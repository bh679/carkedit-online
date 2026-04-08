// CarkedIt Online — Post-Game NPS Survey
'use strict';

import { getState } from '../state.js';

const API_BASE = `${window.location.origin}/api/carkedit`;

// Module-level state for the current survey instance
let selectedScore = null;
const submittedGames = new Set(); // game_id keys that have already been submitted this session
let expanded = false;
let submitting = false;
let justSubmitted = false;
let autoExpandTimer = null;
const AUTO_EXPAND_MS = 15000;

function gameKey(state) {
  // Prefer roomCode for online games; fall back to a synthetic local key
  if (state.roomCode) return `online:${state.roomCode}`;
  return `local:${state.phase23Round ?? 0}:${state.players.map(p => p.name).join('|')}`;
}

export function hasSubmitted(state) {
  return submittedGames.has(gameKey(state)) || justSubmitted;
}

function getClientVersion() {
  // Best-effort: read from a meta tag or fallback
  const meta = document.querySelector('meta[name="app-version"]');
  return meta?.content || 'unknown';
}

export function render(state) {
  if (hasSubmitted(state) || justSubmitted) {
    return renderThankYou();
  }
  if (!expanded) {
    if (autoExpandTimer === null) {
      autoExpandTimer = setTimeout(() => {
        autoExpandTimer = null;
        if (!expanded && !justSubmitted && !hasSubmitted(state)) {
          expand();
        }
      }, AUTO_EXPAND_MS);
    }
    return `
      <div class="survey survey--collapsed">
        <button class="survey__prompt-btn" onclick="window.survey.expand()">
          💬 Help us improve — share your feedback
        </button>
      </div>
    `;
  }

  const scoreButtons = Array.from({ length: 11 }, (_, i) => {
    const active = selectedScore === i ? ' survey__score-btn--active' : '';
    return `<button class="survey__score-btn${active}" onclick="window.survey.setScore(${i})">${i}</button>`;
  }).join('');

  const canSubmit = selectedScore !== null && !submitting;

  return `
    <div class="survey survey--expanded">
      <h3 class="survey__title">How likely are you to recommend CarkedIt to a friend?</h3>
      <div class="survey__score-row">${scoreButtons}</div>
      <div class="survey__score-labels">
        <span>Not likely</span>
        <span>Very likely</span>
      </div>
      <label class="survey__label">Why that score?</label>
      <textarea id="survey-comment" class="survey__textarea" rows="2" placeholder="Tell us why..."></textarea>
      <label class="survey__label">What could we improve?</label>
      <textarea id="survey-improvement" class="survey__textarea" rows="2" placeholder="Your suggestions..."></textarea>
      <div class="survey__actions">
        <button class="btn ${canSubmit ? 'btn--primary' : 'btn--disabled'}"
                onclick="window.survey.submit()"
                ${canSubmit ? '' : 'disabled'}>
          ${submitting ? 'Sending...' : 'Submit Feedback'}
        </button>
      </div>
    </div>
  `;
}

function renderThankYou() {
  return `
    <div class="survey survey--thanks">
      <h3 class="survey__thanks-title">Thanks for the feedback! 🙏</h3>
      <div class="survey__cta-row">
        <button class="btn btn--primary" onclick="window.game.showScreen('menu')">
          Play Again
        </button>
        <button class="btn btn--secondary" onclick="window.location.href='expansions.html'">
          Make Your Own Cards
        </button>
      </div>
    </div>
  `;
}

function expand() {
  if (autoExpandTimer !== null) { clearTimeout(autoExpandTimer); autoExpandTimer = null; }
  expanded = true;
  if (window.game && typeof window.game.showScreen === 'function') {
    window.game.showScreen('phase4');
  }
}

function setScore(n) {
  selectedScore = n;
  if (window.game && typeof window.game.showScreen === 'function') {
    window.game.showScreen('phase4');
  }
}

async function submit() {
  if (selectedScore === null || submitting) return;
  const state = getState();

  // Read textareas BEFORE re-render
  const commentEl = document.getElementById('survey-comment');
  const improvementEl = document.getElementById('survey-improvement');
  const comment = commentEl?.value?.trim() || '';
  const improvement = improvementEl?.value?.trim() || '';

  submitting = true;
  if (window.game?.showScreen) window.game.showScreen('phase4');

  const myPlayer = state.players.find(p => p.sessionId === state.mySessionId);

  // Compute is_dev the same way phase-header.js does
  const localDev = state.players?.length > 0 && state.players.every(p => p._devName);
  const onlineDev = state.onlinePlayers?.length > 0 && state.onlinePlayers.every(p => p.isDevName);
  const isDev = localDev || onlineDev;

  const payload = {
    game_id: state.roomCode || gameKey(state),
    player_name: myPlayer?.name || null,
    session_id: state.mySessionId || null,
    nps_score: selectedScore,
    comment: comment || null,
    improvement: improvement || null,
    client_version: getClientVersion(),
    is_dev: isDev,
  };

  try {
    const res = await fetch(`${API_BASE}/surveys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok && res.status !== 409) {
      console.warn('[survey] Submit failed:', res.status);
    }
  } catch (err) {
    console.warn('[survey] Submit error:', err);
  }

  submittedGames.add(gameKey(state));
  justSubmitted = true;
  submitting = false;
  selectedScore = null;
  expanded = false;

  if (window.game?.showScreen) window.game.showScreen('phase4');
}

export function reset() {
  if (autoExpandTimer !== null) { clearTimeout(autoExpandTimer); autoExpandTimer = null; }
  expanded = false;
  selectedScore = null;
  submitting = false;
  justSubmitted = false;
}

// Attach to window for inline onclick handlers
window.survey = { expand, setScore, submit, reset };
