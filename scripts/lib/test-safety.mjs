// Guards for every test that writes: database tests truncate tables and create
// and drop databases, browser tests delete their storage folder. They may only
// ever touch a Postgres on this machine (CI starts one per run) and folders
// they created and marked themselves. There is deliberately no override.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Throws unless `url` is a Postgres on this machine. Returns the parsed URL. */
export function assertDisposableDatabaseUrl(url, label = 'TEST_DATABASE_URL') {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${label} is not a valid postgres:// URL.`);
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol))
    throw new Error(`${label} must be a postgres:// URL.`);
  if (!LOOPBACK.has(parsed.hostname)) {
    throw new Error(
      `${label} points at ${parsed.hostname}. Tests erase data, so they only run against a ` +
        'Postgres on this machine (localhost or 127.0.0.1), never Neon or production.',
    );
  }
  return parsed;
}

/** Names the tests may create and drop. Anything else is refused. */
export const DISPOSABLE_DATABASE = /^osp_(e2e|mig|test|close_check|restore_check)(_[a-z0-9_]+)?$/;

export function assertDisposableDatabaseName(name) {
  if (!DISPOSABLE_DATABASE.test(name))
    throw new Error(`Refusing to create or drop database "${name}": not a test database name.`);
  return name;
}

/** Production settings that must never be present while tests run the app. */
export const PRODUCTION_ONLY_ENV = [
  'B2_KEY_ID',
  'B2_APPLICATION_KEY',
  'B2_BUCKET',
  'B2_ENDPOINT',
  'SETUP_TOKEN',
  'VERCEL',
  'VERCEL_ENV',
];

export function assertNoProductionEnv(env = process.env) {
  const present = PRODUCTION_ONLY_ENV.filter((name) => env[name]);
  if (present.length)
    throw new Error(
      `Refusing to start the test server with production settings present: ${present.join(', ')}.`,
    );
  if (env.DATABASE_URL) assertDisposableDatabaseUrl(env.DATABASE_URL, 'DATABASE_URL');
}

const MARKER = '.osp-test-storage';

/** Marks a freshly created temporary folder as owned by this test run. */
export function markTestStorage(dir, runId) {
  writeFileSync(join(dir, MARKER), runId);
}

/** True only for a folder this run created and marked. */
export function isOwnTestStorage(dir, runId) {
  const marker = join(dir, MARKER);
  return existsSync(marker) && readFileSync(marker, 'utf8') === runId;
}
