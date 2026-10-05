import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

type Database = ReturnType<typeof createNeon>;
let instance: Database | undefined;

const createNeon = (url: string) => drizzleNeon(neon(url), { schema });

/** A Postgres on your own machine (for local development and tests) uses a regular connection. */
export const isLocalDatabase = (url: string) => /@(localhost|127\.0\.0\.1)[:/]/.test(url);

function createDb(url: string): Database {
  if (isLocalDatabase(url)) {
    // Same query builder; only Neon's `batch` differs, and the app doesn't use it.
    return drizzlePg(new pg.Pool({ connectionString: url }), { schema }) as unknown as Database;
  }
  return createNeon(url);
}

/** The database, created on first use so builds without DATABASE_URL still work. */
export function db(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  instance ??= createDb(url);
  return instance;
}

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
