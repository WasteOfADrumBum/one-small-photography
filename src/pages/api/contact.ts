import type { APIRoute } from 'astro';
import { fail, json, readJson } from '@/lib/http';
import { NewMessage, addMessage, tooManyRecent } from '@/lib/messages';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const input = await readJson(request, NewMessage);
  if ('response' in input) return input.response;
  const { website, ...message } = input.data;
  // A filled honeypot gets the same answer as a real send, so bots learn nothing.
  if (website) return json({ ok: true }, 201);
  if (await tooManyRecent()) return fail('Lots of messages right now. Try again in an hour.', 429);
  await addMessage(message);
  return json({ ok: true }, 201);
};
