/**
 * Creates this run's synthetic admin through the real one-time /setup page,
 * then adds the fixture albums through the admin API: a visible album with
 * landscape, portrait and square photos (one of them hidden), a visible album
 * with no photos, and a hidden album.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test as setup } from '@playwright/test';
import { AUTH_FILE, E2E, SEED_PATH, type Seed } from './support/env';
import { adminApi, uploadThroughApi } from './support/images';

type Album = { id: string; slug: string; title: string };

setup('create the admin account and fixture albums', async ({ page }) => {
  await page.goto('/setup');
  await page.getByLabel('Setup token (from Vercel)').fill(E2E.setupToken);
  await page.getByLabel('Email').fill(E2E.adminEmail);
  await page.getByLabel(/^Password/).fill(E2E.adminPassword);
  await page.getByLabel('Confirm password').fill(E2E.adminPassword);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const album = (title: string, description = '') =>
    adminApi<Album>(page, '/api/admin/albums', 'POST', { title, description });
  const publish = (id: string) =>
    adminApi(page, `/api/admin/albums/${id}`, 'PATCH', { published: true });

  const field = await album('Field Notes', 'Synthetic test pictures of colour and shape.');
  const shots = [
    {
      title: 'Wide field',
      alt: 'A wide gradient from green to gold',
      width: 3000,
      height: 2000,
      seed: 1,
    },
    {
      title: 'Tall field',
      alt: 'A tall gradient with circles',
      width: 2000,
      height: 3000,
      seed: 2,
    },
    { title: 'Square field', alt: 'A square gradient', width: 1800, height: 1800, seed: 3 },
    { title: 'Secret field', alt: 'A photo that stays hidden', width: 2400, height: 1600, seed: 4 },
  ];
  const photos = [];
  for (const shot of shots) photos.push(await uploadThroughApi(page, field.id, shot));
  const hiddenPhoto = photos.at(-1)!;
  await adminApi(page, `/api/admin/photos/${hiddenPhoto.id}`, 'PATCH', { published: false });
  await publish(field.id);

  const empty = await album('Coming Soon');
  await publish(empty.id);

  const hidden = await album('Private Shoot');
  const privatePhoto = await uploadThroughApi(page, hidden.id, {
    title: 'Private',
    alt: 'A private picture',
    width: 1600,
    height: 1200,
    seed: 5,
  });

  // A visible album whose only photo has lost its files in storage.
  const broken = await album('Broken Files');
  const lost = await uploadThroughApi(page, broken.id, {
    title: 'Lost',
    alt: 'A photo whose file has gone missing',
    width: 1200,
    height: 800,
    seed: 6,
  });
  await publish(broken.id);
  rmSync(join(E2E.storageDir, 'photos', lost.id), { recursive: true, force: true });

  const seed: Seed = {
    public: {
      id: field.id,
      slug: field.slug,
      title: field.title,
      photoIds: photos.slice(0, 3).map((p) => p.id),
      hiddenPhotoId: hiddenPhoto.id,
    },
    empty: { id: empty.id, slug: empty.slug, title: empty.title },
    hidden: { id: hidden.id, slug: hidden.slug, title: hidden.title, photoId: privatePhoto.id },
    broken: { id: broken.id, slug: broken.slug, title: broken.title, photoId: lost.id },
    formats: Object.fromEntries([...photos, privatePhoto, lost].map((p) => [p.id, p.format])),
  };
  mkdirSync('e2e/.auth', { recursive: true });
  writeFileSync(SEED_PATH, JSON.stringify(seed, null, 2));
  await page.context().storageState({ path: AUTH_FILE });
});
