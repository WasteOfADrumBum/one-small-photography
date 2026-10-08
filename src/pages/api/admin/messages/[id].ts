import type { APIRoute } from 'astro';
import { z } from 'zod';
import { fail, json, readJson } from '@/lib/http';
import { deleteMessage, setRead } from '@/lib/messages';

export const prerender = false;

const Id = z.uuid();
const MarkRead = z.object({ read: z.boolean() });

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = Id.safeParse(params.id);
  if (!id.success) return fail('Not found.', 404);
  const input = await readJson(request, MarkRead);
  if ('response' in input) return input.response;
  const row = await setRead(id.data, input.data.read);
  return row ? json(row) : fail('Not found.', 404);
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = Id.safeParse(params.id);
  if (!id.success) return fail('Not found.', 404);
  await deleteMessage(id.data);
  return json({ ok: true });
};
