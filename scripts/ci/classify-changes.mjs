// Decides whether a change touches anything but documentation. Writes
// `code=true|false` to $GITHUB_OUTPUT. When in doubt it says true, so the full
// pipeline runs: only a change made purely of the files below skips the build
// and browser jobs (static checks and tests always run, since some tests read docs).
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const DOCS_ONLY = [/^docs\//, /^\.engineering\//, /\.md$/i, /^LICENSE$/];
const ZERO = /^0+$/;

function base() {
  const { EVENT, PR_BASE, PUSH_BEFORE, MG_BASE } = process.env;
  if (EVENT === 'pull_request') return PR_BASE;
  if (EVENT === 'merge_group') return MG_BASE;
  if (EVENT === 'push' && PUSH_BEFORE && !ZERO.test(PUSH_BEFORE)) return PUSH_BEFORE;
  return undefined;
}

let code = 'true';
let reason = 'no comparison base (manual run or new branch): running everything';
const from = base();
if (from) {
  try {
    const files = execFileSync('git', ['diff', '--name-only', `${from}...HEAD`], {
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);
    const other = files.filter((f) => !DOCS_ONLY.some((re) => re.test(f)));
    code = files.length > 0 && other.length === 0 ? 'false' : 'true';
    reason = `${files.length} files changed, ${other.length} outside documentation`;
  } catch (err) {
    reason = `could not diff against ${from} (${err.message.split('\n')[0]}): running everything`;
  }
}
console.log(`code=${code} (${reason})`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `code=${code}\n`);
