<!-- generated from .engineering/state.json (revision 5) -->

# Handoff: one-small-photography

Read this, then **verify against GitHub** (branch head, open PRs, CI) before continuing. Nothing below is independently verified.

- Checkpoint: revision 5, `ckpt-0005-contract-v1-shape`, 2026-11-02T23:10:00Z by Claude Code
- Written by: a local edit that the agent then pushed; confirm the branch head matches
- Uncommitted work outside this checkpoint: **none**

## Continue with

No pull request is open. The release record is docs/RELEASE.md; recovery is docs/RECOVERY.md; optional work is ROADMAP.md. Checkpoint re-recorded in the continuity contract v1 shape (the previous revision failed hub validation and showed as invalid in the hub aggregate); content carried over, nothing new claimed.

## Unfinished

- Owner checklist in docs/RELEASE.md sections 5 and 6

## Blockers

- Owner release decision (docs/RELEASE.md section 6)

## Decisions

- [human] Password recovery is an owner-run script against the database; no public reset or registration (Joshua Small's brief for the release)
- [agent] Off-site DB backup is a manual monthly owner step for v1; scheduled encrypted backup is ROADMAP R-2
- [agent] Sessions are excluded from backups; a restored site requires logging in again
- [agent] In-range dependency updates were not applied: they did not fix the build-time-only moderate advisories
- [agent] Default share image is a branded card (public/og-card.jpg); album pages keep their own cover photo

## Constraints

- Non-commercial showcase: no prices, packages, booking or sales
- Free tiers only, no card on file (Vercel Hobby, Neon Free, B2 free, Resend free)
- Never run destructive tests against production; restores only into new empty databases
- Release approval belongs to Joshua Small

## Unresolved decisions

- Keep or drop the proposed contact-page privacy sentence
- Accept 30-day CDN copy of later-hidden photos for v1 (ROADMAP R-3) or prioritise the purge
- Release approval and scope (docs/RELEASE.md section 6, owner)
