// Owner-only password recovery for the single admin account. There is no public
// "forgot password" page on purpose; whoever can reach the database is the owner.
import { randomBytes, scrypt } from 'node:crypto';

/** Must match MIN_PASSWORD_LENGTH in src/lib/auth.ts. */
export const MIN_PASSWORD_LENGTH = 12;

/** The same scheme as hashPassword in src/lib/auth.ts (a test checks they agree). */
export function hashPassword(password) {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) =>
      err ? reject(err) : resolve(`scrypt$${salt.toString('hex')}$${key.toString('hex')}`),
    ),
  );
}

/**
 * Sets a new password for the account with this email, clears any lockout and
 * signs out every existing session. Returns false when no account has that email.
 */
export async function resetAdminPassword(db, email, password) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters for the password.`);
  }
  const rows = await db.query(
    `update users set password_hash = $1, failed_logins = 0, locked_until = null
     where email = $2 returning id`,
    [await hashPassword(password), email.trim().toLowerCase()],
  );
  if (rows.length === 0) return false;
  await db.query(`delete from sessions where user_id = $1`, [rows[0].id]);
  return true;
}
