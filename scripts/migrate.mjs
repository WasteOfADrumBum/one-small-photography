// Applies pending migrations in ./drizzle to the database. Runs on every
// Vercel build (see the `vercel-build` script), before the site is built.
import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { migrate as migrateNeon } from 'drizzle-orm/neon-http/migrator';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set; add it in Vercel project settings.');
  process.exit(1);
}

const migrationsFolder = './drizzle';
if (/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  const pool = new pg.Pool({ connectionString: url });
  await migratePg(drizzlePg(pool), { migrationsFolder });
  await pool.end();
} else {
  await migrateNeon(drizzleNeon(neon(url)), { migrationsFolder });
}
console.log('Database migrations applied.');
