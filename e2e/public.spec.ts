/** What a visitor sees: navigation, albums, photos, layout and error pages. */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './support/env';

/** Fails the test on any uncaught error or console error the page reports. */
function watchErrors(page: Page, allow: RegExp[] = []) {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !allow.some((re) => re.test(msg.text())))
      errors.push(`console: ${msg.text()}`);
  });
  return () => expect(errors, 'browser errors').toEqual([]);
}

test('home page leads to the portfolio and an album', async ({ page }) => {
  // The "Broken Files" fixture album is featured and its photo file is missing on purpose.
  const noErrors = watchErrors(page, [/status of 404/]);
  await page.goto('/');
  await expect(page).toHaveTitle('OneSmallPhoto');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Portfolio' })
    .click();
  await expect(page).toHaveURL(/\/portfolio$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Portfolio' })).toBeVisible();
  await page.getByRole('link', { name: new RegExp(seed.public.title) }).click();
  await expect(page).toHaveURL(new RegExp(`/portfolio/${seed.public.slug}$`));
  await expect(page.getByRole('heading', { level: 1, name: seed.public.title })).toBeVisible();
  noErrors();
});

test('the portfolio lists visible albums only, with their photo counts', async ({ page }) => {
  await page.goto('/portfolio');
  const field = page.getByRole('link', { name: new RegExp(seed.public.title) });
  await expect(field).toContainText('3 photos');
  await expect(page.getByRole('link', { name: new RegExp(seed.empty.title) })).toContainText(
    '0 photos',
  );
  await expect(page.getByText(seed.hidden.title)).toHaveCount(0);
});

test('All photos gathers every visible photo from every visible album', async ({ page }) => {
  // The seeded Broken Files album has a photo whose file is gone on purpose.
  const noErrors = watchErrors(page, [/status of 404/]);
  await page.goto('/portfolio');
  await page.getByRole('link', { name: /View all \d+ photos/ }).click();
  await expect(page).toHaveURL(/\/portfolio\/all$/);
  await expect(page.getByRole('heading', { level: 1, name: 'All photos' })).toBeVisible();
  const html = await page.content();
  for (const id of seed.public.photoIds) expect(html).toContain(id);
  expect(html).not.toContain(seed.public.hiddenPhotoId);
  expect(html).not.toContain(seed.hidden.photoId);
  // Past the first few, photos wait until they are scrolled near.
  const lazy = await page
    .locator('[data-gallery-item] img')
    .evaluateAll((els) => els.slice(3).every((el) => el.getAttribute('loading') === 'lazy'));
  expect(lazy).toBe(true);
  await page.locator(`[data-gallery-item][data-album="${seed.public.title}"]`).first().click();
  const viewer = page.getByRole('dialog', { name: 'Photo viewer' });
  await expect(viewer.getByText(`From ${seed.public.title}`)).toBeVisible();
  noErrors();
});

test('an album shows its visible photos at their real shape', async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.goto(`/portfolio/${seed.public.slug}`);
  const items = page.locator('[data-gallery-item]');
  await expect(items).toHaveCount(3);
  // The hidden photo is not in the page at all.
  expect(await page.content()).not.toContain(seed.public.hiddenPhotoId);

  const images = items.locator('img');
  for (let i = 0; i < 3; i++) {
    const img = images.nth(i);
    await img.scrollIntoViewIfNeeded();
    await expect(img).toHaveJSProperty('complete', true);
    const shape = await img.evaluate((el: HTMLImageElement) => ({
      natural: el.naturalWidth / el.naturalHeight,
      declared: Number(el.getAttribute('width')) / Number(el.getAttribute('height')),
      shown: el.getBoundingClientRect().width / el.getBoundingClientRect().height,
      loaded: el.naturalWidth > 0,
    }));
    expect(shape.loaded).toBe(true);
    expect(shape.shown).toBeCloseTo(shape.declared, 1);
    expect(shape.natural).toBeCloseTo(shape.declared, 1);
  }
  noErrors();
});

test('the gallery is one column on a phone and three on a desktop', async ({ page }) => {
  const columns = async () => {
    const lefts = await page
      .locator('[data-gallery-item]')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
    return new Set(lefts).size;
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/portfolio/${seed.public.slug}`);
  expect(await columns()).toBe(1);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload();
  expect(await columns()).toBe(3);
});

test('an album with no photos still opens', async ({ page }) => {
  const noErrors = watchErrors(page);
  const res = await page.goto(`/portfolio/${seed.empty.slug}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: seed.empty.title })).toBeVisible();
  await expect(page.locator('[data-gallery-item]')).toHaveCount(0);
  noErrors();
});

test('a photo whose file is missing keeps its space and its description', async ({ page }) => {
  // The browser logs the failed image load; nothing else may go wrong.
  const noErrors = watchErrors(page, [/404/, /Failed to load resource/]);
  const res = await page.goto(`/portfolio/${seed.broken.slug}`);
  expect(res?.status()).toBe(200);
  const img = page.locator('[data-gallery-item] img');
  await expect(img).toHaveAttribute('alt', 'A photo whose file has gone missing');
  const box = await img.boundingBox();
  expect(box!.height).toBeGreaterThan(50);
  const file = await page.request.get(
    `/img/${seed.broken.photoId}/md.${seed.formats[seed.broken.photoId]}`,
  );
  expect(file.status()).toBe(404);
  noErrors();
});

test('unknown addresses answer 404 with the not-found page', async ({ page, request }) => {
  for (const path of ['/no-such-page', `/portfolio/no-such-album`, '/portfolio/%3Cscript%3E']) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
    await expect(page.getByRole('heading', { name: "This page doesn't exist." })).toBeVisible();
  }
  for (const path of ['/img/not-a-uuid/sm.webp', '/api/nothing-here']) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});

test('hidden albums and photos stay out of public pages, files and the sitemap', async ({
  request,
}) => {
  expect((await request.get(`/portfolio/${seed.hidden.slug}`)).status()).toBe(404);
  for (const id of [seed.hidden.photoId, seed.public.hiddenPhotoId]) {
    for (const size of ['sm', 'md', 'lg']) {
      const res = await request.get(`/img/${id}/${size}.${seed.formats[id]}`);
      expect(res.status(), `${id} ${size}`).toBe(404);
    }
  }
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain(`/portfolio/${seed.public.slug}`);
  expect(sitemap).toContain('/portfolio/all');
  expect(sitemap).not.toContain(seed.hidden.slug);
  const home = await (await request.get('/')).text();
  expect(home).not.toContain(seed.hidden.photoId);
  const all = await (await request.get('/portfolio/all')).text();
  expect(all).not.toContain(seed.hidden.photoId);
  expect(all).not.toContain(seed.public.hiddenPhotoId);
});

test('pages name their canonical address on the real domain', async ({ page }) => {
  await page.goto(`/portfolio/${seed.public.slug}`);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    `https://photo.onesmall.company/portfolio/${seed.public.slug}`,
  );
  const robots = await (await page.request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /admin');
  expect(robots).toContain('Sitemap: https://photo.onesmall.company/sitemap.xml');
});
