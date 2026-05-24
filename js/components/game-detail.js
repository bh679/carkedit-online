// CarkedIt Online — Shared Game Detail Rendering
//
// Renders the 3-row expanded view for a single game (Settings, Players,
// Phases, Issues, Debug + Copy-for-Claude). Used by stats.html (Dashboard)
// and stats-games.html (See All Games).
//
// Consumer usage:
//   import { renderGameDetail, init as initGameDetail } from './components/game-detail.js';
//   initGameDetail({ authFetch, apiBase: API_BASE });
//   // ...after fetching /api/carkedit/games/:id and caching gd...
//   const html = renderGameDetail(gd);
//
// The module exposes window.gameDetail for inline onclick handlers in the
// rendered HTML (previewCard, closePreview, copyDebugData).

'use strict';

import { render as renderCard } from './card.js';

// ── Module-level config (set by init) ────────────────
let _authFetch = (url, opts) => fetch(url, opts);
let _apiBase = '';
const _cache = {};

function _resolveApiBase() {
  return typeof _apiBase === 'function' ? _apiBase() : _apiBase;
}

const PREVIEW_OVERLAY_ID = 'game-detail-preview-overlay';

// ── Small helpers ────────────────────────────────────
function escAttr(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

function maskName(name) {
  if (!name || name.length <= 1) return '*';
  return name[0] + '*'.repeat(name.length - 1);
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function _safeParse(jsonStr, fallback) {
  if (!jsonStr) return fallback;
  try { return JSON.parse(jsonStr); } catch { return jsonStr; }
}

function _groupCardPlaysByRound(cardPlays) {
  const roundMap = {};
  for (const cp of (cardPlays || [])) {
    if (!roundMap[cp.round]) roundMap[cp.round] = {};
    if (!roundMap[cp.round][cp.phase]) roundMap[cp.round][cp.phase] = [];
    roundMap[cp.round][cp.phase].push({
      card_id: cp.card_id,
      card_text: cp.card_text,
      card_deck: cp.card_deck,
      player_name: cp.player_name,
      is_winner: !!cp.is_winner,
    });
  }
  return Object.keys(roundMap)
    .sort((a, b) => Number(a) - Number(b))
    .map(round => ({ round: Number(round), phases: roundMap[round] }));
}

async function _copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

// ── Mini-card preview overlay ────────────────────────
function deckTypeFor(deck) {
  return deck === 'living' ? 'live' : deck === 'bye' ? 'bye' : 'die';
}

function renderMiniCard(text, deck, cardId) {
  const deckType = deckTypeFor(deck);
  const compositeId = `${deckType}:${cardId}`;
  const idAttr = cardId ? `, '${escAttr(cardId)}'` : '';
  const innerHtml = renderCard(compositeId)
    || `<div class="card card--${deckType} card--text-only"><div class="card__body card__body--text-only"><h3 class="card__title card__title--${deckType}">${text}</h3></div></div>`;
  return `
    <div class="detail__mini-card" onclick="event.stopPropagation(); window.gameDetail.previewCard('${escAttr(text)}', '${escAttr(deck)}'${idAttr})">
      ${innerHtml}
    </div>`;
}

function previewCard(text, deck, cardId) {
  const deckType = deckTypeFor(deck);
  const compositeId = `${deckType}:${cardId}`;
  const cardHtml = renderCard(compositeId)
    || `<div class="card card--${deckType} card--text-only"><div class="card__body card__body--text-only"><h3 class="card__title card__title--${deckType}">${text}</h3></div></div>`;

  let overlay = document.getElementById(PREVIEW_OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = PREVIEW_OVERLAY_ID;
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '200';
    overlay.style.display = 'none';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="hand__inspect-overlay hand__inspect-overlay--${deckType}" onclick="window.gameDetail.closePreview()">
      <div class="hand__inspect-card-wrapper" onclick="event.stopPropagation()">
        ${cardHtml}
        <button class="btn btn--secondary hand__submit-btn" onclick="window.gameDetail.closePreview()">Close</button>
      </div>
    </div>`;
  overlay.style.display = 'block';
}

function closePreview() {
  const overlay = document.getElementById(PREVIEW_OVERLAY_ID);
  if (overlay) { overlay.style.display = 'none'; overlay.innerHTML = ''; }
}

// ── Detail panel rendering ───────────────────────────
function renderSettingsCard(gd) {
  let settings = {};
  try { settings = gd.settings_json ? JSON.parse(gd.settings_json) : {}; } catch {}

  const settingRows = Object.entries(settings).map(([k, v]) =>
    `<div class="detail__setting-row"><span class="detail__setting-key">${k}</span><span class="detail__setting-val">${v}</span></div>`
  ).join('');

  return `
    <div class="detail__panel">
      <h4 class="detail__panel-title">Settings & Versions</h4>
      <div class="detail__versions">
        <span>API: ${gd.api_version || '—'}</span>
        <span>Client: ${gd.client_version || '—'}</span>
        <span>Mode: ${gd.mode}</span>
        <span>Rounds: ${gd.rounds}</span>
        ${gd.room_code ? `<span>Room: ${gd.room_code}</span>` : ''}
      </div>
      ${settingRows ? `<div class="detail__settings-grid">${settingRows}</div>` : ''}
    </div>`;
}

function renderPlayersCard(gd) {
  const cardPlays = gd.card_plays || [];
  const players = (gd.players || []).map(p => {
    const played = cardPlays.filter(c => c.player_name === p.player_name);
    const isWinner = false;

    const cardsHtml = played.length > 0
      ? `<div class="detail__player-cards">${played.map(c =>
          `<div class="detail__mini-card-wrap ${c.is_winner ? 'detail__mini-card-wrap--winner' : ''}">
            ${renderMiniCard(c.card_text, c.card_deck, c.card_id)}
          </div>`
        ).join('')}</div>`
      : '';

    const scoreText = `${p.score} wins`;

    return `
      <div class="detail__player ${isWinner ? 'detail__player--winner' : ''}">
        <div class="detail__player-header">
          <span class="detail__player-rank">#${p.rank}</span>
          <span class="detail__player-name">${maskName(p.player_name)}${isWinner ? ' ★' : ''}</span>
          <span class="detail__player-score">${scoreText}</span>
        </div>
        ${cardsHtml}
      </div>`;
  }).join('');

  return `
    <div class="detail__panel detail__panel--wide">
      <h4 class="detail__panel-title">Players</h4>
      ${players}
    </div>`;
}

function getActivePhaseKey(status) {
  if (!status) return null;
  if (status.startsWith('die')) return 'die';
  if (status.startsWith('living')) return 'living';
  if (status.startsWith('bye')) return 'bye';
  if (status.startsWith('eulogy')) return 'eulogy';
  return null;
}

const PHASE_DEFS = [
  { key: 'die',     label: 'Die',    settingKey: 'enableDie',    color: 'die' },
  { key: 'living',  label: 'Live',   settingKey: 'enableLive',   color: 'live' },
  { key: 'bye',     label: 'Bye',    settingKey: 'enableBye',    color: 'bye' },
  { key: 'eulogy',  label: 'Eulogy', settingKey: 'enableEulogy', color: 'eulogy' },
];

const PHASE_ORDER = ['die', 'living', 'bye', 'eulogy'];

function renderPhaseCards(gd) {
  const cardPlays = gd.card_plays || [];
  const isLive = gd.live_status === 'live';
  const activePhase = isLive ? getActivePhaseKey(gd.status) : null;

  let settings = {};
  if (gd.settings_json) {
    try { settings = JSON.parse(gd.settings_json); } catch {}
  }

  const playsByPhase = {};
  for (const cp of cardPlays) {
    if (!playsByPhase[cp.phase]) playsByPhase[cp.phase] = [];
    playsByPhase[cp.phase].push(cp);
  }

  function roundCount(plays) {
    return new Set(plays.map(c => c.round)).size;
  }

  const phaseCards = PHASE_DEFS.map(def => {
    const plays = playsByPhase[def.key] || [];
    const hasPlays = plays.length > 0;
    const enabled = settings[def.settingKey] !== false;
    const isActive = activePhase === def.key;

    const statusPhase = getActivePhaseKey(gd.status);
    const statusIdx = statusPhase ? PHASE_ORDER.indexOf(statusPhase) : PHASE_ORDER.length;
    const thisIdx = PHASE_ORDER.indexOf(def.key);
    const isPast = thisIdx < statusIdx;

    let stateClass = '';
    if (!enabled) {
      stateClass = 'detail__phase-card--disabled';
    } else if (isActive) {
      stateClass = `detail__phase-card--active detail__phase-card--active-${def.color}`;
    } else if (!isPast && !hasPlays) {
      stateClass = 'detail__phase-card--pending';
    }

    const rounds = roundCount(plays);
    const roundLabel = rounds > 0 ? `${rounds} round${rounds !== 1 ? 's' : ''}` : '';
    const statsText = hasPlays ? `${plays.length} cards${roundLabel ? ' · ' + roundLabel : ''}` : (enabled ? 'Not yet' : 'Off');

    const cardsHtml = plays.map(c =>
      `<div class="detail__mini-card-wrap ${c.is_winner ? 'detail__mini-card-wrap--winner' : ''}">
        ${renderMiniCard(c.card_text, c.card_deck, c.card_id)}
        <span class="detail__mini-card-player">${maskName(c.player_name)}</span>
      </div>`
    ).join('');

    return `
      <div class="detail__phase-card ${stateClass}">
        <div class="detail__phase-header">
          <span class="detail__phase-name">${def.label}</span>
          <span class="detail__phase-stats">${statsText}</span>
        </div>
        ${hasPlays ? `<div class="detail__phase-cards">${cardsHtml}</div>` : ''}
      </div>`;
  }).join('');

  return `
    <div class="detail__row">
      <h4 class="detail__row-title">Phases</h4>
      <div class="detail__phases-row">${phaseCards}</div>
    </div>`;
}

function _renderErrorLog(errorLogJson) {
  if (!errorLogJson) return '';
  let errors;
  try { errors = JSON.parse(errorLogJson); } catch { return ''; }
  if (!Array.isArray(errors) || errors.length === 0) return '';

  const rows = errors.map(e => {
    const ts = e.timestamp ? new Date(e.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
    const type = e.type ? `<span class="detail__error-type">${e.type}</span>` : '';
    const src = e.source ? ` <span class="detail__error-src">${e.source}${e.line ? ':' + e.line : ''}</span>` : '';
    return `<div class="detail__error-entry">${ts} ${type} ${e.message || ''}${src}</div>`;
  }).join('');

  return `
    <div class="detail__error-log">
      <h5 class="detail__error-log-title" onclick="this.parentElement.classList.toggle('is-collapsed')">
        Errors (${errors.length}) <span class="detail__toggle-arrow">&#9660;</span>
      </h5>
      <div class="detail__error-log-list">${rows}</div>
    </div>`;
}

function renderIssuesCard(gd) {
  if (!gd.issues || gd.issues.length === 0) return '';
  const issueRows = gd.issues.map(issue => {
    const date = new Date(issue.created_at);
    const time = date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const cats = issue.category.split(',').map(c => `<span class="detail__issue-cat">${c.trim()}</span>`).join(' ');
    const desc = issue.description ? `<p class="detail__issue-desc">${issue.description.length > 200 ? issue.description.slice(0, 200) + '...' : issue.description}</p>` : '';
    const meta = [issue.screen, issue.phase].filter(Boolean).join(' / ');
    const errorLogHtml = _renderErrorLog(issue.error_log);
    return `
      <div class="detail__issue-item">
        <div class="detail__issue-header">
          <span class="detail__issue-time">${time}</span>
          ${cats}
          ${meta ? `<span class="detail__issue-meta">${meta}</span>` : ''}
        </div>
        ${desc}
        ${errorLogHtml}
      </div>`;
  }).join('');

  return `
    <div class="detail__row detail__row--issues">
      <h4 class="detail__row-title detail__row-title--issues" onclick="this.parentElement.classList.toggle('is-collapsed')">
        Issue Reports (${gd.issues.length}) <span class="detail__toggle-arrow">&#9660;</span>
      </h4>
      <div class="detail__issues-list">
        ${issueRows}
      </div>
    </div>`;
}

function renderDebugCard(gd) {
  return `
    <div class="detail__row detail__row--debug">
      <h4 class="detail__row-title">Debug</h4>
      <div class="detail__debug">
        <span>ID: ${gd.id}</span>
        <span>Started: ${gd.started_at || '—'}</span>
        <span>Finished: ${gd.finished_at}</span>
        <span>Duration: ${formatDuration(gd.duration_seconds)}</span>
        <span>Status: ${gd.status} / ${gd.live_status}</span>
        <span>Error: ${gd.has_error ? 'Yes' : 'No'}</span>
        <span>Dev: ${gd.is_dev ? 'Yes' : 'No'}</span>
        ${gd.room_code ? `<span>Room code: ${gd.room_code}</span>` : ''}
      </div>
      <button id="copy-debug-btn-${gd.id}" class="detail__copy-debug-btn" onclick="event.stopPropagation(); window.gameDetail.copyDebugData('${gd.id}')">Copy for Claude</button>
    </div>`;
}

async function copyDebugData(gameId) {
  const btn = document.getElementById('copy-debug-btn-' + gameId);
  const gd = _cache[gameId];
  if (!gd) return;

  if (btn) { btn.textContent = 'Loading...'; btn.disabled = true; }

  try {
    let events = [];
    try {
      const res = await _authFetch(`${_resolveApiBase()}/api/carkedit/games/${gameId}/events`);
      if (res.ok) { const data = await res.json(); events = data.events || []; }
    } catch { /* events are optional */ }

    const statusDesc = gd.live_status === 'completed' ? 'completed successfully'
      : gd.live_status === 'abandoned' ? 'was abandoned' : 'is currently live';
    const errorNote = gd.has_error ? ' The game has errors flagged.' : '';
    const issueNote = (gd.issues && gd.issues.length > 0) ? ` There are ${gd.issues.length} issue report(s).` : '';
    const durationNote = gd.duration_seconds ? ` Duration: ${Math.round(gd.duration_seconds / 60)} minutes.` : '';

    const payload = {
      _context: `CarkedIt game debug data for game ${gd.id}. This is a ${gd.mode} game with ${gd.player_count} players that ${statusDesc}.${durationNote}${errorNote}${issueNote} Use this data to diagnose issues or understand game flow.`,
      host_url: window.location.origin,
      game: {
        id: gd.id, mode: gd.mode, room_code: gd.room_code, status: gd.status,
        live_status: gd.live_status, has_error: gd.has_error, is_dev: gd.is_dev,
        started_at: gd.started_at, finished_at: gd.finished_at,
        duration_seconds: gd.duration_seconds, rounds: gd.rounds,
        player_count: gd.player_count, winner_name: gd.winner_name,
        winner_score: gd.winner_score, host_name: gd.host_name,
        api_version: gd.api_version, client_version: gd.client_version,
      },
      settings: _safeParse(gd.settings_json, null),
      players: gd.players || [],
      rounds: _groupCardPlaysByRound(gd.card_plays),
      issues: (gd.issues || []).map(issue => ({
        id: issue.id, created_at: issue.created_at, category: issue.category,
        description: issue.description, screen: issue.screen, phase: issue.phase,
        player_count: issue.player_count, game_mode: issue.game_mode,
        device_info: issue.device_info, client_version: issue.client_version,
        players: _safeParse(issue.players_json, null),
        game_state: _safeParse(issue.game_state_json, null),
        errors: _safeParse(issue.error_log, null),
      })),
      events_timeline: events.map(ev => ({
        event_type: ev.event_type, actor_name: ev.actor_name,
        phase: ev.phase, round: ev.round,
        data: _safeParse(ev.data_json, null),
        created_at: ev.created_at,
      })),
    };

    await _copyToClipboard(JSON.stringify(payload, null, 2));
    if (btn) { btn.textContent = 'Copied!'; btn.classList.add('detail__copy-debug-btn--success'); }
  } catch (err) {
    console.error('[game-detail] copyDebugData failed:', err);
    if (btn) { btn.textContent = 'Copy failed'; btn.classList.add('detail__copy-debug-btn--error'); }
  } finally {
    if (btn) {
      btn.disabled = false;
      setTimeout(() => {
        btn.textContent = 'Copy for Claude';
        btn.classList.remove('detail__copy-debug-btn--success', 'detail__copy-debug-btn--error');
      }, 2000);
    }
  }
}

// ── Public API ───────────────────────────────────────
export function renderGameDetail(gd) {
  if (gd && gd.id) _cache[gd.id] = gd;
  return `
    <div class="dashboard__detail" onclick="event.stopPropagation()">
      <div class="detail__row detail__row--top">
        ${renderSettingsCard(gd)}
        ${renderPlayersCard(gd)}
      </div>
      ${renderPhaseCards(gd)}
      ${renderIssuesCard(gd)}
      ${renderDebugCard(gd)}
    </div>`;
}

export function init({ authFetch, apiBase } = {}) {
  if (typeof authFetch === 'function') _authFetch = authFetch;
  if (typeof apiBase === 'string' || typeof apiBase === 'function') _apiBase = apiBase;
  if (typeof window !== 'undefined') {
    window.gameDetail = { previewCard, closePreview, copyDebugData };
  }
}
