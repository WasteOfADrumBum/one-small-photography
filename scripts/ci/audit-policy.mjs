// Dependency vulnerability policy, run in CI and by `npm run audit:policy`.
//
// - Any high or critical advisory fails, wherever it is in the tree.
// - A low or moderate advisory fails unless security/audit-exceptions.json
//   lists it with an owner, scope, reason and an expiry that hasn't passed.
// - An exception that no longer matches anything is reported, so the list
//   shrinks when a fix lands.
// Never fixed with `npm audit fix --force` (it downgrades packages).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const today = new Date().toISOString().slice(0, 10);
const { exceptions } = JSON.parse(readFileSync('security/audit-exceptions.json', 'utf8'));

let report;
try {
  report = JSON.parse(
    execFileSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 32e6 }),
  );
} catch (err) {
  // npm audit exits non-zero when it finds anything; the JSON is still on stdout.
  if (!err.stdout) throw err;
  report = JSON.parse(err.stdout);
}
if (report.error) {
  console.error(`npm audit could not run: ${JSON.stringify(report.error)}`);
  process.exit(1);
}

const advisories = new Map();
for (const vuln of Object.values(report.vulnerabilities ?? {}))
  for (const via of vuln.via)
    if (typeof via === 'object') {
      const id = via.url.split('/').pop();
      const entry = advisories.get(id) ?? {
        id,
        severity: via.severity,
        title: via.title,
        packages: new Set(),
      };
      entry.packages.add(via.name);
      advisories.set(id, entry);
    }

const problems = [];
for (const adv of advisories.values()) {
  const line = `${adv.id} ${adv.severity} in ${[...adv.packages].join(', ')}: ${adv.title}`;
  if (adv.severity === 'high' || adv.severity === 'critical') {
    problems.push(`${line} (high and critical are never excepted)`);
    continue;
  }
  const exception = exceptions.find((e) => e.advisory === adv.id);
  if (!exception) problems.push(`${line} (no exception recorded)`);
  else if (exception.expires < today)
    problems.push(`${line} (exception expired ${exception.expires})`);
  else console.log(`excepted until ${exception.expires}: ${line}`);
}
for (const e of exceptions)
  if (!advisories.has(e.advisory))
    console.log(`::notice::Exception ${e.advisory} no longer matches; remove it.`);

const counts = report.metadata?.vulnerabilities ?? {};
console.log(`npm audit: ${JSON.stringify(counts)}`);
if (problems.length) {
  for (const p of problems) console.log(`::error::${p}`);
  process.exit(1);
}
console.log('Dependency policy passed.');
