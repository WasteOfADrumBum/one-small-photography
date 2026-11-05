// Fails the CodeQL job when the analysis found an error-level or high-severity
// result, instead of leaving findings only in the Security tab.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.SARIF_DIR ?? 'codeql-results';
const findings = [];
for (const file of readdirSync(dir).filter((f) => f.endsWith('.sarif'))) {
  const sarif = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  for (const run of sarif.runs ?? []) {
    const rules = new Map((run.tool?.driver?.rules ?? []).map((r) => [r.id, r]));
    for (const result of run.results ?? []) {
      const rule = rules.get(result.ruleId);
      const severity = Number(rule?.properties?.['security-severity'] ?? 0);
      const level = result.level ?? rule?.defaultConfiguration?.level ?? 'warning';
      const where = result.locations?.[0]?.physicalLocation;
      const location = where ? `${where.artifactLocation?.uri}:${where.region?.startLine}` : '?';
      const line = `${result.ruleId} (${level}, severity ${severity || 'n/a'}) at ${location}: ${result.message?.text}`;
      console.log(line);
      if (level === 'error' || severity >= 7) findings.push(line);
    }
  }
}
if (findings.length) {
  for (const f of findings) console.log(`::error::${f}`);
  process.exit(1);
}
console.log('CodeQL: no error-level or high-severity findings.');
