// Saves the site's database to a JSON file on your computer. Read-only: it
// never changes the database it reads.
//
//   DATABASE_URL='postgres://…' node scripts/db-backup.mjs [backup.json]
//
// The file holds contact messages (names, emails) and the admin password hash,
// so keep it private: not in the repo, not in a shared folder. See docs/RECOVERY.md.
import { writeFile } from 'node:fs/promises';
import { createBackup } from './lib/backup.mjs';
import { describeDatabase, openDatabase, redact } from './lib/db.mjs';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL to the database to back up.');
  process.exit(1);
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = process.argv[2] ?? `onesmallphoto-db-${stamp}.json`;

const db = openDatabase(url);
try {
  const backup = await createBackup(db, { source: describeDatabase(url) });
  await writeFile(out, JSON.stringify(backup), { mode: 0o600 });
  console.log(`Backed up ${describeDatabase(url)} to ${out}`);
  console.log(`Rows: ${JSON.stringify(backup.counts)}; migrations: ${backup.migrations.length}`);
  console.log('This file contains private data (messages, password hash). Keep it private.');
} catch (err) {
  // Never print the connection string: some errors carry it.
  console.error(`Backup failed: ${redact(err?.message ?? err, url)}`);
  process.exitCode = 1;
} finally {
  await db.end();
}
