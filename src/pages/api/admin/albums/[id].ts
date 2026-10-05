import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { albums, photos } from '@/db/schema';
import { getAlbumWithPhotos, uniqueSlug } from '@/lib/albums';
import { fail, json, readJson } from '@/lib/http';
import { deletePhotoFiles } from '@/lib/storage';

export const prerender = false;

const id = z.uuid();

export const GET: APIRoute = async ({ params }) => {
  const parsed = id.safeParse(params.id);
  if (!parsed.success) return fail('Not found.', 404);
  const album = await getAlbumWithPhotos(parsed.data);
  return album ? json(album) : fail('Not found.', 404);
};

const UpdateAlbum = z.object({
  title: z.string().trim().min(1, 'Give the album a name.').max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  published: z.boolean().optional(),
  coverPhotoId: z.uuid().nullable().optional(),
});

export const PATCH: APIRoute = async ({ params, request }) => {
  const albumId = id.safeParse(params.id);
  if (!albumId.success) return fail('Not found.', 404);
  const input = await readJson(request, UpdateAlbum);
  if ('response' in input) return input.response;
  const changes = input.data;

  if (changes.coverPhotoId) {
    const [cover] = await db()
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.id, changes.coverPhotoId), eq(photos.albumId, albumId.data)));
    if (!cover) return fail('That cover photo is not in this album.');
  }

  const [album] = await db()
    .update(albums)
    .set({
      ...changes,
      ...(changes.title ? { slug: await uniqueSlug(changes.title, albumId.data) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(albums.id, albumId.data))
    .returning();
  return album ? json(album) : fail('Not found.', 404);
};

export const DELETE: APIRoute = async ({ params }) => {
  const albumId = id.safeParse(params.id);
  if (!albumId.success) return fail('Not found.', 404);
  const albumPhotos = await db()
    .select({ id: photos.id, format: photos.format })
    .from(photos)
    .where(eq(photos.albumId, albumId.data));
  for (const photo of albumPhotos) await deletePhotoFiles(photo.id, photo.format);
  await db().delete(albums).where(eq(albums.id, albumId.data));
  return json({ ok: true });
};
