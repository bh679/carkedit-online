// CarkedIt Online — Firebase Auth Manager
'use strict';

import { getState, setState } from '../state.js';

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC6QJz6jTzJkBWV7Shd9XpCfHWrovJ9vaI",
  authDomain: "carkedit-5cc8e.firebaseapp.com",
  projectId: "carkedit-5cc8e",
  storageBucket: "carkedit-5cc8e.firebasestorage.app",
  messagingSenderId: "144073275425",
  appId: "1:144073275425:web:2301fbbccc2be69c654b60",
};

let firebaseApp = null;
let firebaseAuth = null;
let firebaseModules = null;

async function loadFirebase() {
  if (firebaseModules) return firebaseModules;
  const [appMod, authMod] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js'),
  ]);
  firebaseApp = appMod.initializeApp(FIREBASE_CONFIG);
  firebaseAuth = authMod.getAuth(firebaseApp);
  firebaseModules = { app: appMod, auth: authMod };
  return firebaseModules;
}

export async function initAuth(onUserChanged) {
  try {
    const { auth: authMod } = await loadFirebase();
    authMod.onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        const localUser = await linkOrFetchUser(firebaseUser, token);
        setState({
          authUser: localUser,
          firebaseUser: { displayName: firebaseUser.displayName, photoURL: firebaseUser.photoURL, email: firebaseUser.email },
          authToken: token,
          authLoading: false,
          loginError: null,
          showLoginModal: false,
        });
        if (onUserChanged) onUserChanged();
      } else {
        setState({
          authUser: null,
          firebaseUser: null,
          authToken: null,
          authLoading: false,
        });
        if (onUserChanged) onUserChanged();
      }
    });
  } catch (err) {
    console.warn('[CarkedIt Auth] Firebase init failed:', err);
    setState({ authLoading: false });
    if (onUserChanged) onUserChanged();
  }
}

export async function signInWithGoogle() {
  try {
    setState({ loginError: null });
    const { auth: authMod } = await loadFirebase();
    const provider = new authMod.GoogleAuthProvider();
    await authMod.signInWithPopup(firebaseAuth, provider);
  } catch (err) {
    console.error('[CarkedIt Auth] Google sign-in error:', err);
    setState({ loginError: err.message || 'Google sign-in failed' });
  }
}

export async function signInWithEmail(email, password) {
  try {
    setState({ loginError: null });
    const { auth: authMod } = await loadFirebase();
    await authMod.signInWithEmailAndPassword(firebaseAuth, email, password);
  } catch (err) {
    console.error('[CarkedIt Auth] Email sign-in error:', err);
    setState({ loginError: friendlyError(err.code) });
  }
}

export async function signUpWithEmail(email, password) {
  try {
    setState({ loginError: null });
    const { auth: authMod } = await loadFirebase();
    await authMod.createUserWithEmailAndPassword(firebaseAuth, email, password);
  } catch (err) {
    console.error('[CarkedIt Auth] Sign-up error:', err);
    setState({ loginError: friendlyError(err.code) });
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
  const state = getState();
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
      setState({ authUser: user });
    }
  } catch (err) {
    console.warn('[CarkedIt Auth] Profile update failed:', err);
  }
}

async function linkOrFetchUser(firebaseUser, token) {
  const API_BASE = `${window.location.origin}/api/carkedit`;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const anonymousId = localStorage.getItem('carkedit-user-id');
  if (anonymousId) {
    try {
      const res = await fetch(`${API_BASE}/users/link`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ anonymous_user_id: anonymousId }),
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
        display_name: firebaseUser.displayName || 'User',
        firebase_uid: firebaseUser.uid,
        email: firebaseUser.email,
        avatar_url: firebaseUser.photoURL,
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
  };
  return map[code] || 'Authentication failed';
}
