<!-- generated from .engineering/state.json (revision 7); edit state.json through a checkpoint, not this file -->

# one-small-photography: development status

All values are **agent-reported**, not independently verified. Check GitHub before relying on them.

- Milestone: Photography release (owner decision pending in docs/RELEASE.md section 6)
- Active task: none recorded
- Branch: claude/project-thread-svwmjb
- Recorded commit: `d1bc89e` on `claude/project-thread-svwmjb`
- Last checkpoint: 2026-11-03T13:50:00Z by Claude Code

## Next action

Owner: review and merge the follow-up PR for branch claude/project-thread-svwmjb; run scripts/first-backup.ps1 -CheckOnly then without it; check the B2 lifecycle (RECOVERY.md section 4); complete docs/RELEASE.md section 6 yourself.

## Completed

- Fixed the CI unhandled Postgres 57P01 error seen on main run 75: pool.end() resolved before sockets closed; openPool() now waits; regression test added
- WCAG 2.2 pass (axe 4.10 A/AA/2.2 at 5 viewports incl. 200% zoom and 320px reflow, Tab walk, text spacing): fixed clipped admin photo cards on phones, added non-drag reorder buttons, 24px admin link targets. No screen reader run.
- Reconciled docs/RELEASE.md: production smoke run 41498801968 passed 10/10 (read from its logs)
- Reviewed 20 moderate npm advisories (0 high): none in the deployed function bundle, no non-downgrade fix; recovery requirements table added (RELEASE.md 3a)
- Added scripts/verify-backup.mjs, password redaction in db-backup/db-restore, scripts/first-backup.ps1 and backup entries in .gitignore
- B2 recovery settings: no B2 access from the agent; exact console steps written in docs/RECOVERY.md section 4

## In progress

_none recorded_

## Tests (agent-reported)

- `npm run format:check && npm run lint && npm run check && npm test (160 tests in 25 files, Postgres 16 locally, 3 consecutive runs of the integration file clean) && npm run build`: pass at `d39790f`, 2026-11-03T13:42:00Z
- `GitHub CI on PR #28 (pull_request), Postgres 16 service, 0 unhandled errors`: pass at `d1bc89e`, 2026-11-03T13:45:00Z
- `GitHub CI on main @ 153eee0 (push)`: fail at `153eee0`, 2026-11-03T03:42:00Z
- `Production smoke (manual dispatch after the release merge), 10/10 checks`: pass at `c850853`, 2026-11-02T18:15:00Z

## Unverified changes

- scripts/first-backup.ps1 was never run under PowerShell (none available to the agent); its Node steps were run
- Backblaze bucket lifecycle and keys were not inspected (no B2 access)
- No screen reader (NVDA, JAWS, VoiceOver, TalkBack) or real-device test; accessibility checks were Chromium only
- Carried over: share card in real link previews, photo-audit against B2
