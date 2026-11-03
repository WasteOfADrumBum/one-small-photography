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

/**
 * A node-postgres pool whose `close()` resolves only once every connection's
 * socket has closed. `pool.end()` alone resolves as soon as it has *asked* its
 * clients to disconnect, so a caller that then drops or terminates the
 * database can kill a backend that is still saying goodbye; the server's
 * FATAL 57P01 then reaches a client nobody listens to any more and crashes
 * the process ("terminating connection due to administrator command").
 */
export function openPool(url) {
  const pool = new pg.Pool({ connectionString: url });
  let open = 0;
  const waiters = [];
  pool.on('connect', () => {
    open += 1;
  });
  pool.on('remove', () => {
    open -= 1;
    if (open === 0) waiters.splice(0).forEach((resolve) => resolve());
  });
  const allClosed = () =>
    open === 0 ? Promise.resolve() : new Promise((resolve) => waiters.push(resolve));
  return {
    pool,
    async close() {
      const closed = allClosed();
      await pool.end();
      await closed;
    },
  };
}

/** A minimal client: `query(text, params)` resolves to rows; `end()` closes it. */
export function openDatabase(url) {
  if (!url) throw new Error('No database URL given.');
  if (isLocalDatabase(url)) {
    const { pool, close } = openPool(url);
    return {
      query: async (text, params = []) => (await pool.query(text, params)).rows,
      end: close,
    };
  }
  const sql = neon(url);
  return { query: (text, params = []) => sql.query(text, params), end: async () => {} };
}

/** Applies the migrations in ./drizzle, the same way production deploys do. */
export async function applyMigrations(url, migrationsFolder = './drizzle') {
  if (isLocalDatabase(url)) {
    const { pool, close } = openPool(url);
    try {
      await migratePg(drizzlePg(pool), { migrationsFolder });
    } finally {
      await close();
    }
  } else {
    await migrateNeon(drizzleNeon(neon(url)), { migrationsFolder });
  }
}
