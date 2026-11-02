// Sets a new admin password when you're locked out. Run it on your own computer:
//
//   DATABASE_URL='postgres://…' node scripts/reset-admin-password.mjs you@example.com
//
// It asks for the new password twice (nothing is shown as you type), clears any
// lockout and signs out every session. See docs/RECOVERY.md.
import { createInterface } from 'node:readline';
import { resetAdminPassword } from './lib/admin-password.mjs';
import { describeDatabase, openDatabase } from './lib/db.mjs';

const url = process.env.DATABASE_URL;
const email = process.argv[2];
if (!url || !email) {
  console.error('Usage: DATABASE_URL=<database> node scripts/reset-admin-password.mjs <email>');
  process.exit(1);
}

/** Reads one line without echoing it when run in a terminal. Piped input also works. */
function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let asked = false;
    rl._writeToOutput = (text) => {
      if (!asked) rl.output.write(text);
      asked = true;
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

const lines = process.stdin.isTTY
  ? null
  : (
      await new Promise((resolve) => {
        let data = '';
        process.stdin.on('data', (chunk) => (data += chunk));
        process.stdin.on('end', () => resolve(data));
      })
    ).split(/\r?\n/);

const password = lines ? lines[0] : await ask('New password: ');
const confirm = lines ? (lines[1] ?? lines[0]) : await ask('Same password again: ');
if (password !== confirm) {
  console.error("The passwords don't match. Nothing changed.");
  process.exit(1);
}

const db = openDatabase(url);
try {
  const ok = await resetAdminPassword(db, email, password);
  if (!ok) {
    const accounts = await db.query('select email from users order by created_at');
    console.error(`No account with that email in ${describeDatabase(url)}. Nothing changed.`);
    console.error(`Accounts: ${accounts.map((a) => a.email).join(', ') || 'none'}`);
    process.exitCode = 1;
  } else {
    console.log(`Password changed for ${email} in ${describeDatabase(url)}.`);
    console.log('Any lockout is cleared and every session is signed out. Log in at /login.');
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
