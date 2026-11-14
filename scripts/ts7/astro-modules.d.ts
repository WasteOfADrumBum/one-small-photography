// Only for the TypeScript 7 check (tsconfig.ts7.json). Plain tsc cannot read .astro files, so tests that import a
// component see it as an Astro component factory. `astro check` type-checks the .astro files themselves.
declare module '*.astro' {
  import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
  const Component: AstroComponentFactory;
  export default Component;
}
