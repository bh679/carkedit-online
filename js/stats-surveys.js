// CarkedIt Online — All Survey Responses (See All page)
'use strict';

import { guardPage } from './managers/page-permission-guard.js';
import { renderAdminHeader, bindAdminHeader, resetAdminHeaderMenu } from './components/admin-header.js';
import { getFirebaseConfig } from './firebase-config.js';

await guardPage('stats-surveys').catch((err) => { throw err; });

const FIREBASE_CONFIG = getFirebaseConfig();
const API_BASE = '';
const PAGE_SIZE = 100;

let firebaseAuth = null;
let authToken = null;
let firebaseUserInfo = null;

let surveyResponses = [];
let surveyTotal = 0;

const DEV_VALUES = ['nodev', 'all', 'dev'];
let surveyDevFilter = 'all';

function readFiltersFromUrl() {
  const params = new URLSearchParams(location.search);
  const dev = params.get('dev');
  if (dev && DEV_VALUES.includes(dev)) surveyDevFilter = dev;
}

function writeFiltersToUrl() {
  const params = new URLSearchParams();
  if (surveyDevFilter !== 'all') params.set('dev', surveyDevFilter);
  const qs = params.toString();
  const url = qs ? `${location.pathname}?${qs}` : location.pathname;
  history.replaceState(null, '', url);
}

async function loadFirebaseAuth() {
  const [appMod, authMod] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js'),
  ]);
  const app = appMod.initializeApp(FIREBASE_CONFIG);
  firebaseAuth = authMod.getAuth(app);
  return authMod;
}

function authFetch(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return fetch(url, { ...opts, headers });
}

async function doSignOut() {
  const { signOut } = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js');
  await signOut(firebaseAuth);
  authToken = null;
  firebaseUserInfo = null;
  renderGate('Sign in to view stats.', true);
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

function npsBucketClass(score) {
  if (score >= 9) return 'nps-chip--promoter';
  if (score >= 7) return 'nps-chip--passive';
  return 'nps-chip--detractor';
}

async function fetchSurveys(append = false) {
  try {
    const offset = append ? surveyResponses.length : 0;
    const devParam = surveyDevFilter !== 'all' ? `&dev=${surveyDevFilter}` : '';
    const res = await authFetch(`${API_BASE}/api/carkedit/surveys?limit=${PAGE_SIZE}&offset=${offset}${devParam}`);
    if (!res.ok) return;
    const data = await res.json();
    const incoming = data.responses || [];
    surveyResponses = append ? [...surveyResponses, ...incoming] : incoming;
    surveyTotal = data.total || 0;
  } catch (err) {
    console.warn('[stats-surveys] Failed to fetch surveys:', err);
  }
}

async function loadMore() {
  await fetchSurveys(true);
  renderPage();
}

async function cycleDev() {
  const idx = DEV_VALUES.indexOf(surveyDevFilter);
  surveyDevFilter = DEV_VALUES[(idx + 1) % DEV_VALUES.length];
  writeFiltersToUrl();
  await fetchSurveys(false);
  renderPage();
}

async function toggleSurveyDev(id, next) {
  try {
    const res = await authFetch(`${API_BASE}/api/carkedit/surveys/${encodeURIComponent(id)}/dev`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_dev: !!next }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    const idx = surveyResponses.findIndex(s => String(s.id) === String(id));
    if (idx >= 0) surveyResponses[idx] = { ...surveyResponses[idx], is_dev: updated.is_dev };
    renderPage();
  } catch (err) {
    console.warn('[stats-surveys] Failed to toggle dev:', err);
  }
}

function renderFilters() {
  const devLabels = { all: 'With Dev', nodev: 'No Dev', dev: 'Only Dev' };
  const devActive = surveyDevFilter !== 'all' ? 'dashboard__filter-btn--active' : '';
  return `
    <div class="dashboard__filter-bar">
      <button class="dashboard__filter-btn ${devActive}" onclick="window.statsSurveys.cycleDev()">${devLabels[surveyDevFilter]}</button>
    </div>
  `;
}

const TRUNCATE_CHAR_THRESHOLD = 280;
const TRUNCATE_LINE_THRESHOLD = 5;

function shouldTruncate(text) {
  if (!text) return false;
  if (text.length > TRUNCATE_CHAR_THRESHOLD) return true;
  return text.split('\n').length > TRUNCATE_LINE_THRESHOLD;
}

function fieldClass(text) {
  return shouldTruncate(text)
    ? 'survey-response__field survey-response__field--truncatable'
    : 'survey-response__field';
}

function fieldOnclick(text) {
  return shouldTruncate(text)
    ? ` onclick="this.classList.toggle('survey-response__field--expanded')"`
    : '';
}

function renderResponse(r) {
  const date = new Date(r.created_at).toLocaleString();
  const bucket = npsBucketClass(r.nps_score);
  const player = r.player_name || '(anonymous)';
  const rawComment = r.comment || '';
  const rawImprovement = r.improvement || '';
  const comment = escapeHtml(rawComment);
  const improvement = escapeHtml(rawImprovement);
  const sid = escAttr(String(r.id));
  return `
    <div class="survey-response">
      <div class="survey-response__header">
        <span class="nps-chip ${bucket}">${r.nps_score}</span>
        <span class="survey-response__player">${escapeHtml(player)}</span>
        <span class="survey-response__date">${date}</span>
        <button class="dashboard__dev-toggle ${r.is_dev ? 'is-on' : ''}" title="Toggle dev" onclick="window.statsSurveys.toggleSurveyDev('${sid}', ${!r.is_dev})">DEV</button>
      </div>
      ${comment ? `<div class="${fieldClass(rawComment)}"${fieldOnclick(rawComment)}><strong>Comment:</strong> ${comment}</div>` : ''}
      ${improvement ? `<div class="${fieldClass(rawImprovement)}"${fieldOnclick(rawImprovement)}><strong>Improve:</strong> ${improvement}</div>` : ''}
    </div>
  `;
}

function renderGate(msg, showSignIn = false) {
  document.getElementById('app').innerHTML = `
    ${renderAdminHeader()}
    <div class="dashboard">
      <header class="dashboard__header">
        <h1 class="dashboard__title">All Survey Responses</h1>
      </header>
      <p class="dashboard__empty">${msg}</p>
      ${showSignIn ? '<button class="btn btn--google" id="sign-in-btn" style="font-size:1rem;padding:0.75em 1.5em">Sign in with Google</button>' : ''}
    </div>`;
  bindAdminHeader(document.getElementById('app'), {});
  if (showSignIn) {
    document.getElementById('sign-in-btn').addEventListener('click', async () => {
      const authMod = await loadFirebaseAuth();
      const provider = new authMod.GoogleAuthProvider();
      await authMod.signInWithPopup(firebaseAuth, provider);
    });
  }
}

function renderPage() {
  resetAdminHeaderMenu();
  const app = document.getElementById('app');
  const hasMore = surveyResponses.length < surveyTotal;
  const loadMoreBtn = hasMore
    ? `<button class="dashboard__load-more" onclick="window.statsSurveys.loadMore()">Load more (${surveyResponses.length} of ${surveyTotal})</button>`
    : '';

  const body = surveyResponses.length === 0
    ? '<p class="dashboard__empty">No survey responses yet.</p>'
    : `
      <div class="survey-responses__summary">
        Showing ${surveyResponses.length} of ${surveyTotal} responses
      </div>
      <div class="survey-responses__list">${surveyResponses.map(renderResponse).join('')}</div>
      ${loadMoreBtn}
    `;

  app.innerHTML = `
    ${renderAdminHeader({ user: firebaseUserInfo })}
    <div class="dashboard">
      <header class="dashboard__header">
        <h1 class="dashboard__title">All Survey Responses <span class="dashboard__versions"><a href="stats.html" class="dashboard__see-all" style="flex:0 0 auto;padding:0.25rem 0.75rem;font-size:0.75rem">← Back to Stats</a></span></h1>
      </header>
      <section class="dashboard__section">
        <div id="survey-responses">
          ${renderFilters()}
          ${body}
        </div>
      </section>
    </div>
  `;
  bindAdminHeader(app, { user: firebaseUserInfo, onSignOut: doSignOut });
}

async function boot() {
  await fetchSurveys(false);
  renderPage();
}

window.statsSurveys = { cycleDev, loadMore, toggleSurveyDev };

readFiltersFromUrl();
renderGate('Loading…', false);

try {
  const authMod = await loadFirebaseAuth();
  authMod.onAuthStateChanged(firebaseAuth, async (user) => {
    if (user) {
      authToken = await user.getIdToken();
      firebaseUserInfo = { displayName: user.displayName, photoURL: user.photoURL, email: user.email };
      await boot();
    } else {
      authToken = null;
      firebaseUserInfo = null;
      renderGate('Sign in to view stats.', true);
    }
  });
} catch (err) {
  renderGate('Authentication service unavailable.', false);
}
