/**
 * Guards for things that live outside the app code: the static-page headers in
 * vercel.json and the read-only production smoke checks.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS } from '@/middleware';
import { runSmoke } from '../../scripts/lib/smoke.mjs';

describe('vercel.json', () => {
  it('gives prerendered pages the same security headers as the middleware', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      headers: { source: string; headers: { key: string; value: string }[] }[];
    };
    const all = config.headers.find((h) => h.source === '/(.*)');
    expect(Object.fromEntries(all!.headers.map((h) => [h.key, h.value]))).toEqual(SECURITY_HEADERS);
  });
});

describe('production smoke checks', () => {
  const secure = {
    'x-frame-options': 'DENY',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "frame-ancestors 'none'",
    'referrer-policy': 'strict-origin-when-cross-origin',
  };
  const photo = '/img/0c492119-1fda-4d8e-b04c-c19568abd958/sm.webp';

  /** A pretend site; `broken` swaps in a bad answer for one path. */
  function site(broken: Record<string, Response> = {}) {
    const methods: string[] = [];
    const fetchImpl = async (url: URL, init: RequestInit = {}) => {
      methods.push(init.method ?? 'GET');
      const path = url.pathname;
      if (broken[path]) return broken[path];
      const page = (body: string, status = 200) => new Response(body, { status, headers: secure });
      if (path === '/') return page('<title>OneSmallPhoto</title>');
      if (path === '/portfolio') return page(`<a href="/portfolio/dusty"><img src="${photo}"></a>`);
      if (path === photo)
        return new Response('x', {
          headers: { 'content-type': 'image/webp', 'cache-control': 'public, max-age=86400' },
        });
      if (path === '/contact') return page('hello');
      if (path === '/admin' || path === '/setup')
        return new Response(null, { status: 302, headers: { location: '/login?next=/admin' } });
      if (path === '/api/admin/albums')
        return new Response('', { status: init.method === 'POST' ? 403 : 401 });
      if (path === '/robots.txt') return page('ok');
      if (path === '/sitemap.xml') return page('https://photo.example/');
      return page('nope', 404);
    };
    return { fetchImpl: fetchImpl as unknown as typeof fetch, methods };
  }

  it('passes against a healthy site and only reads, apart from one refused POST', async () => {
    const { fetchImpl, methods } = site();
    const results = await runSmoke('https://photo.example', fetchImpl);
    expect(results.filter((r) => !r.ok)).toEqual([]);
    expect(results).toHaveLength(10);
    expect(methods.filter((m) => m !== 'GET')).toEqual(['POST']);
  });

  it('reports an open admin API, missing headers and a hidden-photo style 404', async () => {
    const { fetchImpl } = site({
      '/api/admin/albums': new Response('[]', { status: 200 }),
      '/contact': new Response('hello'),
      [photo]: new Response('Not found', { status: 404 }),
    });
    const failed = (await runSmoke('https://photo.example', fetchImpl)).filter((r) => !r.ok);
    expect(failed.map((r) => r.name)).toEqual([
      'a published photo is served and cached',
      'static pages carry security headers',
      'admin API refuses visitors',
      'admin API refuses cross-site writes',
    ]);
  });
});

describe('photo storage audit', () => {
  it('finds photos missing files and files with no photo', async () => {
    const { comparePhotoStorage } = await import('../../scripts/lib/photo-audit.mjs');
    const report = comparePhotoStorage(
      [
        { id: 'a', format: 'webp' },
        { id: 'b', format: 'jpg' },
      ],
      [
        'photos/a/sm.webp',
        'photos/a/md.webp',
        'photos/a/lg.webp',
        'photos/b/sm.jpg',
        'photos/z/sm.webp',
      ],
    );
    expect(report).toEqual({
      photos: 2,
      files: 5,
      missing: [{ id: 'b', sizes: ['md', 'lg'] }],
      orphans: ['z'],
    });
  });
});
