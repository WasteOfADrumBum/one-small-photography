// Read-only: lists photos whose files are missing from storage, and stored
// files that no photo row points at. Needs DATABASE_URL plus either the B2_*
// variables (production) or STORAGE_DIR (local).
//
//   DATABASE_URL=… B2_KEY_ID=… B2_APPLICATION_KEY=… B2_BUCKET=… B2_ENDPOINT=… \
//     node scripts/photo-audit.mjs
import { openDatabase } from './lib/db.mjs';
import { comparePhotoStorage, listPhotoKeys } from './lib/photo-audit.mjs';

if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL, and the B2_* variables or STORAGE_DIR.');
  process.exit(1);
}
const db = openDatabase(process.env.DATABASE_URL);
try {
  const rows = await db.query('select id, format from photos order by created_at');
  const report = comparePhotoStorage(rows, await listPhotoKeys());
  console.log(`${report.photos} photo rows, ${report.files} stored files`);
  console.log(`Photos missing files: ${report.missing.length}`);
  for (const m of report.missing) console.log(`  ${m.id}: missing ${m.sizes.join(', ')}`);
  console.log(`Stored files with no photo row: ${report.orphans.length}`);
  for (const id of report.orphans) console.log(`  photos/${id}/`);
  if (report.missing.length) process.exitCode = 1;
} finally {
  await db.end();
}
