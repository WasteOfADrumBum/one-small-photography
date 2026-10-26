/**
 * Tests against a real Postgres. They run only when TEST_DATABASE_URL is set
 * (CI starts a throwaway database), and they empty every table first, so never
 * point it at the real one. Photos go to a temporary folder instead of B2.
 */
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/client';
import { albums, messages, photos, sessions, users, type User } from '@/db/schema';
import {
  listPublishedAlbums,
  getPublishedAlbumBySlug,
  setOrder,
  stackPhotos,
  uniqueSlug,
} from '@/lib/albums';
import {
  SESSION_COOKIE,
  attemptLogin,
  endSession,
  getSessionUser,
  hashPassword,
  startSession,
} from '@/lib/auth';
import { addMessage, tooManyRecent } from '@/lib/messages';
import * as albumRoute from '@/pages/api/admin/albums/[id]';
import * as albumPhotosRoute from '@/pages/api/admin/albums/[id]/photos';
import * as createAlbumRoute from '@/pages/api/admin/albums/index';
import * as photoRoute from '@/pages/api/admin/photos/[id]';
import * as contactRoute from '@/pages/api/contact';
import * as imgRoute from '@/pages/img/[id]/[file]';

const url = process.env.TEST_DATABASE_URL;
const ORIGIN = 'http://localhost';

/** A stand-in for Astro's cookie jar. */
function cookieJar() {
  const values = new Map<string, string>();
  return {
    values,
    get: (name: string) => (values.has(name) ? { value: values.get(name)! } : undefined),
    set: (name: string, value: string) => void values.set(name, value),
    delete: (name: string) => void values.delete(name),
  };
}
type Jar = ReturnType<typeof cookieJar>;
const asCookies = (jar: Jar) => jar as unknown as Parameters<typeof startSession>[1];

/** Calls an API route the way Astro would, with only what the routes read. */
type Handler = (context: never) => Response | Promise<Response>;
function call(
  handler: Handler | undefined,
  {
    params = {},
    method = 'GET',
    body,
    user = null,
  }: { params?: Record<string, string>; method?: string; body?: unknown; user?: User | null } = {},
) {
  const init: RequestInit = { method };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  const context = { params, request: new Request(ORIGIN, init), locals: { user } };
  return Promise.resolve(handler!(context as never));
}

// A tiny but real WebP (1x1), so the copyright tagging on /img has something to parse.
const WEBP = Uint8Array.from(
  atob('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA='),
  (c) => c.charCodeAt(0),
);

function uploadForm(title: string, extra: Record<string, string> = {}) {
  const form = new FormData();
  form.set('title', title);
  form.set('alt', `Alt text for ${title}`);
  form.set('width', '2400');
  form.set('height', '1600');
  for (const [k, v] of Object.entries(extra)) form.set(k, v);
  for (const size of ['sm', 'md', 'lg']) {
    form.set(size, new File([WEBP], `${size}.webp`, { type: 'image/webp' }));
  }
  return form;
}

describe.skipIf(!url)('with a database', () => {
  let storage: string;
  let admin: User;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    storage = await mkdtemp(join(tmpdir(), 'osp-photos-'));
    process.env.STORAGE_DIR = storage;
    const pool = new pg.Pool({ connectionString: url });
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
    await pool.end();
  });

  afterAll(async () => {
    await rm(storage, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await db().execute(
      sql`truncate ${messages}, ${photos}, ${albums}, ${sessions}, ${users}, cameras, lenses cascade`,
    );
    [admin] = (await db()
      .insert(users)
      .values({
        email: 'admin@example.com',
        passwordHash: await hashPassword('a long enough password'),
      })
      .returning()) as [User];
  });

  async function createAlbum(title: string, published = false) {
    const res = await call(createAlbumRoute.POST, { method: 'POST', body: { title }, user: admin });
    expect(res.status).toBe(201);
    const album = (await res.json()) as { id: string; slug: string };
    if (published) {
      await call(albumRoute.PATCH, {
        method: 'PATCH',
        params: { id: album.id },
        body: { published: true },
      });
    }
    return album;
  }

  async function upload(albumId: string, title: string, extra?: Record<string, string>) {
    const res = await call(albumPhotosRoute.POST, {
      method: 'POST',
      params: { id: albumId },
      body: uploadForm(title, extra),
    });
    return { res, photo: (await res.clone().json()) as { id: string; error?: string } };
  }

  describe('logging in', () => {
    it('signs in with the right password and starts a session', async () => {
      const result = await attemptLogin(' Admin@Example.com ', 'a long enough password');
      expect(result.ok).toBe(true);
      const jar = cookieJar();
      await startSession(admin.id, asCookies(jar));
      const token = jar.values.get(SESSION_COOKIE)!;
      expect(token).toBeTruthy();
      // Only a hash of the cookie is stored.
      const [row] = await db().select().from(sessions);
      expect(row!.id).not.toBe(token);
      expect((await getSessionUser(asCookies(jar)))?.id).toBe(admin.id);

      await endSession(asCookies(jar));
      expect(jar.values.has(SESSION_COOKIE)).toBe(false);
      expect(await db().select().from(sessions)).toHaveLength(0);
    });

    it('rejects a wrong password or unknown email the same way', async () => {
      expect(await attemptLogin('admin@example.com', 'wrong')).toEqual({
        ok: false,
        reason: 'invalid',
      });
      expect(await attemptLogin('nobody@example.com', 'wrong')).toEqual({
        ok: false,
        reason: 'invalid',
      });
    });

    it('locks the account after five misses, even for the right password', async () => {
      for (let i = 0; i < 4; i++)
        expect((await attemptLogin('admin@example.com', 'x')).ok).toBe(false);
      expect(await attemptLogin('admin@example.com', 'x')).toEqual({ ok: false, reason: 'locked' });
      expect(await attemptLogin('admin@example.com', 'a long enough password')).toEqual({
        ok: false,
        reason: 'locked',
      });
    });

    it('ignores a made-up or expired session cookie', async () => {
      const jar = cookieJar();
      jar.set(SESSION_COOKIE, 'made-up');
      expect(await getSessionUser(asCookies(jar))).toBeNull();
      await startSession(admin.id, asCookies(jar));
      await db()
        .update(sessions)
        .set({ expiresAt: new Date(Date.now() - 1000) });
      expect(await getSessionUser(asCookies(jar))).toBeNull();
    });
  });

  describe('albums', () => {
    it('gives each album its own slug', async () => {
      const first = await createAlbum('Fashion & Models');
      const second = await createAlbum('Fashion & Models');
      expect(first.slug).toBe('fashion-and-models');
      expect(second.slug).toBe('fashion-and-models-2');
      expect(await uniqueSlug('Fashion & Models', first.id)).toBe('fashion-and-models');
    });

    it('shows only visible albums and visible photos on the site', async () => {
      const shown = await createAlbum('Shown', true);
      await createAlbum('Hidden');
      const { photo: keep } = await upload(shown.id, 'Keep');
      const { photo: hide } = await upload(shown.id, 'Hide');
      await call(photoRoute.PATCH, {
        method: 'PATCH',
        params: { id: hide.id },
        body: { published: false },
      });

      const list = await listPublishedAlbums();
      expect(list.map((a) => a.title)).toEqual(['Shown']);
      expect(list[0]!.photos.map((p) => p.id)).toEqual([keep.id]);
      expect(await getPublishedAlbumBySlug('hidden')).toBeUndefined();
    });

    it('saves a new order', async () => {
      const a = await createAlbum('A', true);
      const b = await createAlbum('B', true);
      const c = await createAlbum('C', true);
      await setOrder('albums', [c.id, a.id, b.id]);
      expect((await listPublishedAlbums()).map((x) => x.title)).toEqual(['C', 'A', 'B']);
    });

    it('puts the cover on top of the Polaroid stack', async () => {
      const album = await createAlbum('Stack', true);
      const { photo: first } = await upload(album.id, 'First');
      const { photo: second } = await upload(album.id, 'Second');
      await call(albumRoute.PATCH, {
        method: 'PATCH',
        params: { id: album.id },
        body: { coverPhotoId: second.id },
      });
      const [listed] = await listPublishedAlbums();
      expect(stackPhotos(listed!).map((p) => p.id)).toEqual([second.id, first.id]);
    });

    it('refuses a cover photo from another album', async () => {
      const one = await createAlbum('One');
      const two = await createAlbum('Two');
      const { photo } = await upload(two.id, 'Elsewhere');
      const res = await call(albumRoute.PATCH, {
        method: 'PATCH',
        params: { id: one.id },
        body: { coverPhotoId: photo.id },
      });
      expect(res.status).toBe(400);
    });

    it('deletes an album with its photos and their files', async () => {
      const album = await createAlbum('Doomed');
      const { photo } = await upload(album.id, 'One');
      expect(await readdir(join(storage, 'photos'))).toContain(photo.id);
      await call(albumRoute.DELETE, { method: 'DELETE', params: { id: album.id } });
      expect(await db().select().from(photos)).toHaveLength(0);
      expect(await readdir(join(storage, 'photos'))).not.toContain(photo.id);
    });
  });

  describe('photos', () => {
    it('stores an upload, makes it the first cover and keeps only known EXIF fields', async () => {
      const album = await createAlbum('Uploads');
      const { res, photo } = await upload(album.id, 'Dusty', {
        settings: JSON.stringify({ aperture: '2.8', iso: 100 }),
        exif: JSON.stringify({
          model: 'NIKON Z 7_2',
          fNumber: 2.8,
          gps: [36.1, -79.8],
          iso: 'lots',
        }),
      });
      expect(res.status).toBe(201);
      const [row] = await db().select().from(photos);
      expect(row).toMatchObject({ title: 'Dusty', aperture: '2.8', iso: 100, format: 'webp' });
      expect(row!.exif).toEqual({ model: 'NIKON Z 7_2', fNumber: 2.8 });
      const [saved] = await db().select().from(albums);
      expect(saved!.coverPhotoId).toBe(photo.id);
    });

    it('rejects settings that are not on the lists', async () => {
      const album = await createAlbum('Bad');
      const { res } = await upload(album.id, 'Bad', { settings: JSON.stringify({ iso: 123 }) });
      expect(res.status).toBe(400);
      expect(await db().select().from(photos)).toHaveLength(0);
    });

    it('moves a photo to another album and clears the cover it leaves behind', async () => {
      const from = await createAlbum('From');
      const to = await createAlbum('To');
      const { photo } = await upload(from.id, 'Traveler');
      const res = await call(photoRoute.PATCH, {
        method: 'PATCH',
        params: { id: photo.id },
        body: { albumId: to.id },
      });
      expect(res.status).toBe(200);
      const rows = await db().select().from(albums);
      expect(rows.find((a) => a.id === from.id)!.coverPhotoId).toBeNull();
      const [moved] = await db().select().from(photos);
      expect(moved!.albumId).toBe(to.id);
    });

    it('serves visible photos to everyone and hidden ones only to you', async () => {
      const album = await createAlbum('Gallery', true);
      const { photo } = await upload(album.id, 'Shown');
      const get = (user: User | null) =>
        call(imgRoute.GET, { params: { id: photo.id, file: 'md.webp' }, user });

      const open = await get(null);
      expect(open.status).toBe(200);
      expect(open.headers.get('Cache-Control')).toContain('public');
      const bytes = new TextDecoder('latin1').decode(await open.arrayBuffer());
      expect(bytes).toContain('All rights reserved');

      await call(photoRoute.PATCH, {
        method: 'PATCH',
        params: { id: photo.id },
        body: { published: false },
      });
      expect((await get(null)).status).toBe(404);
      const mine = await get(admin);
      expect(mine.status).toBe(200);
      expect(mine.headers.get('Cache-Control')).toBe('private, no-store');
    });

    it('answers 404 for bad photo addresses', async () => {
      const album = await createAlbum('Gallery', true);
      const { photo } = await upload(album.id, 'Shown');
      for (const params of [
        { id: 'nope', file: 'md.webp' },
        { id: photo.id, file: 'xl.webp' },
        { id: photo.id, file: 'md.jpg' },
      ]) {
        expect((await call(imgRoute.GET, { params })).status).toBe(404);
      }
    });

    it('deletes a photo, its files and its place as cover', async () => {
      const album = await createAlbum('Album');
      const { photo } = await upload(album.id, 'Gone');
      await call(photoRoute.DELETE, { method: 'DELETE', params: { id: photo.id } });
      expect(await db().select().from(photos)).toHaveLength(0);
      const [row] = await db().select().from(albums);
      expect(row!.coverPhotoId).toBeNull();
      expect(await readdir(join(storage, 'photos'))).not.toContain(photo.id);
    });
  });

  describe('the contact form', () => {
    const send = (body: object) => call(contactRoute.POST, { method: 'POST', body });
    const note = { name: 'Ada', email: 'ada@example.com', body: 'Loved the Dusty photo.' };

    it('saves a note for the admin inbox', async () => {
      expect((await send(note)).status).toBe(201);
      const [row] = await db().select().from(messages);
      expect(row).toMatchObject({ ...note, readAt: null });
    });

    it('pretends to accept bot posts that fill the hidden field', async () => {
      expect((await send({ ...note, website: 'http://spam.example' })).status).toBe(201);
      expect(await db().select().from(messages)).toHaveLength(0);
    });

    it('explains what is wrong with a bad note', async () => {
      const res = await send({ ...note, email: 'nope' });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'That email address does not look right.' });
    });

    it('stops taking notes after 20 in an hour', async () => {
      for (let i = 0; i < 19; i++) await addMessage(note);
      expect(await tooManyRecent()).toBe(false);
      expect((await send(note)).status).toBe(201);
      expect(await tooManyRecent()).toBe(true);
      expect((await send(note)).status).toBe(429);
    });
  });
});
