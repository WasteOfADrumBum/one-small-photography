<!-- generated from .engineering/state.json (revision 2); edit state.json through a checkpoint, not this file -->

# one-small-photography: development status

All values are **agent-reported**, not independently verified. Check GitHub before relying on them.

- Milestone: Post-release polish: social share card
- Active task: Share card PR awaiting owner review (branch claude/project-thread-j083m5, based on main c850853)
- Branch: `claude/project-thread-j083m5`
- Recorded commit: `c850853` (base on `main`)
- Last checkpoint: 2026-11-02T18:25:00Z by Claude (claude.ai project thread 'Make a social share card')
- Roadmap: [ROADMAP.md](../ROADMAP.md) · Release record: [docs/RELEASE.md](../docs/RELEASE.md)

## Next action

Joshua reviews and merges the share card PR; then paste a page URL into a link preview tool (e.g. opengraph.xyz) to confirm the card shows. Release owner checklist in docs/RELEASE.md section 5 still applies.

## Completed

- Release closure PR #23 merged to main (c850853), per GitHub
- Added public/og-card.jpg (1200x630 branded share card: logo, tagline, Triad cities and domain; no photo, per Joshua)
- BaseLayout uses the card as the default og:image with width/height/alt; added og:site_name and twitter:title/description/image; album pages still share their cover photo

## In progress

_none recorded_

## Tests (agent-reported)

- `npm run lint && npm run check && npm test && npm run build`: pass (125 passed, 24 skipped: DB tests skipped, no local Postgres) (2026-11-02T18:25:00Z)
- `astro dev, curl /the-triad, grep og:/twitter: meta`: og:image and twitter:image point at https://photo.onesmall.company/og-card.jpg with 1200x630 (2026-11-02T18:25:00Z)

## Unverified changes

- Share card rendering in real Facebook/LinkedIn/X/iMessage previews (needs the deployed site)
- Carried over: vercel.json headers on live pages, photo-audit against B2, real-device and screen reader checks
