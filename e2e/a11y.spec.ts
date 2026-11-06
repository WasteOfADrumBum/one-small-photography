/**
 * Automated accessibility checks (WCAG 2.2 A and AA rules that axe-core can
 * test) on representative pages and their open states, plus behaviour axe
 * cannot see: focus, keyboard use, reduced motion, reflow and larger text.
 *
 * This is automated evidence only. It does not replace a screen-reader pass,
 * a zoom check by eye or a visual review; see docs/ACCESSIBILITY-EVIDENCE.md.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { AUTH_FILE, seed } from './support/env';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoViolations(page: Page, label: string, include?: string) {
  let builder = new AxeBuilder({ page }).withTags(WCAG);
  if (include) builder = builder.include(include);
  const { violations } = await builder.analyze();
  const summary = violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(summary, `axe violations on ${label}`).toEqual([]);
}

/** Scroll-triggered reveals start transparent; show everything before checking contrast. */
async function settle(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1000);
}

const publicPages = () => [
  '/',
  '/portfolio',
  `/portfolio/${seed.public.slug}`,
  `/portfolio/${seed.empty.slug}`,
  '/contact',
  '/the-triad',
  '/under-the-hood',
  '/login',
  '/no-such-page',
];

test('public pages have no detectable WCAG 2.2 AA violations', async ({ page }) => {
  for (const path of publicPages()) {
    await page.goto(path);
    await settle(page);
    await expectNoViolations(page, path);
  }
});

test('every page has one main landmark, a level-one heading and a language', async ({ page }) => {
  for (const path of publicPages()) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('main'), path).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 }), path).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Main' }), path).toBeVisible();
  }
});

test('album links have a name in the browser’s own accessibility tree', async ({
  page,
  browserName,
}) => {
  // axe accepted these links while Chrome gave them no name at all; ask the browser itself.
  test.skip(browserName !== 'chromium', 'reads the tree through the Chrome DevTools protocol');
  for (const path of ['/', '/portfolio']) {
    await page.goto(path);
    const cdp = await page.context().newCDPSession(page);
    const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as {
      nodes: { role?: { value: string }; name?: { value: string }; ignored: boolean }[];
    };
    const names = nodes
      .filter((n) => n.role?.value === 'link' && !n.ignored)
      .map((n) => n.name?.value ?? '');
    expect(
      names.filter((n) => !n.trim()),
      `unnamed links on ${path}`,
    ).toEqual([]);
    expect(
      names.some((n) => n.includes(seed.public.title)),
      path,
    ).toBe(true);
  }
});

test('every picture has a text alternative', async ({ page }) => {
  for (const path of ['/', '/portfolio', `/portfolio/${seed.public.slug}`]) {
    await page.goto(path);
    const missing = await page.locator('img:not([alt])').count();
    expect(missing, path).toBe(0);
  }
  await page.goto(`/portfolio/${seed.public.slug}`);
  for (const alt of await page
    .locator('[data-gallery-item] img')
    .evaluateAll((els) => els.map((e) => e.getAttribute('alt'))))
    expect(alt?.trim().length).toBeGreaterThan(3);
});

test('the open photo viewer passes axe and announces the photo', async ({ page }) => {
  await page.goto(`/portfolio/${seed.public.slug}`);
  await page.locator('[data-gallery-item]').first().click();
  await expect(page.getByRole('dialog', { name: 'Photo viewer' })).toBeVisible();
  await expect(page.locator('[data-position]')).toHaveAttribute('aria-live', 'polite');
  await expectNoViolations(page, 'open photo viewer', '[data-lightbox]');
});

test('the phone menu opens, passes axe, and Escape returns focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const toggle = page.locator('[data-site-menu-toggle]');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Contact' }),
  ).toBeVisible();
  await expectNoViolations(page, 'open phone menu', 'header');
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
});

test('form errors are announced and pass axe', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('someone@e2e.test');
  await page.getByLabel('Password').fill('definitely wrong');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expectNoViolations(page, 'login error');

  await page.goto('/contact');
  const send = page.getByRole('button', { name: 'Send' });
  await send.scrollIntoViewIfNeeded();
  await expect(send).toBeEnabled();
  await page.getByLabel('Your name').fill('Ada');
  await page.getByLabel('Email, so I can write back').fill('ada@nowhere');
  await page.getByLabel('Message').fill('Hello');
  await send.click();
  await expect(page.getByRole('alert')).toBeVisible();
  await settle(page);
  await expectNoViolations(page, 'contact error');
});

test('keyboard focus is always visible on links and buttons', async ({ page }) => {
  await page.goto(`/portfolio/${seed.public.slug}`);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const style = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      return {
        tag: `${el.tagName} ${el.textContent?.trim().slice(0, 30) ?? ''}`,
        outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0,
        ring: s.boxShadow !== 'none',
      };
    });
    if (!style) continue;
    expect(style.outline || style.ring, `no visible focus on ${style.tag}`).toBe(true);
  }
});

test('with reduced motion, content shows at once without animation', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/portfolio');
  const opacities = await page
    .locator('[data-reveal]')
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity));
  expect(opacities.length).toBeGreaterThan(0);
  expect(new Set(opacities)).toEqual(new Set(['1']));
  await context.close();
});

test('pages reflow at 320 CSS pixels without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of [...publicPages(), '/setup']) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test('text at twice the size still fits without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const path of publicPages()) {
    await page.goto(path);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test('the log-in icon explains itself on keyboard focus, not only on hover', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Log in' }).focus();
  await expect(page.locator('#login-tip')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#login-tip')).toBeHidden();
});

test.describe('admin', () => {
  test.use({ storageState: AUTH_FILE });

  test('admin pages pass axe, including the upload card and the save notice', async ({ page }) => {
    await page.goto('/admin');
    await expectNoViolations(page, '/admin albums tab');
    for (const tab of ['Gear', 'Messages']) {
      await page.getByRole('tab', { name: tab }).click();
      await expectNoViolations(page, `/admin ${tab} tab`);
    }
    await page.goto(`/admin/albums/${seed.public.id}`);
    await expectNoViolations(page, 'album editor');
    await page.locator('li[id^=photo-]').first().getByLabel('Title').fill('Wide field');
    await page.getByRole('button', { name: /Move Wide field later/ }).click();
    await expect(page.getByRole('status').filter({ hasText: /saved/i })).toBeVisible();
    await expectNoViolations(page, 'album editor with save notice');
    await page.getByRole('button', { name: /Move Wide field earlier/ }).click();
    await expect(page.getByRole('status').filter({ hasText: /saved/i })).toBeVisible();
  });

  test('the admin reflows at 320 CSS pixels', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const path of ['/admin', `/admin/albums/${seed.public.id}`]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});
