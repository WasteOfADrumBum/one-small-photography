// Shared by the scripts in this folder: one way to reach the database, whether
// it's Neon (over HTTPS, so it works anywhere) or a Postgres on this machine.
import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { migrate as migrateNeon } from 'drizzle-orm/neon-http/migrator';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

export const isLocalDatabase = (url) => /@(localhost|127\.0\.0\.1)[:/]/.test(url);

/** The host of a database URL, safe to print (no user name or password). */
export function describeDatabase(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

/** A minimal client: `query(text, params)` resolves to rows; `end()` closes it. */
export function openDatabase(url) {
  if (!url) throw new Error('No database URL given.');
  if (isLocalDatabase(url)) {
    const pool = new pg.Pool({ connectionString: url });
    return {
      query: async (text, params = []) => (await pool.query(text, params)).rows,
      end: () => pool.end(),
    };
  }
  const sql = neon(url);
  return { query: (text, params = []) => sql.query(text, params), end: async () => {} };
}

/** Applies the migrations in ./drizzle, the same way production deploys do. */
export async function applyMigrations(url, migrationsFolder = './drizzle') {
  if (isLocalDatabase(url)) {
    const pool = new pg.Pool({ connectionString: url });
    await migratePg(drizzlePg(pool), { migrationsFolder });
    await pool.end();
  } else {
    await migrateNeon(drizzleNeon(neon(url)), { migrationsFolder });
  }
}
