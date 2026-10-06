import { and, asc, count, eq, inArray, max, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/db/client';
import { albums, photos, type Album, type Photo } from '@/db/schema';
import { slugify } from '@/lib/http';

export type AlbumSummary = Album & { photoCount: number; coverFormat: string | null };

const cover = alias(photos, 'cover');

export async function listAlbums(): Promise<AlbumSummary[]> {
  const rows = await db()
    .select({ album: albums, photoCount: count(photos.id), coverFormat: cover.format })
    .from(albums)
    .leftJoin(photos, eq(photos.albumId, albums.id))
    .leftJoin(cover, eq(cover.id, albums.coverPhotoId))
    .groupBy(albums.id, cover.id)
    .orderBy(asc(albums.sortOrder), asc(albums.createdAt));
  return rows.map((r) => ({ ...r.album, photoCount: r.photoCount, coverFormat: r.coverFormat }));
}

export async function getAlbumWithPhotos(
  id: string,
): Promise<(Album & { photos: Photo[] }) | undefined> {
  return db().query.albums.findFirst({
    where: eq(albums.id, id),
    with: { photos: { orderBy: [asc(photos.sortOrder), asc(photos.createdAt)] } },
  });
}

/** A slug based on the title that no other album uses. */
export async function uniqueSlug(title: string, exceptId?: string): Promise<string> {
  const base = slugify(title);
  const taken = new Set(
    (await db().select({ id: albums.id, slug: albums.slug }).from(albums))
      .filter((a) => a.id !== exceptId)
      .map((a) => a.slug),
  );
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

export async function nextAlbumOrder(): Promise<number> {
  const [row] = await db()
    .select({ value: max(albums.sortOrder) })
    .from(albums);
  return (row?.value ?? -1) + 1;
}

export async function nextPhotoOrder(albumId: string): Promise<number> {
  const [row] = await db()
    .select({ value: max(photos.sortOrder) })
    .from(photos)
    .where(eq(photos.albumId, albumId));
  return (row?.value ?? -1) + 1;
}

export type PublicAlbum = Album & { photos: Photo[] };

/** Published albums with their published photos, in display order, for the public site. */
export async function listPublishedAlbums(): Promise<PublicAlbum[]> {
  return db().query.albums.findMany({
    where: eq(albums.published, true),
    orderBy: [asc(albums.sortOrder), asc(albums.createdAt)],
    with: {
      photos: {
        where: eq(photos.published, true),
        orderBy: [asc(photos.sortOrder), asc(photos.createdAt)],
      },
    },
  });
}

export async function getPublishedAlbumBySlug(slug: string): Promise<PublicAlbum | undefined> {
  return db().query.albums.findFirst({
    where: and(eq(albums.slug, slug), eq(albums.published, true)),
    with: {
      photos: {
        where: eq(photos.published, true),
        orderBy: [asc(photos.sortOrder), asc(photos.createdAt)],
      },
    },
  });
}

/** The cover first, then the rest in order: the top three become the Polaroid stack. */
export function stackPhotos(album: PublicAlbum): Photo[] {
  const cover = album.photos.find((p) => p.id === album.coverPhotoId);
  return cover ? [cover, ...album.photos.filter((p) => p !== cover)] : album.photos;
}

/** Saves a new display order in one statement: each id gets its position in the list. */
export async function setOrder(table: 'albums' | 'photos', ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const target = table === 'albums' ? albums : photos;
  const values = sql.join(
    ids.map((id, index) => sql`(${id}::uuid, ${index}::int)`),
    sql`, `,
  );
  await db().execute(sql`
    update ${target} set sort_order = v.position
    from (values ${values}) as v(id, position)
    where ${target.id} = v.id
  `);
}

export async function photosInAlbum(albumId: string, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const rows = await db()
    .select({ id: photos.id })
    .from(photos)
    .where(and(eq(photos.albumId, albumId), inArray(photos.id, ids)));
  return rows.length === ids.length;
}
