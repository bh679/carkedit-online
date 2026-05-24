// CarkedIt Online — Page Permission Guard
//
// Block a standalone HTML page from loading when the signed-in user's role
// is below the page's effective min role. Pages call:
//
//   import { guardPage } from './js/managers/page-permission-guard.js';
//   await guardPage('admin-users');  // throws on deny
//
// Resolves once the page is cleared to render. On deny, replaces document.body
// with an access-denied screen and rejects so callers can early-return.
'use strict';

import { fetchEffectivePermissions, getPageByPath, meetsRole } from '../config/pages.js';

const FIREBASE_AUTH_URL = 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
const FIREBASE_APP_URL = 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function getCurrentUserRole() {
  // Resolve current Firebase user (if any) and exchange for the local role.
  // Signed-out users are Player (per roles.ts hierarchy).
  try {
    const { getFirebaseConfig } = await import('../firebase-config.js');
    const [appMod, authMod] = await Promise.all([
      import(FIREBASE_APP_URL),
      import(FIREBASE_AUTH_URL),
    ]);
    const app = appMod.getApps?.().length ? appMod.getApp() : appMod.initializeApp(getFirebaseConfig());
    const auth = authMod.getAuth(app);
    const user = await new Promise((resolve) => {
      const unsub = authMod.onAuthStateChanged(auth, (u) => { unsub(); resolve(u); });
    });
    if (!user) return 'Player';
    const token = await user.getIdToken();
    const res = await fetch('/api/carkedit/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return 'Player';
    const me = await res.json();
    return me?.role || 'Player';
  } catch {
    return 'Player';
  }
}

function renderAccessDenied(pagePath, userRole, minRole) {
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;padding:2rem;text-align:center;background:#111;color:#ddd;">
      <div style="max-width:480px;">
        <h1 style="font-size:1.6rem;margin:0 0 0.5em;color:#fff;">Access denied</h1>
        <p style="color:#aaa;margin:0 0 1em;">
          The <strong>${esc(pagePath)}</strong> page requires the <strong>${esc(minRole)}</strong> role
          or higher. Your current role is <strong>${esc(userRole)}</strong>.
        </p>
        <a href="." style="color:#7aaaff;">&larr; Back to game</a>
      </div>
    </div>
  `;
}

export async function guardPage(pathSlug) {
  const [pages, userRole] = await Promise.all([
    fetchEffectivePermissions(),
    getCurrentUserRole(),
  ]);
  const page = pages.find((p) => p.path === pathSlug) ?? getPageByPath(pathSlug);
  const minRole = page?.currentMinRole ?? page?.defaultMinRole ?? 'Player';
  if (meetsRole(userRole, minRole)) return { allowed: true, role: userRole, minRole };
  renderAccessDenied(pathSlug, userRole, minRole);
  throw new Error(`Access denied: ${pathSlug} requires ${minRole}, user has ${userRole}`);
}
