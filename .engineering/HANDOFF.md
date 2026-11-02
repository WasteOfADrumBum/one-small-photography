<!-- generated from .engineering/state.json (revision 2) -->

# Handoff: one-small-photography

Read this, then **verify against GitHub** (branch head, open PRs, CI) before continuing. Nothing below is independently verified.

- Checkpoint: revision 2, `share-card-2026-11-02`, 2026-11-02T18:25:00Z by Claude (claude.ai project thread 'Make a social share card')
- Written by: agent, committed on branch `claude/project-thread-j083m5` (based on `main` @ `c850853`)
- Uncommitted work outside this checkpoint: **none**
- Links: [ROADMAP.md](../ROADMAP.md), [release record](../docs/RELEASE.md), [recovery runbook](../docs/RECOVERY.md)

## Continue with

After merge and deploy, check a shared link preview. Share card source HTML lives in the project files (share-card/og-card.html), rendered with Playwright at 1200x630.

## Unfinished

- Owner checklist in docs/RELEASE.md section 5 (carried over, not re-verified)

## Blockers

- Owner must merge the share card PR (repo rule)
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
