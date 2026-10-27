import reactRenderer from '@astrojs/react/server.js';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import Nav from '@/components/Nav.astro';
import ContactPage from '@/pages/contact.astro';
import { nav } from '@/lib/site';

const render = async (component: Parameters<AstroContainer['renderToString']>[0], path: string) => {
  const container = await AstroContainer.create({ astroConfig: { site: 'https://photo.example' } });
  container.addServerRenderer({ name: '@astrojs/react', renderer: reactRenderer });
  return container.renderToString(component, {
    request: new Request(`https://photo.example${path}`),
  });
};

describe('header menu', () => {
  it('has a named menu button that controls the list of every nav link', async () => {
    const html = await render(Nav, '/the-triad');
    const button = html.match(/<button[^>]*data-site-menu-toggle[^>]*>[\s\S]*?<\/button>/)?.[0];
    expect(button).toBeDefined();
    expect(button).toContain('type="button"');
    expect(button).toContain('aria-expanded="false"');
    expect(button).toContain('aria-controls="site-menu"');
    expect(button).toMatch(/<span class="sr-only"[^>]*>Menu<\/span>/);
    expect(html).toMatch(/<ul[^>]*id="site-menu"/);
    for (const item of nav) expect(html).toContain(`href="${item.href}"`);
    expect(html).toMatch(/href="\/the-triad"[^>]*aria-current="page"/);
  });
});

describe('contact page', () => {
  it('keeps the banner for wider screens and gives phones a blank pixel instead', async () => {
    delete process.env.DATABASE_URL;
    const html = await render(ContactPage, '/contact');
    const banner = html.match(/<figure[^>]*data-contact-banner[\s\S]*?<\/figure>/)?.[0];
    expect(banner).toBeDefined();
    expect(banner).toContain('class="hidden sm:block"');
    expect(banner).toMatch(/<source media="\(max-width: 39.999rem\)" srcset="data:image\/gif/);
    expect(banner).toContain('alt="Five studio portraits');
  });
});
