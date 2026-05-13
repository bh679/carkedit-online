// Per-host Firebase web SDK configuration.
//
// These configs are PUBLIC. Firebase web SDK configs (apiKey, appId, etc.)
// are NOT secrets — they identify the project to the SDK and are visible to
// any browser that loads the page. The real security boundary is Firebase
// Auth + Firestore Security Rules + custom admin claims, all configured
// inside each project's Firebase Console.
//
// To add a new public hostname, add an entry to CONFIG_BY_HOST. To wire up
// a fresh dev or staging Firebase project, replace the REPLACE_ME_* fields
// in DEV_CONFIG / STAGING_CONFIG with the web-app config printed by the
// Firebase Console for that project.

const PROD_CONFIG = {
  apiKey: "AIzaSyC6QJz6jTzJkBWV7Shd9XpCfHWrovJ9vaI",
  projectId: "carkedit-5cc8e",
  storageBucket: "carkedit-5cc8e.firebasestorage.app",
  messagingSenderId: "144073275425",
  appId: "1:144073275425:web:2301fbbccc2be69c654b60",
};

// Placeholders until the staging Firebase project is provisioned. See
// docs/firebase-project-separation-runbook.md step 5 — the user pastes the
// real web SDK config into this block before the carkedit-online PR merges.
const STAGING_CONFIG = {
  apiKey: "REPLACE_ME_STAGING_API_KEY",
  projectId: "carkedit-staging",
  storageBucket: "carkedit-staging.firebasestorage.app",
  messagingSenderId: "REPLACE_ME_STAGING_SENDER_ID",
  appId: "REPLACE_ME_STAGING_APP_ID",
};

// Placeholders for the dev project, same lifecycle as staging.
const DEV_CONFIG = {
  apiKey: "REPLACE_ME_DEV_API_KEY",
  projectId: "carkedit-dev",
  storageBucket: "carkedit-dev.firebasestorage.app",
  messagingSenderId: "REPLACE_ME_DEV_SENDER_ID",
  appId: "REPLACE_ME_DEV_APP_ID",
};

const CONFIG_BY_HOST = {
  'dev.play.carkedit.com': DEV_CONFIG,
  'staging.play.carkedit.com': STAGING_CONFIG,
  'play.carkedit.com': PROD_CONFIG,
};

// An unknown hostname falls through to DEV — that way a misconfigured route
// fails closed against the lowest-stakes environment instead of silently
// authenticating against prod. Includes localhost / loopback / the legacy
// brennan.games redirect so developer environments map to dev by default.

export function getFirebaseConfig(hostnameArg, hostArg) {
  const fromWindow = typeof window !== 'undefined' && window.location ? window.location : null;
  const hostname = (hostnameArg ?? (fromWindow ? fromWindow.hostname : '')).toLowerCase();
  const host = hostArg ?? (fromWindow ? fromWindow.host : hostname);
  const base = CONFIG_BY_HOST[hostname] || DEV_CONFIG;
  // authDomain must equal the current page host so the same-origin
  // /__/auth/* proxy on carkedit-api keeps Google OAuth working under
  // Safari ITP. See carkedit-api/src/index.ts.
  return { ...base, authDomain: host };
}
