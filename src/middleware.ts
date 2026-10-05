import { defineMiddleware } from 'astro:middleware';
import { getSessionUser } from '@/lib/auth';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const isProtected = (path: string) =>
  path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/admin/');

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;
  // Prerendered pages have no request cookies; only on-demand routes need a user.
  if (context.isPrerendered) return next();

  const { pathname } = context.url;

  // CSRF: Astro checks Origin for form posts; JSON API calls get the same check here.
  if (pathname.startsWith('/api/') && MUTATING.has(context.request.method)) {
    const origin = context.request.headers.get('origin');
    if (origin !== context.url.origin) return new Response('Forbidden', { status: 403 });
  }

  if (isProtected(pathname) || pathname.startsWith('/img/')) {
    context.locals.user = await getSessionUser(context.cookies);
  }

  if (isProtected(pathname) && !context.locals.user) {
    if (pathname.startsWith('/api/')) return new Response('Unauthorized', { status: 401 });
    return context.redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  const response = await next();
  if (isProtected(pathname)) response.headers.set('Cache-Control', 'private, no-store');
  return response;
});
