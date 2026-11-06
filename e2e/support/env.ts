/**
 * What the e2e runner (scripts/e2e.mjs) hands the tests: the site, its own
 * throwaway database and photo folder, the mail stand-in and a synthetic admin.
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { assertDisposableDatabaseUrl } from '../../scripts/lib/test-safety.mjs';

const need = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set: run the tests with \`npm run test:e2e\`.`);
  return value;
};

export const E2E = {
  get databaseUrl() {
    const url = need('E2E_RUN_DATABASE_URL');
    const parsed = assertDisposableDatabaseUrl(url, 'E2E_RUN_DATABASE_URL');
    if (!/^\/osp_e2e_[0-9a-f]+$/.test(parsed.pathname))
      throw new Error('E2E_RUN_DATABASE_URL is not this run’s throwaway database.');
    return url;
  },
  get storageDir() {
    return need('E2E_STORAGE_DIR');
  },
  get mailSink() {
    return need('E2E_MAIL_SINK');
  },
  get setupToken() {
    return need('E2E_SETUP_TOKEN');
  },
  get adminEmail() {
    return need('E2E_ADMIN_EMAIL');
  },
  get adminPassword() {
    return need('E2E_ADMIN_PASSWORD');
  },
};

/** Saved by the setup project: a signed-in admin, for tests that start in the admin. */
export const AUTH_FILE = 'e2e/.auth/admin.json';
const SEED_FILE = 'e2e/.auth/seed.json';

export type Seed = {
  public: { id: string; slug: string; title: string; photoIds: string[]; hiddenPhotoId: string };
  empty: { id: string; slug: string; title: string };
  hidden: { id: string; slug: string; title: string; photoId: string };
  broken: { id: string; slug: string; title: string; photoId: string };
  formats: Record<string, string>;
};
export const SEED_PATH = SEED_FILE;
let cached: Seed | undefined;
/** The fixture ids. Read when first used: spec files load before the setup project runs. */
export const seed: Seed = new Proxy({} as Seed, {
  get: (_, key: keyof Seed) =>
    (cached ??= JSON.parse(readFileSync(SEED_FILE, 'utf8')) as Seed)[key],
});

/** Runs a query on this run's throwaway database (never anything else). */
export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: E2E.databaseUrl });
  await client.connect();
  try {
    return (await client.query(text, params)).rows as T[];
  } finally {
    await client.end();
  }
}

export async function sentEmails(): Promise<{ body: Record<string, unknown> }[]> {
  return (await fetch(`${E2E.mailSink}/__emails`)).json();
}
export async function failNextEmails(count = 1) {
  await fetch(`${E2E.mailSink}/__fail-next`, { method: 'POST', body: String(count) });
}
