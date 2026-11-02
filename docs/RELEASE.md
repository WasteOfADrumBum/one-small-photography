# Release record: photography showcase v1

Acceptance record for Joshua Small's final review. **Release approval belongs to Joshua Small and
is not recorded here until he records it himself** (section 6).

Scope: the non-commercial photography showcase at https://photo.onesmall.company (portfolio,
albums, The Triad, Under the hood, contact "say hello" form, single-owner admin). No prices,
packages, booking or sales. Free tiers only, no card on file.

Evidence labels used below:

- **Agent-verified**: checked by Claude (AI agent) on 2026-11-02 with the command or tool named.
  Not independent human verification.
- **CI**: GitHub Actions on the PR, reproducible by anyone.
- **Owner-reported**: stated by Joshua Small; not re-tested by the agent.
- **Open**: not yet verified; listed in section 5.

## 1. Production identity (agent-verified, 2026-11-02 ~17:00 UTC, Vercel and Neon APIs)

| Item                             | Value                                                                                                                                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical URL                    | https://photo.onesmall.company (`site` in `astro.config.mjs`)                                                                                                                                                               |
| Vercel project / team            | `one-small-photography` (`prj_FOLtGh5vtKgKRY0dX1BaR8L3D9RF`), team TaskForge, Hobby                                                                                                                                         |
| Production deployment            | `dpl_C3PpG42VGUuqzC1s8w1i54YRZHah`, READY, from `main` @ `d926563` (PR #20 merge)                                                                                                                                           |
| Previous (rollback) deployment   | `dpl_9vzRBvbty4tu6hSWJZSaub25udR3` @ `d65e096`, rollback candidate                                                                                                                                                          |
| Domains on the project           | photo.onesmall.company, one-small-photography.vercel.app (+ Vercel aliases)                                                                                                                                                 |
| Deployment protection            | Vercel Authentication on all deployments except the custom domain                                                                                                                                                           |
| Production env vars (names only) | DATABASE_URL, B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET, B2_ENDPOINT, SETUP_TOKEN, RESEND_API_KEY, CONTACT_TO_EMAIL (all "sensitive"), CONTACT_FROM_EMAIL (plain). Production target only: previews get no database or keys. |
| Database                         | Neon project `OneSmallPhoto` (`steep-rice-45353759`), Postgres 18.6, aws-us-east-2, Free plan, history retention 6 h, branch `production` only                                                                              |
| Data at check time               | 1 user, 14 albums (all visible), 132 photos (131 visible), 1 message, 3 cameras, 3 lenses, 3 migrations applied, 0 broken album covers, 8.6 MB                                                                              |
| Runtime errors                   | None reported by Vercel for the last 7 days                                                                                                                                                                                 |
| Live portfolio                   | `/portfolio` fetched: 14 album titles, no error text                                                                                                                                                                        |

The release candidate is `main` after this PR merges; Vercel will create a new production
deployment. Record its id in section 6 once it is live.

## 2. Owner-reported evidence (Joshua Small, 2026-11-02, project thread)

- Contact notification emails arrive.
- Public galleries work live.

## 3. Checks and results

### Audits reconciled against current code

| Audit                                  | Then                                                                 | Now (agent-verified)                                                                                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Site + WCAG audit, PR #16 (2026-10-26) | 0 axe issues, 94 tests                                               | Merged. Re-ran axe (WCAG 2.1 A/AA) on 10 pages × phone and desktop: found 2 new issues since, both fixed here (below). 0 now.                                                      |
| XSS audit, PR #20 (2026-10-30)         | No exploitable XSS; CSP backstop added                               | Merged and deployed (`d926563`). Its follow-up "prerendered pages get no security headers" is fixed here with `vercel.json`. Script CSP (`script-src`) is still open, see ROADMAP. |
| Audit open decisions                   | Domain, Gmail, town, old repo, cache, privacy line, wording, lockout | Domain, town, old repo, Gmail: decided 2026-10-26. Privacy line: proposed here for your review. Hidden-photo cache, wording, lockout: accepted risks below.                        |

### Security (agent-verified unless marked CI)

| Area                | Result                                                                                                                                                                                                                                           | How                                                                                                                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin authorization | Every `/admin*` page redirects anonymous visitors to `/login`; every `/api/admin/*` call answers 401; anonymous DELETE answers 401.                                                                                                              | Middleware review; `src/middleware.test.ts` (CI); local browser run against a disposable database                                                                                                                                                                                                                 |
| CSRF                | Cross-site POST to the admin API answers 403 before any handler runs. Astro checks Origin on form posts.                                                                                                                                         | Local run; production smoke check                                                                                                                                                                                                                                                                                 |
| Sessions            | Random 32-byte token, only its SHA-256 stored; httpOnly, Secure in production, SameSite=Lax, 30 days; logout deletes the row; expired or forged cookies rejected.                                                                                | `src/lib/auth.ts` review; integration tests (CI)                                                                                                                                                                                                                                                                  |
| Brute force         | 5 misses lock the account for 15 minutes; unknown emails take the same time as real ones.                                                                                                                                                        | Integration tests (CI)                                                                                                                                                                                                                                                                                            |
| Setup protection    | `/setup` needs `SETUP_TOKEN` (constant-time compare) and redirects to `/login` once an account exists.                                                                                                                                           | Code review; local run (302 after the account existed)                                                                                                                                                                                                                                                            |
| Password recovery   | Owner procedure: `scripts/reset-admin-password.mjs` (new). No public reset or registration. Clears lockout and ends every session.                                                                                                               | Integration test proves the new password logs in through the site's own login code and the old one fails                                                                                                                                                                                                          |
| Uploads             | Admin only; 4 MB per size; WebP/JPEG only; EXIF and settings validated. **New:** the file's bytes must match its declared type.                                                                                                                  | Unit + integration tests (CI); local run (HTML labelled as WebP refused with 400, nothing stored)                                                                                                                                                                                                                 |
| Private content     | Hidden photos and photos in hidden albums answer 404 to visitors and `private, no-store` to the owner; hidden albums 404.                                                                                                                        | Integration tests (CI); local run (hidden 404 anonymous, 200 for admin)                                                                                                                                                                                                                                           |
| Error handling      | Bad ids → 404; bad JSON → 400 with a plain message; storage failure → 502 and the row is rolled back; failed contact email never loses the note. No stack traces in responses.                                                                   | Code review; integration tests (CI)                                                                                                                                                                                                                                                                               |
| Security headers    | Server-rendered pages already had them. **New:** `vercel.json` adds the same four to prerendered pages (/contact, /the-triad, /under-the-hood, 404). A test keeps both lists identical.                                                          | Release-guard test (CI). A smoke run against today's production ([run 41495846674](https://github.com/WasteOfADrumBum/one-small-photography/actions/runs/41495846674)) failed only this check: /contact has no headers yet, the gap this PR fixes. **Live confirmation is open** until the smoke run after merge. |
| Secrets and history | No keys, tokens, `.env` or private keys in any commit (67 commits scanned). Author emails: noreply plus the known Gmail (decided 2026-10-26). Vercel reports no env-var security issues.                                                         | `git log -p` pattern scan; Vercel API                                                                                                                                                                                                                                                                             |
| Dependencies        | Runtime: 0 high/critical. 4 moderate advisories in `glob`/`minimatch` via `@vercel/nft`, which only runs during the build, not on the site; no non-breaking fix exists. Dev-only: drizzle-kit's bundled esbuild (dev server issue, not shipped). | `npm audit --omit=dev`, `npm audit`                                                                                                                                                                                                                                                                               |

### Data, recovery and operations

| Area             | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backups          | Neon Free: 6 h history, no scheduled snapshots. **New** `scripts/db-backup.mjs` for monthly off-site copies. First off-site backup is an owner action.                                                                                                                                                                                                                                                                                                                   |
| Restore drill    | Agent-verified 2026-11-02 17:01–17:03 UTC: disposable branch `restore-drill-2026-11-02-disposable` of production; migrations applied to a new empty database there; all 6 tables loaded with the same JSON round trip `db-restore.mjs` uses. Counts and md5 checksums of every table matched production exactly. Branch deleted afterwards; production untouched (read-only queries only).                                                                               |
| Restore scripts  | `db-backup.mjs` / `db-restore.mjs` round trip, refuse-if-not-empty guard and schema check are tested against Postgres in CI.                                                                                                                                                                                                                                                                                                                                             |
| Photo objects    | Recovery documented (`docs/RECOVERY.md` §4); **new** read-only `scripts/photo-audit.mjs` reconciles rows with bucket files (run locally against a disposable store: 12 rows, 36 files, 0 problems). Not run against B2 (no B2 access from the agent).                                                                                                                                                                                                                    |
| Rollback         | Vercel Instant Rollback; previous production deployment is a rollback candidate. Migrations are forward-only and additive so far.                                                                                                                                                                                                                                                                                                                                        |
| Monitoring       | **New** "Production smoke" workflow: 10 read-only checks daily and on demand; failures email the owner. First run from GitHub's runners (2026-11-02 17:56 UTC, run linked above): 9/10 against production, everything except the static-page headers this PR adds (pages, 14 albums, a published photo served with public caching, admin redirect, admin API 401, cross-site write 403, setup closed, 404, robots and sitemap). Vercel shows 0 runtime errors in 7 days. |
| Billing controls | Vercel Hobby, Neon Free, Backblaze B2 free 10 GB, Resend free: all no-card plans that pause or refuse at their limits. The Vercel API reports the team on Hobby (runtime-log retention error names the Hobby plan). Contact form capped at 20 notes/hour sitewide; Resend's 100/day cap only stops emails, notes still save.                                                                                                                                             |
| Caching          | Pages: `no-store` so admin edits show at once. Published photos: browser 1 day, CDN 30 days (protects B2's free egress). Hidden photos: `private, no-store`. Accepted risk: a photo hidden after it was cached stays reachable by exact URL for up to 30 days (ROADMAP R-3).                                                                                                                                                                                             |
| Image delivery   | Three WebP sizes (480/1280/2400 px) made in the browser; `srcset`/`sizes`; lazy loading after the first three; copyright XMP embedded; originals never leave your computer.                                                                                                                                                                                                                                                                                              |
| Privacy          | Stored: contact name, email, message (kept until you delete it), admin email + password hash. Vercel Web Analytics is cookieless. Uploads are re-encoded, so camera GPS never reaches the site. **New** one-sentence notice on /contact (your call to keep).                                                                                                                                                                                                             |

### CI, devices, slow network, accessibility

| Area           | Result                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI             | `main` @ `d926563` green (run 59). This PR runs format, lint, type check, 149 tests (including database tests on Postgres 16) and build.                                                                                                                                                                                                                                                                                      |
| Local full run | Agent-verified on this branch: format, lint, `astro check` (0 errors), all tests, build.                                                                                                                                                                                                                                                                                                                                      |
| Accessibility  | axe-core 4.10 (WCAG 2.0/2.1 A and AA), 10 pages (public, album, 404, login, admin list, album editor) at 375×812 and 1280×800: 0 violations after two fixes: phones could scroll sideways a few pixels on album, Under the hood and 404 pages (title glow; WCAG 1.4.10), and an admin "Gear tab" link was indistinguishable from its text (1.4.1). Reduced-motion users get the pages. No hands-on screen reader pass (open). |
| Devices        | Chromium at phone and desktop widths; no horizontal overflow on any page after the fix. Not tested on real iOS Safari or Android hardware (open, owner spot check).                                                                                                                                                                                                                                                           |
| Slow network   | Chrome "Slow 3G" profile on a phone, local dev server: home, album and contact pages reached DOMContentLoaded in 3.4–4.1 s. Dev bundles are larger than production; the production build ships about 177 KB of gzipped JS in total (most of it only on admin pages).                                                                                                                                                          |

## 4. Changes in this release PR

- Upload byte-signature check (`src/lib/image-type.ts`).
- Static-page security headers (`vercel.json`) and a guard test.
- Phone sideways-scroll fix (`main { overflow-x: clip }`) and an underlined admin link.
- Contact privacy sentence.
- Owner scripts: `reset-admin-password`, `db-backup`, `db-restore`, `photo-audit`, `smoke`; shared helpers in `scripts/lib/`.
- Daily read-only production smoke workflow.
- `docs/RECOVERY.md`, this record, `ROADMAP.md`, README links, Engineering Hub checkpoint.

## 5. Open items before approval

Release blockers (each needs Joshua; see the owner checklist in the PR):

1. Review and merge the release PR (repository rule: the owner merges).
2. After the production deploy, run **Production smoke** once and confirm 10/10, including
   "static pages carry security headers" (proves `vercel.json` took effect live).
3. Take the first off-site database backup with `scripts/db-backup.mjs` and keep it privately.
4. In Backblaze, confirm the photo bucket's lifecycle keeps prior versions (so deleted photos can be
   unhidden) or accept that recovery is "re-upload from originals".

Accepted risks (not blockers, tracked in ROADMAP): no `script-src` CSP yet; 30-day CDN copy of
later-hidden photos; sitewide (not per-visitor) contact rate limit and per-account lockout;
build-time-only moderate advisories; no real-device or screen reader pass.

## 6. Approval (Joshua Small only)

Leave blank until you decide.

- Production deployment id after merge:
- Smoke run link:
- First off-site backup taken (date, where):
- Decision (approve / hold) and date:
