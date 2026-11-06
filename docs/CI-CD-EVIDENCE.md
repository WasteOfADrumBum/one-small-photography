# CI/CD evidence and score (2026-11-06)

The requirements-to-evidence checklist for the CI/CD work in
[PR #30](https://github.com/WasteOfADrumBum/one-small-photography/pull/30), merged by Joshua Small
on 2026-11-06 as `97eaeb6`, and its follow-up
[PR #38](https://github.com/WasteOfADrumBum/one-small-photography/pull/38), merged as `7e05123`. All results are **agent-reported**. Each one links to the run or
deployment it came from. None of them was independently verified by a person.

Status key:

- **PASS:** shown by a run, on the commit named.
- **FAIL:** shown not to work.
- **BLOCKED:** cannot be done or shown from here, with the reason.
- **N/A:** does not apply, with the reason.

Documentation alone never earns a PASS.

Key runs:

| What                             | Run / deployment                                                                                                   | Commit    | Result                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------- | --------------------------------------------------------------------- |
| PR CI, final candidate           | [42095679307](https://github.com/WasteOfADrumBum/one-small-photography/actions/runs/42095679307)                   | `495e652` | pass                                                                  |
| PR CI, gate on a cancelled run   | [42093915820](https://github.com/WasteOfADrumBum/one-small-photography/actions/runs/42093915820)                   | `af70dc5` | gate failed, as designed (Security failed, Browser cancelled)         |
| CI on the merged commit          | [42262945431](https://github.com/WasteOfADrumBum/one-small-photography/actions/runs/42262945431)                   | `97eaeb6` | pass                                                                  |
| CI on the follow-up merge        | [42271766367](https://github.com/WasteOfADrumBum/one-small-photography/actions/runs/42271766367)                   | `7e05123` | pass                                                                  |
| Production deployment            | Vercel `dpl_AhXNq6RBgdZenD7DLosqoGQuhnFM` build log                                                                | `97eaeb6` | READY; "0 new, 3 in total" migrations                                 |
| Smoke after that deployment      | [42263055341](https://github.com/WasteOfADrumBum/one-small-photography/actions/runs/42263055341)                   | `97eaeb6` | fired automatically; 13/14, found the 404 cache header (fixed in #38) |
| Smoke after the follow-up        | [42271830897](https://github.com/WasteOfADrumBum/one-small-photography/actions/runs/42271830897)                   | `7e05123` | HTTP 14/14; browser checks failed on a real defect, see below         |
| Firefox and WebKit, first run    | [42263158099](https://github.com/WasteOfADrumBum/one-small-photography/actions/runs/42263158099)                   | `97eaeb6` | failed: Chromium missing for setup                                    |
| Firefox and WebKit, after fixes  | [42267842079](https://github.com/WasteOfADrumBum/one-small-photography/actions/runs/42267842079)                   | `164be9b` | 56 passed, 0 failed, 0 flaky in each                                  |
| Preview build skipped migrations | Vercel `dpl_6mLbUdGxtXP9BirEpHhivtmgu8Fi` build log: "Skipping database migrations on a preview build"             | `1e463ce` | pass                                                                  |
| Baseline (before)                | [41676021387](https://github.com/WasteOfADrumBum/one-small-photography/actions/runs/41676021387), one "verify" job | `d70f75f` | 77 s                                                                  |

## 1. Application, database and browser validation (25)

Acceptance: real-browser tests of the built app, with real auth, persistence and uploads, run
on every code PR. Every journey and failure path in the brief that the product actually has
is covered. Isolation is enforced in code.

| Requirement                                                                                                                           | Status | Evidence                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser framework with locked dependencies                                                                                            | PASS   | `@playwright/test`, `playwright`, `playwright-core` 1.63.0 and `@axe-core/playwright` 4.14.0, all exact versions in the lockfile                                                                                                                         |
| Exercises the built app: routing, middleware, cookies, auth, API                                                                      | PASS   | `scripts/e2e.mjs` serves `dist/server/entry.mjs` in production mode; 57/57 in run 42095679307                                                                                                                                                            |
| Disposable Postgres, migrated by the real migration path                                                                              | PASS   | `osp_e2e_<run>` is created and then migrated by `scripts/migrate.mjs`; the log is kept as `test-results/e2e-migration.log`                                                                                                                               |
| Isolated temporary image storage                                                                                                      | PASS   | Marked `mkdtemp` folder, passed as `STORAGE_DIR`                                                                                                                                                                                                         |
| Fails clearly when the database or build is missing                                                                                   | PASS   | `scripts/e2e.mjs` exits with a message; tested by hand locally                                                                                                                                                                                           |
| Prevents production endpoints and credentials                                                                                         | PASS   | `test-safety.mjs` refuses: a non-loopback URL, `?host=` / `?hostaddr=`, `B2_*` / `SETUP_TOKEN` / `VERCEL*`. The server gets an allowlisted environment, and mail can go only to a loopback address. `src/test/test-safety.test.ts` covers this (4 tests) |
| Cleans up only resources positively identified as the run's                                                                           | PASS   | Databases are dropped by name pattern, folders by run marker (`isOwnTestStorage`), both covered by tests                                                                                                                                                 |
| No test login routes, auth bypasses or fixture endpoints                                                                              | PASS   | Seeding goes through `/setup` with a random token and the normal admin API. The independent review confirmed none exist                                                                                                                                  |
| Public journeys: home, portfolio, albums, images and aspect ratios, responsive layout                                                 | PASS   | `e2e/public.spec.ts`                                                                                                                                                                                                                                     |
| Lightbox: open, navigate, close, focus restore, keyboard-only                                                                         | PASS   | `e2e/lightbox.spec.ts`                                                                                                                                                                                                                                   |
| Contact: validation, feedback, failure recovery, isolated mail sink                                                                   | PASS   | `e2e/contact.spec.ts` (local sink; real Resend never called)                                                                                                                                                                                             |
| Empty albums, missing images, unknown routes, hidden content                                                                          | PASS   | `e2e/public.spec.ts` (the "Broken Files" fixture, 404s, hidden album and photo)                                                                                                                                                                          |
| Admin journey steps 1–10 through the real UI                                                                                          | PASS   | `e2e/admin.spec.ts`, a serial journey ending in a cookie-replay 401                                                                                                                                                                                      |
| Admin failure paths: credentials, expiry, anonymous, IDs, cross-album, file contents, size, interruption, duplicates, storage failure | PASS   | `e2e/admin.spec.ts`, plus `src/test/integration.test.ts` for a storage failure leaving no record                                                                                                                                                         |
| Database integration tests (existing coverage kept)                                                                                   | PASS   | 196 Vitest tests in CI on Postgres 16                                                                                                                                                                                                                    |
| Firefox and WebKit run of the same suite                                                                                              | PASS   | Run 42267842079: 56/56 in each engine, 0 flaky. The first runs found three real differences (WebKit refuses a `Secure` cookie on `http://localhost`; Firefox misreports a cached script's size; typing before hydration). All fixed in #38               |

Everything runs and passes in Chromium on every PR. Firefox and WebKit pass the same suite weekly. **Score: 25/25.**

## 2. Deployment, migration and recovery safety (20)

Acceptance: CI runs the real production entrypoint against disposable infrastructure. Each of
fresh, upgrade, repeat, failure, missing config and preview isolation is tested. Previews
cannot migrate production. Rollback for code and data is documented.

| Requirement                                                           | Status      | Evidence                                                                                                                                                      |
| --------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI runs `npm run vercel-build` (migrations + build), not just `build` | PASS        | "Production build and migrations" job, run 42095679307                                                                                                        |
| Fresh database                                                        | PASS        | Same job, plus `src/test/migrations.test.ts`                                                                                                                  |
| Database at the previous release's schema, with data                  | PASS        | `migrations.test.ts` "upgrades a database at the previous release"                                                                                            |
| Repeated run applies nothing                                          | PASS        | CI step greps " 0 new"; also covered by a test                                                                                                                |
| Migration failure stops the build, no secret printed                  | PASS        | `migrations.test.ts`: non-zero exit, no `[build]`, URL not printed                                                                                            |
| Missing or invalid configuration                                      | PASS        | Tests: production with no URL, a non-Postgres URL, an unreachable host                                                                                        |
| Preview isolation                                                     | PASS        | `migrate-plan.mjs`: a preview with a database fails. Vercel preview build log shows migrations skipped. Vercel env vars are Production-only (API, 2026-11-05) |
| Concurrent production migrations                                      | PASS        | Vercel Hobby runs one build at a time. Drizzle records applied migrations; the repeat run is tested                                                           |
| Application compatibility during rollout (expand-only)                | PASS        | Destructive-SQL lint, with its own test of what it catches                                                                                                    |
| No destructive production schema change under this task               | PASS        | The PR added no migration. The merged deploy applied "0 new, 3 in total" (Vercel build log)                                                                   |
| Production deploy verified after merge                                | PASS        | Both merges deployed READY; `/version.json` matched `97eaeb6` and then `7e05123` (smoke `wait-for-deployment` log)                                            |
| Recovery for code versus database documented                          | PASS (docs) | `docs/DEPLOYMENT.md` "Rolling back", `docs/RECOVERY.md` §5. A documentation-only item, so it earns no execution credit                                        |

**Score: 19/20.** The one point withheld: the rollback path itself was not exercised. That
would mean a real Instant Rollback in production, which this task did not authorize.

## 3. Workflow and application security validation (20)

| Requirement                                          | Status  | Evidence                                                                                                                                                                    |
| ---------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actions pinned to full SHAs; images and tools pinned | PASS    | zizmor `unpinned-uses` / `unpinned-images` clean (pedantic)                                                                                                                 |
| Automated updates for actions and dependencies       | PASS    | `.github/dependabot.yml`; Dependabot runs started on the merge (2026-11-06 17:35)                                                                                           |
| Least-privilege permissions, documented              | PASS    | zizmor `excessive-permissions` / `undocumented-permissions` clean                                                                                                           |
| Job timeouts; cancel superseded PR runs only         | PASS    | Every job sets `timeout-minutes`. Run 42093915820 was cancelled by a newer push; `main` runs are never cancelled                                                            |
| Serialized smoke and deploy-alert jobs               | PASS    | Job-level concurrency (zizmor `concurrency-limits` clean)                                                                                                                   |
| No untrusted PR code with production credentials     | PASS    | No workflow uses a secret. PR jobs get a read-only token. Fork note in `docs/CI-CD.md`                                                                                      |
| Safe handling of untrusted inputs                    | PASS    | zizmor `template-injection` clean; values passed through `env:` only                                                                                                        |
| No secrets or user data in logs and artifacts        | PASS    | Synthetic data only. Saved sign-in excluded from artifacts. Hidden paths logged by number. DB password redacted (tested)                                                    |
| Workflow syntax and dangerous-pattern checks         | PASS    | actionlint + zizmor in "Static checks"                                                                                                                                      |
| Secret exposure                                      | PASS    | gitleaks, full history, in "Security checks". It caught a real false positive on the first PR run, which was fixed                                                          |
| Dependency vulnerabilities with justified exceptions | PASS    | `audit-policy.mjs`: high or critical always fails; 3 moderate build-time advisories have owner, scope, reason and expiry 2027-02-05                                         |
| GitHub dependency review on PRs                      | BLOCKED | Needs the repository's Dependency graph, which needs admin settings access. The agent's proxy refuses settings writes. The audit policy covers the whole lockfile meanwhile |
| Application security patterns (SAST)                 | PASS    | CodeQL `security-extended`. The fail-on-findings script was tested against a synthetic SARIF and against an empty folder                                                    |
| Session cookies and logout                           | PASS    | `security.spec.ts` (flags), `admin.spec.ts` (cookie replay → 401)                                                                                                           |
| CSRF / origin enforcement                            | PASS    | `security.spec.ts`, plus the production smoke cross-site check                                                                                                              |
| Upload validation and path traversal                 | PASS    | `admin.spec.ts` (fake, PNG, oversized), `security.spec.ts` (traversal)                                                                                                      |
| Stored and reflected XSS                             | PASS    | `security.spec.ts`, plus the contact email-escaping test                                                                                                                    |
| Hidden image caching and visibility                  | PASS    | `security.spec.ts` (private, no-store), smoke hidden-path check                                                                                                             |
| Signed URL handling                                  | N/A     | The app issues no signed URLs. The unused presigner dependency was removed                                                                                                  |
| EXIF / GPS stripping                                 | PASS    | `strip-metadata.ts` covers segments, scans, trailers after the end of image, MPF and fill bytes (9 unit tests). Integration test on stored files, e2e GPS test              |
| Contact abuse and rate limiting                      | PASS    | `integration.test.ts` (429)                                                                                                                                                 |
| Public versus private caching                        | PASS    | `security.spec.ts`, smoke cache checks                                                                                                                                      |

**Score: 19/20.** The one point withheld: dependency review is blocked.

## 4. Accessibility, compatibility and performance (15)

| Requirement                                                                                                                        | Status  | Evidence                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| axe on public and admin pages and open states, WCAG 2.2 tags                                                                       | PASS    | `a11y.spec.ts`; see [ACCESSIBILITY-EVIDENCE.md](ACCESSIBILITY-EVIDENCE.md)                                                                                                   |
| Behaviour checks: names (AX tree), focus visible, containment, restore, announcements, reduced motion, reflow, 200% text, no-hover | PASS    | `a11y.spec.ts`, `lightbox.spec.ts`. They found and fixed a real defect: album links had no name in Chrome                                                                    |
| Chromium on every PR; Firefox and WebKit scheduled                                                                                 | PASS    | axe and behaviour checks pass in all three engines (run 42267842079 and PR CI)                                                                                               |
| Manual screen reader, zoom and visual review                                                                                       | BLOCKED | Needs a person. Owner-reported Narrator, keyboard and phone checks (2026-11-03) are recorded as such; VoiceOver and NVDA are not done                                        |
| JS and CSS budgets                                                                                                                 | PASS    | `performance.spec.ts` with `e2e/budgets.json` (about 15% over measured)                                                                                                      |
| Responsive image selection, no oversized delivery                                                                                  | PASS    | `performance.spec.ts` per viewport and DPR                                                                                                                                   |
| Layout shift from images                                                                                                           | PASS    | CLS ≤ 0.1 with delayed images; width and height declared                                                                                                                     |
| Screenshot comparisons                                                                                                             | N/A     | Not added. The site's GSAP and scroll effects would make them flaky, and the stable layout assertions above cover the risk. The brief asked for them only where maintainable |

**Score: 13/15.** The automated checks pass in all three engines. The manual assistive-technology review needs a person
(−2).

## 5. Merge enforcement and operational monitoring (10)

| Requirement                                                                            | Status         | Evidence                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One stable final check that fails on fail, cancel or unexpected skip                   | PASS           | "CI gate". Run 42093915820 shows it failing on a failed and a cancelled job. The docs-only path is defined; it is first exercised by the docs-only PR that adds this file                                  |
| PRs required, CI gate required and up to date, no force push or delete, minimal bypass | BLOCKED        | The agent's proxy refuses branch-protection and ruleset writes (403, 2026-11-05). `.github/rulesets/protect-main.json` is ready to import. `GET /rules/branches/main` currently returns `[]`               |
| Detection while protection is missing                                                  | PASS           | Daily "Check that main is protected" job opens an alert issue                                                                                                                                              |
| Merge queue support                                                                    | PASS           | `merge_group` trigger; the queue itself is not required for a one-person repo                                                                                                                              |
| Smoke after successful deployment, with identity and readiness                         | PASS           | Fired by the deployment both times, waited for the exact commit, and found two real production defects: the 404 cache header (fixed) and the Vercel Analytics script that 404s on every page (open, below) |
| Failed versus cancelled deployments handled distinctly                                 | PASS (code)    | `deployment-failed` job. No real failure occurred to exercise it, so the code is reviewed but not run                                                                                                      |
| Scheduled fallback kept                                                                | PASS           | Daily cron; [42224562554](https://github.com/WasteOfADrumBum/one-small-photography/actions/runs/42224562554) passed                                                                                        |
| Alerts reach the owner; deduplicated; bounded retries                                  | PASS (partial) | One labelled issue per kind, retries ×3, smoke retry ×1. Whether GitHub emails Joshua depends on his notification settings, which could not be checked                                                     |

**Score: 6/10.** Required protection is not enforced (−4). Everything else runs.

## 6. Speed, diagnostics and maintainability (10)

| Requirement                                     | Status | Evidence                                                                                                                                                                  |
| ----------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR feedback within about 3–8 minutes            | PASS   | Run 42271118896: 2m07s from start to gate. Before: one 77 s job with no browser, build or security checks; the last #30 run took over 12 min, 9m43s of it browser install |
| Lockfile caching, build reuse                   | PASS   | `setup-node` npm cache; one e2e build serves all browser tests; Chromium is cached by lockfile (follow-up PR)                                                             |
| Retries expose flaky tests                      | PASS   | One retry in CI. The summary counts "flaky (passed on retry)" and annotates the run: 0 in run 42095679307                                                                 |
| Failure diagnostics, bounded and sanitised      | PASS   | Vitest JUnit, Playwright report, traces and screenshots, server and migration logs, build log; 7-day retention; auth excluded                                             |
| Evaluated commit and environment recorded       | PASS   | `/version.json`; the smoke check matches the commit                                                                                                                       |
| Everything runnable locally via package scripts | PASS   | `docs/TESTING.md`: `verify`, `test:e2e`, `test:migrations`, `audit:policy`, `secrets:scan`, `workflows:lint`                                                              |

**Score: 10/10.**

## Total

| Category                                     | Max | Score  |
| -------------------------------------------- | --- | ------ |
| Application, database and browser validation | 25  | 25     |
| Deployment, migration and recovery safety    | 20  | 19     |
| Workflow and application security validation | 20  | 19     |
| Accessibility, compatibility and performance | 15  | 13     |
| Merge enforcement and monitoring             | 10  | 6      |
| Speed, diagnostics and maintainability       | 10  | 10     |
| **Total**                                    | 100 | **92** |

**All implementable work completed:** yes, for everything the agent's access allows.

**100/100 achieved:** no. The points still open need, in order of value:

1. **Owner: import `.github/rulesets/protect-main.json`** (Settings → Rules → Rulesets → Import).
   Worth +4.
2. **Owner: turn on the Dependency graph** (Settings → Advanced Security). Then re-add the
   dependency-review step. Worth +1.
3. **A person: a VoiceOver and NVDA pass** over the viewer, contact errors and admin upload.
   Worth +2.
4. **Owner: turn on Web Analytics** in Vercel (Project → Analytics → Enable; free on Hobby), or
   say to remove it. `astro.config.mjs` has injected the analytics script since the first commit,
   but analytics is not on for the project, so `/_vercel/insights/script.js` answers 404 and
   every public page logs two console errors. The post-deploy browser smoke found this; it is a
   site defect, not a pipeline one, so it costs no points, but smoke stays red until it is fixed.
