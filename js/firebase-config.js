// Per-host Firebase web SDK configuration.
//
// These configs are PUBLIC. Firebase web SDK configs (apiKey, appId, etc.)
// are NOT secrets — they identify the project to the SDK and are visible to
// any browser that loads the page. The real security boundary is Firebase
// Auth rules + custom admin claims, configured inside each project's
// Firebase Console.
//
// To add a new public hostname, add an entry to CONFIG_BY_HOST. To wire up
// a new Firebase project, copy the web-app config block from the Firebase
// Console (Project settings → General → Your apps).

const PROD_CONFIG = {
  apiKey: "AIzaSyC6QJz6jTzJkBWV7Shd9XpCfHWrovJ9vaI",
  projectId: "carkedit-5cc8e",
  storageBucket: "carkedit-5cc8e.firebasestorage.app",
  messagingSenderId: "144073275425",
  appId: "1:144073275425:web:2301fbbccc2be69c654b60",
};

const STAGING_CONFIG = {
  apiKey: "AIzaSyC0ngHBR-_Uz3M5Dwbo-r5WiKel0SvuHGI",
  projectId: "carkedit-staging",
  storageBucket: "carkedit-staging.firebasestorage.app",
  messagingSenderId: "44484042956",
  appId: "1:44484042956:web:8a98c9c742dd48f5256269",
  measurementId: "G-TQQQQ6545W",
};

const DEV_CONFIG = {
  apiKey: "AIzaSyADRu0zM_jXlfNswZcasR5Y0DtAz-C9xHE",
  projectId: "carkeditdev",
  storageBucket: "carkeditdev.firebasestorage.app",
  messagingSenderId: "902836470179",
  appId: "1:902836470179:web:5ba8e364f05308f2b49a16",
  measurementId: "G-F8X3TL3BFJ",
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

// Prod Firebase config for the "preview production data" toggle on the
// dev/staging stats page. authDomain points at play.carkedit.com so the
// OAuth popup runs through prod's same-origin /__/auth/* reverse-proxy,
// matching the Safari ITP workaround used by getFirebaseConfig above.
export function getProdFirebaseConfig() {
  return { ...PROD_CONFIG, authDomain: 'play.carkedit.com' };
}
