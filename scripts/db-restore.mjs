// Restores a backup made by scripts/db-backup.mjs into a NEW, EMPTY database:
// applies the migrations there, then loads every row. It refuses to run
// against a database that already has data, so it cannot overwrite the live site.
//
//   DATABASE_URL='postgres://…/restore_target' node scripts/db-restore.mjs backup.json
//
// See docs/RECOVERY.md for when and how to point the site at the restored copy.
import { readFile } from 'node:fs/promises';
import { assertEmpty, restoreBackup } from './lib/backup.mjs';
import { applyMigrations, describeDatabase, openDatabase } from './lib/db.mjs';

const url = process.env.DATABASE_URL;
const file = process.argv[2];
if (!url || !file) {
  console.error('Usage: DATABASE_URL=<empty target> node scripts/db-restore.mjs <backup.json>');
  process.exit(1);
}

const backup = JSON.parse(await readFile(file, 'utf8'));
console.log(`Restoring ${file} (taken ${backup.createdAt}) into ${describeDatabase(url)}`);
const db = openDatabase(url);
try {
  // Checked before migrating too, so pointing this at the live site changes nothing.
  await assertEmpty(db);
  await applyMigrations(url);
  const counts = await restoreBackup(db, backup);
  console.log(`Restored. Rows now: ${JSON.stringify(counts)}`);
} catch (err) {
  console.error(`Restore failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await db.end();
}
