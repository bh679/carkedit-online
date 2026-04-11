// CarkedIt Online — Issue Report Overlay Component
'use strict';

import { getState } from '../state.js';
import { getErrorLog, clearErrorState } from '../utils/error-logger.js';

const CATEGORIES = [
  { id: 'connection',  label: 'Connection Issue' },
  { id: 'gameplay',    label: 'Gameplay Issue' },
  { id: 'card',        label: 'Card / Content Issue' },
  { id: 'ui',          label: 'UI / Display Issue' },
  { id: 'other',       label: 'Other' },
];

let _clientVersion = null;

function loadClientVersion() {
  if (_clientVersion) return;
  fetch('package.json')
    .then(r => r.json())
    .then(pkg => { _clientVersion = pkg.version; })
    .catch(() => {});
}

loadClientVersion();

export function render() {
  const checkboxes = CATEGORIES.map(cat => `
    <label class="issue-report__category">
      <input type="checkbox" name="issue-cat" value="${cat.id}">
      <span>${cat.label}</span>
    </label>
  `).join('');

  return `
    <div class="issue-report__overlay" onclick="window.game.closeIssueReport()">
      <div class="issue-report__panel" onclick="event.stopPropagation()">
        <h2 class="issue-report__title">Report an Issue</h2>
        <p class="issue-report__subtitle">What kind of issue are you experiencing?</p>

        <div class="issue-report__categories">
          ${checkboxes}
        </div>

        <textarea
          id="issue-description"
          class="input issue-report__description"
          placeholder="Describe what happened..."
          rows="4"
          maxlength="2000"
        ></textarea>

        <div id="issue-report-status" class="issue-report__status"></div>

        <div class="issue-report__actions">
          <button class="btn btn--secondary" onclick="window.game.closeIssueReport()">Cancel</button>
          <button class="btn btn--primary" id="issue-submit-btn" onclick="window.game.submitIssueReport()">Submit</button>
        </div>

        ${_renderErrorCount()}
      </div>
    </div>
  `;
}

export async function submit() {
  const checkboxes = document.querySelectorAll('input[name="issue-cat"]:checked');
  const categories = Array.from(checkboxes).map(cb => cb.value);

  if (categories.length === 0) {
    _showStatus('Please select at least one issue type.', true);
    return;
  }

  const description = document.getElementById('issue-description')?.value?.trim() || '';
  const state = getState();
  const players = state.gameMode === 'online' ? state.onlinePlayers : state.players;

  const payload = {
    category: categories.join(','),
    description,
    game_mode: state.gameMode,
    screen: state.screen,
    phase: state.phase || state.onlinePhase || null,
    room_code: state.roomCode || null,
    player_count: players.length,
    players_json: JSON.stringify(players.map(p => ({ name: p.name, score: p.score ?? 0 }))),
    game_state_json: JSON.stringify({
      phase: state.phase,
      onlinePhase: state.onlinePhase,
      turnStatus: state.turnStatus,
      connectionStatus: state.connectionStatus,
      round: state.phase23Round,
      livingDeadIndex: state.livingDeadIndex,
      isHost: state.isHost,
    }),
    device_info: JSON.stringify({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screenWidth: screen.width,
      screenHeight: screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      touchSupport: 'ontouchstart' in window,
      language: navigator.language,
    }),
    error_log: JSON.stringify(getErrorLog()),
    client_version: _clientVersion || 'unknown',
  };

  const btn = document.getElementById('issue-submit-btn');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/carkedit/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Server error (${res.status})`);

    clearErrorState();
    _showStatus('Report sent. Thank you!', false);
    setTimeout(() => {
      window.game.closeIssueReport();
    }, 1500);
  } catch (err) {
    _showStatus('Failed to send report. Please try again.', true);
    if (btn) btn.disabled = false;
  }
}

function _renderErrorCount() {
  const errors = getErrorLog();
  const count = errors.length;
  if (count === 0) {
    return '<p class="issue-report__error-count">No errors detected</p>';
  }
  return `<p class="issue-report__error-count issue-report__error-count--has-errors">${count} error${count !== 1 ? 's' : ''} detected &mdash; will be attached to report</p>`;
}

function _showStatus(message, isError) {
  const el = document.getElementById('issue-report-status');
  if (!el) return;
  el.textContent = message;
  el.className = 'issue-report__status' + (isError ? ' issue-report__status--error' : ' issue-report__status--success');
}
