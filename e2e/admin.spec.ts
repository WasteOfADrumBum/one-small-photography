/**
 * The admin journey through the real UI, server, database and photo folder,
 * with a synthetic account and synthetic pictures, plus the ways it can fail.
 * Runs in order: the journey builds on its own album.
 */
import { renameSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { hashPassword } from '../scripts/lib/admin-password.mjs';
import { AUTH_FILE, E2E, query, seed } from './support/env';
import { syntheticImage } from './support/images';

test.describe.configure({ mode: 'serial' });

async function signIn(page: Page, email = E2E.adminEmail, password = E2E.adminPassword) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

async function addUser(email: string, password: string) {
  await query('insert into users (email, password_hash) values ($1, $2)', [
    email,
    await hashPassword(password),
  ]);
}

const toast = (page: Page) => page.locator('[role=status], [role=alert]').filter({ hasText: /./ });

async function chooseFiles(
  page: Page,
  files: { name: string; mimeType: string; buffer: Buffer }[],
) {
  await page.locator('input[type=file]').setInputFiles(files);
}

async function anonymous(browser: Browser) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  return { context, page: await context.newPage() };
}

test.describe('the admin journey', () => {
  const title = `Journey ${Date.now()}`;
  let albumUrl = '';
  let albumId = '';
  let slug = '';

  test('sign in, create an album, upload, edit, reorder, publish, hide, delete, sign out', async ({
    page,
    browser,
  }) => {
    // 1. Sign in.
    await signIn(page);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('tab', { name: 'Albums' })).toBeVisible();

    // 2. Create an album (it starts hidden).
    await page.getByLabel('Name').fill(title);
    await page.getByRole('button', { name: 'Create album' }).click();
    await expect(page).toHaveURL(/\/admin\/albums\/[0-9a-f-]{36}$/);
    albumUrl = page.url();
    albumId = albumUrl.split('/').pop()!;

    // 3. Upload two synthetic photos through the real file picker; the page resizes them.
    const wide = await syntheticImage(page, { width: 3000, height: 2000, seed: 11 });
    const tall = await syntheticImage(page, { width: 1500, height: 2250, seed: 12 });
    await chooseFiles(page, [
      { name: 'first-shot.jpg', mimeType: 'image/jpeg', buffer: wide },
      { name: 'second-shot.jpg', mimeType: 'image/jpeg', buffer: tall },
    ]);
    await expect(page.getByText(/first-shot\.jpg · ready/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/second-shot\.jpg · ready/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Upload 2 photos' }).click();
    const cards = page.locator('li[id^=photo-]');
    await expect(cards).toHaveCount(2, { timeout: 20_000 });
    const rows = await query<{ id: string; title: string; width: number; height: number }>(
      'select id, title, width, height from photos where album_id = $1 order by sort_order',
      [albumId],
    );
    expect(rows.map((r) => r.title)).toEqual(['first shot', 'second shot']);
    // Resized in the browser to 2400 px on the long edge, shape kept.
    expect(rows[0]).toMatchObject({ width: 2400, height: 1600 });
    for (const row of rows)
      for (const size of ['sm', 'md', 'lg'])
        expect(existsSync(join(E2E.storageDir, 'photos', row.id, `${size}.webp`))).toBe(true);

    // 4. Edit a title and the alt text; each saves when the field loses focus.
    const firstCard = cards.first();
    await firstCard.getByLabel('Title').fill('Morning field');
    await firstCard.getByLabel('Alt text').fill('Gold light over a green field');
    await firstCard.getByLabel('Description').click();
    await expect(toast(page)).toContainText('Changes saved');
    await expect
      .poll(
        async () => (await query('select title, alt from photos where id = $1', [rows[0]!.id]))[0],
      )
      .toEqual({ title: 'Morning field', alt: 'Gold light over a green field' });

    // 5. Reorder with the single-click alternative to dragging.
    await page.getByRole('button', { name: 'Move Morning field later' }).click();
    await expect(toast(page)).toContainText('Order saved');
    await expect
      .poll(async () =>
        (
          await query<{ id: string }>(
            'select id from photos where album_id = $1 order by sort_order',
            [albumId],
          )
        ).map((r) => r.id),
      )
      .toEqual([rows[1]!.id, rows[0]!.id]);

    // 6. Publish the album.
    const albumToggle = page.locator('section').first().getByRole('button', { name: 'Hidden' });
    await albumToggle.click();
    await expect(
      page.locator('section').first().getByRole('button', { name: 'Visible' }),
    ).toHaveAttribute('aria-pressed', 'true');
    slug = (await query<{ slug: string }>('select slug from albums where id = $1', [albumId]))[0]!
      .slug;

    // 7. A visitor sees it, in the new order, with the new alt text.
    const visitor = await anonymous(browser);
    await visitor.page.goto(`/portfolio/${slug}`);
    const shown = visitor.page.locator('[data-gallery-item] img');
    await expect(shown).toHaveCount(2);
    await expect(shown.nth(1)).toHaveAttribute('alt', 'Gold light over a green field');
    const photoPath = `/img/${rows[0]!.id}/md.webp`;
    expect((await visitor.page.request.get(photoPath)).status()).toBe(200);

    // 8. Hide it again: the visitor gets a 404 for the page and its photos.
    await page.locator('section').first().getByRole('button', { name: 'Visible' }).click();
    await expect(
      page.locator('section').first().getByRole('button', { name: 'Hidden' }),
    ).toBeVisible();
    await expect
      .poll(async () => (await visitor.page.request.get(`/portfolio/${slug}`)).status())
      .toBe(404);
    expect((await visitor.page.request.get(photoPath)).status()).toBe(404);
    await visitor.context.close();

    // 9. Delete the album through the page; its records and files go with it.
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete album' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    expect(await query('select id from albums where id = $1', [albumId])).toHaveLength(0);
    expect(await query('select id from photos where album_id = $1', [albumId])).toHaveLength(0);
    for (const row of rows) expect(existsSync(join(E2E.storageDir, 'photos', row.id))).toBe(false);

    // 10. Sign out: the admin and its API are closed to this browser, and the
    //     old session cookie no longer works anywhere.
    const [cookie] = (await page.context().cookies()).filter((c) => c.name === 'osp_session');
    expect(cookie).toBeTruthy();
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
    const replay = await page.request.get('/api/admin/albums', {
      headers: { cookie: `osp_session=${cookie!.value}` },
    });
    expect(replay.status()).toBe(401);
  });
});

test.describe('signing in', () => {
  test('a wrong password is refused without saying which part was wrong', async ({ page }) => {
    await signIn(page, E2E.adminEmail, 'not the password at all');
    await expect(page.getByRole('alert')).toHaveText("That email and password don't match.");
    await signIn(page, 'nobody@e2e.test', 'not the password at all');
    await expect(page.getByRole('alert')).toHaveText("That email and password don't match.");
    await expect(page).toHaveURL(/\/login/);
  });

  test('five misses lock the account, even against the right password', async ({ page }) => {
    const email = `locked-${Date.now()}@e2e.test`;
    await addUser(email, 'the right password here');
    for (let i = 0; i < 5; i++) await signIn(page, email, `wrong password ${i}`);
    await expect(page.getByRole('alert')).toHaveText('Too many attempts. Try again in 15 minutes.');
    await signIn(page, email, 'the right password here');
    await expect(page.getByRole('alert')).toHaveText('Too many attempts. Try again in 15 minutes.');
  });

  test('an expired session is sent back to the login, from pages and from the editor', async ({
    page,
  }) => {
    const email = `expiry-${Date.now()}@e2e.test`;
    await addUser(email, 'a password for expiry');
    await signIn(page, email, 'a password for expiry');
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto(`/admin/albums/${seed.empty.id}`);
    await expect(page.getByLabel('Album name')).toHaveValue(seed.empty.title);

    await query(
      "update sessions set expires_at = now() - interval '1 minute' where user_id = (select id from users where email = $1)",
      [email],
    );
    // The editor's next save meets a 401 and goes to the login.
    await page.getByLabel('Description').first().fill('changed after expiry');
    await page.getByLabel('Album name').click();
    await expect(page).toHaveURL(/\/login\?next=/);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
    expect(
      (await query('select description from albums where id = $1', [seed.empty.id]))[0],
    ).toEqual({
      description: '',
    });
  });
});

test.describe('the admin API refuses what it should', () => {
  test('anonymous visitors get 401 from every admin endpoint', async ({ request, baseURL }) => {
    const id = seed.public.id;
    const photo = seed.public.photoIds[0];
    const calls: [string, string][] = [
      ['GET', '/api/admin/albums'],
      ['POST', '/api/admin/albums'],
      ['GET', `/api/admin/albums/${id}`],
      ['PATCH', `/api/admin/albums/${id}`],
      ['DELETE', `/api/admin/albums/${id}`],
      ['POST', `/api/admin/albums/${id}/photos`],
      ['PUT', `/api/admin/albums/${id}/photos`],
      ['POST', '/api/admin/albums/reorder'],
      ['PATCH', `/api/admin/photos/${photo}`],
      ['DELETE', `/api/admin/photos/${photo}`],
      ['POST', '/api/admin/gear/cameras'],
      ['DELETE', `/api/admin/messages/${photo}`],
    ];
    for (const [method, path] of calls) {
      const res = await request.fetch(path, { method, headers: { origin: baseURL! }, data: {} });
      expect(res.status(), `${method} ${path}`).toBe(401);
    }
    expect(await query('select id from albums where id = $1', [id])).toHaveLength(1);
  });

  test.describe('signed in', () => {
    test.use({ storageState: AUTH_FILE });

    test('unknown or malformed ids answer 404', async ({ request, page }) => {
      expect((await request.get('/api/admin/albums/not-a-uuid')).status()).toBe(404);
      expect(
        (await request.get('/api/admin/albums/00000000-0000-4000-8000-000000000000')).status(),
      ).toBe(404);
      await page.goto('/admin/albums/not-a-uuid');
      await expect(page).toHaveURL(/\/admin$/);
    });

    test('photos from another album cannot be used as a cover or reordered here', async ({
      request,
      baseURL,
    }) => {
      const headers = { origin: baseURL! };
      const cover = await request.patch(`/api/admin/albums/${seed.empty.id}`, {
        headers,
        data: { coverPhotoId: seed.public.photoIds[0] },
      });
      expect(cover.status()).toBe(400);
      expect(await cover.json()).toEqual({ error: 'That cover photo is not in this album.' });
      const order = await request.put(`/api/admin/albums/${seed.empty.id}/photos`, {
        headers,
        data: { ids: [seed.public.photoIds[0]] },
      });
      expect(order.status()).toBe(400);
    });

    test('uploads that are too big, the wrong type, or not what they claim are refused', async ({
      request,
      baseURL,
    }) => {
      const headers = { origin: baseURL! };
      const before = await query('select count(*)::int as n from photos');
      const post = (file: { name: string; mimeType: string; buffer: Buffer }) =>
        request.post(`/api/admin/albums/${seed.empty.id}/photos`, {
          headers,
          multipart: { title: 'x', width: '10', height: '10', sm: file, md: file, lg: file },
        });
      const jpegStart = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x00, 0x00]);
      const tooBig = Buffer.concat([jpegStart, Buffer.alloc(4 * 1024 * 1024 + 10)]);
      const big = await post({ name: 'big.jpg', mimeType: 'image/jpeg', buffer: tooBig });
      expect(big.status()).toBe(400);
      expect(await big.json()).toEqual({ error: 'Photo file is too large.' });
      const png = await post({
        name: 'x.png',
        mimeType: 'image/png',
        buffer: Buffer.from('\x89PNG\r\n'),
      });
      expect(png.status()).toBe(400);
      const fake = await post({
        name: 'x.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('<svg onload=alert(1)>'),
      });
      expect(fake.status()).toBe(400);
      expect(await fake.json()).toEqual({ error: 'Photos must be WebP or JPEG.' });
      expect(await query('select count(*)::int as n from photos')).toEqual(before);
    });

    test('the editor reports a file that is not really a picture and uploads nothing', async ({
      page,
    }) => {
      await page.goto(`/admin/albums/${seed.empty.id}`);
      await chooseFiles(page, [
        {
          name: 'not-a-photo.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('just some text, not an image'),
        },
      ]);
      await expect(page.getByText(/not-a-photo\.jpg · (?!ready|resizing)/)).toBeVisible();
      await expect(page.getByRole('button', { name: /Upload 0 photos/ })).toBeDisabled();
      // Anything that isn't an image at all is left out.
      await chooseFiles(page, [
        { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') },
      ]);
      await expect(page.getByText('notes.txt')).toHaveCount(0);
    });

    test('a dropped upload is reported, saves nothing, and can be retried', async ({ page }) => {
      await page.goto(`/admin/albums/${seed.empty.id}`);
      const image = await syntheticImage(page, { width: 1200, height: 900, seed: 21 });
      await chooseFiles(page, [{ name: 'flaky.jpg', mimeType: 'image/jpeg', buffer: image }]);
      await expect(page.getByText(/flaky\.jpg · ready/)).toBeVisible({ timeout: 20_000 });
      await page.route('**/api/admin/albums/*/photos', (route) => route.abort('connectionreset'));
      await page.getByRole('button', { name: 'Upload 1 photo' }).click();
      await expect(page.getByText(/flaky\.jpg · (?!ready|uploading)/)).toBeVisible();
      expect(
        await query('select id from photos where album_id = $1', [seed.empty.id]),
      ).toHaveLength(0);

      await page.unroute('**/api/admin/albums/*/photos');
      // Double-clicking must not upload the photo twice.
      await page.getByRole('button', { name: 'Upload 1 photo' }).dblclick();
      await expect(page.locator('li[id^=photo-]')).toHaveCount(1, { timeout: 20_000 });
      const saved = await query<{ id: string }>('select id from photos where album_id = $1', [
        seed.empty.id,
      ]);
      expect(saved).toHaveLength(1);

      // Put the fixture album back as it was: no photos.
      page.once('dialog', (d) => d.accept());
      await page.getByRole('button', { name: 'Delete flaky' }).click();
      await expect(page.locator('li[id^=photo-]')).toHaveCount(0);
      expect(existsSync(join(E2E.storageDir, 'photos', saved[0]!.id))).toBe(false);
    });

    test('a storage failure is reported as a failure and leaves no record', async ({ page }) => {
      await page.goto(`/admin/albums/${seed.empty.id}`);
      const image = await syntheticImage(page, { width: 900, height: 600, seed: 22 });
      await chooseFiles(page, [{ name: 'doomed.jpg', mimeType: 'image/jpeg', buffer: image }]);
      await expect(page.getByText(/doomed\.jpg · ready/)).toBeVisible({ timeout: 20_000 });

      // Break this run's photo folder for a moment: a file where the folder should be.
      const photosDir = join(E2E.storageDir, 'photos');
      const aside = join(E2E.storageDir, 'photos-aside');
      renameSync(photosDir, aside);
      writeFileSync(photosDir, 'storage is broken');
      try {
        await page.getByRole('button', { name: 'Upload 1 photo' }).click();
        await expect(
          page.getByText(/doomed\.jpg · Could not store the photo\. Try again\./),
        ).toBeVisible();
      } finally {
        rmSync(photosDir);
        renameSync(aside, photosDir);
      }
      expect(
        await query('select id from photos where album_id = $1', [seed.empty.id]),
      ).toHaveLength(0);
      expect(readdirSync(photosDir).length).toBeGreaterThan(0);
    });

    test('a double-clicked Create album makes one album', async ({ page }) => {
      const name = `Once ${Date.now()}`;
      await page.goto('/admin');
      await page.getByLabel('Name').fill(name);
      await page.getByRole('button', { name: 'Create album' }).dblclick();
      await expect(page).toHaveURL(/\/admin\/albums\//);
      const made = await query<{ id: string }>('select id from albums where title = $1', [name]);
      expect(made).toHaveLength(1);
      page.once('dialog', (d) => d.accept());
      await page.getByRole('button', { name: 'Delete album' }).click();
      await expect(page).toHaveURL(/\/admin$/);
    });
  });
});
