/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// Astro's Vite setup, so tests can render .astro pages with the container API.
export default getViteConfig({
  test: { include: ['src/**/*.test.{ts,tsx}'] },
});
