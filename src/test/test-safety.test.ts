/** The guards every destructive test step goes through (scripts/lib/test-safety.mjs). */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertDisposableDatabaseName,
  assertDisposableDatabaseUrl,
  assertNoProductionEnv,
  isOwnTestStorage,
  markTestStorage,
} from '../../scripts/lib/test-safety.mjs';

describe('test safety guards', () => {
  it('accepts only a Postgres on this machine', () => {
    for (const ok of [
      'postgres://postgres:postgres@localhost:5432/osp_test',
      'postgresql://u@127.0.0.1/db',
    ])
      expect(() => assertDisposableDatabaseUrl(ok)).not.toThrow();
    for (const bad of [
      'postgres://u:p@ep-cool-123.us-east-2.aws.neon.tech/neondb',
      'postgres://u:p@localhost/db?host=ep-x.neon.tech',
      'postgres://u:p@localhost/db?hostaddr=10.0.0.5',
      'mysql://u@localhost/db',
      'not a url',
    ])
      expect(() => assertDisposableDatabaseUrl(bad), bad).toThrow();
  });

  it('creates and drops only databases with a test name', () => {
    expect(assertDisposableDatabaseName('osp_e2e_1a2b3c4d')).toBe('osp_e2e_1a2b3c4d');
    for (const bad of ['neondb', 'postgres', 'osp_e2e_x; drop database neondb', 'osp_prod'])
      expect(() => assertDisposableDatabaseName(bad), bad).toThrow();
  });

  it('refuses to start with production settings present', () => {
    expect(() => assertNoProductionEnv({ PATH: '/bin' })).not.toThrow();
    expect(() => assertNoProductionEnv({ B2_KEY_ID: 'x' })).toThrow(/B2_KEY_ID/);
    expect(() => assertNoProductionEnv({ VERCEL_ENV: 'production' })).toThrow();
    expect(() => assertNoProductionEnv({ DATABASE_URL: 'postgres://u@db.neon.tech/x' })).toThrow();
  });

  it('recognises only the folder this run marked', () => {
    const dir = mkdtempSync(join(tmpdir(), 'osp-safety-'));
    try {
      expect(isOwnTestStorage(dir, 'run1')).toBe(false);
      markTestStorage(dir, 'run1');
      expect(isOwnTestStorage(dir, 'run1')).toBe(true);
      expect(isOwnTestStorage(dir, 'run2')).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
