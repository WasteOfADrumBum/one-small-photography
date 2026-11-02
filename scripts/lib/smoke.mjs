// Read-only checks against a running site (production by default). Used by
// scripts/smoke.mjs and the "Production smoke" workflow. Nothing here signs in
// or changes data: the one POST is refused by the cross-site check before any
// handler runs.

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

/** Runs every check and returns [{ name, ok, detail }]. Never throws. */
export async function runSmoke(base = DEFAULT_SITE, fetchImpl = fetch) {
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

  let portfolioHtml = '';
  await check('home page loads', async () => {
    const res = await get('/');
    expectStatus(res, 200);
    if (!(await res.text()).includes('OneSmallPhoto')) throw new Error('site name missing');
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
  await check('robots.txt and sitemap.xml are served', async () => {
    expectStatus(await get('/robots.txt'), 200);
    const sitemap = await get('/sitemap.xml');
    expectStatus(sitemap, 200);
    if (!(await sitemap.text()).includes(new URL(base).host))
      throw new Error('sitemap host mismatch');
  });
  return results;
}
