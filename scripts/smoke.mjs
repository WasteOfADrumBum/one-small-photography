// Read-only health check of the live site. Exits non-zero if anything fails.
//
//   node scripts/smoke.mjs [https://photo.onesmall.company]
import { DEFAULT_SITE, runSmoke } from './lib/smoke.mjs';

//   EXPECTED_COMMIT=<sha>       the live site must be built from this commit
//   SMOKE_HIDDEN_PATHS=a,b      known hidden album or photo addresses (must be 404)
//
// A failed run is repeated once after 30 seconds (a deploy that is still
// settling, a blip); only a failure seen twice fails the check.
const base = process.argv[2] ?? process.env.SITE_URL ?? DEFAULT_SITE;
const options = {
  expectedCommit: process.env.EXPECTED_COMMIT || undefined,
  hiddenPaths: (process.env.SMOKE_HIDDEN_PATHS ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean),
};

const print = (results) => {
  for (const r of results)
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
  return results.filter((r) => !r.ok).length;
};

let results = await runSmoke(base, fetch, options);
let failed = print(results);
if (failed) {
  console.log(`\n${failed} failed; trying again in 30 seconds.\n`);
  await new Promise((resolve) => setTimeout(resolve, 30_000));
  results = await runSmoke(base, fetch, options);
  failed = print(results);
}
console.log(`\n${results.length - failed}/${results.length} checks passed against ${base}`);
if (failed) process.exitCode = 1;
