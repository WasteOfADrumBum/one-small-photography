<!-- generated from .engineering/state.json (revision 13) -->

# Handoff: one-small-photography

Read this, then **verify against GitHub** (branch head, open PRs, CI) before continuing. Nothing below is independently verified.

- Checkpoint: revision 13, `album-tags-pr46-2026-11-13`, 2026-11-13T13:00:45Z by Claude Code (claude-fable-5-2)
- Written by: the hub writer (committed through the GitHub API)
- Uncommitted work outside this checkpoint: **none**

## Continue with

PR #46 (album tags and portfolio filter) is merged as dcefd23 and production serves it; CI on main and the production smoke passed. The previous main (f118807) is kept on backup/main-2026-11-13-pre-pr46. Nothing is in progress. The owner's local checkout is on hero-logo-animation, 84 commits behind main when checked on 2026-11-12; expect conflicts in portfolio/index.astro if that branch is revived. Next: owner tags albums; then add browser tests for the filter. Do not record approval.

## Unfinished

- Owner: tag albums in the admin; check the admin tag picker and the portfolio filter in a browser
- Browser tests for the tag filter and the tag picker (seed a tagged album in e2e/seed.setup.ts)
- Owner: Vercel Web Analytics on or off
- Owner release decision (docs/RELEASE.md section 6)

## Blockers

_none recorded_

## Decisions

- [human] Password recovery is an owner-run script against the database; no public reset or registration (Joshua Small's brief for the release)
- [agent] Off-site DB backup is a manual monthly owner step for v1; scheduled encrypted backup is ROADMAP R-2
- [agent] Sessions are excluded from backups; a restored site requires logging in again
- [agent] In-range dependency updates were not applied: they did not fix the build-time-only moderate advisories
- [agent] Default share image is a branded card (public/og-card.jpg); album pages keep their own cover photo
- [agent] Owner scripts print only a redacted message on failure, because Node's own error output can echo the database password
- [agent] Photos and albums get Move earlier/later buttons so reordering does not require dragging (WCAG 2.5.7)
- [agent] 20 moderate advisories are build or dev time only and have no non-downgrade fix; recorded as accepted risk pending the owner's decision
- [human] The verified database backup copy on K:\ stays unencrypted; the owner accepts the risk of exposing contact data and the admin password hash if someone accesses that drive (Joshua Small, project thread, 2026-11-03T16:10:42Z)
- [agent] Firefox/WebKit tests serve the built site over HTTPS with a throwaway certificate because WebKit refuses Secure cookies on http://localhost; the PR suite stays on HTTP
- [agent] GitHub dependency review removed from CI until the owner turns on the Dependency graph; the npm audit policy covers the lockfile meanwhile

## Constraints

- Non-commercial showcase: no prices, packages, booking or sales
- Free tiers only, no card on file (Vercel Hobby, Neon Free, B2 free, Resend free)
- Never run destructive tests against production; restores only into new empty databases
- Release approval belongs to Joshua Small

## Unresolved decisions

- Keep or drop the proposed contact-page privacy sentence
- Accept 30-day CDN copy of later-hidden photos for v1 (ROADMAP R-3) or prioritise the purge
- Release approval and scope (docs/RELEASE.md section 6, owner)
- Vercel Web Analytics: turn it on for the project, or remove webAnalytics from astro.config.mjs (owner)
