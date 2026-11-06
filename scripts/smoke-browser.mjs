// Read-only browser pass over the live site: the home page, the portfolio, one
// album and its photo viewer, failing on any script error or console error.
// Signs in nowhere and submits nothing.
//
//   node scripts/smoke-browser.mjs [https://photo.onesmall.company]
import { chromium } from 'playwright';
import { DEFAULT_SITE } from './lib/smoke.mjs';

const base = process.argv[2] ?? process.env.SITE_URL ?? DEFAULT_SITE;
const browser = await chromium.launch();
const page = await browser.newPage({ userAgent: 'osp-smoke-browser' });
const errors = [];
page.on('pageerror', (err) => errors.push(`${page.url()}: ${err.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`${page.url()}: console: ${msg.text()}`);
});

const steps = [];
try {
  for (const path of ['/', '/portfolio']) {
    const res = await page.goto(new URL(path, base).href, { waitUntil: 'networkidle' });
    steps.push(`${path} ${res?.status()}`);
  }
  const album = await page.locator('a[href^="/portfolio/"]').first().getAttribute('href');
  if (!album) throw new Error('no album link on /portfolio');
  await page.goto(new URL(album, base).href, { waitUntil: 'networkidle' });
  steps.push(`${album} loaded`);
  const first = page.locator('[data-gallery-item]').first();
  await first.click();
  await page
    .getByRole('dialog', { name: 'Photo viewer' })
    .waitFor({ state: 'visible', timeout: 10_000 });
  await page.keyboard.press('Escape');
  steps.push('photo viewer opens and closes');
} catch (err) {
  errors.push(`step failed: ${err.message}`);
} finally {
  await browser.close();
}
for (const step of steps) console.log(`PASS  ${step}`);
for (const e of errors) console.log(`FAIL  ${e}`);
if (errors.length) process.exitCode = 1;
else console.log(`\nBrowser smoke passed against ${base}`);
