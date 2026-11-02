<!-- generated from .engineering/state.json (revision 5); edit state.json through a checkpoint, not this file -->

# one-small-photography: development status

All values are **agent-reported**, not independently verified. Check GitHub before relying on them.

- Milestone: Photography release (owner decision pending in docs/RELEASE.md section 6)
- Active task: none recorded
- Branch: unknown
- Recorded commit: `e3bc6d2` on `main`
- Last checkpoint: 2026-11-02T23:10:00Z by Claude Code

## Next action

Owner: complete docs/RELEASE.md section 6 (scope approval, first off-site backup, B2 version lifecycle, the 4 moderate build-time advisories). Optional work in ROADMAP.md.

## Completed

- PR #22 merged by Joshua Small as e3bc6d2: CI workflow token limited to contents: read; CI green on main
- PR #26 merged (48efb13): white "Why One Small" heading and a letter that opens with a P
- PR #25 merged to main (ad5a8b2), per GitHub
- Heading: 'Why One Small' in paper/white, 'Photo' in gold (Joshua: the sand 'Why' looked odd)
- Letter now opens 'Photography, for me, comes down to one small photo: a single frame, one moment, seen clearly and kept.' (Joshua wanted a P drop cap; the O looked too square)

## In progress

_none recorded_

## Tests (agent-reported)

- `npm run lint && npm run check && npm test && npm run build (125 passed, 24 DB tests skipped locally)`: pass, 2026-11-02T19:35:00Z
- `GitHub CI on main (push, read-only token)`: pass at `e3bc6d2`, 2026-11-02T22:16:00Z
- `Production smoke (manual dispatch after the release merge)`: pass at `c850853`, 2026-11-02T18:15:00Z

## Unverified changes

- Carried over: share card in real link previews, vercel.json headers on live pages, photo-audit against B2, real-device and screen reader checks
