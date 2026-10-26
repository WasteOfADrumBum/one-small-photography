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
  it('is linked from the footer, not the header', async () => {
    expect(await render(Nav, '/')).not.toContain('href="/under-the-hood"');
    expect(await render(Footer, '/')).toMatch(
      /<a href="\/under-the-hood"[^>]*>\s*Under the hood\s*<\/a>/,
    );
  });
});

describe('page titles', () => {
  it.each([
    ['/portfolio', PortfolioPage],
    ['/the-triad', TriadPage],
    ['/under-the-hood', UnderTheHoodPage],
    ['/contact', ContactPage],
  ] as const)('%s has the sunlit title', async (path, page) => {
    expect(await render(page, path)).toMatch(/<h1 class="title-sunlit[ "]/);
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

  it('left-aligns the albums heading like the rest of the page', async () => {
    const html = await render(HomePage, '/');
    const heading = html.match(/<h2[^>]*>\s*Albums\s*<\/h2>/)?.[0];
    expect(heading).toBeDefined();
    expect(heading).not.toContain('text-center');
  });
});
