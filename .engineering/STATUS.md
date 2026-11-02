<!-- generated from .engineering/state.json (revision 3); edit state.json through a checkpoint, not this file -->

# one-small-photography: development status

All values are **agent-reported**, not independently verified. Check GitHub before relying on them.

- Milestone: Post-release polish: home page copy
- Active task: "Why One Small Photo" reword PR awaiting owner review (branch claude/project-thread-s3ukro, based on main 9db5526)
- Branch: `claude/project-thread-s3ukro`
- Recorded commit: `9db5526` (base on `main`)
- Last checkpoint: 2026-11-02T19:10:00Z by Claude (claude.ai project thread 'Reword the "Why One Small" line')
- Roadmap: [ROADMAP.md](../ROADMAP.md) · Release record: [docs/RELEASE.md](../docs/RELEASE.md)

## Next action

Joshua reviews the wording and merges the PR (he may want his own sentence). Release owner checklist in docs/RELEASE.md section 5 still applies.

## Completed

- Share card PR #24 merged to main (9db5526), per GitHub
- Home page letter: first line no longer mentions the family name or One Small Family/Studio; it now reads 'One Small Photo is about the single frame: one moment, seen clearly and kept.' (per Joshua)
- Home page heading: 'Why' in sand, 'One Small' in paper and 'Photo' in gold, both semibold, matching the logo wordmark

## In progress

_none recorded_

## Tests (agent-reported)

- `npm run lint && npm run check && npm test && npm run build`: pass (125 passed, 24 skipped: DB tests skipped, no local Postgres) (2026-11-02T19:10:00Z)
- `astro dev + Playwright screenshots of the home 'Why One Small Photo' section at 1280 and 390 wide`: heading and letter render as intended; before/after attached to the PR (2026-11-02T19:10:00Z)

## Unverified changes

- Carried over: share card in real link previews, vercel.json headers on live pages, photo-audit against B2, real-device and screen reader checks
