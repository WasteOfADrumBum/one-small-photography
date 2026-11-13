<!-- generated from .engineering/state.json (revision 13); edit state.json through a checkpoint, not this file -->

# one-small-photography: development status

All values are **agent-reported**, not independently verified. Check GitHub before relying on them.

- Milestone: Photography release (owner decision pending in docs/RELEASE.md section 6)
- Active task: none recorded
- Branch: `main`
- Recorded commit: `dcefd23` on `main`
- Last checkpoint: 2026-11-13T13:00:45Z by Claude Code

## Next action

Joshua Small: tag the albums in the admin (the portfolio filter stays hidden until a visible album has a tag) and look at the admin tag picker, which no one has viewed in a browser. Owner items unchanged: Vercel Web Analytics on or off; release decision (docs/RELEASE.md section 6).

## Completed

- CI/CD brought to the standard in docs/CI-CD.md: PR #30 (merged by Joshua Small as 97eaeb6) and follow-up PR #38 (merged as 7e05123); agent-reported score 92/100 in docs/CI-CD-EVIDENCE.md
- [withheld: possible sensitive data]
- [withheld: possible sensitive data]
- Production smoke on every production deployment, plus daily; alert issues labelled production-alert open and close automatically
- [withheld: possible sensitive data]
- All photos view (/portfolio/all) is on main; the revision 12 record still listed its PR as open
- PR #46 (owner request, 2026-11-12): album tags from a fixed list of 34 kinds of photography (src/lib/album-tags.ts); admin tag picker with removable chips in the album editor; tag filter with chips on /portfolio (any-match, state kept in ?tags=); migration 0003 adds albums.tags (jsonb, default []). Photos are not tagged. Squash-merged as dcefd23
- Protect main ruleset imported from .github/rulesets/protect-main.json on 2026-11-12 (required check: CI gate)

## In progress

_none recorded_

## Tests (agent-reported)

- `Locally on 64e78ce: prettier, eslint, astro check, Vitest 202/202 on Postgres 16, Chromium e2e 68/68 (Firefox/WebKit no…`: pass at `64e78ce`, 2026-11-06T23:20:00Z
- `GitHub CI on main (push) after PR #38`: pass at `7e05123`, 2026-11-06T18:40:00Z
- `Production smoke after the 7e05123 deployment: HTTP 14/14, browser checks failed on the analytics script 404`: fail at `7e05123`, 2026-11-06T18:45:00Z
- `Browser tests (Firefox, WebKit) on 164be9b: 56/56 each`: pass at `164be9b`, 2026-11-06T18:31:00Z
- `PR CI on 8ae8631 (PR #38 head)`: pass at `8ae8631`, 2026-11-06T18:31:00Z
- `Locally: lint, astro check, prettier, Vitest 197 on Postgres 16, workflow lint + zizmor, Chromium e2e 57/57 over HTTP a…`: pass at `164be9b`, 2026-11-06T18:20:00Z
- `Production smoke after the 97eaeb6 deployment: 13/14 (404 cache header)`: fail at `97eaeb6`, 2026-11-06T17:37:00Z
- `Locally on 72d4010: prettier --check, eslint, astro check, vitest run (183 passed, 35 skipped: no local Postgres, so th…`: pass, 2026-11-12T22:40:00Z
- `GitHub CI on PR #46 head 72d4010: CI gate, static checks, unit/integration/migration tests, production build and migrat…`: pass, 2026-11-13T12:55:00Z
- `GitHub CI on main (push) after PR #46`: pass at `dcefd23`, 2026-11-13T12:59:44Z
- `Production smoke after the dcefd23 deployment; agent also read /version.json (commit dcefd23) and /portfolio (200)`: pass at `dcefd23`, 2026-11-13T12:58:58Z

## Unverified changes

- Dependency graph is off, so GitHub dependency review is not in CI
- No VoiceOver or NVDA pass has been done; owner-reported Narrator, keyboard and phone checks from 2026-11-03 stand as owner-reported
- The deployment-failed alert job has not run on a real failed deployment
- Whether GitHub alert emails reach Joshua depends on his notification settings, not checked
- Carried over: file recovery only tested; restoring the real backup into a new database not tested
- Album tags (PR #46): the portfolio filter was viewed by the agent only on a temporary local page with fake albums at one desktop width; the admin tag picker was not viewed in a browser at all; no browser test covers either (the e2e seed has no tagged album, so the filter is hidden in the a11y sweep)
- Album tags (PR #46): no owner review before merge; the owner asked for the merge in the session (2026-11-13) and the previous main is on backup/main-2026-11-13-pre-pr46
- On production no album is tagged yet, so the filter has not been seen working on the live site
