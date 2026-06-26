// CarkedIt Online — Partner-brand ("Evangelist") owner admin panel.
//
// Pure, DOM-free rendering + brand-resolution helpers for brand-admin.html.
// The real access boundary is the server-side requireBrandOwner middleware; this
// page is a filtered view over the same global stats datastore, scoped to one
// brand via GET /brands/:id/stats and /brands/:id/users.
'use strict';

import { escapeHtml } from './utils/escape.js';

/**
 * Resolve which brand the panel should show. An explicit `?brand=<id>` wins
 * (lets a global admin inspect any brand); otherwise fall back to the first
 * brand the signed-in user owns (from GET /brands/mine). Null when neither.
 */
export function resolveBrandId(queryBrandId, myBrands) {
  if (queryBrandId) return String(queryBrandId);
  if (Array.isArray(myBrands) && myBrands.length > 0 && myBrands[0] && myBrands[0].id) {
    return String(myBrands[0].id);
  }
  return null;
}

/** Human-readable duration from seconds (matches the terse stats style). */
export function formatDuration(seconds) {
  const s = Math.round(Number(seconds) || 0);
  if (s <= 0) return '—';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

// Count-style stat cards drawn straight from the GamesStats payload.
const STAT_CARDS = [
  { key: 'totalGames', label: 'Games' },
  { key: 'finishedGames', label: 'Finished' },
  { key: 'liveGames', label: 'Live now' },
  { key: 'abandonedGames', label: 'Abandoned' },
  { key: 'allPlayers', label: 'Players (all games)' },
  { key: 'errorGames', label: 'Games w/ errors' },
];

/** Game-stats panel HTML for a GamesStats object (null-safe). */
export function renderStatsPanel(stats) {
  if (!stats) return '<p class="brand-admin__empty">No stats available.</p>';
  const cards = STAT_CARDS.map((c) =>
    `<div class="brand-admin__stat">
      <span class="brand-admin__stat-num">${Number(stats[c.key] ?? 0)}</span>
      <span class="brand-admin__stat-label">${c.label}</span>
    </div>`,
  ).join('');
  const time = `
    <div class="brand-admin__stat">
      <span class="brand-admin__stat-num">${formatDuration(stats.avgPlayTime)}</span>
      <span class="brand-admin__stat-label">Avg game length</span>
    </div>
    <div class="brand-admin__stat">
      <span class="brand-admin__stat-num">${formatDuration(stats.longestPlayTime)}</span>
      <span class="brand-admin__stat-label">Longest game</span>
    </div>`;
  return `<div class="brand-admin__stats">${cards}${time}</div>`;
}

/** Signed-up-accounts table HTML. Escapes user-supplied display names. */
export function renderUsersPanel(users) {
  const list = Array.isArray(users) ? users : [];
  if (list.length === 0) {
    return '<p class="brand-admin__empty">No accounts have signed up under this brand yet.</p>';
  }
  const rows = list.map((u) => {
    const when = u.created_at
      ? new Date(u.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' })
      : '—';
    return `<tr>
      <td>${escapeHtml(u.display_name || '—')}</td>
      <td>${escapeHtml(when)}</td>
    </tr>`;
  }).join('');
  return `<table class="brand-admin__table">
    <thead><tr><th>Name</th><th>Signed up</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}
