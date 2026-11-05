/** The full-screen photo viewer, by mouse and by keyboard alone. */
import { expect, test } from '@playwright/test';
import { seed } from './support/env';

test.beforeEach(async ({ page }) => {
  await page.goto(`/portfolio/${seed.public.slug}`);
});

const viewer = (page: import('@playwright/test').Page) =>
  page.getByRole('dialog', { name: 'Photo viewer' });

test('opens on the photo clicked, steps through the album and closes', async ({ page }) => {
  const first = page.locator('[data-gallery-item]').first();
  await first.click();
  const dialog = viewer(page);
  await expect(dialog).toBeVisible();
  const image = dialog.locator('[data-image]');
  await expect(image).toHaveAttribute('src', new RegExp(`/img/${seed.public.photoIds[0]}/lg\\.`));
  await expect(image).toHaveAttribute('alt', 'A wide gradient from green to gold');
  await expect(dialog.getByText('Photo 1 of 3')).toBeAttached();
  await expect
    .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(1000);

  await dialog.getByRole('button', { name: 'Next photo' }).click();
  await expect(dialog.getByText('Photo 2 of 3')).toBeAttached();
  await expect(dialog.getByText('Tall field')).toBeVisible();
  await dialog.getByRole('button', { name: 'Previous photo' }).click();
  await dialog.getByRole('button', { name: 'Previous photo' }).click();
  await expect(dialog.getByText('Photo 3 of 3')).toBeAttached(); // wraps around

  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  // Focus goes back to the photo that was showing when the viewer closed.
  await expect(page.locator('[data-gallery-item]').nth(2)).toBeFocused();
});

test('works with the keyboard alone, keeps focus inside and returns it', async ({ page }) => {
  // Skip link first, then on through the page to the first photo.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  const first = page.locator('[data-gallery-item]').first();
  for (let i = 0; i < 20 && !(await first.evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press('Tab');
  await expect(first).toBeFocused();

  await page.keyboard.press('Enter');
  const dialog = viewer(page);
  await expect(dialog).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByText('Photo 2 of 3')).toBeAttached();
  await page.keyboard.press('ArrowLeft');
  await expect(dialog.getByText('Photo 1 of 3')).toBeAttached();

  // A modal dialog: Tab never reaches the page behind it.
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    const outside = await page.evaluate(() => {
      const active = document.activeElement;
      const dialogEl = document.querySelector('[data-lightbox]');
      return Boolean(active && active !== document.body && !dialogEl?.contains(active));
    });
    expect(outside, `focus left the viewer after ${i + 1} tabs`).toBe(false);
  }

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(first).toBeFocused();
});

test('controls stay usable without hover, at phone size and by touch', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await page.goto(`/portfolio/${seed.public.slug}`);
  await page.locator('[data-gallery-item]').first().tap();
  const dialog = viewer(page);
  await expect(dialog).toBeVisible();
  for (const name of ['Previous photo', 'Next photo', 'Close']) {
    const box = await dialog.getByRole('button', { name }).boundingBox();
    // WCAG 2.2 target size: at least 24 by 24 CSS pixels.
    expect(box!.width, name).toBeGreaterThanOrEqual(24);
    expect(box!.height, name).toBeGreaterThanOrEqual(24);
  }
  await dialog.getByRole('button', { name: 'Next photo' }).tap();
  await expect(dialog.getByText('Photo 2 of 3')).toBeAttached();
  await dialog.getByRole('button', { name: 'Close' }).tap();
  await expect(dialog).toBeHidden();
  await context.close();
});
