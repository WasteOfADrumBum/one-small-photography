<!-- generated from .engineering/state.json (revision 1) -->

# Handoff: one-small-photography

Read this, then **verify against GitHub** (branch head, open PRs, CI) before continuing. Nothing below is independently verified.

- Checkpoint: revision 1, `release-closure-2026-11-02`, 2026-11-02T18:00:00Z by Claude (claude.ai project thread 'Close the photography release')
- Written by: agent, committed on branch `claude/project-thread-hwo1nn` (based on `main` @ `d926563`)
- Uncommitted work outside this checkpoint: **none**
- Links: [ROADMAP.md](../ROADMAP.md), [release record](../docs/RELEASE.md), [recovery runbook](../docs/RECOVERY.md)

## Continue with

Read docs/RELEASE.md section 5. After merge: GitHub Actions > Production smoke > Run workflow; expect 10/10. Then DATABASE_URL=<prod> node scripts/db-backup.mjs <private path>.

## Unfinished

- Owner checklist in docs/RELEASE.md section 5

## Blockers

- Owner must merge the release PR (repo rule)
- Owner must run Production smoke after deploy and take the first off-site DB backup
- Owner must check B2 bucket lifecycle keeps prior versions

## Decisions

- Password recovery is an owner-run script against the database; no public reset or registration (per Joshua's brief)
- Off-site DB backup is a manual monthly owner step for v1; scheduled encrypted backup is ROADMAP R-2
- Sessions are excluded from backups; a restored site requires logging in again
- In-range dependency updates were not applied: they did not fix the build-time-only moderate advisories

## Constraints

- Non-commercial showcase: no prices, packages, booking or sales
- Free tiers only, no card on file (Vercel Hobby, Neon Free, B2 free, Resend free)
- Never run destructive tests against production; restores only into new empty databases
- Release approval belongs to Joshua Small

## Unresolved decisions

- Keep or drop the proposed contact-page privacy sentence
- Accept 30-day CDN copy of later-hidden photos for v1 (ROADMAP R-3) or prioritise the purge
