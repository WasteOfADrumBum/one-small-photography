<!-- generated from .engineering/state.json (revision 1) -->

# Handoff: one-small-photography

Read this, then **verify against GitHub** (branch head, open PRs, CI) before continuing. Nothing below is independently verified.

- Checkpoint: revision 1, `closeout-2026-11-02-photo`, 2026-11-02T17:06:51Z by Claude Code
- Written by: a local edit that the agent then pushed; confirm the branch head matches
- Uncommitted work outside this checkpoint: **none**

## Continue with

Read docs/release-scope-1.0.0.md and ROADMAP.md, then the hub acceptance record docs/acceptance/closeout-2026-11-02.md. Do not add roadmap items to 1.0.0.

## Unfinished

- Owner scope approval, advisory disposition and gate verifications (hub acceptance record).

## Blockers

- scope-document-missing stays open in the hub until the owner approves the scope.

## Decisions

- [agent] Proposed 1.0.0 as the first release name for the live site; Neon Postgres and B2 storage are in scope as already shipped; no new features. Owner approval pending.

## Constraints

- Release approval, tags and gate verification belong to Joshua Small.
- Enhancements live in ROADMAP.md and never block or reopen an accepted release.
- Secrets (database URL, B2 keys, RESEND_API_KEY, SETUP_TOKEN) stay in Vercel environment variables.

## Unresolved decisions

- Owner approval of the 1.0.0 scope draft.
- 4 moderate advisories via @astrojs/vercel -> @vercel/nft (build-time file tracing) need an owner disposition under security-privacy-review; none high or critical.
