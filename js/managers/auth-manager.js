// CarkedIt Online — Firebase Auth Manager
'use strict';

import { getState, setState as _gameSetState } from '../state.js';
import { getFirebaseConfig } from '../firebase-config.js';

// Allow external consumers (e.g. card designer) to provide their own state setter.
// Call setStateSetter(fn) before initAuth() to redirect all auth state updates.
let _setState = _gameSetState;
let _getState = getState;

export function setStateSetter(setFn, getFn) {
  _setState = setFn;
  if (getFn) _getState = getFn;
}

const FIREBASE_CONFIG = getFirebaseConfig();

let firebaseApp = null;
let firebaseAuth = null;
let firebaseModules = null;

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

async function loadFirebase() {
  if (firebaseModules) return firebaseModules;
  const [appMod, authMod] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js'),
  ]);
  // Idempotent: guardPage may have already initialized the default app.
  firebaseApp = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FIREBASE_CONFIG);
  firebaseAuth = authMod.getAuth(firebaseApp);
  firebaseModules = { app: appMod, auth: authMod };
  return firebaseModules;
}

export async function initAuth(onUserChanged) {
  try {
    const { auth: authMod } = await loadFirebase();

    // Handle return from signInWithRedirect() (mobile Google sign-in).
    // Must run before onAuthStateChanged to capture redirect errors.
    try {
      await authMod.getRedirectResult(firebaseAuth);
    } catch (redirectErr) {
      console.error('[CarkedIt Auth] Redirect result error:', redirectErr);
      _setState({ loginError: redirectErr.message || 'Google sign-in failed' });
    }

    authMod.onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        const localUser = await linkOrFetchUser(firebaseUser, token);
        // Firebase sign-in succeeded but the account service returned no
        // user — surface it instead of silently appearing signed out.
        const accountError = localUser
          ? null
          : "Signed in, but couldn't reach the account service — please try again.";
        _setState({
          authUser: localUser,
          firebaseUser: { displayName: firebaseUser.displayName, photoURL: firebaseUser.photoURL, email: firebaseUser.email },
          authToken: token,
          authLoading: false,
          loginError: accountError,
          showLoginModal: accountError ? _getState().showLoginModal : false,
        });
        if (onUserChanged) onUserChanged();
        // Owned partner brands → drives the "Brand Admin" link in the user menu.
        fetchMyBrands(token).then((brands) => {
          _setState({ myBrands: brands });
          if (onUserChanged) onUserChanged();
        });
      } else {
        _setState({
          authUser: null,
          firebaseUser: null,
          authToken: null,
          authLoading: false,
          myBrands: [],
        });
        if (onUserChanged) onUserChanged();
      }
    });
  } catch (err) {
    console.warn('[CarkedIt Auth] Firebase init failed:', err);
    _setState({ authLoading: false });
    if (onUserChanged) onUserChanged();
  }
}

export async function signInWithGoogle() {
  try {
    _setState({ loginError: null, loginNotice: null });
    const { auth: authMod } = await loadFirebase();
    const provider = new authMod.GoogleAuthProvider();
    if (isMobile()) {
      await authMod.signInWithRedirect(firebaseAuth, provider);
    } else {
      await authMod.signInWithPopup(firebaseAuth, provider);
    }
  } catch (err) {
    console.error('[CarkedIt Auth] Google sign-in error:', err);
    _setState({ loginError: err.message || 'Google sign-in failed' });
  }
}

export async function signInWithEmail(email, password) {
  try {
    _setState({ loginError: null, loginNotice: null });
    const { auth: authMod } = await loadFirebase();
    await authMod.signInWithEmailAndPassword(firebaseAuth, email, password);
  } catch (err) {
    console.error('[CarkedIt Auth] Email sign-in error:', err);
    _setState({ loginError: friendlyError(err.code) });
  }
}

export async function signUpWithEmail(email, password) {
  try {
    _setState({ loginError: null, loginNotice: null });
    const { auth: authMod } = await loadFirebase();
    await authMod.createUserWithEmailAndPassword(firebaseAuth, email, password);
  } catch (err) {
    console.error('[CarkedIt Auth] Sign-up error:', err);
    _setState({ loginError: friendlyError(err.code) });
  }
}

export async function sendPasswordReset(email) {
  try {
    _setState({ loginError: null, loginNotice: null });
    const { auth: authMod } = await loadFirebase();
    await authMod.sendPasswordResetEmail(firebaseAuth, email);
    _setState({ loginNotice: 'Reset email sent — check your inbox' });
  } catch (err) {
    console.error('[CarkedIt Auth] Password reset error:', err);
    _setState({ loginError: friendlyError(err.code) });
  }
}

export async function logOut() {
  try {
    const { auth: authMod } = await loadFirebase();
    await authMod.signOut(firebaseAuth);
  } catch (err) {
    console.error('[CarkedIt Auth] Sign-out error:', err);
  }
}

export async function getAuthToken() {
  if (!firebaseAuth?.currentUser) return null;
  return firebaseAuth.currentUser.getIdToken();
}

export async function updateUserProfile({ display_name, birth_month, birth_day }) {
  const state = _getState();
  if (!state.authUser || !state.authToken) return;
  const API_BASE = `${window.location.origin}/api/carkedit`;
  try {
    const token = await getAuthToken();
    const res = await fetch(`${API_BASE}/users/${state.authUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ display_name, birth_month, birth_day }),
    });
    if (res.ok) {
      const user = await res.json();
      _setState({ authUser: user });
    }
  } catch (err) {
    console.warn('[CarkedIt Auth] Profile update failed:', err);
  }
}

// Partner brands this user owns (any status). Empty on failure — the menu
// simply omits the Brand Admin link.
async function fetchMyBrands(token) {
  try {
    const res = await fetch(`${window.location.origin}/api/carkedit/brands/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    return (await res.json()).brands || [];
  } catch (err) {
    console.warn('[CarkedIt Auth] fetch my brands failed:', err);
    return [];
  }
}

async function linkOrFetchUser(firebaseUser, token) {
  const API_BASE = `${window.location.origin}/api/carkedit`;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  // Partner-brand attribution: when signing up on a brand vanity URL, tag the
  // new account with the brand (server validates + writes it once, at creation).
  const brandId = (typeof window !== 'undefined' && window.brand) ? window.brand.id : undefined;

  const anonymousId = localStorage.getItem('carkedit-user-id');
  if (anonymousId) {
    try {
      const res = await fetch(`${API_BASE}/users/link`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ anonymous_user_id: anonymousId, brand_id: brandId }),
      });
      if (res.ok) {
        const user = await res.json();
        localStorage.setItem('carkedit-user-id', user.id);
        return user;
      }
    } catch (err) {
      console.warn('[CarkedIt Auth] Link user failed:', err);
    }
  }

  // Upsert the Firebase user
  try {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        // New accounts start nameless — the player provides their name when
        // creating a room. Google sign-in keeps its displayName.
        display_name: firebaseUser.displayName || '',
        firebase_uid: firebaseUser.uid,
        email: firebaseUser.email,
        avatar_url: firebaseUser.photoURL,
        brand_id: brandId,
      }),
    });
    if (res.ok) {
      const user = await res.json();
      localStorage.setItem('carkedit-user-id', user.id);
      return user;
    }
  } catch (err) {
    console.warn('[CarkedIt Auth] Upsert user failed:', err);
  }
  return null;
}

function friendlyError(code) {
  const map = {
    'auth/user-not-found': 'No account found with that email',
    'auth/wrong-password': 'Incorrect password',
    'auth/invalid-email': 'Invalid email address',
    'auth/email-already-in-use': 'An account with that email already exists',
    'auth/weak-password': 'Password must be at least 6 characters',
    'auth/invalid-credential': 'Invalid email or password',
    'auth/too-many-requests': 'Too many attempts. Try again later',
    'auth/missing-email': 'Please enter your email address',
    'auth/operation-not-allowed': "Email sign-up isn't enabled for this environment",
  };
  return map[code] || 'Authentication failed';
}
