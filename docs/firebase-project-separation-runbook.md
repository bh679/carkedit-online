# Firebase Project Separation Runbook

Goal: three distinct Firebase projects — one per CarkedIt environment — so that signing in on `dev.play.carkedit.com` creates a user in the dev Firebase project, NOT in prod.

After this runbook is followed, every Firebase Auth user is bound to the environment it originated from.

| Env     | Firebase project ID                      | Hostname                        |
| ------- | ---------------------------------------- | ------------------------------- |
| dev     | `carkeditdev`                            | `dev.play.carkedit.com`         |
| staging | `carkedit-staging`                       | `staging.play.carkedit.com`     |
| prod    | `carkedit-5cc8e` *(existing, unchanged)* | `play.carkedit.com`             |

The dev/staging projects are treated as **fresh** — no user data is migrated from prod. The app uses Firebase Auth only (no Firestore, no Storage) so there's no other data to migrate either.

## Prerequisites

- Firebase Console admin access on the existing `carkedit-5cc8e` project.
- SSH access to the dev and staging Lightsail boxes as `bitnami`.
- The carkedit-online + carkedit-api PRs from `dev/firebase-per-env` merged to main before Step 7 below.

## Step 1 — Create two new Firebase projects

In <https://console.firebase.google.com/>:

1. **Add project** → name `carkeditdev`. Note: the actual project ID Firebase assigns may differ if the name is taken; record whatever ID lands.
2. Pick the same Google Cloud billing account `carkedit-5cc8e` uses so invoices stay consolidated.
3. Google Analytics: optional. The current codebase doesn't call `getAnalytics()`, so enabling it is harmless. The `js/firebase-config.js` selector includes a `measurementId` field for dev + staging so analytics will be available later if someone wires it up.
4. Repeat for `carkedit-staging`.

## Step 2 — Enable Google sign-in on each new project

For each new project:

1. **Authentication** → **Sign-in method** tab → enable **Google**. Set the project support email.
2. **Authentication** → **Settings** tab → **Authorized domains** section → **Add domain**:
   - dev project: add `dev.play.carkedit.com` (`localhost` is already a default).
   - staging project: add `staging.play.carkedit.com`.

> ⚠️ The "Authorized domains" list is in the **Settings** tab, NOT the "Safelist client IDs from external projects" field inside the Google sign-in provider. That other field accepts OAuth client IDs from other Google Cloud projects and is unrelated.

If the app uses email/password sign-in (it does — `signInWithEmail` is called by router, marketplace, and card-designer), also enable **Email/Password** under Sign-in method.

## Step 3 — Generate service-account JSONs

For each new project:

1. **Project settings** (gear icon) → **Service accounts** tab → scroll past the Admin SDK snippet → **Generate new private key** → confirm.
2. Save the downloaded JSON with a clearly named filename, e.g.:
   - `firebase-service-account-carkeditdev.json`
   - `firebase-service-account-carkedit-staging.json`
3. **Do not commit these anywhere.** They grant Firebase Admin access. Store in a password manager / encrypted note.

## Step 4 — Capture the web SDK config for each new project

(Already done — values are committed in `js/firebase-config.js`. This step is here for the next person who provisions a fresh project.)

1. **Project settings** → **General** tab → scroll to **Your apps** → click **Add app** → web (`</>` icon) → register a new web app named `carkedit-online`.
2. Firebase prints a `const firebaseConfig = { … }` block. Paste those values into the corresponding entry in `js/firebase-config.js`.

## Step 5 — Bootstrap your admin account (per-env)

Admin authorisation is gated by the `is_admin` column in the env's local SQLite (`/home/bitnami/server/carkedit-api/games.db`), not by Firebase custom claims. So provisioning the new Firebase projects doesn't auto-grant admin — you need a row in each env's local DB.

Do this AFTER Step 7 (cutover) has rotated the service-account JSON on each box:

1. SSH to the dev box:
   ```bash
   ssh -i ~/.ssh/<KEY> bitnami@dev.play.carkedit.com
   sqlite3 /home/bitnami/server/carkedit-api/games.db \
     "UPDATE users SET is_admin = 1 WHERE email = 'YOUR_GOOGLE_EMAIL_HERE';"
   ```
   (Sign in once first via `https://dev.play.carkedit.com/` so the row exists; then run the UPDATE.)
2. Repeat for staging.

Prod is unchanged — your existing admin row in prod's `games.db` stays.

## Step 6 — Land the code

The two PRs in `dev/firebase-per-env` carry the real web SDK configs and the proxy fix:

- `carkedit-online` PR: per-host Firebase config selector
- `carkedit-api` PR: derives the OAuth proxy target from the service-account `project_id`

Squash-merge both to main. After merge, dev + staging still authenticate against prod until Step 7 runs.

## Step 7 — Rotate service-account JSONs on dev + staging boxes

For the **dev** box (`dev.play.carkedit.com`):

```bash
# From your local machine, replace ~/.ssh/<KEY> with your Lightsail SSH key.

scp -i ~/.ssh/<KEY> firebase-service-account-carkeditdev.json \
    bitnami@dev.play.carkedit.com:/home/bitnami/server/carkedit-api/firebase-service-account.json

ssh -i ~/.ssh/<KEY> bitnami@dev.play.carkedit.com
chmod 600 /home/bitnami/server/carkedit-api/firebase-service-account.json
chown bitnami:bitnami /home/bitnami/server/carkedit-api/firebase-service-account.json
pm2 reload carkedit-api
pm2 logs carkedit-api --lines 20 --nostream
```

Check the pm2 log line:
```
[CarkedIt API] Firebase Admin initialized (project: carkeditdev)
```
If it still shows `carkedit-5cc8e`, the wrong file landed — re-`scp` and `pm2 reload` again.

Repeat for the **staging** box with `firebase-service-account-carkedit-staging.json`. Leave the **prod** box untouched.

## Step 8 — Verify isolation

For each environment, open a private browser window:

1. Visit `https://dev.play.carkedit.com/` (or staging / prod).
2. Click **Sign in with Google**, choose your Google account.
3. Confirm the sign-in completes without an OAuth error.
4. In the Firebase Console, open the matching project's **Authentication** → **Users** tab. Your account should appear there.
5. Open the **prod** project's **Authentication** → **Users** tab. The dev/staging sign-in should NOT appear there. (If it does, the cutover did not take effect — check Step 7.)

Then verify the auth proxy:
```bash
curl -sI https://dev.play.carkedit.com/__/auth/handler | grep -i location
```
The redirect should now route through `carkeditdev.firebaseapp.com` (not `carkedit-5cc8e.firebaseapp.com`).

## Rollback

If sign-in breaks on dev or staging after the cutover:

1. On the affected box: copy a backup of the prod service-account JSON back into `/home/bitnami/server/carkedit-api/firebase-service-account.json`.
2. `pm2 reload carkedit-api`.
3. Sign-in reverts to authenticating against prod. The carkedit-api proxy will follow because it reads `project_id` from the JSON at startup.

Code-side rollback: `git revert` the merge commit of `dev/firebase-per-env` in each repo. No data loss because dev/staging projects were never relied on for production users.

## Related

- [carkedit-online/js/firebase-config.js](../js/firebase-config.js) — the per-host selector
- [carkedit-api/src/index.ts](https://github.com/bh679/carkedit-api/blob/main/src/index.ts) — service-account-driven OAuth proxy
- Audit context: `.claude/worktrees/wizardly-wilson-12bb48/AUDIT-REPORT.md` Section 10
