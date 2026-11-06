/**
 * Stable performance guards for a photo site: which image size each screen
 * downloads, layout shift caused by photos, and how much script and style a
 * page ships. Byte counts are of the uncompressed files, so they don't move
 * with the network; the budgets have headroom and live in e2e/budgets.json.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { seed } from './support/env';

const budgets = JSON.parse(readFileSync('e2e/budgets.json', 'utf8')) as {
  $comment?: string;
  pages: Record<string, { js: number; css: number }>;
  maxLayoutShift: number;
};

/** Records every same-origin script, style and photo the page downloads. */
function recordAssets(page: Page) {
  const assets: { url: string; type: string; bytes: number }[] = [];
  page.on('response', async (res) => {
    const type = res.request().resourceType();
    if (!['script', 'stylesheet', 'image'].includes(type)) return;
    const body = await res.body().catch(() => Buffer.alloc(0));
    assets.push({ url: new URL(res.url()).pathname, type, bytes: body.length });
  });
  return assets;
}

const sum = (list: { bytes: number }[]) => list.reduce((n, a) => n + a.bytes, 0);

test('each page stays within its script and style budget', async ({ page }) => {
  const measured: Record<string, { js: number; css: number }> = {};
  for (const [key, budget] of Object.entries(budgets.pages)) {
    const path = key.replace('{album}', seed.public.slug);
    const assets = recordAssets(page);
    await page.goto(path, { waitUntil: 'networkidle' });
    const js = sum(assets.filter((a) => a.type === 'script'));
    const css = sum(assets.filter((a) => a.type === 'stylesheet'));
    measured[key] = { js, css };
    expect(js, `${path} JavaScript bytes`).toBeLessThanOrEqual(budget.js);
    expect(css, `${path} CSS bytes`).toBeLessThanOrEqual(budget.css);
    page.removeAllListeners('response');
  }
  test.info().annotations.push({ type: 'measured', description: JSON.stringify(measured) });
});

test('phones download small photos, not the full-size ones', async ({ browser }) => {
  for (const { width, dpr, allowed } of [
    { width: 390, dpr: 1, allowed: ['sm'] },
    { width: 390, dpr: 2, allowed: ['sm', 'md'] },
    { width: 1280, dpr: 1, allowed: ['sm', 'md'] },
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: dpr,
    });
    const page = await context.newPage();
    const assets = recordAssets(page);
    await page.goto(`/portfolio/${seed.public.slug}`, { waitUntil: 'networkidle' });
    const sizes = assets
      .filter((a) => a.url.startsWith('/img/'))
      .map((a) => /\/(sm|md|lg)\./.exec(a.url)?.[1]);
    expect(sizes.length, `${width}px @${dpr}x`).toBeGreaterThan(0);
    for (const size of sizes) expect(allowed, `${width}px @${dpr}x got ${size}`).toContain(size);
    await context.close();
  }
});

test('photos do not shift the layout as they load', async ({ page }) => {
  for (const path of ['/', '/portfolio', `/portfolio/${seed.public.slug}`]) {
    // Slow every photo down so the page lays out before any of them arrive.
    await page.route('**/img/**', async (route) => {
      await new Promise((r) => setTimeout(r, 300));
      await route.continue();
    });
    await page.goto(path);
    await page.evaluate(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        })[])
          if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(cls, `layout shift on ${path}`).toBeLessThanOrEqual(budgets.maxLayoutShift);
    await page.unroute('**/img/**');
  }
});

test('every gallery photo declares its size before it loads', async ({ page }) => {
  await page.goto(`/portfolio/${seed.public.slug}`);
  const missing = await page
    .locator('[data-gallery-item] img')
    .evaluateAll(
      (els) => els.filter((el) => !el.getAttribute('width') || !el.getAttribute('height')).length,
    );
  expect(missing).toBe(0);
});
