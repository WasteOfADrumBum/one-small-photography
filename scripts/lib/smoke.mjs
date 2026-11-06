// Read-only checks against a running site (production by default). Used by
// scripts/smoke.mjs and the "Production smoke" workflow. Nothing here signs in
// or changes data. Two POSTs: one is refused by the cross-site check before any
// handler runs, the other is an empty contact form that fails validation before
// anything is saved, rate-limited or emailed.

export const DEFAULT_SITE = 'https://photo.onesmall.company';

const SECURITY_HEADERS = {
  'x-frame-options': (v) => v === 'DENY',
  'x-content-type-options': (v) => v === 'nosniff',
  'content-security-policy': (v) => /frame-ancestors 'none'/.test(v ?? ''),
  'referrer-policy': (v) => v === 'strict-origin-when-cross-origin',
};

function headerProblems(res) {
  return Object.entries(SECURITY_HEADERS)
    .filter(([name, ok]) => !ok(res.headers.get(name)))
    .map(([name]) => `${name}=${res.headers.get(name) ?? 'missing'}`);
}

/**
 * Runs every check and returns [{ name, ok, detail }]. Never throws.
 *
 * Options: `expectedCommit` (the live site must be built from it), and
 * `hiddenPaths` (addresses of known hidden albums or photos that must answer 404).
 */
export async function runSmoke(base = DEFAULT_SITE, fetchImpl = fetch, options = {}) {
  const { expectedCommit, hiddenPaths = [] } = options;
  const results = [];
  const get = (path, init = {}) =>
    fetchImpl(new URL(path, base), {
      redirect: 'manual',
      ...init,
      headers: { 'user-agent': 'osp-smoke', ...init.headers },
    });
  const check = async (name, fn) => {
    try {
      const detail = await fn();
      results.push({ name, ok: true, detail: detail ?? '' });
    } catch (err) {
      results.push({ name, ok: false, detail: err.message });
    }
  };
  const expectStatus = (res, ...codes) => {
    if (!codes.includes(res.status))
      throw new Error(`HTTP ${res.status}, expected ${codes.join(' or ')}`);
  };

  const canonicalOf = (html) => /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];

  if (expectedCommit) {
    await check('the live site is the expected build', async () => {
      const res = await get('/version.json');
      expectStatus(res, 200);
      const { commit } = await res.json();
      if (commit !== expectedCommit)
        throw new Error(`live commit ${commit}, expected ${expectedCommit}`);
      return commit.slice(0, 7);
    });
  }

  let portfolioHtml = '';
  await check('home page loads, with its canonical address', async () => {
    const res = await get('/');
    expectStatus(res, 200);
    const html = await res.text();
    if (!html.includes('OneSmallPhoto')) throw new Error('site name missing');
    const canonical = canonicalOf(html);
    if (canonical !== new URL('/', DEFAULT_SITE).href) throw new Error(`canonical ${canonical}`);
  });
  await check('portfolio lists albums, with security headers', async () => {
    const res = await get('/portfolio');
    expectStatus(res, 200);
    portfolioHtml = await res.text();
    const problems = headerProblems(res);
    if (problems.length) throw new Error(problems.join(', '));
    const albums = new Set(portfolioHtml.match(/href="\/portfolio\/[^"]+"/g) ?? []).size;
    if (albums === 0) throw new Error('no album links');
    return `${albums} albums`;
  });
  await check('a public album opens, uncached, with its photos', async () => {
    const href = portfolioHtml.match(/href="(\/portfolio\/[^"]+)"/)?.[1];
    if (!href) throw new Error('no album link on /portfolio');
    const res = await get(href);
    expectStatus(res, 200);
    const html = await res.text();
    if (!html.includes('data-gallery-item')) throw new Error('no photos on the album page');
    if (!(res.headers.get('cache-control') ?? '').includes('no-store'))
      throw new Error(`cache-control ${res.headers.get('cache-control')}`);
    const canonical = canonicalOf(html);
    if (canonical !== new URL(href, DEFAULT_SITE).href) throw new Error(`canonical ${canonical}`);
    return href;
  });
  await check('a published photo is served and cached', async () => {
    const src = portfolioHtml.match(/\/img\/[0-9a-f-]{36}\/(?:sm|md|lg)\.(?:webp|jpg)/)?.[0];
    if (!src) throw new Error('no photo found on /portfolio');
    const res = await get(src);
    expectStatus(res, 200);
    const type = res.headers.get('content-type') ?? '';
    const cache = res.headers.get('cache-control') ?? '';
    await res.arrayBuffer();
    if (!type.startsWith('image/')) throw new Error(`content-type ${type}`);
    if (!cache.includes('public')) throw new Error(`cache-control ${cache}`);
    return src;
  });
  await check('static pages carry security headers', async () => {
    const res = await get('/contact');
    expectStatus(res, 200);
    await res.text();
    const problems = headerProblems(res);
    if (problems.length) throw new Error(problems.join(', '));
  });
  await check('admin pages send visitors to the login', async () => {
    const res = await get('/admin');
    expectStatus(res, 302, 303, 307);
    if (!(res.headers.get('location') ?? '').includes('/login'))
      throw new Error('not redirected to /login');
  });
  await check('admin API refuses visitors', async () => {
    expectStatus(await get('/api/admin/albums'), 401);
  });
  await check('admin API refuses cross-site writes', async () => {
    const res = await get('/api/admin/albums', {
      method: 'POST',
      headers: { origin: 'https://example.invalid', 'content-type': 'application/json' },
      body: '{}',
    });
    expectStatus(res, 403);
  });
  await check('setup page is closed once the account exists', async () => {
    const res = await get('/setup');
    expectStatus(res, 302, 303, 307);
  });
  await check('unknown pages answer 404', async () => {
    expectStatus(await get('/portfolio/this-album-does-not-exist'), 404);
  });
  await check('unknown and known-hidden addresses answer 404, never publicly cached', async () => {
    // Hidden paths are named by number only: the log of this public repo is public.
    const paths = ['/img/00000000-0000-4000-8000-000000000000/sm.webp', ...hiddenPaths];
    for (const [i, path] of paths.entries()) {
      const label = i === 0 ? 'an unknown photo' : `hidden address #${i}`;
      const res = await get(path);
      await res.arrayBuffer();
      if (res.status !== 404) throw new Error(`${label}: HTTP ${res.status}, expected 404`);
      if ((res.headers.get('cache-control') ?? '').includes('public'))
        throw new Error(`${label} is publicly cacheable`);
    }
    return hiddenPaths.length
      ? `${hiddenPaths.length} known hidden addresses`
      : 'no hidden fixtures set';
  });
  await check('the contact form validates without saving or sending anything', async () => {
    // An empty note fails validation before the database or email is touched.
    const res = await get('/api/contact', {
      method: 'POST',
      headers: { origin: new URL(base).origin, 'content-type': 'application/json' },
      body: '{}',
    });
    expectStatus(res, 400);
    const body = await res.json().catch(() => ({}));
    if (!body.error) throw new Error('no validation message');
  });
  await check('robots.txt and sitemap.xml are served', async () => {
    expectStatus(await get('/robots.txt'), 200);
    const sitemap = await get('/sitemap.xml');
    expectStatus(sitemap, 200);
    if (!(await sitemap.text()).includes(new URL(base).host))
      throw new Error('sitemap host mismatch');
  });
  return results;
}
