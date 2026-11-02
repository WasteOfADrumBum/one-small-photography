# One Small Photography roadmap

Optional future work. **Nothing here blocks or reopens the current release**, which is defined in
[docs/release-scope-1.0.0.md](docs/release-scope-1.0.0.md). Gates and status live in the
[One Small Engineering hub](https://github.com/WasteOfADrumBum/one-small-engineering/blob/main/projects/registry.json).
After acceptance the site is in maintenance: defects and security fixes only, until the owner
starts a new scoped release from this list.

Priority: **P1** next, **P2** useful, **P3** nice to have.

## E1. More photos and albums (P2)

- **Purpose:** grow the portfolio.
- **Scope:** content added through the admin; no code change.
- **Acceptance criteria:** new albums appear on the portfolio index and load on phone and desktop.
- **Dependencies:** none (content, not a code release).

## E2. Production build-tool advisories (P2)

- **Purpose:** clear the 4 moderate advisories (`glob`, `minimatch`) reached through
  `@astrojs/vercel` → `@vercel/nft`, which runs at build time for file tracing. 20 moderate in
  total including dev tooling, as of 2026-11-02. None high or critical.
- **Scope:** upgrade `@astrojs/vercel` when a release with fixed ranges ships, or a scoped
  `overrides` entry if tests and the Vercel build stay green; never `npm audit fix --force` (it
  downgrades the adapter).
- **Acceptance criteria:** `npm audit --omit=dev` 0 moderate or higher; CI and a Vercel preview
  build green; galleries still load in the preview.
- **Dependencies:** upstream release, or owner acceptance of the override approach.

## E3. Automated accessibility check in CI (P2)

- **Purpose:** catch WCAG regressions on PRs, as Studio and OneSmallUI already do.
- **Scope:** Playwright + axe against `astro preview` for home, one album and contact.
- **Acceptance criteria:** 0 serious or critical violations; job required on PRs.
- **Dependencies:** a seeded test album that needs no production data.

## E4. Contact note retention (P3)

- **Purpose:** keep personal data no longer than needed.
- **Scope:** a documented retention period and an admin action (or scheduled job on the free tier)
  that deletes older notes.
- **Acceptance criteria:** notes older than the period are removed; tests cover it.
- **Dependencies:** owner decision on the period.

## E5. Pin GitHub Actions by SHA (P3)

- **Purpose:** supply-chain hardening (the CI token is already limited to `contents: read`).
- **Scope:** pin `actions/checkout` and `actions/setup-node` to full SHAs.
- **Acceptance criteria:** CI green; no permission widened.
- **Dependencies:** none.
