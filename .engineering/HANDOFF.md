<!-- generated from .engineering/state.json (revision 7) -->

# Handoff: one-small-photography

Read this, then **verify against GitHub** (branch head, open PRs, CI) before continuing. Nothing below is independently verified.

- Checkpoint: revision 7, `ckpt-0007-pr28-ci-green`, 2026-11-03T13:50:00Z by Claude Code
- Written by: a local edit that the agent then pushed; confirm the branch head matches
- Uncommitted work outside this checkpoint: **none**

## Continue with

Pull request #28 (branch claude/project-thread-svwmjb) has green CI on d1bc89e. The owner reviews and merges. Do not record approval.

## Unfinished

- Owner checklist in docs/RELEASE.md sections 5 and 6
- First off-site backup
- B2 lifecycle check
- Screen reader and real-device pass

## Blockers

- Owner release decision (docs/RELEASE.md section 6)
- No PowerShell or B2 access in the agent environment

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
