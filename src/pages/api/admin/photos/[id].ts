import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { albums, photos } from '@/db/schema';
import { nextPhotoOrder } from '@/lib/albums';
import { fail, json, readJson } from '@/lib/http';
import { deletePhotoFiles } from '@/lib/storage';

export const prerender = false;

const UpdatePhoto = z.object({
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  alt: z.string().trim().max(500).optional(),
  published: z.boolean().optional(),
  albumId: z.uuid().optional(),
});

export const PATCH: APIRoute = async ({ params, request }) => {
  const photoId = z.uuid().safeParse(params.id);
  if (!photoId.success) return fail('Not found.', 404);
  const input = await readJson(request, UpdatePhoto);
  if ('response' in input) return input.response;
  const changes = input.data;

  const [current] = await db().select().from(photos).where(eq(photos.id, photoId.data));
  if (!current) return fail('Not found.', 404);

  let sortOrder: number | undefined;
  if (changes.albumId && changes.albumId !== current.albumId) {
    const [target] = await db()
      .select({ id: albums.id })
      .from(albums)
      .where(eq(albums.id, changes.albumId));
    if (!target) return fail('That album does not exist.');
    sortOrder = await nextPhotoOrder(changes.albumId);
    // Moving the cover out of an album leaves that album without one.
    await db()
      .update(albums)
      .set({ coverPhotoId: null })
      .where(and(eq(albums.id, current.albumId), eq(albums.coverPhotoId, current.id)));
  }

  const [photo] = await db()
    .update(photos)
    .set({ ...changes, ...(sortOrder !== undefined ? { sortOrder } : {}) })
    .where(eq(photos.id, current.id))
    .returning();
  return json(photo);
};

export const DELETE: APIRoute = async ({ params }) => {
  const photoId = z.uuid().safeParse(params.id);
  if (!photoId.success) return fail('Not found.', 404);
  const [photo] = await db().select().from(photos).where(eq(photos.id, photoId.data));
  if (!photo) return fail('Not found.', 404);

  await deletePhotoFiles(photo.id, photo.format);
  await db()
    .update(albums)
    .set({ coverPhotoId: null })
    .where(and(eq(albums.id, photo.albumId), eq(albums.coverPhotoId, photo.id)));
  await db().delete(photos).where(eq(photos.id, photo.id));
  return json({ ok: true });
};
