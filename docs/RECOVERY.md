# Recovery runbook

How to get OneSmallPhoto back when something goes wrong. Everything here uses free tiers and
needs no card. Run the scripts from a checkout of this repo on your own computer (Node 22.12+,
`npm ci` once).

Where the pieces live:

| Piece           | Where                                               | How it is protected                                        |
| --------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| Site code       | GitHub `main`, deployed by Vercel (Hobby)           | Git history; Vercel keeps old deployments                  |
| Database        | Neon project `OneSmallPhoto`, branch production     | Neon history (6 hours on Free) + your own backup files     |
| Photo files     | Private Backblaze B2 bucket (`B2_BUCKET`)           | B2 file versions, if the bucket keeps them; your originals |
| Original photos | Your own computer/drives (never uploaded)           | Your own backups                                           |
| Secrets         | Vercel → Project → Settings → Environment Variables | Never in the repo                                          |

Get a database URL from the Neon console: **Project OneSmallPhoto → Dashboard → Connect**
(choose the branch). Paste it only into your own terminal. Never commit it or put it in a file
inside this repo.

---

## 1. Locked out of the admin (password recovery)

There is no public "forgot password" page on purpose: the site has one account, and whoever can
reach the database is the owner. To set a new password:

```sh
DATABASE_URL='<production URL from Neon>' node scripts/reset-admin-password.mjs you@example.com
```

It asks for the new password twice (nothing shows as you type; at least 12 characters), then
clears any lockout and signs out every session. Log in at `/login`.

- Wrong email? It changes nothing and prints the account emails it found.
- If you only hit the 5-try lockout, waiting 15 minutes also works.
- The script uses the same password hashing as the site (a test checks they agree).

Last resort (no Node handy): in the Neon SQL editor run
`delete from sessions; delete from users;`, make sure `SETUP_TOKEN` is set in Vercel, and visit
`/setup` to create the account again. Albums, photos and messages are not tied to the account,
so nothing else is lost.

## 2. Database backups

**Automatic (Neon):** Neon keeps 6 hours of history on the Free plan. Inside that window you can
restore the production branch to any moment from the Neon console (**Branches → production →
Restore**), or create a branch from a past time to look first. Older than 6 hours: use a backup file.

**Your own backup file (do this monthly and before risky changes):**

```sh
DATABASE_URL='<production URL>' node scripts/db-backup.mjs ~/Backups/onesmallphoto-db-$(date +%F).json
```

Read-only. It saves every table except logins (sessions) as one JSON file. The file holds contact
messages and the password hash, so keep it private: not in the repo, not in a shared folder.
If you prefer the standard tool, `pg_dump` 18 or newer works too:
`pg_dump "$DATABASE_URL" -Fc -f onesmallphoto.dump`.

### Your first off-site backup (Windows PowerShell)

Uses the repo's own scripts (`db-backup.mjs`, then `verify-backup.mjs`). The database address is
typed at a hidden prompt, held only in that one PowerShell process while the backup runs, and any
output is scrubbed of it. The file is saved outside the repo in a folder only your Windows
account can open.

```powershell
cd path\to\one-small-photography
npm ci                                   # once
.\scripts\first-backup.ps1 -CheckOnly    # safe dry run: checks Node, repo, folder; touches nothing
.\scripts\first-backup.ps1               # asks for the Neon connection string (hidden), then backs up
```

If PowerShell refuses to run the script, run `Set-ExecutionPolicy -Scope Process Bypass` in that
window first (it lasts only for that window). Get the connection string in Neon: **Project
OneSmallPhoto → Dashboard → Connect → branch production**. The script finishes by printing the
file path, row counts and a SHA-256. Then:

1. Copy the `.json` and its `.sha256` to a second private place (an encrypted or BitLocker
   external drive is best; an unencrypted private drive is a risk the owner has accepted). Do not use email, a shared folder or the repo (`.gitignore` also blocks it).
2. On the copy run `Get-FileHash <file> -Algorithm SHA256` and compare with the `.sha256` file.
3. Optional proof it restores: follow section 3 into a throwaway Neon branch.
4. Write the date and location in `docs/RELEASE.md` section 6.

Check any backup file at any time without a database: `node scripts/verify-backup.mjs <file>`.

**Status:** Owner-reported 2026-11-03: `first-backup.ps1` ran successfully under PowerShell 7.6.9,
the backup passed verification, and its copy on `K:\` matched the SHA-256. The `K:\` copy is **not
encrypted**; on 2026-11-03 Joshua Small accepted in writing the risk that contact data and the admin
password hash are exposed if someone accesses that drive. The agent itself never
ran the script under PowerShell (none available); it ran everything the script calls (backup,
verify, restore against Postgres), and a test proves a failed connection prints no password.

## 3. Restoring the database

Never restore over the live database. Restore into a new, empty database, check it, then switch.

1. In Neon, create a branch (e.g. `restore-YYYY-MM-DD`) and in it a new empty database
   (**Databases → New database**, owner `neondb_owner`). Copy its connection URL.
2. Load the backup:

   ```sh
   DATABASE_URL='<URL of the new empty database>' node scripts/db-restore.mjs backup.json
   ```

   It applies the migrations, loads every row and checks the counts. It refuses to run if the
   target has any data, so it can't overwrite the live site. If it reports a schema mismatch,
   check out the commit that was live when the backup was taken and run it from there.

3. Check the photo files still match (section 4).
4. Switch: in Vercel set `DATABASE_URL` (Production) to the restored database's URL and
   redeploy, or in Neon make the restored branch the default. Log in again (sessions aren't
   restored).
5. Once the site looks right for a few days, delete the old branch.

**Drill record:** on 2026-11-02 a disposable Neon branch of production was made, the migrations
were applied to a new empty database on it, and every table was copied across with the same
`json_agg` → `json_populate_recordset` round trip the restore script uses. Row counts and
per-table checksums matched production exactly (users 1, albums 14, photos 132, messages 1,
cameras 3, lenses 3). The branch was then deleted. The scripts themselves run in CI against
Postgres on every push. See `docs/RELEASE.md`.

## 4. Photo files and database references

Each photo row (`photos.id`, `photos.format`) points at three files in the bucket:
`photos/<id>/sm.<format>`, `photos/<id>/md.<format>`, `photos/<id>/lg.<format>`. An album's
`cover_photo_id` points at one of its photos. Nothing else links the two.

Check they agree (read-only):

```sh
DATABASE_URL='…' B2_KEY_ID='…' B2_APPLICATION_KEY='…' B2_BUCKET='…' B2_ENDPOINT='…' \
  node scripts/photo-audit.mjs
```

It lists photos whose files are missing and files with no photo row. Use a read-only B2
application key for this if you make one.

What to do with the result:

- **Files with no row** (e.g. after restoring an older database): harmless. They are photos
  uploaded after the backup. Re-add them in the admin from your originals, or delete the
  `photos/<id>/` folder in the B2 web UI once you're sure.
- **Rows with missing files** (a file was deleted, or the database is newer than the bucket):
  first look in B2 (**Browse Files → bucket → photos/<id>/**, turn on **Show hidden files**). The
  site's deletes hide files rather than erase them, so if the bucket keeps file versions you can
  **Unhide** them. Otherwise re-upload the photo from your original in the admin and delete the
  broken one.
- **Album cover gone:** open the album in the admin and pick a cover; the site falls back to the
  first photo meanwhile.

**Backblaze recovery settings (check once, in the B2 web console):**

1. Sign in at backblaze.com → **B2 Cloud Storage → Buckets**. Find the bucket named in
   Vercel's `B2_BUCKET`.
2. **Files are private:** the bucket's **Files in Bucket are: Private** (the site serves photos
   through `/img`, so the bucket never needs to be public).
3. **Lifecycle Settings:** click the bucket's **Lifecycle Settings** and choose **Keep all versions
   of the file (default)**. This is what lets a hidden or deleted photo be un-hidden. Do not pick
   "Keep only the last version". Versions count toward the free 10 GB, so deleted photos still use
   space until you remove them in **Browse Files** with **Show hidden files / versions** on.
4. **Object Lock:** leave off (not needed, and it would block deletes you ask for).
5. **Application key:** **App Keys** → the key in Vercel should list only this bucket, with read,
   write and delete. For `photo-audit.mjs` and rclone make a second key limited to this bucket with
   **Read Only**.
6. **Caps & Alerts:** open **Caps & Alerts** and keep the daily storage, download and transaction
   caps at or below the free allowance, so a spike stops service instead of billing. Keep no card
   on file.
7. **Test an undelete once:** upload a throwaway photo in the admin, delete it, find
   `photos/<id>/` in **Browse Files** with **Show hidden files** on, and confirm you can **Unhide**
   it.

The agent could not read your B2 account (no B2 connector or key was available to it), so none of
this is verified from its side. **Owner-reported 2026-11-03:** the bucket is private with "Keep all
versions" enabled, and after deleting a disposable photo through the site its original versions
remained in B2 and the retained `sm.webp` opened.

**What an undelete does and does not recover.** Un-hiding or downloading the retained files
recovers the _images_. Deleting a photo in the admin also deletes its database row (title,
description, camera settings, position, album). That row comes back only from a backup file
(restore into a new database, section 3, then switch) or by uploading the original again and
re-entering the details. The 2026-11-03 test covered the files, not the row.

**Copy of the bucket (recommended monthly):** B2 lets you download up to 3× your stored data per
day free. With [rclone](https://rclone.org/b2/) (free):
`rclone sync b2:<bucket>/photos ~/Backups/onesmallphoto-photos`. Your camera originals remain the
real master copies; the site only stores resized versions.

## 5. A bad deploy

- **Instant rollback:** Vercel → Project → **Deployments**, open the last good production
  deployment → **⋯ → Instant Rollback** (Hobby can roll back to the previous production
  deployment). Then revert the bad commit on GitHub so the next merge doesn't bring it back.
- **Database migrations are forward-only.** A deploy that added a migration has already changed
  the tables. Rolling back the code is fine when the migration only added things (all current
  ones do). If a future migration removes or renames columns, take a backup first (section 2).
- Preview deployments have no database variables, so they never touch production data.

## 6. Secrets leaked or a device lost

Rotate in this order, updating each value in Vercel (Production) and redeploying once at the end:

1. Neon: **Roles → neondb_owner → Reset password**; update `DATABASE_URL`.
2. Backblaze: create a new application key limited to the bucket, delete the old one; update
   `B2_KEY_ID` and `B2_APPLICATION_KEY`.
3. Resend: create a new sending key, delete the old; update `RESEND_API_KEY`.
4. Sign out everywhere: run the password reset in section 1 (it ends every session).

## 7. Monitoring

- **Production smoke** (GitHub Actions, daily and on demand): read-only checks that pages load,
  photos are served, the admin stays locked and security headers are present. A failed run emails
  you. Run it now: GitHub → Actions → Production smoke → Run workflow, or
  `node scripts/smoke.mjs` locally.
- **Errors:** Vercel → Project → Logs (Hobby keeps 1 hour) and Observability.
- **Usage:** Vercel, Neon and Backblaze dashboards. All three are on no-card free plans, which
  stop or pause at their limits rather than charge.
