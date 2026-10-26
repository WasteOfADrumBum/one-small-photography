import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('astro:middleware', () => ({ defineMiddleware: (fn: unknown) => fn }));
const getSessionUser = vi.fn();
vi.mock('@/lib/auth', () => ({ getSessionUser: (...args: unknown[]) => getSessionUser(...args) }));

const { onRequest, SECURITY_HEADERS } = await import('./middleware');

const ORIGIN = 'https://photo.example';

function run(
  path: string,
  {
    method = 'GET',
    origin,
    prerendered = false,
  }: { method?: string; origin?: string; prerendered?: boolean } = {},
) {
  const url = new URL(path, ORIGIN);
  const headers = new Headers(origin ? { origin } : {});
  const context = {
    url,
    request: new Request(url, { method, headers }),
    cookies: {},
    locals: {} as { user: unknown },
    isPrerendered: prerendered,
    redirect: (to: string) => new Response(null, { status: 302, headers: { Location: to } }),
  };
  const next = vi.fn(async () => new Response('ok'));
  // The middleware's own types come from Astro; this stand-in has what it reads.
  const handler = onRequest as unknown as (c: typeof context, n: typeof next) => Promise<Response>;
  return { response: handler(context, next), context, next };
}

beforeEach(() => getSessionUser.mockReset().mockResolvedValue(null));

describe('middleware', () => {
  it('sends public pages through with security headers and no user lookup', async () => {
    const { response, next } = run('/portfolio');
    const res = await response;
    expect(next).toHaveBeenCalled();
    expect(getSessionUser).not.toHaveBeenCalled();
    for (const [name, value] of Object.entries(SECURITY_HEADERS))
      expect(res.headers.get(name)).toBe(value);
    expect(res.headers.get('Cache-Control')).toBeNull();
  });

  it('sends logged-out visitors from the admin to the login', async () => {
    const res = await run('/admin/albums/abc').response;
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/login?next=%2Fadmin%2Falbums%2Fabc');
  });

  it('answers 401 to logged-out admin API calls', async () => {
    const res = await run('/api/admin/albums', { method: 'POST', origin: ORIGIN }).response;
    expect(res.status).toBe(401);
  });

  it('lets a logged-in user into the admin and keeps those pages out of caches', async () => {
    getSessionUser.mockResolvedValue({ id: 'u1' });
    const { response, context } = run('/admin');
    const res = await response;
    expect(res.status).toBe(200);
    expect(context.locals.user).toEqual({ id: 'u1' });
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('looks up the user for photos, so hidden ones show while logged in', async () => {
    getSessionUser.mockResolvedValue({ id: 'u1' });
    const { response, context } = run('/img/x/sm.webp');
    await response;
    expect(context.locals.user).toEqual({ id: 'u1' });
  });

  it('refuses API writes from other sites', async () => {
    getSessionUser.mockResolvedValue({ id: 'u1' });
    for (const origin of ['https://evil.example', undefined]) {
      const { response, next } = run('/api/contact', { method: 'POST', origin });
      expect((await response).status).toBe(403);
      expect(next).not.toHaveBeenCalled();
    }
    expect((await run('/api/contact', { method: 'POST', origin: ORIGIN }).response).status).toBe(
      200,
    );
  });

  it('skips everything for prerendered pages', async () => {
    const { response, next } = run('/admin', { prerendered: true });
    await response;
    expect(next).toHaveBeenCalled();
    expect(getSessionUser).not.toHaveBeenCalled();
  });
});
