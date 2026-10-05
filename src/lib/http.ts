import type { z } from 'zod';

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const fail = (message: string, status = 400) => json({ error: message }, status);

/** Parses a JSON body against a schema, or returns a 400 response. */
export async function readJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { response: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: fail('Expected a JSON body.') };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return { response: fail(parsed.error.issues[0]?.message ?? 'Invalid input.') };
  return { data: parsed.data };
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'album'
  );
}
