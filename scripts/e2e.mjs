// Runs the browser tests against the built site on this machine, with its own
// throwaway database and photo folder, then removes exactly those.
//
//   npm run build:e2e        (once, after changing the app)
//   npm run test:e2e         (Chromium: the pull-request suite)
//   npm run test:e2e -- --project=firefox --project=webkit
//
// Needs E2E_DATABASE_URL or TEST_DATABASE_URL: a Postgres on this machine that
// this script may create a database on. See docs/TESTING.md.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import {
  assertDisposableDatabaseName,
  assertDisposableDatabaseUrl,
  assertNoProductionEnv,
  isOwnTestStorage,
  markTestStorage,
} from './lib/test-safety.mjs';

const fail = (message) => {
  console.error(`e2e: ${message}`);
  process.exit(1);
};

const adminUrl = process.env.E2E_DATABASE_URL || process.env.TEST_DATABASE_URL;
if (!adminUrl)
  fail(
    'Set E2E_DATABASE_URL (or TEST_DATABASE_URL) to a Postgres on this machine, e.g. ' +
      'postgres://postgres:postgres@localhost:5432/postgres. The tests create and drop their own database there.',
  );
try {
  assertDisposableDatabaseUrl(adminUrl, 'E2E_DATABASE_URL');
  // A DATABASE_URL in this shell must also be local: never risk a production one.
  assertNoProductionEnv(process.env);
} catch (err) {
  fail(err.message);
}
if (!existsSync('dist/server/entry.mjs') || !existsSync('dist/.osp-e2e-build'))
  fail('No browser-test build found. Run `npm run build:e2e` first.');

const runId = randomBytes(4).toString('hex');
const dbName = assertDisposableDatabaseName(`osp_e2e_${runId}`);
const dbUrl = (() => {
  const u = new URL(adminUrl);
  u.pathname = `/${dbName}`;
  return u.href;
})();
const resultsDir = 'test-results';
mkdirSync(resultsDir, { recursive: true });

let storageDir;
let server;
let sink;
let admin;
let exitCode;

async function cleanup() {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  sink?.close();
  if (process.env.E2E_KEEP === '1') {
    console.log(`e2e: kept database ${dbName} and storage ${storageDir} (E2E_KEEP=1).`);
  } else {
    if (admin) {
      await admin
        .query(`drop database if exists ${assertDisposableDatabaseName(dbName)} with (force)`)
        .catch((err) => console.error(`e2e: could not drop ${dbName}: ${err.message}`));
    }
    // Only a folder this run created and marked is ever deleted.
    if (storageDir && isOwnTestStorage(storageDir, runId))
      rmSync(storageDir, { recursive: true, force: true });
  }
  await admin?.end().catch(() => {});
}

/** A stand-in for Resend: records every email, and can be told to fail. */
function startMailSink() {
  const emails = [];
  let failNext = 0;
  const srv = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      if (req.method === 'POST' && req.url === '/emails') {
        if (failNext > 0) {
          failNext -= 1;
          res.writeHead(500).end('{"message":"sink told to fail"}');
          return;
        }
        emails.push({
          headers: { authorization: req.headers.authorization },
          body: JSON.parse(body),
        });
        res.writeHead(200, { 'content-type': 'application/json' }).end('{"id":"e2e"}');
      } else if (req.method === 'GET' && req.url === '/__emails') {
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(emails));
      } else if (req.method === 'POST' && req.url === '/__fail-next') {
        failNext = Number(body) || 1;
        res.writeHead(204).end();
      } else res.writeHead(404).end();
    });
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve(srv)));
}

async function waitForServer(base, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`the site exited with code ${child.exitCode}`);
    try {
      const res = await fetch(new URL('/version.json', base));
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('the site did not start within 30 seconds');
}

for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    await cleanup();
    process.exit(130);
  });

try {
  admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`create database ${dbName}`);

  // The real deployment migration entrypoint, against the new empty database.
  const migrated = spawnSync('node', ['scripts/migrate.mjs'], {
    env: { PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: dbUrl },
    encoding: 'utf8',
  });
  writeFileSync(join(resultsDir, 'e2e-migration.log'), `${migrated.stdout}${migrated.stderr}`);
  if (migrated.status !== 0) throw new Error(`migrations failed:\n${migrated.stderr}`);

  storageDir = mkdtempSync(join(tmpdir(), 'osp-e2e-storage-'));
  markTestStorage(storageDir, runId);

  sink = await startMailSink();
  const sinkUrl = `http://127.0.0.1:${sink.address().port}`;

  const port = Number(process.env.E2E_PORT) || 4400 + Math.floor(Math.random() * 500);
  const baseURL = `http://localhost:${port}`;
  const setupToken = randomBytes(18).toString('base64url');
  const adminPassword = `e2e-${randomBytes(12).toString('base64url')}`;

  // Only what the site needs: nothing from this shell (no real keys) gets through.
  const log = createWriteStream(join(resultsDir, 'e2e-server.log'));
  server = spawn('node', ['dist/server/entry.mjs'], {
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: 'production',
      HOST: 'localhost',
      PORT: String(port),
      DATABASE_URL: dbUrl,
      STORAGE_DIR: storageDir,
      SETUP_TOKEN: setupToken,
      RESEND_API_KEY: 're_e2e_not_a_real_key',
      CONTACT_TO_EMAIL: 'owner@e2e.test',
      RESEND_API_URL: `${sinkUrl}/emails`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  await waitForServer(baseURL, server);
  console.log(`e2e: site on ${baseURL}, database ${dbName}, run ${runId}`);

  const args = process.argv.slice(2);
  // Not spawnSync: the mail stand-in lives in this process and must keep answering.
  const tests = spawn('npx', ['playwright', 'test', ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      E2E_BASE_URL: baseURL,
      E2E_RUN_DATABASE_URL: dbUrl,
      E2E_STORAGE_DIR: storageDir,
      E2E_MAIL_SINK: sinkUrl,
      E2E_SETUP_TOKEN: setupToken,
      E2E_ADMIN_EMAIL: `admin-${runId}@e2e.test`,
      E2E_ADMIN_PASSWORD: adminPassword,
      E2E_RUN_ID: runId,
    },
  });
  exitCode = await new Promise((resolve) => tests.on('exit', (code) => resolve(code ?? 1)));
} catch (err) {
  console.error(`e2e: ${err.message}`);
  exitCode = 1;
} finally {
  await cleanup();
}
process.exit(exitCode);
