# Firebase Project Separation Runbook

Goal: three distinct Firebase projects — one per CarkedIt environment — so that signing in on `dev.play.carkedit.com` creates a user in the dev project, NOT in prod.

After this runbook is followed, every Firebase Auth user and every Firestore write is bound to the environment it originated from.

| Env     | Firebase project ID                      | Hostname                        |
| ------- | ---------------------------------------- | ------------------------------- |
| dev     | `carkedit-dev` *(to create)*             | `dev.play.carkedit.com`         |
| staging | `carkedit-staging` *(to create)*         | `staging.play.carkedit.com`     |
| prod    | `carkedit-5cc8e` *(existing, unchanged)* | `play.carkedit.com`             |

The dev/staging projects are treated as **fresh** — no user data is migrated from prod.

## Prerequisites

- Firebase Console admin access on the existing `carkedit-5cc8e` project (to mirror its settings).
- SSH access to the dev and staging Lightsail boxes as `bitnami`.
- Engineering pairing for the placeholder-replacement step in `js/firebase-config.js`.
- The code-side PRs from this feature branch must be merged before the server-side credential rotation runs (`dev/firebase-per-env` in both `carkedit-online` and `carkedit-api`).

## Step 1 — Create two new Firebase projects

In <https://console.firebase.google.com/>:

1. **Add project** → name `carkedit-dev`. Suggest using the suggested project ID as `carkedit-dev`. If the ID is taken, Firebase will append a suffix — that's fine, just note the actual ID.
2. Pick the same Google Cloud billing account that `carkedit-5cc8e` uses, so billing stays consolidated.
3. Disable Google Analytics for the new project (the existing prod project does not have analytics wired into the app code; keeping dev/staging consistent avoids divergence).
4. Repeat for `carkedit-staging`.

Record the final project IDs — they go into `js/firebase-config.js`.

## Step 2 — Enable Google sign-in on each new project

For each new project:

1. **Authentication** → **Sign-in method** → enable **Google**.
2. Set the project support email to match prod's.
3. **Authorized domains** — add the matching hostname:
   - For `carkedit-dev`: add `dev.play.carkedit.com` and `localhost`.
   - For `carkedit-staging`: add `staging.play.carkedit.com`.

## Step 3 — Clone Firestore security rules from prod

1. Open the existing prod project (`carkedit-5cc8e`) → **Firestore Database** → **Rules** tab. Copy the rules text.
2. In the new project → **Firestore Database** → **Create database** (production mode, same region as prod for latency parity).
3. Paste the prod rules text into the new project's **Rules** tab and **Publish**.
4. Repeat for the other new project.

No data is migrated. Both new projects start empty.

## Step 4 — Generate service-account JSONs

For each new project:

1. **Project settings** (gear icon) → **Service accounts** → **Generate new private key** → confirm.
2. Save the JSON locally with a clearly named filename:
   - `firebase-service-account-dev.json`
   - `firebase-service-account-staging.json`
3. **Do not commit these files anywhere.** Keep them in a password manager or encrypted note. They authenticate as Firebase Admin and can read every user.

## Step 5 — Capture the web SDK config for each new project

For each new project:

1. **Project settings** → **General** tab → scroll to **Your apps** → click **Add app** → web (`</>` icon) → register a new web app named `carkedit-online`.
2. Firebase shows a snippet:
   ```js
   const firebaseConfig = {
     apiKey: "…",
     authDomain: "carkedit-dev.firebaseapp.com",
     projectId: "carkedit-dev",
     storageBucket: "carkedit-dev.firebasestorage.app",
     messagingSenderId: "…",
     appId: "…",
   };
   ```
3. Copy the snippet and paste it into the PR description for `dev/firebase-per-env` (or send to engineering directly). These values are **public** — safe to share via PR.

## Step 6 — Apply admin custom claims for your Google account

The admin gate on `branch-manager.html` / `deploy.html` / `admin-image-gen.html` requires a Firebase user with `is_admin = true` in the carkedit-api users table for the matching environment. Since dev/staging start fresh, the first admin user in each project must be created manually.

The simplest path (assuming you're the only admin):

1. On each environment (dev box, then staging box), once Step 8 below has rotated the service-account file:
   - Visit `https://<env-hostname>/admin-users.html`. Sign in once with your Google account. This upserts your user record into the env's local SQLite DB via `linkOrFetchUser`.
   - The first user signing in to a fresh deployment auto-becomes admin via the `hasAnyAdmin()` bootstrap path in `carkedit-api`. (If that bootstrap path is no longer active, the operator can directly UPDATE `users SET is_admin = 1 WHERE email = …` on the box's `games.db`.)

If the auto-bootstrap doesn't fire (because the local DB already has anonymous users), SSH to the env, open `/home/bitnami/server/carkedit-api/games.db` with `sqlite3`, and run:
```sql
UPDATE users SET is_admin = 1 WHERE email = 'YOUR_GOOGLE_EMAIL_HERE';
```

## Step 7 — Engineering merges the code PRs

Once the configs from Step 5 are pasted into the PR:

1. Engineer replaces the `REPLACE_ME_*` placeholders in `carkedit-online/js/firebase-config.js` with the real values.
2. Open PR for `dev/firebase-per-env` in `carkedit-online`.
3. Open PR for `dev/firebase-per-env` in `carkedit-api` (paired — same branch name, different repo).
4. Both squash-merge to main.

After merge, dev/staging boxes are still using the old `firebase-service-account.json` pointing at prod — sign-in still works against prod for now. The cutover happens in Step 8.

## Step 8 — Rotate service-account JSONs on dev + staging boxes

For the **dev** box (`dev.play.carkedit.com`):

```bash
# From your local machine, replace ~/.ssh/<KEY> with your Lightsail SSH key.

scp -i ~/.ssh/<KEY> firebase-service-account-dev.json \
    bitnami@dev.play.carkedit.com:/home/bitnami/server/carkedit-api/firebase-service-account.json

ssh -i ~/.ssh/<KEY> bitnami@dev.play.carkedit.com
chmod 600 /home/bitnami/server/carkedit-api/firebase-service-account.json
chown bitnami:bitnami /home/bitnami/server/carkedit-api/firebase-service-account.json
pm2 reload carkedit-api
pm2 logs carkedit-api --lines 20 --nostream
```

Check the pm2 log line:
```
[CarkedIt API] Firebase Admin initialized (project: carkedit-dev)
```
The project name must match the dev project ID. If it still shows `carkedit-5cc8e`, the wrong file landed — re-`scp` and `pm2 reload` again.

Repeat for the **staging** box with `firebase-service-account-staging.json`. Leave the **prod** box untouched.

## Step 9 — Verify isolation

For each environment, open a private browser window:

1. Visit `https://dev.play.carkedit.com/` (or staging / prod).
2. Click **Sign in with Google**, choose your Google account.
3. Confirm the sign-in completes without an OAuth error.
4. In the Firebase Console, open the matching project's **Authentication** → **Users** tab. Your account should appear there.
5. Open the **prod** project's **Authentication** → **Users** tab. The dev/staging sign-in should NOT appear there. (If it does, the cutover did not take effect — check Step 8.)

Then verify the auth proxy:
```bash
curl -sI https://dev.play.carkedit.com/__/auth/handler | grep -i location
```
The redirect should now route through `carkedit-dev.firebaseapp.com` (not `carkedit-5cc8e.firebaseapp.com`).

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
