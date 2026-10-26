import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { fail, json, readJson, slugify } from './http';

describe('slugify', () => {
  it('makes a readable URL part', () => {
    expect(slugify('Fashion & Models')).toBe('fashion-and-models');
    expect(slugify('  Café   Portraits!  ')).toBe('cafe-portraits');
    expect(slugify('2014: Dusty')).toBe('2014-dusty');
  });

  it('falls back to "album" when nothing usable is left', () => {
    expect(slugify('!!!')).toBe('album');
    expect(slugify('')).toBe('album');
  });

  it('keeps slugs short', () => {
    expect(slugify('a'.repeat(100))).toHaveLength(60);
  });
});

describe('responses', () => {
  it('sends JSON with a status', async () => {
    const res = json({ ok: true }, 201);
    expect(res.status).toBe(201);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(await res.json()).toEqual({ ok: true });
  });

  it('sends errors as { error }', async () => {
    const res = fail('Nope.', 409);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Nope.' });
  });
});

describe('readJson', () => {
  const Schema = z.object({ name: z.string().min(1, 'Add a name.') });
  const post = (body: string) => new Request('http://x/', { method: 'POST', body });

  it('returns the parsed body', async () => {
    expect(await readJson(post('{"name":"Dusty"}'), Schema)).toEqual({ data: { name: 'Dusty' } });
  });

  it('answers 400 with the first validation message', async () => {
    const result = await readJson(post('{"name":""}'), Schema);
    expect('response' in result && result.response.status).toBe(400);
    if ('response' in result)
      expect(await result.response.json()).toEqual({ error: 'Add a name.' });
  });

  it('answers 400 when the body is not JSON', async () => {
    const result = await readJson(post('not json'), Schema);
    if (!('response' in result)) throw new Error('expected a response');
    expect(await result.response.json()).toEqual({ error: 'Expected a JSON body.' });
  });
});
