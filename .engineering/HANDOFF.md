<!-- generated from .engineering/state.json (revision 8) -->

# Handoff: one-small-photography

Read this, then **verify against GitHub** (branch head, open PRs, CI) before continuing. Nothing below is independently verified.

- Checkpoint: revision 8, `ckpt-0008-owner-reported-nov3`, 2026-11-03T15:40:00Z by Claude Code
- Written by: a local edit that the agent then pushed; confirm the branch head matches
- Uncommitted work outside this checkpoint: **none**

## Continue with

A documentation pull request records the owner-reported 2026-11-03 results and the post-merge CI and smoke results. Wait for the owner to review and merge it. Do not record approval.

## Unfinished

- Confirm K:\ encryption
- Owner approval decision in docs/RELEASE.md section 6

## Blockers

- Owner release decision (docs/RELEASE.md section 6)
- K:\ encryption unconfirmed

## Decisions

- [human] Password recovery is an owner-run script against the database; no public reset or registration (Joshua Small's brief for the release)
- [agent] Off-site DB backup is a manual monthly owner step for v1; scheduled encrypted backup is ROADMAP R-2
- [agent] Sessions are excluded from backups; a restored site requires logging in again
- [agent] In-range dependency updates were not applied: they did not fix the build-time-only moderate advisories
- [agent] Default share image is a branded card (public/og-card.jpg); album pages keep their own cover photo
- [agent] Owner scripts print only a redacted message on failure, because Node's own error output can echo the database password
- [agent] Photos and albums get Move earlier/later buttons so reordering does not require dragging (WCAG 2.5.7)
- [agent] 20 moderate advisories are build or dev time only and have no non-downgrade fix; recorded as accepted risk pending the owner's decision

## Constraints

- Non-commercial showcase: no prices, packages, booking or sales
- Free tiers only, no card on file (Vercel Hobby, Neon Free, B2 free, Resend free)
- Never run destructive tests against production; restores only into new empty databases
- Release approval belongs to Joshua Small

## Unresolved decisions

- Keep or drop the proposed contact-page privacy sentence
- Accept 30-day CDN copy of later-hidden photos for v1 (ROADMAP R-3) or prioritise the purge
- Release approval and scope (docs/RELEASE.md section 6, owner)
