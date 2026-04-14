// CarkedIt Online — Financial Dashboard
'use strict';

import { renderAdminHeader, bindAdminHeader } from './components/admin-header.js';

// ── Constants ─────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC6QJz6jTzJkBWV7Shd9XpCfHWrovJ9vaI",
  authDomain: window.location.host,
  projectId: "carkedit-5cc8e",
  storageBucket: "carkedit-5cc8e.firebasestorage.app",
  messagingSenderId: "144073275425",
  appId: "1:144073275425:web:2301fbbccc2be69c654b60",
};

const PROVIDER_COLORS = {
  'flux-2-pro': { bg: 'rgba(147, 51, 234, 0.15)', fg: '#9333ea', bar: '#9333ea', label: 'FLUX Pro' },
  'flux-2-max': { bg: 'rgba(147, 51, 234, 0.25)', fg: '#7c3aed', bar: '#7c3aed', label: 'FLUX Max' },
  'flux-2-klein-9b': { bg: 'rgba(147, 51, 234, 0.10)', fg: '#a855f7', bar: '#a855f7', label: 'FLUX Klein 9B' },
  'flux-2-klein-4b': { bg: 'rgba(147, 51, 234, 0.08)', fg: '#c084fc', bar: '#c084fc', label: 'FLUX Klein 4B' },
  'leonardo-phoenix-1': { bg: 'rgba(236, 72, 153, 0.15)', fg: '#ec4899', bar: '#ec4899', label: 'Leonardo Phoenix' },
};

function getProviderStyle(provider) {
  return PROVIDER_COLORS[provider] || { bg: 'var(--color-input-bg)', fg: 'var(--color-text-muted)', bar: 'var(--color-text-muted)', label: provider };
}

// ── State ─────────────────────────────────────────────
let _fbAuth = null;
let _fbUserInfo = null;

// ── Utilities ─────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function usd(amount) {
  if (amount == null || isNaN(amount)) return '$0.00';
  return '$' + amount.toFixed(2);
}

function usdShort(amount) {
  if (amount == null || isNaN(amount)) return '$0';
  if (amount >= 1000) return '$' + (amount / 1000).toFixed(1) + 'k';
  if (amount >= 100) return '$' + amount.toFixed(0);
  return '$' + amount.toFixed(2);
}

function monthLabel(ym) {
  const [y, m] = ym.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[parseInt(m, 10) - 1] + ' ' + y.slice(2);
}

// ── API Helper ────────────────────────────────────────
async function costsFetch(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (_fbAuth && _fbAuth.currentUser) {
    const token = await _fbAuth.currentUser.getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`/api/carkedit/costs${path}`, { ...opts, headers });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

// ── Section Renderers ─────────────────────────────────

function renderSummaryCards(data) {
  const { totals } = data;
  const cur = totals.current_month_usd;
  const prev = totals.previous_month_usd;
  let trendClass = 'fin-trend--flat';
  let trendText = 'No change';
  if (prev > 0 && cur !== prev) {
    const pct = ((cur - prev) / prev * 100).toFixed(0);
    if (cur > prev) {
      trendClass = 'fin-trend--up';
      trendText = `+${pct}% vs last month`;
    } else {
      trendClass = 'fin-trend--down';
      trendText = `${pct}% vs last month`;
    }
  } else if (prev === 0 && cur > 0) {
    trendClass = 'fin-trend--up';
    trendText = 'New spending';
  }

  return `
    <div class="fin-stats-row">
      <div class="fin-stat">
        <div class="fin-stat__value">${usd(totals.all_time_usd)}</div>
        <div class="fin-stat__label">All Time</div>
      </div>
      <div class="fin-stat">
        <div class="fin-stat__value">${usd(cur)}</div>
        <div class="fin-stat__label">This Month</div>
        <div class="${trendClass} fin-trend">${esc(trendText)}</div>
      </div>
      <div class="fin-stat">
        <div class="fin-stat__value">${usd(prev)}</div>
        <div class="fin-stat__label">Last Month</div>
      </div>
      <div class="fin-stat">
        <div class="fin-stat__value">${totals.all_time_count.toLocaleString()}</div>
        <div class="fin-stat__label">Generations</div>
      </div>
    </div>
    ${totals.estimated_count > 0 ? `<div class="fin-note">* ${totals.estimated_count} of ${totals.all_time_count} generations use estimated costs (pre-tracking)</div>` : ''}`;
}

function renderProviderBreakdown(data) {
  if (!data.by_provider || data.by_provider.length === 0) {
    return '<div class="fin-empty">No image generation costs recorded yet.</div>';
  }

  const totalUsd = data.by_provider.reduce((s, p) => s + p.total_usd, 0);
  const totalCount = data.by_provider.reduce((s, p) => s + p.count, 0);

  const rows = data.by_provider.map(p => {
    const style = getProviderStyle(p.provider);
    const pct = totalUsd > 0 ? (p.total_usd / totalUsd * 100).toFixed(1) : '0.0';
    return `
      <tr>
        <td><span class="fin-badge" style="background:${style.bg};color:${style.fg}">${esc(style.label)}</span></td>
        <td class="fin-table__num">${usd(p.total_usd)}</td>
        <td class="fin-table__num">${p.count.toLocaleString()}</td>
        <td class="fin-table__num">${pct}%</td>
      </tr>`;
  }).join('');

  return `
    <table class="fin-table">
      <thead>
        <tr><th>Provider</th><th>Cost</th><th>Generations</th><th>Share</th></tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="fin-table__total">
          <td><strong>Total</strong></td>
          <td class="fin-table__num"><strong>${usd(totalUsd)}</strong></td>
          <td class="fin-table__num"><strong>${totalCount.toLocaleString()}</strong></td>
          <td class="fin-table__num"><strong>100%</strong></td>
        </tr>
      </tbody>
    </table>`;
}

function renderMonthlyChart(data) {
  if (!data.by_month || data.by_month.length === 0) {
    return '<div class="fin-empty">No monthly data available.</div>';
  }

  // Collect all providers across months for legend
  const allProviders = new Set();
  data.by_month.forEach(m => {
    Object.keys(m.providers).forEach(p => allProviders.add(p));
  });
  const providers = [...allProviders];

  const maxMonth = Math.max(...data.by_month.map(m => m.total_usd));

  const bars = data.by_month.map(m => {
    const segments = providers.map(p => {
      const val = m.providers[p] || 0;
      if (val === 0) return '';
      const widthPct = maxMonth > 0 ? (val / maxMonth * 100) : 0;
      const style = getProviderStyle(p);
      return `<div class="fin-month-row__bar" style="width:${widthPct}%;background:${style.bar}" title="${esc(style.label)}: ${usd(val)}"></div>`;
    }).join('');

    return `
      <div class="fin-month-row">
        <div class="fin-month-row__label">${monthLabel(m.month)}</div>
        <div class="fin-month-row__bar-container">${segments}</div>
        <div class="fin-month-row__amount">${usd(m.total_usd)}</div>
      </div>`;
  }).join('');

  const legend = providers.map(p => {
    const style = getProviderStyle(p);
    return `<div class="fin-legend__item"><div class="fin-legend__dot" style="background:${style.bar}"></div>${esc(style.label)}</div>`;
  }).join('');

  return `
    <div class="fin-legend">${legend}</div>
    ${bars}`;
}

// ── AWS Cost Section ──────────────────────────────────

function renderAwsSection(awsData) {
  if (!awsData) {
    return '<div class="fin-empty">No AWS data fetched yet. Click "Fetch Latest" to load.</div>';
  }
  const { months, fetched_at } = awsData;
  const rows = months.map(m => {
    const services = Object.entries(m.services)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amt]) => `<div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--color-text-muted);padding:1px 0"><span>${name}</span><span>$${amt.toFixed(4)}</span></div>`)
      .join('');
    return `
      <div style="border:1px solid var(--color-border);border-radius:6px;padding:0.6rem 0.8rem;margin-bottom:0.5rem">
        <div style="display:flex;justify-content:space-between;font-weight:600;margin-bottom:0.3rem">
          <span>${m.month}</span>
          <span>$${m.total_usd.toFixed(4)}</span>
        </div>
        ${services}
      </div>`;
  }).join('');
  const fetchedStr = fetched_at ? new Date(fetched_at).toLocaleString() : '';
  return `
    <div style="font-size:0.7rem;color:var(--color-text-muted);margin-bottom:0.6rem">Last fetched: ${fetchedStr}</div>
    ${rows || '<div class="fin-empty">No AWS costs found for this period.</div>'}`;
}

async function fetchAwsCosts(btn) {
  btn.disabled = true;
  btn.textContent = 'Fetching…';
  const section = document.getElementById('section-aws');
  try {
    const resp = await costsFetch('/fetch/aws', { method: 'POST' });
    section.innerHTML = renderAwsSection(resp);
    btn.textContent = 'Fetch Latest';
  } catch (err) {
    section.innerHTML = `<div class="fin-error">Failed: ${err.message}</div>`;
    btn.textContent = 'Retry';
  } finally {
    btn.disabled = false;
  }
}

window._fetchAwsCosts = fetchAwsCosts;

// ── Dashboard Shell ───────────────────────────────────

function renderDashboard(data) {
  return `
    <div style="padding:var(--space-md)">
      <div class="fin-header">
        <span class="fin-header__title">Financial Dashboard</span>
        <div class="fin-header__meta">
          <button class="btn btn--secondary" style="padding:0.3rem 0.6rem;font-size:0.7rem" onclick="location.reload()">Refresh</button>
        </div>
      </div>

      <div class="fin-grid">

        <div class="fin-card fin-card--full">
          <div class="fin-card__title">Cost Summary</div>
          <div id="section-summary">${renderSummaryCards(data)}</div>
        </div>

        <div class="fin-card">
          <div class="fin-card__title">Provider Breakdown</div>
          <div id="section-providers">${renderProviderBreakdown(data)}</div>
        </div>

        <div class="fin-card">
          <div class="fin-card__title">Monthly Costs</div>
          <div id="section-monthly">${renderMonthlyChart(data)}</div>
        </div>

        <div class="fin-card fin-card--full">
          <div class="fin-card__title" style="display:flex;justify-content:space-between;align-items:center">
            <span>AWS Costs (carkedit.com)</span>
            <button class="btn btn--secondary" style="padding:0.3rem 0.8rem;font-size:0.75rem" onclick="window._fetchAwsCosts(this)">Fetch Latest</button>
          </div>
          <div id="section-aws">${renderAwsSection(null)}</div>
        </div>

      </div>
    </div>`;
}

// ── Init ──────────────────────────────────────────────

async function init() {
  const app = document.getElementById('app');
  app.innerHTML = `
    ${renderAdminHeader({ user: _fbUserInfo })}
    <div style="padding:var(--space-md)">
      <div class="fin-header">
        <span class="fin-header__title">Financial Dashboard</span>
      </div>
      <div class="fin-loading">Loading cost data...</div>
    </div>`;
  bindAdminHeader(app, {
    user: _fbUserInfo,
    onSignOut: () => _fbAuth && _fbAuth.signOut(),
  });

  try {
    const data = await costsFetch('/summary?months=12');
    app.innerHTML = renderAdminHeader({ user: _fbUserInfo }) + renderDashboard(data);
    bindAdminHeader(app, {
      user: _fbUserInfo,
      onSignOut: () => _fbAuth && _fbAuth.signOut(),
    });
  } catch (err) {
    console.error('[financial-dashboard] Failed to load cost data:', err);
    const container = app.querySelector('.fin-loading');
    if (container) {
      container.className = 'fin-error';
      container.textContent = 'Failed to load cost data. ' + err.message;
    }
  }
}

// ── Auth Gate ─────────────────────────────────────────

function renderAuthGate(msg, showSignIn = false) {
  const app = document.getElementById('app');
  app.innerHTML = `
    ${renderAdminHeader()}
    <div style="display:flex;align-items:center;justify-content:center;min-height:80vh;text-align:center">
      <div style="max-width:400px">
        <h1 style="margin-bottom:0.5em">Financial Dashboard</h1>
        <p style="color:#888;margin-bottom:1.5em">${msg}</p>
        ${showSignIn ? '<button class="btn btn--google" id="gate-sign-in" style="font-size:1rem;padding:0.75em 1.5em">Sign in with Google</button>' : ''}
      </div>
    </div>`;
  bindAdminHeader(app, {});
}

document.addEventListener('DOMContentLoaded', async () => {
  renderAuthGate('Loading...', false);
  try {
    const [appMod, authMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js'),
    ]);
    const fbApp = appMod.initializeApp(FIREBASE_CONFIG);
    const fbAuth = authMod.getAuth(fbApp);
    _fbAuth = fbAuth;

    try {
      await authMod.getRedirectResult(fbAuth);
    } catch (redirectErr) {
      console.error('[financial-dashboard] Redirect result error:', redirectErr);
    }

    authMod.onAuthStateChanged(fbAuth, async (user) => {
      if (!user) {
        renderAuthGate('Sign in to access the financial dashboard.', true);
        document.getElementById('gate-sign-in')?.addEventListener('click', async () => {
          const provider = new authMod.GoogleAuthProvider();
          if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            await authMod.signInWithRedirect(fbAuth, provider);
          } else {
            await authMod.signInWithPopup(fbAuth, provider);
          }
        });
        return;
      }
      const token = await user.getIdToken();
      try {
        const res = await fetch('/api/carkedit/users/me', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) { window.location.href = '/'; return; }
        const me = await res.json();
        if (!me.is_admin) {
          const bRes = await fetch('/api/carkedit/admin/bootstrap', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
          if (!bRes.ok) { window.location.href = '/'; return; }
        }
      } catch { window.location.href = '/'; return; }
      _fbUserInfo = { displayName: user.displayName, photoURL: user.photoURL, email: user.email };
      await init();
    });
  } catch (err) {
    console.warn('[financial-dashboard] Firebase init failed:', err);
    renderAuthGate('Authentication service unavailable.', false);
  }
});
