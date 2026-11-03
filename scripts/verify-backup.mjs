// Checks a backup file made by scripts/db-backup.mjs without touching any
// database: format, row counts, and that photos/albums/covers reference rows
// that are in the file. Prints counts and the SHA-256, never any row content.
//
//   node scripts/verify-backup.mjs backup.json
//
// Exit code 0 = file is complete; 1 = problems (listed); 2 = could not read it.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { verifyBackup } from './lib/backup.mjs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/verify-backup.mjs <backup.json>');
  process.exit(2);
}
let text;
let backup;
try {
  text = await readFile(file);
  backup = JSON.parse(text.toString('utf8'));
} catch (err) {
  console.error(`Could not read ${file}: ${err.message}`);
  process.exit(2);
}
const problems = verifyBackup(backup);
if (problems.length) {
  console.error(
    `Backup NOT valid (${problems.length} problem${problems.length === 1 ? '' : 's'}):`,
  );
  for (const p of problems.slice(0, 20)) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`Backup is complete and consistent (taken ${backup.createdAt}).`);
console.log(`Rows: ${JSON.stringify(backup.counts)}; migrations: ${backup.migrations.length}`);
console.log(`Size: ${text.length} bytes`);
console.log(`SHA-256: ${createHash('sha256').update(text).digest('hex')}`);
