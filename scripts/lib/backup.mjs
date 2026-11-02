// Logical backup and restore of the site's database as one JSON file.
// Used by scripts/db-backup.mjs and scripts/db-restore.mjs; see docs/RECOVERY.md.

export const BACKUP_FORMAT = 'onesmallphoto-db-backup';
export const BACKUP_VERSION = 1;

/** Tables in the order they must be restored (parents before children). */
export const BACKUP_TABLES = ['users', 'cameras', 'lenses', 'albums', 'photos', 'messages'];
/** Logins are not backed up: a restored site asks you to log in again. */
export const SKIPPED_TABLES = ['sessions'];

const quote = (name) => `"${name.replace(/"/g, '""')}"`;

async function publicTables(db) {
  const rows = await db.query(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
  );
  return rows.map((r) => r.table_name);
}

async function migrationHashes(db) {
  const exists = await db.query(`select to_regclass('drizzle.__drizzle_migrations') as t`);
  if (!exists[0]?.t) return [];
  const rows = await db.query(`select hash from drizzle.__drizzle_migrations order by id`);
  return rows.map((r) => r.hash);
}

/** Reads every table into a plain object that JSON.stringify can save. Read-only. */
export async function createBackup(db, { source = 'unknown' } = {}) {
  const known = new Set([...BACKUP_TABLES, ...SKIPPED_TABLES]);
  const unknown = (await publicTables(db)).filter((t) => !known.has(t));
  if (unknown.length) {
    throw new Error(
      `Tables not covered by the backup: ${unknown.join(', ')}. Add them to scripts/lib/backup.mjs.`,
    );
  }
  const tables = {};
  const counts = {};
  for (const table of BACKUP_TABLES) {
    const [row] = await db.query(
      `select coalesce(json_agg(t), '[]'::json) as rows from ${quote(table)} t`,
    );
    const rows = typeof row.rows === 'string' ? JSON.parse(row.rows) : row.rows;
    tables[table] = rows;
    counts[table] = rows.length;
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    source,
    migrations: await migrationHashes(db),
    counts,
    tables,
  };
}

/** Row counts of every backed-up and skipped table. */
export async function tableCounts(db) {
  const counts = {};
  for (const table of [...BACKUP_TABLES, ...SKIPPED_TABLES]) {
    const [row] = await db.query(`select count(*)::int as n from ${quote(table)}`);
    counts[table] = Number(row.n);
  }
  return counts;
}

/** Throws unless every app table is missing or empty. Safe to call before migrating. */
export async function assertEmpty(db) {
  const busy = [];
  for (const table of [...BACKUP_TABLES, ...SKIPPED_TABLES]) {
    const [exists] = await db.query(`select to_regclass($1) as t`, [`public.${table}`]);
    if (!exists?.t) continue;
    const [row] = await db.query(`select count(*)::int as n from ${quote(table)}`);
    if (Number(row.n) > 0) busy.push(`${table}: ${row.n}`);
  }
  if (busy.length) {
    throw new Error(
      `Refusing to restore: the target already has data (${busy.join(', ')}). ` +
        'Restore only into a new, empty database.',
    );
  }
}

/**
 * Loads a backup into a database whose tables already exist (run the migrations
 * first) and are empty. It refuses to touch a database that has any data, so it
 * can never overwrite the live site.
 */
export async function restoreBackup(db, backup, { chunkSize = 200 } = {}) {
  if (backup?.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION) {
    throw new Error('This file is not a OneSmallPhoto database backup.');
  }
  const target = await migrationHashes(db);
  const sameSchema =
    target.length === backup.migrations.length &&
    target.every((hash, i) => hash === backup.migrations[i]);
  if (!sameSchema) {
    throw new Error(
      `Schema mismatch: the backup has ${backup.migrations.length} migrations, the target has ` +
        `${target.length}. Check out the commit the backup was taken from and try again.`,
    );
  }
  await assertEmpty(db);
  for (const table of BACKUP_TABLES) {
    const rows = backup.tables[table] ?? [];
    for (let i = 0; i < rows.length; i += chunkSize) {
      await db.query(
        `insert into ${quote(table)} select * from json_populate_recordset(null::${quote(table)}, $1::json)`,
        [JSON.stringify(rows.slice(i, i + chunkSize))],
      );
    }
  }
  const after = await tableCounts(db);
  const mismatched = BACKUP_TABLES.filter((t) => after[t] !== backup.counts[t]);
  if (mismatched.length) {
    throw new Error(`Restored counts do not match the backup for: ${mismatched.join(', ')}`);
  }
  return after;
}
