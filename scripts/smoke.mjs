// Read-only health check of the live site. Exits non-zero if anything fails.
//
//   node scripts/smoke.mjs [https://photo.onesmall.company]
import { DEFAULT_SITE, runSmoke } from './lib/smoke.mjs';

const base = process.argv[2] ?? process.env.SITE_URL ?? DEFAULT_SITE;
const results = await runSmoke(base);
for (const r of results)
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed against ${base}`);
if (failed) process.exitCode = 1;
