# Deployment and migrations

## How a change reaches the live site

1. A pull request runs CI (see [CI-CD.md](CI-CD.md)). Vercel also builds a **preview** of it.
2. Merging to `main` makes Vercel run `npm run vercel-build` for **production**:
   `node scripts/migrate.mjs && astro build`.
3. When Vercel reports the production deployment as successful, GitHub runs **Production
   smoke** (`.github/workflows/production-smoke.yml`), which waits until
   `https://photo.onesmall.company/version.json` reports that exact commit and then runs
   read-only checks. A failure opens one `production-alert` issue; the next pass closes it.

CI runs the same `npm run vercel-build` command, with `VERCEL_ENV=production`, against a new
empty Postgres on every code change ("Production build and migrations" job). So the exact
deployment entrypoint, migrations included, has run before anything merges.

## Which builds may migrate (`scripts/lib/migrate-plan.mjs`)

| Build                                       | What happens                                                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `VERCEL_ENV=production` with a Postgres URL | Applies new migrations, prints how many, then builds                                                       |
| `VERCEL_ENV=production` without one         | **Fails the build** ("DATABASE_URL is not set"), nothing deploys                                           |
| Preview or development, no database         | Skips migrations and builds (the normal preview)                                                           |
| Preview that can see a `DATABASE_URL`       | **Fails**, unless `PREVIEW_DATABASE_ISOLATED=true` marks it as a separate database; previews never migrate |
| Local run with a database                   | Migrates it (for your own local copy)                                                                      |

Before this change, any build with `DATABASE_URL` migrated. Today every Vercel variable is
scoped to Production only (checked through the Vercel API on 2026-11-05), so previews get no
database. The new rule makes sure that if someone ever adds `DATABASE_URL` to Preview, the
preview fails loudly instead of migrating, or serving from, production data.

A failed migration fails the build before `astro build` starts, so a half-migrated database
never gets a new site on top of it; the previous deployment keeps serving. The error is printed
without the database address or password.

**Concurrent builds:** Vercel Hobby runs one build at a time per account, so two production
migrations never overlap. Drizzle records each applied migration, so a repeated run applies
nothing ("0 new"), which CI checks on every code change.

## Rules for new migrations (expand and contract)

During a deploy, and after an Instant Rollback, the previous version of the site runs against
the new schema. So a release may only **add**: new tables, new nullable or defaulted columns,
new indexes. `src/test/migrations.test.ts` fails if a migration drops, renames, retypes,
truncates or deletes, unless it is listed in `REVIEWED_DESTRUCTIVE` with a reason.

To remove something: first release code that no longer uses it; later, in its own reviewed
release with a fresh backup ([RECOVERY.md](RECOVERY.md) section 2), drop it.

The same test file also checks every migration against a fresh database, an upgrade from the
previous release's schema with data in it, a repeated run, a broken migration, an unreachable
database, and the preview rules above.

## Rolling back

**The site (code):** Vercel → Project → Deployments → the last good production deployment →
**⋯ → Instant Rollback**. Then revert the bad commit on GitHub (`git revert <sha>` in a pull
request) so the next merge doesn't bring it back. Production smoke runs again after the revert
deploys.

**The database:** an Instant Rollback does **not** undo a migration. Because every migration is
additive, the older code keeps working on the newer schema, so usually nothing needs undoing.
If a migration ever does need reversing, write a new forward migration that reverses it, or
restore a backup into a new Neon branch ([RECOVERY.md](RECOVERY.md) section 3) and switch
`DATABASE_URL` to it. Never edit or delete an applied migration file.

## The version endpoint

`/version.json` is built into every deployment: `{"commit": "<git sha>", "environment":
"production"}`. It is public on purpose (a commit id of a public repository) and is how the
smoke workflow knows the live site is the deployment it was told about, not an older one.
