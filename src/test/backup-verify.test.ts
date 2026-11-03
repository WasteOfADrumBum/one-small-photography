import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, BACKUP_VERSION, verifyBackup } from '../../scripts/lib/backup.mjs';
import { redact } from '../../scripts/lib/db.mjs';

const good = () => ({
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  createdAt: '2026-11-03T00:00:00.000Z',
  source: 'test',
  migrations: ['m1', 'm2'],
  counts: { users: 1, cameras: 1, lenses: 1, albums: 1, photos: 1, messages: 0 },
  tables: {
    users: [{ id: 'u1' }],
    cameras: [{ id: 'c1' }],
    lenses: [{ id: 'l1' }],
    albums: [{ id: 'a1', title: 'Kept', cover_photo_id: 'p1' }],
    photos: [{ id: 'p1', album_id: 'a1', camera_id: 'c1', lens_id: 'l1' }],
    messages: [],
  },
});

describe('verifyBackup', () => {
  it('accepts a complete, consistent backup', () => {
    expect(verifyBackup(good())).toEqual([]);
  });

  it('rejects other files and wrong versions', () => {
    expect(verifyBackup({})).toHaveLength(1);
    expect(verifyBackup({ ...good(), version: 99 })).toHaveLength(1);
    expect(verifyBackup(null)).toHaveLength(1);
  });

  it('finds missing tables, wrong counts and sessions', () => {
    const missing = good();
    // @ts-expect-error deliberately broken
    delete missing.tables.photos;
    expect(verifyBackup(missing).join()).toMatch(/"photos" is missing/);

    const counted = good();
    counted.counts.albums = 5;
    expect(verifyBackup(counted).join()).toMatch(/"albums" has 1 rows but the file says 5/);

    const withSessions = { ...good(), tables: { ...good().tables, sessions: [] } };
    expect(verifyBackup(withSessions).join()).toMatch(/sessions/);
  });

  it('finds dangling references and an empty user table', () => {
    const b = good();
    b.tables.photos[0].album_id = 'gone';
    b.tables.albums[0].cover_photo_id = 'nope';
    b.tables.users = [];
    b.counts.users = 0;
    const text = verifyBackup(b).join('\n');
    expect(text).toMatch(/missing album/);
    expect(text).toMatch(/cover photo that is not in the backup/);
    expect(text).toMatch(/No admin account/);
  });
});

describe('scripts/verify-backup.mjs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'osp-verify-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const run = (file: string) =>
    spawnSync('node', ['scripts/verify-backup.mjs', file], { encoding: 'utf8' });

  it('passes a good file, prints counts and a hash, and never prints row data', () => {
    const file = join(dir, 'good.json');
    writeFileSync(file, JSON.stringify(good()));
    const r = run(file);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/complete and consistent/);
    expect(r.stdout).toMatch(/SHA-256: [0-9a-f]{64}/);
    expect(r.stdout).not.toMatch(/Kept/);
  });

  it('exits 1 for a damaged file and 2 for an unreadable one', () => {
    const bad = good();
    bad.tables.photos[0].album_id = 'gone';
    const file = join(dir, 'bad.json');
    writeFileSync(file, JSON.stringify(bad));
    expect(run(file).status).toBe(1);
    const junk = join(dir, 'junk.json');
    writeFileSync(junk, 'not json');
    expect(run(junk).status).toBe(2);
    expect(run(join(dir, 'missing.json')).status).toBe(2);
    expect(() => execFileSync('node', ['scripts/verify-backup.mjs'], { stdio: 'pipe' })).toThrow();
  });
});

describe('owner scripts never print the database password', () => {
  const secret = 'SuperSecretPw123';
  const url = `postgres://owner:${secret}@ep-nowhere.invalid/neondb?sslmode=require`;

  it('redacts the address, the password and a malformed address', () => {
    expect(redact(`failed for ${url} (${secret})`, url)).toBe('failed for *** (***)');
    expect(
      redact(`bad: postgres://u:${secret}@bad host/db`, `postgres://u:${secret}@bad host/db`),
    ).not.toContain(secret);
    expect(redact('nothing to hide', undefined)).toBe('nothing to hide');
  });

  it('db-backup.mjs prints no secret when the connection fails, and leaves no file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'osp-leak-'));
    try {
      const file = join(dir, 'b.json');
      for (const bad of [url, `postgres://owner:${secret}@bad host/db`]) {
        const r = spawnSync('node', ['scripts/db-backup.mjs', file], {
          encoding: 'utf8',
          env: { ...process.env, DATABASE_URL: bad },
          timeout: 60_000,
        });
        expect(r.status).toBe(1);
        expect(r.stdout + r.stderr).not.toContain(secret);
        expect(r.stderr).toMatch(/Backup failed/);
      }
      expect(() =>
        execFileSync('node', ['scripts/verify-backup.mjs', file], { stdio: 'pipe' }),
      ).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
