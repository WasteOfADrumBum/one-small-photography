import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { eq, lt } from 'drizzle-orm';
import { db } from '@/db/client';
import { sessions, users, type User } from '@/db/schema';

export const SESSION_COOKIE = 'osp_session';
const SESSION_DAYS = 30;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
export const MIN_PASSWORD_LENGTH = 12;

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function hasAnyUser(): Promise<boolean> {
  const rows = await db().select({ id: users.id }).from(users).limit(1);
  return rows.length > 0;
}

export type LoginResult = { ok: true; user: User } | { ok: false; reason: 'invalid' | 'locked' };

/** Checks a password, locking the account for a while after repeated failures. */
export async function attemptLogin(email: string, password: string): Promise<LoginResult> {
  const [user] = await db()
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);

  if (!user) {
    // Spend the same time as a real check so response timing doesn't reveal valid emails.
    await scryptAsync(password, randomBytes(16));
    return { ok: false, reason: 'invalid' };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) return { ok: false, reason: 'locked' };

  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = user.failedLogins + 1;
    const locked = failed >= MAX_FAILED_LOGINS;
    await db()
      .update(users)
      .set({
        failedLogins: locked ? 0 : failed,
        lockedUntil: locked ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
      })
      .where(eq(users.id, user.id));
    return { ok: false, reason: locked ? 'locked' : 'invalid' };
  }

  if (user.failedLogins > 0 || user.lockedUntil) {
    await db()
      .update(users)
      .set({ failedLogins: 0, lockedUntil: null })
      .where(eq(users.id, user.id));
  }
  return { ok: true, user };
}

export async function startSession(userId: string, cookies: AstroCookies): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db()
    .insert(sessions)
    .values({ id: hashToken(token), userId, expiresAt });
  // Opportunistically clear out expired sessions.
  await db().delete(sessions).where(lt(sessions.expiresAt, new Date()));
  cookies.set(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    expires: expiresAt,
  });
}

export async function getSessionUser(cookies: AstroCookies): Promise<User | null> {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db()
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, hashToken(token)))
    .limit(1);
  if (!row || row.expiresAt < new Date()) return null;
  return row.user;
}

export async function endSession(cookies: AstroCookies): Promise<void> {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token)
    await db()
      .delete(sessions)
      .where(eq(sessions.id, hashToken(token)));
  cookies.delete(SESSION_COOKIE, { path: '/' });
}
