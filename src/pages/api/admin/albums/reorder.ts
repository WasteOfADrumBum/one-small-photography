import type { APIRoute } from 'astro';
import { z } from 'zod';
import { setOrder } from '@/lib/albums';
import { json, readJson } from '@/lib/http';

export const prerender = false;

const Reorder = z.object({ ids: z.array(z.uuid()).max(500) });

export const POST: APIRoute = async ({ request }) => {
  const input = await readJson(request, Reorder);
  if ('response' in input) return input.response;
  await setOrder('albums', input.data.ids);
  return json({ ok: true });
};
