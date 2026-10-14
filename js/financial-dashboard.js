// CarkedIt Online — Financial Dashboard
'use strict';

import { guardPage } from './managers/page-permission-guard.js';
import { renderAdminHeader, bindAdminHeader } from './components/admin-header.js';
import { getFirebaseConfig } from './firebase-config.js';

await guardPage('financial-dashboard').catch((err) => { throw err; });

// ── Constants ─────────────────────────────────────────
const FIREBASE_CONFIG = getFirebaseConfig();

const PROVIDER_COLORS = {
  'flux-2-pro': { bg: 'rgba(147, 51, 234, 0.15)', fg: '#9333ea', bar: '#9333ea', label: 'FLUX Pro' },
  'flux-2-max': { bg: 'rgba(147, 51, 234, 0.25)', fg: '#7c3aed', bar: '#7c3aed', label: 'FLUX Max' },
  'flux-2-klein-9b': { bg: 'rgba(147, 51, 234, 0.10)', fg: '#a855f7', bar: '#a855f7', label: 'FLUX Klein 9B' },
  'flux-2-klein-4b': { bg: 'rgba(147, 51, 234, 0.08)', fg: '#c084fc', bar: '#c084fc', label: 'FLUX Klein 4B' },
  'leonardo-phoenix-1': { bg: 'rgba(236, 72, 153, 0.15)', fg: '#ec4899', bar: '#ec4899', label: 'Leonardo Phoenix' },
  'aws': { bg: 'rgba(255, 153, 0, 0.15)', fg: '#ff9900', bar: '#ff9900', label: 'AWS' },
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
  if (amount > 0 && amount < 0.01) return '$' + amount.toFixed(4);
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
async function costsFetch(path) {
  const headers = {};
  if (_fbAuth && _fbAuth.currentUser) {
    const token = await _fbAuth.currentUser.getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`/api/carkedit/costs${path}`, { headers });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

// ── Section Renderers ─────────────────────────────────

function renderSummaryCards(data, aws) {
  const { totals } = data;
  const awsTotal = (aws && aws.configured) ? aws.totals.total_usd : 0;
  const awsCurMonth = (aws && aws.configured) ? aws.totals.current_month_usd : 0;
  const awsProjected = (aws && aws.configured) ? aws.totals.projected_monthly_usd : 0;
  const combinedAllTime = totals.all_time_usd + awsTotal;
  const cur = totals.current_month_usd + awsCurMonth;
  const projectedMonth = totals.current_month_usd + awsProjected;
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
        <div class="fin-stat__value">${usd(combinedAllTime)}</div>
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
      ${projectedMonth > cur ? `<div class="fin-stat">
        <div class="fin-stat__value">${usd(projectedMonth)}</div>
        <div class="fin-stat__label">Projected / Month</div>
        <div class="fin-trend fin-trend--flat">after free tier</div>
      </div>` : ''}
      <div class="fin-stat">
        <div class="fin-stat__value">${totals.all_time_count.toLocaleString()}</div>
        <div class="fin-stat__label">Generations</div>
      </div>
    </div>
    ${totals.estimated_count > 0 ? `<div class="fin-note">* ${totals.estimated_count} of ${totals.all_time_count} generations use estimated costs (pre-tracking)</div>` : ''}`;
}

// ── Environment Breakdown ─────────────────────────────
const ENV_META = {
  dev:      { label: 'Dev',         bg: 'rgba(59, 130, 246, 0.15)', fg: '#2563eb' },
  staging:  { label: 'Staging',     bg: 'rgba(245, 158, 11, 0.15)', fg: '#d97706' },
  prod:     { label: 'Prod',        bg: 'rgba(34, 197, 94, 0.15)',  fg: '#16a34a' },
  untagged: { label: 'Untagged',    bg: 'var(--color-input-bg)',    fg: 'var(--color-text-muted)' },
};
const ENV_ORDER = ['dev', 'staging', 'prod'];

function getEnvMeta(env) {
  return ENV_META[env] || { label: env, bg: 'var(--color-input-bg)', fg: 'var(--color-text-muted)' };
}

// Merge per-environment image-gen costs (summary.by_environment) with
// per-environment server costs (aws.by_environment) into one table.
function renderEnvironmentTable(data, aws) {
  const imgByEnv = {};
  (data.by_environment || []).forEach(e => { imgByEnv[e.environment] = e.total_usd; });

  const awsConfigured = !!(aws && aws.configured);
  const srvByEnv = {};
  (awsConfigured ? (aws.by_environment || []) : []).forEach(e => { srvByEnv[e.environment] = e.total_usd; });
  const hasServer = awsConfigured && (aws.by_environment || []).length > 0;

  const seen = new Set([...Object.keys(imgByEnv), ...Object.keys(srvByEnv)]);
  const envs = [
    ...ENV_ORDER.filter(e => seen.has(e)),
    ...[...seen].filter(e => !ENV_ORDER.includes(e)).sort(),
  ];

  if (envs.length === 0) {
    return '<div class="fin-empty">No per-environment cost data yet.</div>';
  }

  let totImg = 0, totSrv = 0;
  const rows = envs.map(env => {
    const img = imgByEnv[env] || 0;
    const srv = srvByEnv[env] || 0;
    totImg += img; totSrv += srv;
    const meta = getEnvMeta(env);
    return `<tr>
      <td><span class="fin-badge" style="background:${meta.bg};color:${meta.fg}">${esc(meta.label)}</span></td>
      <td class="fin-table__num">${usd(img)}</td>
      <td class="fin-table__num">${hasServer ? usd(srv) : '—'}</td>
      <td class="fin-table__num">${usd(img + srv)}</td>
    </tr>`;
  }).join('');

  const note = !awsConfigured
    ? '<div class="fin-note">Server (AWS) costs need AWS credentials — showing image-gen costs per environment only.</div>'
    : (!hasServer
        ? '<div class="fin-note">Per-environment server costs appear once the AWS <code>Environment</code> cost-allocation tag is activated (~24–48h, forward-only).</div>'
        : '');

  return `
    <table class="fin-table">
      <thead>
        <tr><th>Environment</th><th>Image Gen</th><th>Server (AWS)</th><th>Total</th></tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="fin-table__total">
          <td><strong>Total</strong></td>
          <td class="fin-table__num"><strong>${usd(totImg)}</strong></td>
          <td class="fin-table__num"><strong>${hasServer ? usd(totSrv) : '—'}</strong></td>
          <td class="fin-table__num"><strong>${usd(totImg + totSrv)}</strong></td>
        </tr>
      </tbody>
    </table>
    ${note}`;
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

// ── AWS Section Renderers ────────────────────────────

function renderAwsSection(aws) {
  if (!aws || !aws.configured) {
    return `<div class="fin-card fin-card--full fin-card--section-heading">
      <div class="fin-card__title">Server Costs (AWS)</div>
    </div>
    <div class="fin-card fin-card--full fin-card--unconfigured">
      <div class="fin-empty">AWS credentials not configured. Add <code>AWS_ACCESS_KEY_ID</code> and <code>AWS_SECRET_ACCESS_KEY</code> to the API <code>.env</code> to enable.</div>
    </div>`;
  }

  const hasProjected = (aws.by_service || []).some(s => s.projected_monthly != null);

  const serviceRows = (aws.by_service || []).map(s => {
    const pct = aws.totals.total_usd > 0 ? (s.total_usd / aws.totals.total_usd * 100).toFixed(1) : '0.0';
    const projectedCol = hasProjected
      ? `<td class="fin-table__num">${s.projected_monthly != null ? usd(s.projected_monthly) + '/mo' : '—'}</td>`
      : '';
    return `<tr>
      <td><span class="fin-badge fin-badge--aws">${esc(s.service)}</span></td>
      <td class="fin-table__num">${usd(s.total_usd)}</td>
      ${projectedCol}
      <td class="fin-table__num">${pct}%</td>
    </tr>`;
  }).join('');

  const projectedHeader = hasProjected ? '<th>Projected</th>' : '';
  const projectedTotal = hasProjected
    ? `<td class="fin-table__num"><strong>${usd(aws.totals.projected_monthly_usd)}/mo</strong></td>`
    : '';

  const serviceTable = `<table class="fin-table">
    <thead><tr><th>Service</th><th>Actual Cost</th>${projectedHeader}<th>Share</th></tr></thead>
    <tbody>
      ${serviceRows}
      <tr class="fin-table__total">
        <td><strong>Total</strong></td>
        <td class="fin-table__num"><strong>${usd(aws.totals.total_usd)}</strong></td>
        ${projectedTotal}
        <td class="fin-table__num"><strong>100%</strong></td>
      </tr>
    </tbody>
  </table>
  ${hasProjected ? '<div class="fin-note">Projected = estimated monthly cost after free tier / promotional periods end</div>' : ''}`;

  // Monthly bars for AWS
  const months = aws.by_month || [];
  const allServices = new Set();
  months.forEach(m => Object.keys(m.services).forEach(s => allServices.add(s)));
  const services = [...allServices];
  const maxMonth = Math.max(...months.map(m => m.total_usd), 0);

  // Pick distinct colors for AWS services
  const AWS_SERVICE_COLORS = ['#ff9900', '#e47911', '#c7511f', '#a84415', '#8c3510', '#6b290d'];
  function getServiceColor(idx) { return AWS_SERVICE_COLORS[idx % AWS_SERVICE_COLORS.length]; }

  const bars = months.map(m => {
    const segments = services.map((s, i) => {
      const val = m.services[s] || 0;
      if (val === 0) return '';
      const widthPct = maxMonth > 0 ? (val / maxMonth * 100) : 0;
      return `<div class="fin-month-row__bar" style="width:${widthPct}%;background:${getServiceColor(i)}" title="${esc(s)}: ${usd(val)}"></div>`;
    }).join('');
    return `<div class="fin-month-row">
      <div class="fin-month-row__label">${monthLabel(m.month)}</div>
      <div class="fin-month-row__bar-container">${segments}</div>
      <div class="fin-month-row__amount">${usd(m.total_usd)}</div>
    </div>`;
  }).join('');

  const legend = services.map((s, i) =>
    `<div class="fin-legend__item"><div class="fin-legend__dot" style="background:${getServiceColor(i)}"></div>${esc(s)}</div>`
  ).join('');

  const monthlyChart = months.length > 0 ? `<div class="fin-legend">${legend}</div>${bars}` : '<div class="fin-empty">No monthly AWS data.</div>';

  return `<div class="fin-card fin-card--full fin-card--section-heading">
    <div class="fin-card__title">Server Costs (AWS)</div>
  </div>
  <div class="fin-card fin-card--wide">
    <div class="fin-card__title">AWS Service Breakdown</div>
    ${serviceTable}
    <div class="fin-note">Fetched ${new Date(aws.fetched_at).toLocaleString()}</div>
  </div>
  <div class="fin-card">
    <div class="fin-card__title">AWS Monthly Costs</div>
    ${monthlyChart}
  </div>`;
}

// ── Dashboard Shell ───────────────────────────────────

function renderDashboard(data, aws) {
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
          <div id="section-summary">${renderSummaryCards(data, aws)}</div>
        </div>

        <div class="fin-card fin-card--full">
          <div class="fin-card__title">Cost by Environment</div>
          <div id="section-environments">${renderEnvironmentTable(data, aws)}</div>
        </div>

        <div class="fin-card fin-card--wide">
          <div class="fin-card__title">Provider Breakdown</div>
          <div id="section-providers">${renderProviderBreakdown(data)}</div>
        </div>

        <div class="fin-card">
          <div class="fin-card__title">Monthly Image Gen Costs</div>
          <div id="section-monthly">${renderMonthlyChart(data)}</div>
        </div>

        ${renderAwsSection(aws)}

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
    const [data, aws] = await Promise.all([
      costsFetch('/summary?months=12'),
      costsFetch('/aws?months=6').catch(() => null),
    ]);
    app.innerHTML = renderAdminHeader({ user: _fbUserInfo }) + renderDashboard(data, aws);
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

// Module scripts run after DOM parse; using a DOMContentLoaded listener here
// breaks when the top-level `await guardPage(...)` above delays evaluation past
// the actual DOMContentLoaded event — the listener registers too late and the
// page renders blank. See dashboard.js for the same fix.
(async () => {
  renderAuthGate('Loading...', false);
  try {
    const [appMod, authMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js'),
    ]);
    // Idempotent: guardPage may have already initialized the default app.
    const fbApp = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FIREBASE_CONFIG);
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
        // Admin status is granted only via the ADMIN_EMAILS allowlist
        // (server-side, on sign-in) — no in-app self-promotion.
        if (!me.is_admin) { window.location.href = '/'; return; }
      } catch { window.location.href = '/'; return; }
      _fbUserInfo = { displayName: user.displayName, photoURL: user.photoURL, email: user.email };
      await init();
    });
  } catch (err) {
    console.warn('[financial-dashboard] Firebase init failed:', err);
    renderAuthGate('Authentication service unavailable.', false);
  }
})();
