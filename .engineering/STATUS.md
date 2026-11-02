<!-- generated from .engineering/state.json (revision 1); edit state.json through a checkpoint, not this file -->

# one-small-photography: development status

All values are **agent-reported**, not independently verified. Check GitHub before relying on them.

- Milestone: 1.0.0 first accepted release of the live site (scope draft awaiting owner approval)
- Active task: photo-1.0.0-acceptance: Owner acceptance of Photography 1.0.0 under the hub Showcase Definition of Done
- Branch: `claude/closeout-roadmap`
- Recorded commit: `d926563` on `main`
- Last checkpoint: 2026-11-02T17:06:51Z by Claude Code

## Next action

Owner: review and merge the closeout PR (approves docs/release-scope-1.0.0.md), then record gate verifications with verify:record in the hub as listed in docs/acceptance/closeout-2026-11-02.md. Future optional work is in ROADMAP.md and never reopens 1.0.0.

## Completed

- Phone header menu (#17), title and footer polish (#18), contact notes emailed through Resend (#19), CSP and XSS regression test (#20), continuity contract (#21)
- Branch claude/closeout-roadmap: docs/release-scope-1.0.0.md draft (database and B2 storage in scope as shipped), ROADMAP.md, README rollback and release links, CI token limited to contents: read
- Owner reported (Joshua Small, project chat 2026-11-02): contact emails arrive and galleries work live. Recorded as owner-reported evidence in the hub acceptance record; not gate verifications

## In progress

_none recorded_

## Tests (agent-reported)

- `npm run format:check, lint, check (astro check)`: pass at `d926563`, 2026-11-02T17:20:00Z
- `npm test (119 passed, 21 database tests skipped without TEST_DATABASE_URL)`: pass at `d926563`, 2026-11-02T17:20:00Z

## Unverified changes

- Database tests run only in CI (throwaway Postgres); not run locally in this session.
- No manual keyboard, screen-reader or responsive pass recorded by the verifier yet.
