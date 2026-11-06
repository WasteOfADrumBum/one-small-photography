// For a deployment_status event: makes sure the event is about a production
// deployment of a commit on main, then waits until the live domain serves that
// exact build (its /version.json names the commit). Writes `ready=true|false`
// and `reason` to $GITHUB_OUTPUT. A newer deployment that already replaced this
// one is not an error: its own event will be tested.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const { SITE_URL, DEPLOY_SHA, DEPLOY_ENVIRONMENT, DEPLOY_CREATOR, GITHUB_OUTPUT } = process.env;
const output = (ready, reason) => {
  console.log(`${ready ? 'ready' : 'not ready'}: ${reason}`);
  if (GITHUB_OUTPUT)
    appendFileSync(GITHUB_OUTPUT, `ready=${ready}\nreason=${reason.replace(/\n/g, ' ')}\n`);
};
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const known = (sha) => {
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const isAncestor = (a, b) => {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', a, b]);
    return true;
  } catch {
    return false;
  }
};

if (DEPLOY_ENVIRONMENT !== 'Production') {
  output(false, `environment ${DEPLOY_ENVIRONMENT} is not Production`);
  process.exit(0);
}
if (DEPLOY_CREATOR !== 'vercel[bot]') {
  console.log(`::error::deployment created by ${DEPLOY_CREATOR}, not vercel[bot]`);
  process.exit(1);
}
if (!/^[0-9a-f]{40}$/.test(DEPLOY_SHA ?? '')) {
  console.log('::error::deployment has no valid commit SHA');
  process.exit(1);
}
git('fetch', '--quiet', 'origin', 'main');
if (!isAncestor(DEPLOY_SHA, 'origin/main')) {
  console.log(`::error::production deployment of ${DEPLOY_SHA}, which is not on main`);
  process.exit(1);
}

const deadline = Date.now() + 10 * 60_000;
let last = 'nothing yet';
while (Date.now() < deadline) {
  try {
    const res = await fetch(new URL('/version.json', SITE_URL), {
      headers: { 'user-agent': 'osp-smoke', 'cache-control': 'no-cache' },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      const { commit } = await res.json();
      last = commit;
      if (commit === DEPLOY_SHA) {
        output(true, `live site serves ${DEPLOY_SHA.slice(0, 7)}`);
        process.exit(0);
      }
      if (/^[0-9a-f]{40}$/.test(commit)) {
        try {
          // A commit merged after this run started is not in the first fetch.
          if (!known(commit)) git('fetch', '--quiet', 'origin', 'main');
          git('cat-file', '-e', `${commit}^{commit}`);
          if (isAncestor(DEPLOY_SHA, commit)) {
            output(
              false,
              `superseded: the live site already serves the newer ${commit.slice(0, 7)}`,
            );
            process.exit(0);
          }
        } catch {
          // An unknown commit: keep waiting, the alias may not have moved yet.
        }
      }
    } else last = `HTTP ${res.status}`;
  } catch (err) {
    last = err.message;
  }
  await new Promise((resolve) => setTimeout(resolve, 15_000));
}
console.log(
  `::error::the live site never served ${DEPLOY_SHA} within 10 minutes (last seen: ${last})`,
);
process.exit(1);
