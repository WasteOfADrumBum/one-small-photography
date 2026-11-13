import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db } from '@/db/client';
import { albums } from '@/db/schema';
import { listAlbums, nextAlbumOrder, uniqueSlug } from '@/lib/albums';
import { AlbumTags } from '@/lib/album-tag-schema';
import { json, readJson } from '@/lib/http';

export const prerender = false;

export const GET: APIRoute = async () => json(await listAlbums());

const CreateAlbum = z.object({
  title: z.string().trim().min(1, 'Give the album a name.').max(120),
  description: z.string().trim().max(2000).default(''),
  tags: AlbumTags.default([]),
});

export const POST: APIRoute = async ({ request }) => {
  const input = await readJson(request, CreateAlbum);
  if ('response' in input) return input.response;
  const { title, description, tags } = input.data;
  const [album] = await db()
    .insert(albums)
    .values({
      title,
      description,
      tags,
      slug: await uniqueSlug(title),
      sortOrder: await nextAlbumOrder(),
    })
    .returning();
  return json(album, 201);
};
