// Fails the CodeQL job when the analysis found an error-level or high-severity
// result, instead of leaving findings only in the Security tab.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.SARIF_DIR ?? 'codeql-results';
const findings = [];
let runs = 0;
const files = readdirSync(dir).filter((f) => f.endsWith('.sarif'));
for (const file of files) {
  const sarif = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  for (const run of sarif.runs ?? []) {
    runs += 1;
    // Rules live in the driver or in a query pack (an extension); a result points
    // at its rule by index within a tool component, or only by id.
    const components = [run.tool?.driver, ...(run.tool?.extensions ?? [])];
    const byId = new Map(components.flatMap((c) => (c?.rules ?? []).map((r) => [r.id, r])));
    const ruleOf = (result) => {
      const ref = result.rule;
      const component =
        ref?.toolComponent?.index !== undefined
          ? run.tool?.extensions?.[ref.toolComponent.index]
          : run.tool?.driver;
      if (ref?.index !== undefined && component?.rules?.[ref.index])
        return component.rules[ref.index];
      return byId.get(result.ruleId ?? ref?.id);
    };
    for (const result of run.results ?? []) {
      const rule = ruleOf(result);
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
if (!runs) {
  console.log(
    `::error::No CodeQL results found in ${dir}; the analysis did not run or wrote nothing.`,
  );
  process.exit(1);
}
if (findings.length) {
  for (const f of findings) console.log(`::error::${f}`);
  process.exit(1);
}
console.log('CodeQL: no error-level or high-severity findings.');
