// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// Pages are prerendered by default; admin and API routes opt into
// on-demand rendering with `export const prerender = false`.
export default defineConfig({
  site: 'https://one-small-photography.vercel.app',
  adapter: vercel({ webAnalytics: { enabled: true } }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
