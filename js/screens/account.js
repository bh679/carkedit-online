// CarkedIt Online — Manage Account Screen
'use strict';

import { renderPackGrid } from '../components/pack-card.js';
import { ROLE_LABELS } from '../config/brand-labels.js';

// Configurable partner-brand role label (e.g. "Death Evangelist") — never
// hardcode the display name; it lives in brand-labels.js.
const EVANGELIST = ROLE_LABELS.evangelist.singular;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function monthOptions(selected) {
  let html = `<option value="0">—</option>`;
  for (let i = 1; i <= 12; i++) {
    html += `<option value="${i}" ${i === selected ? 'selected' : ''}>${MONTHS[i-1]}</option>`;
  }
  return html;
}

function dayOptions(selected) {
  let html = `<option value="0">—</option>`;
  for (let i = 1; i <= 31; i++) {
    html += `<option value="${i}" ${i === selected ? 'selected' : ''}>${i}</option>`;
  }
  return html;
}

function formatDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export function render(state) {
  const u = state.authUser;
  if (!u) {
    return `
      <div class="screen screen--account">
        <div class="marketplace__header">
          <button class="marketplace__back" onclick="window.game.showScreen('menu')">← Back</button>
          <h1 class="marketplace__title">Manage Account</h1>
          <span></span>
        </div>
        <p class="marketplace__empty">Sign in to manage your account.<br><br>
          <button class="btn btn--primary" onclick="window.game.showLogin()">Sign in</button>
        </p>
      </div>
    `;
  }

  return `
    <div class="screen screen--account">
      <div class="marketplace__header">
        <button class="marketplace__back" onclick="window.game.showScreen('menu')">← Back</button>
        <h1 class="marketplace__title">Manage Account</h1>
        <span></span>
      </div>

      <section class="account__section">
        <h2 class="account__section-title">Profile</h2>
        <form id="account-profile-form" class="account__form" onsubmit="return window.game.saveAccountProfile(event)">
          <label class="account__field">
            <span>Display name</span>
            <input type="text" id="account-display-name" value="${esc(u.display_name || '')}" maxlength="40" required />
          </label>
          <label class="account__field">
            <span>Birth month</span>
            <select id="account-birth-month">${monthOptions(u.birth_month || 0)}</select>
          </label>
          <label class="account__field">
            <span>Birth day</span>
            <select id="account-birth-day">${dayOptions(u.birth_day || 0)}</select>
          </label>
          <div class="account__form-actions">
            <button type="submit" class="btn btn--primary">Save</button>
            <span id="account-profile-status" class="account__status"></span>
          </div>
        </form>
      </section>

      <section class="account__section">
        <h2 class="account__section-title">My Games</h2>
        <div id="account-games-mount"><p class="marketplace__empty">Loading…</p></div>
      </section>

      <section class="account__section">
        <h2 class="account__section-title">My Expansion Packs</h2>
        <div id="account-packs-mount"><p class="marketplace__empty">Loading…</p></div>
      </section>

      <section class="account__section">
        <h2 class="account__section-title">Become a ${esc(EVANGELIST)}</h2>
        <p class="account__hint">Run co-branded games at your own URL (<code>carkedit.com/your-url</code>).
          Submit a request and an admin will review it.</p>
        <div id="account-brands-mount"></div>
        <form id="brand-request-form" class="account__form" onsubmit="return window.game.submitBrandRequest(event)">
          <label class="account__field">
            <span>Brand name</span>
            <input type="text" id="brand-request-name" maxlength="80" required placeholder="Acme Funeral Co." />
          </label>
          <label class="account__field">
            <span>Desired URL</span>
            <input type="text" id="brand-request-slug" maxlength="40" required placeholder="acme"
              oninput="window.game.checkBrandSlug()" />
          </label>
          <p class="account__slug-hint" id="brand-slug-hint">carkedit.com/&lt;your-url&gt;</p>
          <label class="account__field">
            <span>Logo (optional)</span>
            <input type="file" id="brand-request-logo" accept="image/*" />
          </label>
          <div class="account__form-actions">
            <button type="submit" class="btn btn--primary">Submit request</button>
            <span id="brand-request-status" class="account__status"></span>
          </div>
        </form>
      </section>
    </div>
  `;
}

/** Render the user's existing brand requests with their review status. */
export function renderMyBrands(brands) {
  if (!brands || brands.length === 0) return '';
  const items = brands.map((b) => `
    <li class="account__brand">
      <span class="account__brand-slug">carkedit.com/${esc(b.slug)}</span>
      <span class="account__brand-name">${esc(b.name)}</span>
      <span class="account__brand-status account__brand-status--${esc(b.status)}">${esc(b.status)}</span>
    </li>
  `).join('');
  return `<div class="account__brands">
    <h3 class="account__brands-title">Your requests</h3>
    <ul class="account__brands-list">${items}</ul>
  </div>`;
}

export function renderGamesList(games) {
  if (!games || games.length === 0) {
    return '<p class="marketplace__empty">No games yet.</p>';
  }
  const rows = games.map((g) => `
    <li class="account__game">
      <div class="account__game-main">
        <strong>${esc(g.winnerName || 'Unknown')}</strong>
        <span class="account__game-score">${g.winnerScore ?? 0}</span>
      </div>
      <div class="account__game-meta">
        ${esc(g.mode || 'local')} · ${g.rounds || 1} rounds · ${(g.players || []).length} players · ${esc(formatDate(g.finishedAt))}
      </div>
    </li>
  `).join('');
  return `<ul class="account__games">${rows}</ul>`;
}

export function renderMyPacks(packs) {
  return renderPackGrid(packs, {
    showFavorite: false,
    emptyMessage: 'You haven\'t made any expansion packs yet.',
  });
}
