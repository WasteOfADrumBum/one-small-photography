import { describe, expect, it } from 'vitest';
import { footerNav, nav } from '@/lib/site';
import { GET as robots } from '@/pages/robots.txt';
import { GET as sitemap } from '@/pages/sitemap.xml';

const site = new URL('https://photo.example');
const call = (handler: typeof robots) => Promise.resolve(handler({ site } as never));

describe('robots.txt', () => {
  it('keeps the admin and account pages out and points at the sitemap', async () => {
    const text = await (await call(robots)).text();
    for (const path of ['/admin', '/api/', '/login', '/setup'])
      expect(text).toContain(`Disallow: ${path}`);
    expect(text).toContain('Sitemap: https://photo.example/sitemap.xml');
  });
});

describe('sitemap.xml', () => {
  it('lists the home page and every page in the menu', async () => {
    delete process.env.DATABASE_URL;
    const res = await call(sitemap);
    expect(res.headers.get('Content-Type')).toContain('application/xml');
    const xml = await res.text();
    expect(xml).toContain('<loc>https://photo.example/</loc>');
    for (const item of [...nav, ...footerNav])
      expect(xml).toContain(`<loc>https://photo.example${item.href}</loc>`);
  });
});
