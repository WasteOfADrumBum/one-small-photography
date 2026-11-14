# TypeScript 7

The project is on TypeScript 7, with two tools held on TypeScript 6 until they support 7.

## What runs on which version

- **TypeScript 7** (`typescript7` in package.json, an npm alias for `typescript@^7`): `npm run typecheck:ts7` type-checks
  every `.ts` file with `tsconfig.ts7.json`. CI runs it in Static checks.
- **TypeScript 6** (`typescript` in package.json): `astro check` and ESLint (typescript-eslint, eslint-plugin-astro).
  Both need TypeScript's JavaScript API, which TypeScript 7 does not ship, and their peer ranges stop below 6.1.

The build itself does not use either: Astro and Vite strip types with esbuild.

## What was relaxed

Nothing is turned off. The only differences from a plain setup:

- `.github/dependabot.yml` ignores `typescript` 7 and later, so the 6.x copy the tools need is not replaced. The
  `typescript7` alias still gets updates.
- `scripts/ts7/astro-modules.d.ts` declares `*.astro` imports for the TypeScript 7 check only, because plain `tsc` cannot
  read `.astro` files. `tsconfig.json` excludes it, so `astro check` still checks the real components.
- `tsconfig.json` no longer sets `baseUrl` (removed in TypeScript 7); the `@/*` path is now relative (`./src/*`).

## Recheck periodically

Check whether these accept TypeScript 7:

```bash
npm view typescript-eslint peerDependencies
npm view @astrojs/check peerDependencies
```

Once both include 7: move `typescript` to `^7`, drop the `typescript7` alias, `tsconfig.ts7.json`,
`scripts/ts7/` and the Dependabot ignore, and point the TypeScript 7 step back at `npm run check`.
