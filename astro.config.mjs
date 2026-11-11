// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// Production always builds for Vercel. The browser tests build the same app with
// Astro's Node adapter instead (OSP_ADAPTER=node, see docs/TESTING.md), because
// Vercel's output can't be served locally; routes, middleware, cookies and API
// handlers are the same code either way.
// The Node adapter is a dev dependency, loaded only for those test builds.
if (process.env.OSP_ADAPTER === 'node' && process.env.VERCEL)
  throw new Error('OSP_ADAPTER=node is for local browser-test builds only; unset it on Vercel.');
const adapter =
  process.env.OSP_ADAPTER === 'node'
    ? (await import('@astrojs/node')).default({ mode: 'standalone' })
    : vercel();

// Pages are prerendered by default; admin and API routes opt into
// on-demand rendering with `export const prerender = false`.
export default defineConfig({
  site: 'https://photo.onesmall.company',
  adapter,
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
