# Testing

Every check CI runs can be run on your own computer with the package scripts below. None of
them touch the live site, the real database, the real photo bucket or real email.

## Commands

| Command                                 | What it does                                                      | Needs                                 |
| --------------------------------------- | ----------------------------------------------------------------- | ------------------------------------- |
| `npm run verify`                        | Format, lint, type check and the unit/integration tests           | `TEST_DATABASE_URL` for the DB tests  |
| `npm test`                              | Vitest: unit, integration and migration tests                     | `TEST_DATABASE_URL` for the DB tests  |
| `npm run test:migrations`               | Only the deployment-entrypoint and migration tests                | `TEST_DATABASE_URL`                   |
| `npm run build:e2e`                     | Builds the site with the Node adapter so it can be served locally | nothing                               |
| `npm run test:e2e`                      | Browser tests, Chromium (the pull-request suite)                  | `E2E_DATABASE_URL`, a `build:e2e`     |
| `npm run test:e2e -- --project=firefox` | The same suite in Firefox (`webkit` for Safari's engine)          | `npx playwright install firefox`      |
| `E2E_HTTPS=1 npm run test:e2e`          | Serves the site over HTTPS with a throwaway one-day certificate   | `openssl`                             |
| `npm run audit:policy`                  | Dependency advisories against `security/audit-exceptions.json`    | network                               |
| `npm run secrets:scan`                  | gitleaks over the code and its full history                       | network (downloads a pinned gitleaks) |
| `npm run workflows:lint`                | actionlint and zizmor over `.github/workflows`                    | network (downloads pinned binaries)   |

A local Postgres for the database and browser tests (any Postgres 16 on this machine works):

```sh
docker run -d --name osp-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
docker exec osp-pg createdb -U postgres osp_test
export TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/osp_test
export E2E_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
npm run verify && npm run build:e2e && npm run test:e2e
```

`E2E_KEEP=1 npm run test:e2e` keeps the run's database and photo folder afterwards so you can
look at them. On failure, `npx playwright show-report` opens the report, and
`test-results/e2e-server.log` and `test-results/e2e-migration.log` hold the site's own output.

## Safety rules (enforced in code, not just written here)

`scripts/lib/test-safety.mjs` holds the guards; every script and test that creates, empties or
drops anything goes through them.

- **Local databases only.** `TEST_DATABASE_URL` and `E2E_DATABASE_URL` must point at
  `localhost`, `127.0.0.1` or `::1`. A Neon or any other remote address is refused before
  anything connects. The integration tests (which empty every table) check this first.
- **Only databases this run named.** Databases are created and dropped only under names that
  match `osp_e2e_…`, `osp_mig_…` or the other `osp_` test prefixes, and each run drops only the
  ones it created. A name that doesn't match is refused, even for `drop database`.
- **Only folders this run made.** The browser tests store photos in a new temporary folder
  marked with the run's random id. Cleanup deletes a folder only if that marker matches.
- **No production settings.** The browser-test runner refuses to start if `B2_*`,
  `SETUP_TOKEN`, `VERCEL` or `VERCEL_ENV` are set, or if `DATABASE_URL` is set to anything but a
  local database. The site under test gets a fixed, minimal environment; nothing else from your
  shell reaches it.
- **No real email.** The site's email client accepts a different address only for a server on
  this machine (`src/lib/notify.ts`, `resendUrl`), so the tests' stand-in for Resend can never
  be swapped for some other host. The stand-in records each email and can be told to fail.
- **No test doors in the app.** The browser tests sign in through `/setup` (with a random
  one-time token for that run) and `/admin/login`, like a person would. There is no test-only
  login, bypass or fixture route in the site.
- **Synthetic data only.** Every photo in the tests is drawn on a canvas or built in code; every
  account and message is made up for the run.

## What the browser suite covers

`e2e/` runs against the built site (`node dist/server/entry.mjs`, production mode), with real
routing, middleware, cookies, sessions and API handlers, on a database migrated by the real
deployment script (`scripts/migrate.mjs`).

| File                  | Covers                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `seed.setup.ts`       | Creates the admin through `/setup` and four albums through the admin API: published, empty, hidden, and one whose photo files are gone |
| `public.spec.ts`      | Home and portfolio navigation, album pages, aspect ratios, responsive columns, empty and broken albums, 404s, hidden content, sitemap  |
| `lightbox.spec.ts`    | Open, next/previous, close by mouse, keyboard and touch; focus kept inside and returned                                                |
| `contact.spec.ts`     | Browser and server validation, success, duplicate submit, dropped connection with retry, email failure that still saves the note       |
| `admin.spec.ts`       | The full admin journey (sign in to sign out) and its failure paths                                                                     |
| `security.spec.ts`    | Cookie flags, origin checks, redirects, caching of private photos, stored XSS, path traversal, GPS removal                             |
| `a11y.spec.ts`        | axe (WCAG 2.2 A/AA tags) and behaviour checks; see [ACCESSIBILITY-EVIDENCE.md](ACCESSIBILITY-EVIDENCE.md)                              |
| `performance.spec.ts` | JS/CSS budgets, responsive image choice, layout shift while photos load                                                                |

Budgets live in `e2e/budgets.json`, each set about 15% above what the pages measured on
2026-11-05, so a real regression fails while ordinary changes don't.

Retries: one in CI (none for the setup step, which can only run once). A test that passes only on retry is reported as **flaky** in the job summary
and as a warning on the run, so retries never hide it.

**Firefox and WebKit:** the weekly workflow serves the site over HTTPS (`E2E_HTTPS=1`), because
WebKit refuses the admin's `Secure` session cookie on `http://localhost`, as the first run showed.
The certificate is made for the run, trusted only by that run, and deleted afterwards. The
pull-request suite stays on plain HTTP in Chromium; both modes pass locally in Chromium.
