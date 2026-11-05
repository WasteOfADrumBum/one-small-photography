/**
 * Security behaviour that only shows with a real browser, server and cookies.
 * Lower-level cases (XSS escaping, upload sniffing, rate limits, EXIF fields)
 * are covered in src/test; these prove them through the running site.
 */
import exifr from 'exifr';
import { expect, test } from '@playwright/test';
import { AUTH_FILE, E2E, query, seed } from './support/env';
import { adminApi } from './support/images';
import { JPEG_WITH_GPS } from '../src/test/fixtures/images';

test('the session cookie is HttpOnly, SameSite=Lax and Secure', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E.adminEmail);
  await page.getByLabel('Password').fill(E2E.adminPassword);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const cookie = (await page.context().cookies()).find((c) => c.name === 'osp_session')!;
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', secure: true, path: '/' });
  expect(await page.evaluate(() => document.cookie)).not.toContain('osp_session');
});

test('the one-time setup page is closed once the account exists', async ({ request }) => {
  const res = await request.get('/setup', { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  expect(res.headers()['location']).toBe('/login');
});

test('the login only forwards to admin pages', async ({ page }) => {
  for (const next of ['https://evil.example/', '//evil.example', 'javascript:alert(1)']) {
    await page.goto(`/login?next=${encodeURIComponent(next)}`);
    await page.getByLabel('Email').fill(E2E.adminEmail);
    await page.getByLabel('Password').fill(E2E.adminPassword);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/admin$/);
    await page.context().clearCookies();
  }
});

test.describe('signed in', () => {
  test.use({ storageState: AUTH_FILE });

  test('writes from another site are refused, even with a valid session', async ({ request }) => {
    const res = await request.post('/api/admin/albums', {
      headers: { origin: 'https://evil.example' },
      data: { title: 'Cross-site' },
    });
    expect(res.status()).toBe(403);
    const logout = await request.post('/api/auth/logout', {
      headers: { origin: 'https://evil.example' },
    });
    expect(logout.status()).toBe(403);
    expect(await query("select id from albums where title = 'Cross-site'")).toHaveLength(0);
  });

  test('hidden photos are private to the admin and never cacheable', async ({
    request,
    browser,
  }) => {
    const id = seed.hidden.photoId;
    const url = `/img/${id}/sm.${seed.formats[id]}`;
    const mine = await request.get(url);
    expect(mine.status()).toBe(200);
    expect(mine.headers()['cache-control']).toBe('private, no-store');
    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const theirs = await visitor.request.get(url);
    expect(theirs.status()).toBe(404);
    expect(theirs.headers()['cache-control'] ?? '').not.toContain('public');
    await visitor.close();
    const published = await request.get(
      `/img/${seed.public.photoIds[0]}/sm.${seed.formats[seed.public.photoIds[0]!]}`,
    );
    expect(published.headers()['cache-control']).toContain('public');
  });

  test('admin pages are never cached; public pages are revalidated', async ({ request }) => {
    const admin = await request.get('/admin');
    expect(admin.headers()['cache-control']).toBe('private, no-store');
    const album = await request.get(`/portfolio/${seed.public.slug}`);
    expect(album.headers()['cache-control']).toContain('no-store');
    for (const res of [admin, album]) {
      expect(res.headers()['x-frame-options']).toBe('DENY');
      expect(res.headers()['x-content-type-options']).toBe('nosniff');
      expect(res.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
    }
  });

  test('album text with markup shows as text and never runs', async ({ page, browser }) => {
    await page.goto('/admin');
    const album = await adminApi<{ id: string; slug: string }>(page, '/api/admin/albums', 'POST', {
      title: '<img src=x onerror="window.__xss=1">',
      description: '<script>window.__xss=2</script>',
    });
    await adminApi(page, `/api/admin/albums/${album.id}`, 'PATCH', { published: true });
    try {
      const visitor = await browser.newPage({ storageState: { cookies: [], origins: [] } });
      await visitor.goto(`/portfolio/${album.slug}`);
      await expect(visitor.getByRole('heading', { level: 1 })).toHaveText(
        '<img src=x onerror="window.__xss=1">',
      );
      await expect(visitor.getByText('<script>window.__xss=2</script>')).toBeVisible();
      expect(
        await visitor.evaluate(() => (window as unknown as { __xss?: number }).__xss),
      ).toBeUndefined();
      await visitor.goto('/portfolio');
      expect(
        await visitor.evaluate(() => (window as unknown as { __xss?: number }).__xss),
      ).toBeUndefined();
      await visitor.close();
    } finally {
      await adminApi(page, `/api/admin/albums/${album.id}`, 'DELETE');
    }
  });

  test('photo addresses cannot climb out of the photo folder', async ({ request }) => {
    for (const path of [
      '/img/..%2F..%2F..%2Fetc%2Fpasswd/sm.webp',
      `/img/${seed.public.photoIds[0]}/..%2F..%2Fpackage.json`,
      `/img/${seed.public.photoIds[0]}/sm.webp%00.json`,
    ]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  });

  test('a GPS position in an uploaded file is not in what visitors download', async ({
    page,
    request,
    baseURL,
  }) => {
    expect((await exifr.gps(Buffer.from(JPEG_WITH_GPS)))?.latitude).toBeGreaterThan(36);
    // Straight to the API, skipping the browser resize that would drop it anyway.
    const file = { name: 'gps.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(JPEG_WITH_GPS) };
    const res = await request.post(`/api/admin/albums/${seed.hidden.id}/photos`, {
      headers: { origin: baseURL! },
      multipart: { title: 'Located', width: '24', height: '16', sm: file, md: file, lg: file },
    });
    expect(res.status()).toBe(201);
    const { id } = (await res.json()) as { id: string };
    try {
      const served = Buffer.from(await (await request.get(`/img/${id}/lg.jpg`)).body());
      expect(await exifr.gps(served).catch(() => undefined)).toBeUndefined();
      expect(served.includes(Buffer.from('SyntheticCam'))).toBe(false);
      // The copyright notice is added on the way out.
      expect(served.includes(Buffer.from('xmpRights'))).toBe(true);
    } finally {
      await page.goto('/admin');
      await adminApi(page, `/api/admin/photos/${id}`, 'DELETE');
    }
  });
});
