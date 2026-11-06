// Reports whether `main` is protected the way docs/CI-CD.md describes: pull
// requests required, the "CI gate" check required and up to date, no force
// pushes, no deletion. Reads the rules GitHub applies to the branch (any
// ruleset), which needs only read access. Exit 1 lists what is missing.
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
if (!repo || !token) {
  console.error('GITHUB_REPOSITORY and GITHUB_TOKEN are required.');
  process.exit(2);
}
const res = await fetch(`https://api.github.com/repos/${repo}/rules/branches/main`, {
  headers: {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
  },
  signal: AbortSignal.timeout(20_000),
});
if (!res.ok) {
  console.error(`Could not read the rules for main: HTTP ${res.status}`);
  process.exit(2);
}
const rules = await res.json();
const has = (type) => rules.some((r) => r.type === type);
const checks = rules.find((r) => r.type === 'required_status_checks')?.parameters;
const missing = [];
if (!has('pull_request')) missing.push('pull requests are not required');
if (!checks?.required_status_checks?.some((c) => c.context === 'CI gate'))
  missing.push('"CI gate" is not a required check');
else if (!checks.strict_required_status_checks_policy)
  missing.push('branches need not be up to date with main before merging');
if (!has('non_fast_forward')) missing.push('force pushes are allowed');
if (!has('deletion')) missing.push('the branch can be deleted');
if (missing.length) {
  console.log(`main is not fully protected: ${missing.join('; ')}.`);
  process.exit(1);
}
console.log(
  'main is protected: pull requests, "CI gate" (up to date), no force push, no deletion.',
);
