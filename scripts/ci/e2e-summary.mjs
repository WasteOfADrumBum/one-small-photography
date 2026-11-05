// Writes the browser-test results to the job summary, and makes tests that
// failed and then passed on retry impossible to miss: each is an annotation and
// a line in the summary. (They do not fail the run on their own; fix them.)
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const file = 'test-results/e2e-results.json';
if (!existsSync(file)) {
  console.log('No browser-test results (the run did not reach the tests).');
  process.exit(0);
}
const report = JSON.parse(readFileSync(file, 'utf8'));
const tests = [];
const walk = (suite, path = []) => {
  for (const s of suite.suites ?? []) walk(s, [...path, s.title]);
  for (const spec of suite.specs ?? [])
    for (const t of spec.tests ?? [])
      tests.push({
        title: [...path, spec.title].filter(Boolean).join(' › '),
        project: t.projectName,
        status: t.status,
      });
};
walk(report);
const count = (s) => tests.filter((t) => t.status === s).length;
const flaky = tests.filter((t) => t.status === 'flaky');
const failed = tests.filter((t) => t.status === 'unexpected');
const lines = [
  '### Browser tests',
  '',
  `${count('expected')} passed, ${failed.length} failed, ${flaky.length} flaky (passed on retry), ${count('skipped')} skipped, in ${(report.stats.duration / 1000).toFixed(1)} s.`,
  '',
  ...failed.map((t) => `- FAILED [${t.project}] ${t.title}`),
  ...flaky.map((t) => `- FLAKY [${t.project}] ${t.title}`),
];
for (const t of flaky)
  console.log(
    `::warning title=Flaky browser test::[${t.project}] ${t.title} failed, then passed on retry`,
  );
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
