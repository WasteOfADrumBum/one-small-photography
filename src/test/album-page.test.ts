import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import AlbumPage from '@/pages/portfolio/[slug].astro';

describe('album page', () => {
  it('answers 404 with the not-found message when the album does not exist', async () => {
    // With no database configured, every slug is missing.
    delete process.env.DATABASE_URL;
    const container = await AstroContainer.create({
      astroConfig: { site: 'https://photo.example' },
    });
    const res = await container.renderToResponse(AlbumPage, { params: { slug: 'no-such-album' } });
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain("This page doesn't exist.");
    expect(html).toContain('noindex');
  });
});
