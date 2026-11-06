# OneSmallPhoto

The photography portfolio of Joshua Small, made in the North Carolina Triad (Greensboro, High
Point and Winston-Salem).

This is a personal, non-commercial site: no prices, packages or booking offers. It runs entirely
on free tiers with no card on file.

- [ROADMAP.md](ROADMAP.md): future work, kept separate from release blockers.
- [docs/RELEASE.md](docs/RELEASE.md): release record and evidence for the current release.
- [docs/RECOVERY.md](docs/RECOVERY.md): password recovery, backups, restore, photo files, rollback.
- [docs/CI-CD.md](docs/CI-CD.md): checks, merge gate, deployment smoke and alerts.
- [docs/TESTING.md](docs/TESTING.md): running every check locally, and the test safety rules.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): migrations, preview isolation, rolling back.

## Stack

| Layer     | Tool                                             |
| --------- | ------------------------------------------------ |
| Framework | Astro with React islands, TypeScript             |
| Styling   | Tailwind CSS v4                                  |
| Motion    | GSAP (ScrollTrigger, Flip) and Lenis             |
| Hosting   | Vercel Hobby                                     |
| Database  | Neon Postgres with Drizzle ORM                   |
| Photos    | Backblaze B2, resized in the browser             |
| CI        | GitHub Actions and Playwright; see docs/CI-CD.md |

## Develop

Requires Node 22.12 or newer.

```sh
npm install
npm run dev      # http://localhost:4321
```

| Command           | What it does                    |
| ----------------- | ------------------------------- |
| `npm run dev`     | Start the dev server            |
| `npm run build`   | Build for production            |
| `npm run preview` | Preview the production build    |
| `npm run check`   | Type check Astro and TypeScript |
| `npm run lint`    | Lint with ESLint                |
| `npm run format`  | Format with Prettier            |
| `npm test`        | Run the tests                   |
| `npm run verify`  | All of the fast checks          |

Tests that touch the database run when `TEST_DATABASE_URL` points at a throwaway Postgres on
this machine (CI starts one); without it they're skipped. They refuse any address that is not
local. Browser tests and the rest: [docs/TESTING.md](docs/TESTING.md).

```sh
TEST_DATABASE_URL=postgres://postgres@localhost:5432/osp_test npm test
```

## Deploy

Import this repo into Vercel. Every pull request gets a preview URL, and merges to `main`
deploy to production. Secrets (database URL, B2 keys) go in Vercel's environment variables;
see `.env.example` for the names. Never commit them.

Migrations in `drizzle/` run on production deploys only, and a preview that can see a
database fails instead ([docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)). After the first deploy, add
`SETUP_TOKEN`, redeploy, and visit `/setup` once to create the admin login.

## Owner scripts

Run from your own computer with the database URL from Neon. See
[docs/RECOVERY.md](docs/RECOVERY.md).

| Command                                         | What it does                                         |
| ----------------------------------------------- | ---------------------------------------------------- |
| `node scripts/reset-admin-password.mjs <email>` | Set a new admin password, clear lockout, sign out    |
| `node scripts/db-backup.mjs [file]`             | Save the database to a private JSON file (read-only) |
| `node scripts/db-restore.mjs <file>`            | Load a backup into a new, empty database             |
| `node scripts/photo-audit.mjs`                  | Compare photo rows with bucket files (read-only)     |
| `node scripts/smoke.mjs`                        | Read-only health check of the live site              |
