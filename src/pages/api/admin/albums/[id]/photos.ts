import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { albums, photos, type PhotoExif } from '@/db/schema';
import { nextPhotoOrder, photosInAlbum, setOrder } from '@/lib/albums';
import { fail, json, readJson } from '@/lib/http';
import { PHOTO_SIZES, photoKey, putPhoto, type PhotoSize } from '@/lib/storage';

export const prerender = false;

/** Vercel functions accept bodies up to 4.5 MB, so all three sizes together must fit. */
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const FORMATS = { 'image/webp': 'webp', 'image/jpeg': 'jpg' } as const;

const Meta = z.object({
  title: z.string().trim().max(200).default(''),
  description: z.string().trim().max(4000).default(''),
  alt: z.string().trim().max(500).default(''),
  width: z.coerce.number().int().positive().max(20000),
  height: z.coerce.number().int().positive().max(20000),
  exif: z
    .string()
    .default('{}')
    .transform((s, ctx) => {
      try {
        return JSON.parse(s) as PhotoExif;
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Invalid EXIF data.' });
        return z.NEVER;
      }
    }),
});

/** Uploads one photo: three pre-resized files plus its details, as multipart form data. */
export const POST: APIRoute = async ({ params, request }) => {
  const albumId = z.uuid().safeParse(params.id);
  if (!albumId.success) return fail('Not found.', 404);
  const [album] = await db()
    .select({ id: albums.id, coverPhotoId: albums.coverPhotoId })
    .from(albums)
    .where(eq(albums.id, albumId.data));
  if (!album) return fail('Album not found.', 404);

  const form = await request.formData();
  const meta = Meta.safeParse(
    Object.fromEntries([...form].filter(([, v]) => typeof v === 'string')),
  );
  if (!meta.success) return fail(meta.error.issues[0]?.message ?? 'Invalid photo details.');

  const files = {} as Record<PhotoSize, File>;
  let format: string | undefined;
  for (const size of Object.keys(PHOTO_SIZES) as PhotoSize[]) {
    const file = form.get(size);
    if (!(file instanceof File)) return fail(`Missing the ${size} size.`);
    if (file.size > MAX_FILE_BYTES) return fail('Photo file is too large.');
    const ext = FORMATS[file.type as keyof typeof FORMATS];
    if (!ext || (format && ext !== format)) return fail('Photos must be WebP or JPEG.');
    format = ext;
    files[size] = file;
  }

  const [photo] = await db()
    .insert(photos)
    .values({
      ...meta.data,
      albumId: album.id,
      format: format!,
      sortOrder: await nextPhotoOrder(album.id),
    })
    .returning();

  try {
    await Promise.all(
      (Object.keys(files) as PhotoSize[]).map(async (size) =>
        putPhoto(
          photoKey(photo!.id, size, format!),
          new Uint8Array(await files[size].arrayBuffer()),
          files[size].type,
        ),
      ),
    );
  } catch (err) {
    await db().delete(photos).where(eq(photos.id, photo!.id));
    console.error('Photo upload to B2 failed', err);
    return fail('Could not store the photo. Try again.', 502);
  }

  // The first photo in an album becomes its cover until you pick another.
  if (!album.coverPhotoId) {
    await db().update(albums).set({ coverPhotoId: photo!.id }).where(eq(albums.id, album.id));
  }
  return json(photo, 201);
};

const Reorder = z.object({ ids: z.array(z.uuid()).max(2000) });

/** Saves a new photo order for this album. */
export const PUT: APIRoute = async ({ params, request }) => {
  const albumId = z.uuid().safeParse(params.id);
  if (!albumId.success) return fail('Not found.', 404);
  const input = await readJson(request, Reorder);
  if ('response' in input) return input.response;
  if (!(await photosInAlbum(albumId.data, input.data.ids))) {
    return fail('Some photos are not in this album.');
  }
  await setOrder('photos', input.data.ids);
  return json({ ok: true });
};
