// Applies pending migrations in ./drizzle to the database. Runs on every
// Vercel build through the `vercel-build` script, before the site is built, so
// a failed migration stops the deployment and the live site keeps running the
// previous version. Migrations must be backward compatible (expand, then
// contract in a later release): see docs/DEPLOYMENT.md.
import { applyMigrations, countAppliedMigrations, describeDatabase, redact } from './lib/db.mjs';
import { migrationPlan } from './lib/migrate-plan.mjs';

const plan = migrationPlan(process.env);
if (plan.action === 'skip') {
  console.log(plan.message);
  process.exit(0);
}
if (plan.action === 'fail') {
  console.error(plan.message);
  process.exit(1);
}

const url = process.env.DATABASE_URL;
try {
  const before = await countAppliedMigrations(url);
  await applyMigrations(url);
  const after = await countAppliedMigrations(url);
  console.log(
    `Database migrations applied to ${describeDatabase(url)}: ${after - before} new, ${after} in total.`,
  );
} catch (err) {
  // Node's own error text can include the connection string; never print it.
  console.error(`Database migration failed: ${redact(err?.message ?? err, url)}`);
  process.exit(1);
}
