# One Small Photography 1.0.0: release scope (draft for owner approval)

Status: **DRAFT**, proposed 2026-11-02 by Claude Code (builder). It becomes the approved scope only
when Joshua Small approves it; until then the hub keeps blocker `scope-document-missing` open.

Project: `one-small-photography` in the
[One Small Engineering registry](https://github.com/WasteOfADrumBum/one-small-engineering/blob/main/projects/registry.json).
Tier: **Showcase** (10 gates in the hub's
[Definition of Done](https://github.com/WasteOfADrumBum/one-small-engineering/blob/main/standards/definition-of-done.md)).
Non-commercial: no prices, packages or booking.

## Why 1.0.0, and the database and storage question

There are no tags or releases; `package.json` 0.1.0 is a placeholder. The hub's open question was
whether Neon Postgres and Backblaze B2 belong in the first release. They are already built and
live (albums, photos, admin, contact notes), so this draft puts them **in scope** as shipped, with
no new infrastructure work. Production at [photo.onesmall.company](https://photo.onesmall.company)
serves `main`.

## In scope

| #   | Item                                                                                    | Where                                                             |
| --- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| S1  | Home, The Triad, Under the Hood, 404, header (phone menu) and footer                    | `src/pages/`, `src/components/`, PRs #17, #18                     |
| S2  | Portfolio galleries: album index and album pages, images served through `/img/[id]`     | `src/pages/portfolio/`, `src/pages/img/`                          |
| S3  | Contact notes stored and emailed through Resend                                         | `src/pages/api/contact.ts`, PR #19                                |
| S4  | Admin: one-time `/setup`, login and logout, album, photo, gear and message management   | `src/pages/admin/`, `src/pages/api/admin/`, `src/pages/api/auth/` |
| S5  | Neon Postgres (Drizzle migrations on production deploys) and Backblaze B2 photo storage | `src/db/`, `drizzle/`                                             |
| S6  | Content Security Policy and the album-page XSS regression test                          | PR #20, `src/middleware.ts`                                       |
| S7  | CI: format, lint, type check, tests (with a throwaway Postgres), build                  | `.github/workflows/ci.yml`                                        |
| S8  | Accurate README (stack, develop, deploy, rollback)                                      | `README.md`                                                       |

## Acceptance criteria (Showcase gates)

| Gate                      | Criterion for 1.0.0                                                                                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scope-complete`          | Owner approves this document; S1–S8 present on the release commit.                                                                                                                 |
| `automated-checks`        | CI green on the release commit.                                                                                                                                                    |
| `security-privacy-review` | Admin auth, session handling, upload paths, contact notes (personal data retention) and CSP reviewed under the hub's `standards/security.md`; production advisories dispositioned. |
| `wcag-22-aa`              | Automated check on home, a gallery and contact, plus the owner's manual review.                                                                                                    |
| `keyboard-screen-reader`  | Owner keyboard-only and screen-reader pass over navigation, a gallery and the contact form.                                                                                        |
| `responsive-layouts`      | Owner checks phone, tablet, desktop and 200% zoom.                                                                                                                                 |
| `critical-workflows`      | Navigation, galleries and the contact form (email arrives) work in production.                                                                                                     |
| `production-deployment`   | photo.onesmall.company serves the release commit (Vercel deployment id recorded).                                                                                                  |
| `documentation-accurate`  | README matches the project as built.                                                                                                                                               |
| `no-release-blockers`     | No open blocker in the registry.                                                                                                                                                   |

## Out of scope (see [ROADMAP.md](../ROADMAP.md))

More photos and albums, booking or sales features, any redesign. Content updates never block or
reopen this release.

## Release identity

Tag `v1.0.0` on the accepted commit and set `package.json` to 1.0.0 only after owner approval. The
tag and any GitHub release are owner actions.
