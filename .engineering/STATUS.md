<!-- generated from .engineering/state.json (revision 8); edit state.json through a checkpoint, not this file -->

# one-small-photography: development status

All values are **agent-reported**, not independently verified. Check GitHub before relying on them.

- Milestone: Photography release (owner decision pending in docs/RELEASE.md section 6)
- Active task: none recorded
- Branch: claude/project-thread-svwmjb
- Recorded commit: `083627e` on `claude/project-thread-svwmjb`
- Last checkpoint: 2026-11-03T15:40:00Z by Claude Code

## Next action

Owner: confirm K:\ encryption, then decide on docs/RELEASE.md section 6 yourself. No agent step remains.

## Completed

- PR #28 merged as a1227ca; main CI run 78 green (per GitHub)
- Production deployment dpl_7xGuAn2vCBEnj1ag4ET6J3J4LSXU READY at a1227ca (per Vercel API)
- Production smoke run 41664171346 passed 10/10 after that deployment (read from its log)
- docs/RELEASE.md and docs/RECOVERY.md updated with the owner's 2026-11-03 results, labelled owner-reported; file recovery kept distinct from database-record restoration; K:\ encryption marked unconfirmed
- Fixed the CI unhandled Postgres 57P01 error, WCAG 2.2 defects, backup tooling (PR #28)

## In progress

_none recorded_

## Tests (agent-reported)

- `GitHub CI on main (push) after PR #28`: pass at `a1227ca`, 2026-11-03T14:31:00Z
- `Production smoke (manual dispatch after the PR #28 deployment), 10/10 checks`: pass at `a1227ca`, 2026-11-03T15:28:00Z
- `npm run format:check && npm run lint && npm run check && npm test (160 tests, Postgres 16) && npm run build, run locally on the PR #28 branch`: pass at `d39790f`, 2026-11-03T13:42:00Z
- `GitHub CI on main @ 153eee0 (push) before the fix`: fail at `153eee0`, 2026-11-03T03:42:00Z

## Unverified changes

- Owner-reported 2026-11-03, not verified by the agent: keyboard, Narrator and phone checks passed; first-backup.ps1 ran under PowerShell 7.6.9; backup verified and its copy on K:\ matched the SHA-256; B2 bucket private with Keep all versions; retained sm.webp opened after deleting a disposable photo
- File recovery only: restoring a deleted photo's database record, and restoring the real backup file into a new database, have not been tested
- Encryption of K:\ is not confirmed
- The agent never ran first-backup.ps1 under PowerShell and has no B2 access
- Carried over: share card in real link previews, photo-audit against B2
