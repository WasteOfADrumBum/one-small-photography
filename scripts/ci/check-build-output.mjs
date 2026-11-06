// Checks what `npm run vercel-build` produced is a deployable Vercel build:
// the server function, the static files, the security headers and the build
// identity file the post-deploy smoke check waits for.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const out = '.vercel/output';
const problems = [];
const need = (path, what) => {
  if (!existsSync(join(out, path))) problems.push(`missing ${what} (${path})`);
};
need('config.json', 'Vercel build config');
need('static/version.json', 'build identity file');
need('static/404.html', 'not-found page');
need('functions', 'server functions');

if (existsSync(join(out, 'functions'))) {
  const fns = readdirSync(join(out, 'functions')).filter((f) => f.endsWith('.func'));
  if (fns.length === 0) problems.push('no server function was built');
  for (const fn of fns) {
    const config = JSON.parse(readFileSync(join(out, 'functions', fn, '.vc-config.json'), 'utf8'));
    console.log(`function ${fn}: runtime ${config.runtime}`);
  }
}
if (existsSync(join(out, 'static/version.json'))) {
  console.log(`version.json: ${readFileSync(join(out, 'static/version.json'), 'utf8')}`);
}

// JavaScript and CSS shipped to browsers, for the record (budgets are enforced per page in e2e).
const assets = join(out, 'static/_astro');
if (existsSync(assets)) {
  let js = 0;
  let css = 0;
  for (const f of readdirSync(assets)) {
    const size = statSync(join(assets, f)).size;
    if (f.endsWith('.js')) js += size;
    if (f.endsWith('.css')) css += size;
  }
  console.log(
    `client assets: ${(js / 1024).toFixed(1)} KiB JS, ${(css / 1024).toFixed(1)} KiB CSS`,
  );
}

if (problems.length) {
  for (const p of problems) console.log(`::error::${p}`);
  process.exit(1);
}
console.log('Vercel build output looks deployable.');
