# CI/CD

How changes are checked, merged, deployed and watched, and the evidence behind each claim.
Testing commands: [TESTING.md](TESTING.md). Deployment and migrations:
[DEPLOYMENT.md](DEPLOYMENT.md). Accessibility: [ACCESSIBILITY-EVIDENCE.md](ACCESSIBILITY-EVIDENCE.md).

## Workflows

| Workflow               | Runs on                                                         | Does                                                            |
| ---------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| `ci.yml` "CI"          | every pull request, push to `main`, merge queue, by hand        | everything below, ending in the one required check, **CI gate** |
| `production-smoke.yml` | each successful production deployment, daily 13:17 UTC, by hand | read-only HTTP and browser checks of the live site; alert issue |
| `browsers.yml`         | weekly (Monday 09:41 UTC), by hand                              | the full browser suite in Firefox and WebKit; alert issue       |
| Dependabot             | weekly                                                          | grouped npm and GitHub Actions update pull requests, through CI |

### CI jobs

All run in parallel; the gate waits for all of them.

| Job                                   | Checks                                                                                                                                                       | Skipped when      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| What changed                          | Classifies the change as docs-only or code                                                                                                                   | never             |
| Static checks                         | Prettier, ESLint, `astro check` (types), actionlint and zizmor on the workflows                                                                              | never             |
| Unit, integration and migration tests | Vitest against a disposable Postgres: API, auth, uploads, visibility, contact, backups, migrations                                                           | never             |
| Production build and migrations       | `npm run vercel-build` with `VERCEL_ENV=production` on an empty Postgres; a second run applies nothing; the preview path skips; the Vercel output is checked | docs-only changes |
| Browser tests (Chromium)              | The Playwright suite against the built site; see [TESTING.md](TESTING.md)                                                                                    | docs-only changes |
| Security checks                       | `npm audit` policy, gitleaks over the full history, dependency review on pull requests                                                                       | never             |
| CodeQL                                | `security-extended` queries over `src` and `scripts`; fails on errors or high severity                                                                       | never             |
| **CI gate**                           | Passes only if every job passed, or a job allowed to skip did so for a docs-only change                                                                      | never             |

**Why one gate:** branch protection needs one stable check name. The gate fails when any job
fails, is cancelled, or is skipped for any reason other than a docs-only change, and when "What
changed" itself did not give a valid answer. Docs-only pull requests still get a passing gate,
so they never wait on a check that will not run.

Docs-only means every changed file is under `docs/` or `.engineering/`, is a Markdown file, or
is `LICENSE` (`scripts/ci/classify-changes.mjs`). Anything else counts as code.

### Workflow safety

- Every third-party action is pinned to a full commit SHA (with the version in a comment), the
  Postgres image to a digest, and the downloaded tools (actionlint, zizmor, gitleaks) to a
  version and SHA-256. Dependabot proposes updates.
- Default permission is `contents: read`. Only CodeQL can write security results, and only the
  alert steps can write issues.
- No workflow uses a secret. CI never sees production credentials; pull request code runs
  only with the read-only token. Checkouts do not keep the token (`persist-credentials: false`).
- Untrusted values (branch names, deployment fields) reach scripts only through environment
  variables, never inside `run:` text. zizmor checks this.
- Every job has a timeout. Pull request runs are cancelled when a newer push replaces them;
  runs on `main`, smoke runs and browser runs never are.
- Failure artifacts (test reports, traces, server and migration logs, build log) are kept 7
  days, exclude the saved sign-in, and hold only synthetic data.

**Known limit:** GitHub runs a `deployment_status` workflow from the deployed commit's own copy
of the workflow file. The smoke job runs only for a Production deployment made by Vercel, checks
out `main` for its scripts, and verifies that the commit is on `main`, but a preview of a pull
request from a fork could carry its own edited workflow file. Keep Vercel's "Git Fork
Protection" on (Vercel → Project → Settings → Git) so fork pull requests need approval before
they deploy at all; it could not be read from here.

## After a deployment

`production-smoke.yml`, on a deployment status from Vercel:

1. Runs only for environment `Production`, state `success`, created by `vercel[bot]`. A
   `failure` or `error` status runs a separate job that opens a "Production deployment failed"
   alert instead. Previews never run either job.
2. Checks the commit is a full SHA that is on `main`, then polls `/version.json` (every 15 s, up
   to 10 minutes) until the live site reports that commit. If a newer commit on `main` is live
   by then, this run stands down without testing (the newer deployment has its own run). If
   neither appears, it fails.
3. HTTP checks (`scripts/smoke.mjs`, 14 checks): home, portfolio, a public album and one of its
   photos with public caching, security headers on server and static pages, the admin redirect
   and API 401, cross-site write refused, setup closed, unknown and hidden addresses 404 without
   public caching, canonical URLs, robots and sitemap, contact validation (an empty form gets a
   400; nothing is sent or saved), and the commit match. One retry after 30 s.
4. Browser checks (`scripts/smoke-browser.mjs`): home, portfolio, an album and its photo viewer
   in Chromium, failing on page errors or console errors.
5. Opens or updates one issue labelled `production-alert` on failure, and closes it on the next
   pass, so repeated failures do not create a pile of issues.

**How alerts reach the owner:** a new issue notifies watchers of the repository, and GitHub
also emails the person whose push last changed a scheduled workflow when its run fails. Whether
those emails arrive depends on Joshua's GitHub notification settings, which could not be
checked from here.

Set the optional repository variable `SMOKE_HIDDEN_PATHS` (Settings → Secrets and variables →
Actions → Variables) to a space-separated list of addresses that must stay hidden, such as a
hidden album's page, to have smoke check them too. It is a variable, not a secret, so it shows in
logs; only use addresses you are happy to have in a public log.

## Branch protection on `main`

Wanted: pull requests required, **CI gate** required and up to date with `main`, no force
pushes, no deletion, no required human approval, no bypass. See the evidence table for what is
actually set.

## Running it locally

Everything above except CodeQL and dependency review runs on your own computer; see
[TESTING.md](TESTING.md).
