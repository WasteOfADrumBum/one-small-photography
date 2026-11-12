<!-- generated from .engineering/state.json (revision 12); edit state.json through a checkpoint, not this file -->

# one-small-photography: development status

All values are **agent-reported**, not independently verified. Check GitHub before relying on them.

- Milestone: Photography release (owner decision pending in docs/RELEASE.md section 6)
- Active task: none recorded
- Branch: `claude/project-thread-keruxw`
- Recorded commit: `64e78ce` on `claude/project-thread-keruxw`
- Last checkpoint: 2026-11-12T02:08:42Z by Claude Code

## Next action

Joshua: review and merge the All photos PR. Owner items unchanged: import .github/rulesets/protect-main.json, and decide on Vercel Web Analytics.

## Completed

- All photos view: /portfolio/all (button on /portfolio) shows every visible photo in batches of 24 with lazy images; branch claude/project-thread-keruxw at 64e78ce, PR open for Joshua's review
- CI/CD brought to the standard in docs/CI-CD.md: PR #30 (merged by Joshua Small as 97eaeb6) and follow-up PR #38 (merged as 7e05123); agent-reported score 92/100 in docs/CI-CD-EVIDENCE.md
- [withheld: possible sensitive data]
- [withheld: possible sensitive data]
- Production smoke on every production deployment, plus daily; alert issues labelled production-alert open and close automatically
- [withheld: possible sensitive data]

## In progress

_none recorded_

## Tests (agent-reported)

- `Locally on 64e78ce: prettier, eslint, astro check, Vitest 202/202 on Postgres 16, Chromium e2e 68/68 (Firefox/WebKit no…`: pass at `64e78ce`, 2026-11-06T23:20:00Z
- `GitHub CI on main (push) after PR #38`: pass at `7e05123`, 2026-11-06T18:40:00Z
- `Production smoke after the 7e05123 deployment: HTTP 14/14, browser checks failed on the analytics script 404`: fail at `7e05123`, 2026-11-06T18:45:00Z
- `Browser tests (Firefox, WebKit) on 164be9b: 56/56 each`: pass at `164be9b`, 2026-11-06T18:31:00Z
- `PR CI on 8ae8631 (PR #38 head)`: pass at `8ae8631`, 2026-11-06T18:31:00Z
- `Locally: lint, astro check, prettier, Vitest 197 on Postgres 16, workflow lint + zizmor, Chromium e2e 57/57 over HTTP a…`: pass at `164be9b`, 2026-11-06T18:20:00Z
- `Production smoke after the 97eaeb6 deployment: 13/14 (404 cache header)`: fail at `97eaeb6`, 2026-11-06T17:37:00Z

## Unverified changes

- Branch protection on main is not set: the agent's proxy refuses settings writes (403). The ruleset file is ready to import; a daily job alerts while it is missing
- Dependency graph is off, so GitHub dependency review is not in CI
- No VoiceOver or NVDA pass has been done; owner-reported Narrator, keyboard and phone checks from 2026-11-03 stand as owner-reported
- The deployment-failed alert job has not run on a real failed deployment
- Whether GitHub alert emails reach Joshua depends on his notification settings, not checked
- Carried over: file recovery only tested; restoring the real backup into a new database not tested
