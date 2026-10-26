import type { APIRoute } from 'astro';
import { hasDatabase } from '@/db/client';
import { listPublishedAlbums } from '@/lib/albums';
import { nav } from '@/lib/site';

export const prerender = false;

const escapeXml = (value: string) => value.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Every public page, including each visible album, for search engines. */
export const GET: APIRoute = async ({ site }) => {
  const paths: string[] = ['/', ...nav.map((item) => item.href)];
  if (hasDatabase()) {
    try {
      for (const album of await listPublishedAlbums()) paths.push(`/portfolio/${album.slug}`);
    } catch (err) {
      console.error('Could not list albums for the sitemap', err);
    }
  }
  const urls = paths.map(
    (path) => `  <url><loc>${escapeXml(new URL(path, site).href)}</loc></url>`,
  );
  return new Response(
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls,
      '</urlset>',
      '',
    ].join('\n'),
    {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600',
      },
    },
  );
};
