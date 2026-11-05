/**
 * The deployment entrypoint (`npm run vercel-build` = scripts/migrate.mjs, then
 * astro build) run against throwaway databases: a fresh one, one at the
 * previous release's schema, a repeat run, failures, and the environment rules
 * that keep previews away from production data. Needs TEST_DATABASE_URL (a
 * Postgres on this machine); every database here is created and dropped by name.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyMigrations, countAppliedMigrations } from '../../scripts/lib/db.mjs';
import { migrationPlan } from '../../scripts/lib/migrate-plan.mjs';
import {
  assertDisposableDatabaseName,
  assertDisposableDatabaseUrl,
} from '../../scripts/lib/test-safety.mjs';

const url = process.env.TEST_DATABASE_URL;
if (url) assertDisposableDatabaseUrl(url);

const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')) as {
  entries: { tag: string }[];
};

describe('which builds may migrate', () => {
  const local = 'postgres://u:p@localhost:5432/db';
  it('production builds migrate', () => {
    expect(migrationPlan({ VERCEL_ENV: 'production', DATABASE_URL: local }).action).toBe('migrate');
  });
  it('a local run with a database migrates it', () => {
    expect(migrationPlan({ DATABASE_URL: local }).action).toBe('migrate');
  });
  it('preview builds never migrate', () => {
    expect(migrationPlan({ VERCEL_ENV: 'preview' }).action).toBe('skip');
    expect(migrationPlan({ VERCEL_ENV: 'development' }).action).toBe('skip');
  });
  it('a preview that can see a database fails unless it is marked as a separate one', () => {
    expect(migrationPlan({ VERCEL_ENV: 'preview', DATABASE_URL: local }).action).toBe('fail');
    expect(
      migrationPlan({
        VERCEL_ENV: 'preview',
        DATABASE_URL: local,
        PREVIEW_DATABASE_ISOLATED: 'true',
      }).action,
    ).toBe('skip');
  });
  it('production without a usable DATABASE_URL fails the build', () => {
    expect(migrationPlan({ VERCEL_ENV: 'production' }).action).toBe('fail');
    expect(migrationPlan({ VERCEL_ENV: 'production', DATABASE_URL: 'mysql://x' }).action).toBe(
      'fail',
    );
  });
});

describe('migration files', () => {
  // Expand-and-contract: a release may add, never take away, so the version
  // still live during a deploy (and after a rollback) keeps working. Anything
  // destructive needs its own reviewed release; list it here with the reason.
  const REVIEWED_DESTRUCTIVE: Record<string, string> = {};
  const DESTRUCTIVE =
    /\b(drop\s+(table|column|schema|type|index)|rename\s+(column|to)|alter\s+column\s+\S+\s+(set\s+data\s+)?type|truncate|delete\s+from)\b/i;

  it('every migration in the journal has its file, and nothing else is in the folder', () => {
    const files = readdirSync('drizzle').filter((f) => f.endsWith('.sql'));
    expect(files.sort()).toEqual(journal.entries.map((e) => `${e.tag}.sql`).sort());
  });

  it('no migration drops, renames or retypes anything without a reviewed exception', () => {
    const offenders = journal.entries
      .map((e) => e.tag)
      .filter((tag) => !(tag in REVIEWED_DESTRUCTIVE))
      .filter((tag) => DESTRUCTIVE.test(readFileSync(`drizzle/${tag}.sql`, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe.skipIf(!url)(
  'the deployment entrypoint against throwaway databases',
  { timeout: 60_000 },
  () => {
    const created: string[] = [];
    let server: pg.Client;

    const dbUrl = (name: string) => {
      const u = new URL(url!);
      u.pathname = `/${name}`;
      return u.href;
    };
    async function freshDatabase(label: string) {
      const name = assertDisposableDatabaseName(
        `osp_mig_${label}_${Math.random().toString(36).slice(2, 8)}`,
      );
      await server.query(`create database ${name}`);
      created.push(name);
      return dbUrl(name);
    }
    const run = (script: string[], env: Record<string, string | undefined>) => {
      const result = spawnSync(script[0]!, script.slice(1), {
        env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
        encoding: 'utf8',
        timeout: 60_000,
      });
      return { code: result.status, out: `${result.stdout}\n${result.stderr}` };
    };
    const migrate = (env: Record<string, string | undefined>) =>
      run(['node', 'scripts/migrate.mjs'], env);
    const tables = async (target: string) => {
      const client = new pg.Client({ connectionString: target });
      await client.connect();
      try {
        const { rows } = await client.query(
          "select table_name from information_schema.tables where table_schema = 'public' order by 1",
        );
        return rows.map((r) => r.table_name as string);
      } finally {
        await client.end();
      }
    };

    beforeAll(async () => {
      server = new pg.Client({ connectionString: url });
      await server.connect();
    });
    afterAll(async () => {
      for (const name of created)
        await server.query(
          `drop database if exists ${assertDisposableDatabaseName(name)} with (force)`,
        );
      await server.end();
    });

    it('migrates a fresh database the way a production deploy does', async () => {
      const target = await freshDatabase('fresh');
      const result = migrate({ VERCEL_ENV: 'production', DATABASE_URL: target });
      expect(result.code, result.out).toBe(0);
      expect(result.out).toContain(`${journal.entries.length} new`);
      expect(await countAppliedMigrations(target)).toBe(journal.entries.length);
      expect(await tables(target)).toEqual(
        expect.arrayContaining(['albums', 'photos', 'users', 'sessions', 'messages']),
      );
    });

    it('does nothing the second time', async () => {
      const target = await freshDatabase('repeat');
      expect(migrate({ VERCEL_ENV: 'production', DATABASE_URL: target }).code).toBe(0);
      const again = migrate({ VERCEL_ENV: 'production', DATABASE_URL: target });
      expect(again.code, again.out).toBe(0);
      expect(again.out).toContain('0 new');
      expect(await countAppliedMigrations(target)).toBe(journal.entries.length);
    });

    it('upgrades a database at the previous release, keeping its data', async () => {
      const target = await freshDatabase('upgrade');
      // The migrations folder as it was one release ago: every migration but the newest.
      const previous = mkdtempSync(join(tmpdir(), 'osp-prev-migrations-'));
      try {
        cpSync('drizzle', previous, { recursive: true });
        const last = journal.entries.at(-1)!.tag;
        rmSync(join(previous, `${last}.sql`));
        writeFileSync(
          join(previous, 'meta/_journal.json'),
          JSON.stringify({ ...journal, entries: journal.entries.slice(0, -1) }),
        );
        await applyMigrations(target, previous);
      } finally {
        rmSync(previous, { recursive: true, force: true });
      }
      expect(await countAppliedMigrations(target)).toBe(journal.entries.length - 1);

      // Data written by the previous release.
      const client = new pg.Client({ connectionString: target });
      await client.connect();
      try {
        await client.query(
          "insert into albums (title, slug, description, published) values ('Before', 'before', '', true)",
        );
        const result = migrate({ VERCEL_ENV: 'production', DATABASE_URL: target });
        expect(result.code, result.out).toBe(0);
        expect(result.out).toContain('1 new');
        const { rows } = await client.query('select slug, published from albums');
        expect(rows).toEqual([{ slug: 'before', published: true }]);
      } finally {
        await client.end();
      }
    });

    it('fails the build, without printing the password, when a migration fails', async () => {
      const target = await freshDatabase('broken');
      // A table in the way makes the first migration fail part-way.
      const client = new pg.Client({ connectionString: target });
      await client.connect();
      await client.query('create table albums (id int)');
      await client.end();

      const result = run(['npm', 'run', '-s', 'vercel-build'], {
        VERCEL_ENV: 'production',
        DATABASE_URL: target,
      });
      expect(result.code).not.toBe(0);
      expect(result.out).toContain('Database migration failed');
      expect(result.out).not.toContain(target);
      // The site build never starts, so nothing half-migrated gets deployed.
      expect(result.out).not.toMatch(/\[build\]/);
    });

    it('fails clearly when the database cannot be reached', () => {
      const result = migrate({
        VERCEL_ENV: 'production',
        DATABASE_URL: 'postgres://user:hunter2-test@127.0.0.1:1/nothing',
      });
      expect(result.code).toBe(1);
      expect(result.out).toContain('Database migration failed');
      expect(result.out).not.toContain('hunter2-test');
    });

    it('fails a production build with no DATABASE_URL, and a preview that can see one', () => {
      const missing = migrate({ VERCEL_ENV: 'production' });
      expect(missing.code).toBe(1);
      expect(missing.out).toContain('DATABASE_URL is not set');
      const preview = migrate({ VERCEL_ENV: 'preview', DATABASE_URL: dbUrl('osp_mig_never') });
      expect(preview.code).toBe(1);
      expect(preview.out).toContain('Previews must not use the production database');
    });

    it('skips migrations on a preview build without a database', () => {
      const result = migrate({ VERCEL_ENV: 'preview' });
      expect(result.code).toBe(0);
      expect(result.out).toContain('Skipping database migrations');
    });
  },
);
