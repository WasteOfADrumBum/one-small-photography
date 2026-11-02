<!-- generated from .engineering/state.json (revision 1); edit state.json through a checkpoint, not this file -->

# one-small-photography: development status

All values are **agent-reported**, not independently verified. Check GitHub before relying on them.

- Milestone: Photography showcase v1 release closure
- Active task: Release closure PR awaiting owner review (branch claude/project-thread-hwo1nn, based on main d926563)
- Branch: `claude/project-thread-hwo1nn`
- Recorded commit: `d926563` (base on `main`)
- Last checkpoint: 2026-11-02T18:00:00Z by Claude (claude.ai project thread 'Close the photography release')
- Roadmap: [ROADMAP.md](../ROADMAP.md) · Release record: [docs/RELEASE.md](../docs/RELEASE.md)

## Next action

Joshua reviews and merges the release PR, then runs the owner checklist in docs/RELEASE.md section 5 and records approval in section 6

## Completed

- Reconciled site/WCAG audit (PR #16) and XSS audit (PR #20) against current code; both merged and deployed
- Verified admin auth, CSRF, sessions, lockout, setup protection, private content and error handling (tests + local browser run)
- Added upload byte-signature check (src/lib/image-type.ts)
- Added vercel.json security headers for prerendered pages with a sync test
- Fixed phone horizontal overflow (WCAG 1.4.10) and an indistinguishable admin link (1.4.1); axe 0 violations on 10 pages x 2 widths
- Restore drill on disposable Neon branch: all tables matched production checksums; branch deleted
- Added owner scripts: reset-admin-password, db-backup, db-restore, photo-audit, smoke; Production smoke workflow
- Wrote docs/RECOVERY.md, docs/RELEASE.md (acceptance record), ROADMAP.md; linked from README

## In progress

_none recorded_

## Tests (agent-reported)

- `npm run format:check && npm run lint && npm run check && npm test && npm run build`: pass (149 tests, 23 files, DB tests on local Postgres 16) (2026-11-02T18:00:00Z)
- `Playwright + axe-core 4.10 on local dev server, 10 pages at 375x812 and 1280x800`: 0 violations, no horizontal overflow after fixes (2026-11-02T18:00:00Z)
- `Neon restore drill via Neon API (disposable branch, json_agg -> json_populate_recordset)`: counts and md5 per table identical to production (2026-11-02T17:03:00Z)

## Unverified changes

- vercel.json headers on live prerendered pages (confirm with Production smoke after deploy)
- scripts/photo-audit.mjs against the real B2 bucket (no B2 access from the agent)
- Real-device and screen reader checks
