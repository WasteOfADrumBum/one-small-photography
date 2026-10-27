import reactRenderer from '@astrojs/react/server.js';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import Footer from '@/components/Footer.astro';
import Nav from '@/components/Nav.astro';
import HomePage from '@/pages/index.astro';
import PortfolioPage from '@/pages/portfolio/index.astro';
import TriadPage from '@/pages/the-triad.astro';
import UnderTheHoodPage from '@/pages/under-the-hood.astro';
import ContactPage from '@/pages/contact.astro';

const render = async (component: Parameters<AstroContainer['renderToString']>[0], path: string) => {
  delete process.env.DATABASE_URL;
  const container = await AstroContainer.create({ astroConfig: { site: 'https://photo.example' } });
  container.addServerRenderer({ name: '@astrojs/react', renderer: reactRenderer });
  return container.renderToString(component, {
    request: new Request(`https://photo.example${path}`),
  });
};

describe('Under the hood', () => {
  it('is linked from the middle of the footer, not the header', async () => {
    expect(await render(Nav, '/')).not.toContain('href="/under-the-hood"');
    const footer = await render(Footer, '/');
    const columns = [...footer.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map((m) => m[0]);
    expect(columns).toHaveLength(3);
    expect(columns[0]).toContain('All rights reserved');
    expect(columns[1]).toMatch(/<a href="\/under-the-hood"[^>]*>\s*Under the hood\s*<\/a>/);
    expect(columns[2]).toContain('Made in the NC Triad');
  });
});

describe('Log in', () => {
  it('is an icon link in the header with a name and a tooltip, not in the footer', async () => {
    const nav = await render(Nav, '/');
    const link = nav.match(/<a href="\/login"[^>]*>/)?.[0];
    expect(link).toBeDefined();
    expect(link).toContain('aria-label="Log in"');
    expect(link).toContain('aria-describedby="login-tip"');
    expect(nav).toMatch(/<span id="login-tip" role="tooltip"[^>]*>Log in<\/span>/);
    expect(await render(Footer, '/')).not.toContain('href="/login"');
  });
});

describe('page titles', () => {
  it.each([
    ['/portfolio', PortfolioPage],
    ['/the-triad', TriadPage],
    ['/under-the-hood', UnderTheHoodPage],
    ['/contact', ContactPage],
  ] as const)('%s has the sunlit title, with the words in their own span', async (path, page) => {
    expect(await render(page, path)).toMatch(
      /<h1 class="title-sunlit[ "][^>]*>\s*<span[^>]*>[^<]+<\/span>\s*<\/h1>/,
    );
  });
});

describe('home page', () => {
  it('signs the "Why One Small Photo" letter and keeps its first word whole', async () => {
    const html = await render(HomePage, '/');
    const letter = html.match(/<div[^>]*class="letter[\s\S]*?<\/div>/)?.[0];
    expect(letter).toBeDefined();
    expect(letter).toMatch(/<p[^>]*>\s*Small is the family name\./);
    expect(letter).toMatch(/<p class="[^"]*text-right[^"]*"[^>]*>Joshua<\/p>\s*<\/div>$/);
  });

  it('keeps the albums heading centered', async () => {
    const html = await render(HomePage, '/');
    const heading = html.match(/<h2[^>]*>\s*Albums\s*<\/h2>/)?.[0];
    expect(heading).toBeDefined();
    expect(heading).toContain('text-center');
  });
});
