<!-- generated from .engineering/state.json (revision 4) -->

# Handoff: one-small-photography

Read this, then **verify against GitHub** (branch head, open PRs, CI) before continuing. Nothing below is independently verified.

- Checkpoint: revision 4, `why-line-v2-2026-11-02`, 2026-11-02T19:35:00Z by Claude (claude.ai project thread 'Reword the "Why One Small" line')
- Written by: agent, committed on branch `claude/project-thread-s3ukro` (based on `main` @ `ad5a8b2`)
- Uncommitted work outside this checkpoint: **none**
- Links: [ROADMAP.md](../ROADMAP.md), [release record](../docs/RELEASE.md), [recovery runbook](../docs/RECOVERY.md)

## Continue with

Joshua is doing UI updates on a separate branch; this PR touches only the home heading, the letter's first paragraph and its test, so expect at most a small conflict in src/pages/index.astro.

## Unfinished

- Owner checklist in docs/RELEASE.md section 5 (carried over, not re-verified)

## Blockers

- Owner must merge the Why One Small Photo follow-up PR (repo rule)
- Carried over: owner runs Production smoke, first off-site DB backup, and B2 lifecycle check

## Decisions

- Password recovery is an owner-run script against the database; no public reset or registration (per Joshua's brief)
- Off-site DB backup is a manual monthly owner step for v1; scheduled encrypted backup is ROADMAP R-2
- Sessions are excluded from backups; a restored site requires logging in again
- In-range dependency updates were not applied: they did not fix the build-time-only moderate advisories
- Default share image is a branded card (public/og-card.jpg); album pages keep their own cover photo

## Constraints

- Non-commercial showcase: no prices, packages, booking or sales
- Free tiers only, no card on file (Vercel Hobby, Neon Free, B2 free, Resend free)
- Never run destructive tests against production; restores only into new empty databases
- Release approval belongs to Joshua Small

## Unresolved decisions

- Keep or drop the proposed contact-page privacy sentence
- Accept 30-day CDN copy of later-hidden photos for v1 (ROADMAP R-3) or prioritise the purge
