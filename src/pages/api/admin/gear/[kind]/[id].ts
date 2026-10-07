import type { APIRoute } from 'astro';
import { z } from 'zod';
import { deleteGear, isGearKind, renameGear } from '@/lib/gear';
import { fail, json, readJson } from '@/lib/http';

export const prerender = false;

const GearName = z.object({ name: z.string().trim().min(1, 'Give it a name.').max(120) });

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = z.uuid().safeParse(params.id);
  if (!isGearKind(params.kind) || !id.success) return fail('Not found.', 404);
  const input = await readJson(request, GearName);
  if ('response' in input) return input.response;
  try {
    const row = await renameGear(params.kind, id.data, input.data.name);
    return row ? json(row) : fail('Not found.', 404);
  } catch {
    return fail(`"${input.data.name}" is already on the list.`, 409);
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = z.uuid().safeParse(params.id);
  if (!isGearKind(params.kind) || !id.success) return fail('Not found.', 404);
  const row = await deleteGear(params.kind, id.data);
  return row ? json({ ok: true }) : fail('Not found.', 404);
};
