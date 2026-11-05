import type { APIRoute } from 'astro';

/**
 * Which commit this deployment was built from, so the post-deploy smoke check
 * can wait until the live site is really the deployment it was told about
 * (the repository is public, so the commit is not a secret). Built once, at
 * deploy time.
 */
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      commit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.OSP_BUILD_COMMIT || 'unknown',
      environment: process.env.VERCEL_ENV || 'local',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
