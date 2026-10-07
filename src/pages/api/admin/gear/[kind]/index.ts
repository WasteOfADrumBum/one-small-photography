import type { APIRoute } from 'astro';
import { z } from 'zod';
import { addGear, isGearKind, listGear } from '@/lib/gear';
import { fail, json, readJson } from '@/lib/http';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  if (!isGearKind(params.kind)) return fail('Not found.', 404);
  return json(await listGear(params.kind));
};

const GearName = z.object({ name: z.string().trim().min(1, 'Give it a name.').max(120) });

export const POST: APIRoute = async ({ params, request }) => {
  if (!isGearKind(params.kind)) return fail('Not found.', 404);
  const input = await readJson(request, GearName);
  if ('response' in input) return input.response;
  const row = await addGear(params.kind, input.data.name);
  if (!row) return fail(`"${input.data.name}" is already on the list.`, 409);
  return json(row, 201);
};
