# Roadmap

Future work for OneSmallPhoto after the v1 showcase release. **None of these block the release**;
release blockers live in [docs/RELEASE.md](docs/RELEASE.md) §5. Every item must keep the site
non-commercial (no prices, packages, booking or sales) and on no-card free tiers.

Priority: **P1** do next, **P2** worthwhile, **P3** nice to have.

## R-1 Script Content-Security-Policy (P1)

- **Purpose:** close the last XSS backstop gap from the 2026-10-30 audit; today the CSP limits
  framing, plugins, `<base>` and form targets but not scripts.
- **Scope:** add `script-src 'self'` plus hashes for Astro's inline scripts (Astro's `security.csp`
  or a build step), for server-rendered and prerendered pages. No change to features.
- **Acceptance criteria:** every page sends a CSP with `script-src` and no `'unsafe-inline'`;
  GSAP, Lenis, the menu, lightbox, contact form and admin all work in production; the XSS and
  release-guard tests cover the header; browser console shows no CSP violations on any page.
- **Dependencies:** `vercel.json` static headers (this release); Astro CSP support for the
  Vercel adapter.

## R-2 Scheduled encrypted off-site database backup (P1)

- **Purpose:** remove the manual monthly step; Neon Free only keeps 6 hours of history.
- **Scope:** a weekly GitHub Actions job runs `scripts/db-backup.mjs` with a read-only Neon role,
  encrypts the file with `age` using a public key (private key stays with Joshua), and keeps the
  last 8 as workflow artifacts. The repo is public, so nothing unencrypted may be uploaded.
- **Acceptance criteria:** a weekly run produces an encrypted artifact; decrypting and running
  `db-restore.mjs` into an empty Neon branch database reproduces production counts; a failed run
  emails the owner; no secret or plaintext appears in logs or artifacts.
- **Dependencies:** a read-only Neon role and its URL stored as a GitHub Actions secret; an
  `age` key pair.

## R-3 Purge the CDN copy when a photo is hidden or deleted (P2)

- **Purpose:** today a published photo stays reachable by its exact URL for up to 30 days after
  you hide or delete it.
- **Scope:** on hide/delete of a photo or album, call Vercel's cache invalidation for that
  photo's `/img/<id>/*` URLs. Free on Hobby. Keep the 30-day cache for everything else.
- **Acceptance criteria:** after hiding a photo, a fresh request for its URL returns 404 within a
  minute; integration test covers the purge call; a purge failure is logged and doesn't block
  the admin action.
- **Dependencies:** a Vercel token with cache-purge scope stored in Vercel env vars.

## R-4 Photo bucket backup and version safety net (P2)

- **Purpose:** make photo files recoverable without relying on re-uploading originals.
- **Scope:** document and verify B2 lifecycle "keep prior versions for 30 days"; optional
  monthly `rclone sync` of `photos/` to a local drive; `scripts/photo-audit.mjs` in the monthly
  routine.
- **Acceptance criteria:** deleting a test photo in the admin and unhiding its files in B2
  restores it; the audit reports 0 missing files on production.
- **Dependencies:** B2 console access; storage stays under 10 GB.

## R-5 Automated browser accessibility and device checks in CI (P2)

- **Purpose:** keep the 0-issue axe result from regressing; today it was run by hand.
- **Scope:** Playwright + axe-core job against a built site with a seeded throwaway database;
  pages at 375 px and 1280 px; fail on any WCAG 2.1 AA violation or horizontal overflow.
- **Acceptance criteria:** the job runs on every PR in under 5 minutes and fails on a planted
  contrast error; no production data or keys used.
- **Dependencies:** CI Postgres service (exists); local photo storage (`STORAGE_DIR`).

## R-6 Screen reader and real-device pass (P2)

- **Purpose:** cover what automated checks miss.
- **Scope:** VoiceOver on iOS Safari and macOS, TalkBack or NVDA on one other platform: home,
  portfolio, an album with the viewer, contact, login, admin album editor.
- **Acceptance criteria:** every task above completes by keyboard/screen reader alone; issues
  filed and fixed or recorded as accepted.
- **Dependencies:** a person with the devices (Joshua or a tester).

## R-7 Per-visitor limits for login and contact (P3)

- **Purpose:** a stranger can trigger the 15-minute admin lockout or use up the sitewide
  20-notes-per-hour contact cap.
- **Scope:** add per-IP counters (in Postgres, no new service) alongside the existing limits.
- **Acceptance criteria:** one IP's failures don't lock out another; tests cover both limits;
  the existing caps still protect the free tiers.
- **Dependencies:** none.

## R-8 "Sign out everywhere" and session list in the admin (P3)

- **Purpose:** end a forgotten session without the recovery script.
- **Scope:** an admin button that deletes every session but the current one; show session count.
- **Acceptance criteria:** after pressing it, other browsers are logged out on next request;
  integration test.
- **Dependencies:** none.

## R-9 Lighter public JavaScript (P3)

- **Purpose:** faster first view on slow phones.
- **Scope:** load GSAP/Lenis only on pages that animate; keep React off pages without islands.
- **Acceptance criteria:** public pages ship at least 30% less JS (gzipped) than today with the
  same visuals; Slow 3G DOMContentLoaded on the home page improves.
- **Dependencies:** R-5 helps catch visual regressions.

## R-10 AI-written alt text (P3, paid: on hold)

- **Purpose:** better descriptions than the title fallback.
- **Scope:** only if a free, no-card option appears; otherwise stays on hold.
- **Acceptance criteria:** suggested alt text is shown for the owner to accept or edit; never
  published automatically.
- **Dependencies:** a free vision model with no card requirement.
