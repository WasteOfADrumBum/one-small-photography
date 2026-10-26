import type { APIRoute } from 'astro';

/** Lets search engines in, except for the admin and account pages. */
export const GET: APIRoute = ({ site }) =>
  new Response(
    [
      'User-agent: *',
      'Disallow: /admin',
      'Disallow: /api/',
      'Disallow: /login',
      'Disallow: /setup',
      '',
      `Sitemap: ${new URL('/sitemap.xml', site).href}`,
      '',
    ].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
