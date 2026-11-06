// Builds the site for the browser tests: the same app, with Astro's Node adapter
// so it can be served on this machine (see astro.config.mjs). Output: dist/.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const result = spawnSync('npx', ['astro', 'build'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, OSP_ADAPTER: 'node' },
});
if (result.status === 0) writeFileSync('dist/.osp-e2e-build', new Date().toISOString());
process.exit(result.status ?? 1);
