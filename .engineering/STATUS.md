<!-- generated from .engineering/state.json (revision 4); edit state.json through a checkpoint, not this file -->

# one-small-photography: development status

All values are **agent-reported**, not independently verified. Check GitHub before relying on them.

- Milestone: Post-release polish: home page copy
- Active task: Follow-up to PR #25: white "Why" and a letter that opens with a P (branch claude/project-thread-s3ukro, based on main ad5a8b2)
- Branch: `claude/project-thread-s3ukro`
- Recorded commit: `ad5a8b2` (base on `main`)
- Last checkpoint: 2026-11-02T19:35:00Z by Claude (claude.ai project thread 'Reword the "Why One Small" line')
- Roadmap: [ROADMAP.md](../ROADMAP.md) · Release record: [docs/RELEASE.md](../docs/RELEASE.md)

## Next action

Joshua reviews and merges the follow-up PR. Release owner checklist in docs/RELEASE.md section 5 still applies.

## Completed

- PR #25 merged to main (ad5a8b2), per GitHub
- Heading: 'Why One Small' in paper/white, 'Photo' in gold (Joshua: the sand 'Why' looked odd)
- Letter now opens 'Photography, for me, comes down to one small photo: a single frame, one moment, seen clearly and kept.' (Joshua wanted a P drop cap; the O looked too square)

## In progress

_none recorded_

## Tests (agent-reported)

- `npm run lint && npm run check && npm test && npm run build`: pass (125 passed, 24 skipped: DB tests skipped, no local Postgres) (2026-11-02T19:35:00Z)
- `astro dev + Playwright screenshots of the home 'Why One Small Photo' section at 1280 and 390 wide`: heading and letter render as intended; before/after attached to the PR (2026-11-02T19:35:00Z)

## Unverified changes

- Carried over: share card in real link previews, vercel.json headers on live pages, photo-audit against B2, real-device and screen reader checks
