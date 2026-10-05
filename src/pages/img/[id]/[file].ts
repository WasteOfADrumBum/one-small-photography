import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { albums, photos } from '@/db/schema';
import { getPhoto, isPhotoSize, photoKey } from '@/lib/storage';

export const prerender = false;

const notFound = () => new Response('Not found', { status: 404 });

/**
 * Streams a photo from the private B2 bucket. Published photos are cached on
 * Vercel's CDN, so B2 is only read once per photo size per cache period.
 * Hidden photos are only shown to you while logged in.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  const id = z.uuid().safeParse(params.id);
  const match = /^(sm|md|lg)\.(webp|jpg)$/.exec(params.file ?? '');
  if (!id.success || !match || !isPhotoSize(match[1]!)) return notFound();

  const [row] = await db()
    .select({
      format: photos.format,
      photoPublished: photos.published,
      albumPublished: albums.published,
    })
    .from(photos)
    .innerJoin(albums, eq(photos.albumId, albums.id))
    .where(eq(photos.id, id.data));
  if (!row || row.format !== match[2]) return notFound();

  const isPublic = row.photoPublished && row.albumPublished;
  if (!isPublic && !locals.user) return notFound();

  const file = await getPhoto(photoKey(id.data, match[1], row.format));
  if (!file) return notFound();

  return new Response(file.body as BodyInit, {
    headers: {
      'Content-Type': file.contentType,
      'Cache-Control': isPublic
        ? 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400'
        : 'private, no-store',
    },
  });
};
