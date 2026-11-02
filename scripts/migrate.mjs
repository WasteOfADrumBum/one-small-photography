// Applies pending migrations in ./drizzle to the database. Runs on every
// Vercel build (see the `vercel-build` script), before the site is built.
import { applyMigrations } from './lib/db.mjs';

// Preview deploys share the production database, so only production deploys
// change its tables. Unmerged branches never migrate it.
if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
  console.log(`Skipping database migrations on a ${process.env.VERCEL_ENV} deploy.`);
  process.exit(0);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set; add it in Vercel project settings.');
  process.exit(1);
}

await applyMigrations(url);
console.log('Database migrations applied.');
