// CarkedIt Online — Post-Game NPS Survey (multi-step)
'use strict';

import { getState } from '../state.js';

const API_BASE = `${window.location.origin}/api/carkedit`;

// Module-level state for the current survey instance
let selectedScore = null;
const submittedGames = new Set();
let step = 0;           // 0=collapsed, 1=score, 2=feedback
let submitting = false;
let justSubmitted = false;
let autoExpandTimer = null;
const AUTO_EXPAND_MS = 15000;

// Persist textarea values across re-renders
let commentText = '';
let improvementText = '';

function gameKey(state) {
  if (state.roomCode) return `online:${state.roomCode}`;
  return `local:${state.phase23Round ?? 0}:${state.players.map(p => p.name).join('|')}`;
}

export function hasSubmitted(state) {
  return submittedGames.has(gameKey(state)) || justSubmitted;
}

function getClientVersion() {
  const meta = document.querySelector('meta[name="app-version"]');
  return meta?.content || 'unknown';
}

function rerender() {
  if (window.game?.showScreen) window.game.showScreen('phase4');
}

// ── Render dispatcher ──────────────────────────────────────

export function render(state) {
  if (hasSubmitted(state) || justSubmitted) {
    return renderThankYou();
  }
  if (step === 0) return renderCollapsed(state);
  if (step === 1) return renderScoreStep();
  if (step === 2) return renderFeedbackStep();
  return renderCollapsed(state);
}

// ── Step 0: Collapsed ──────────────────────────────────────

function renderCollapsed(state) {
  if (autoExpandTimer === null) {
    autoExpandTimer = setTimeout(() => {
      autoExpandTimer = null;
      if (step === 0 && !justSubmitted && !hasSubmitted(state)) {
        expand();
      }
    }, AUTO_EXPAND_MS);
  }
  return `
    <div class="survey survey--collapsed">
      <p class="survey__prompt-label">Help us improve</p>
      <button class="btn btn--primary survey__prompt-btn" onclick="window.survey.expand()">
        Share Feedback
      </button>
    </div>
  `;
}

// ── Step 1: NPS Score ──────────────────────────────────────

function renderScoreStep() {
  const scoreButtons = Array.from({ length: 11 }, (_, i) => {
    const active = selectedScore === i ? ' survey__score-btn--active' : '';
    return `<button class="survey__score-btn${active}" onclick="window.survey.setScore(${i})">${i}</button>`;
  }).join('');

  const canNext = selectedScore !== null;

  return `
    <div class="survey survey--step-score">
      <h3 class="survey__title">How likely are you to recommend CarkedIt to a friend?</h3>
      <div class="survey__score-row">${scoreButtons}</div>
      <div class="survey__score-labels">
        <span>Not likely</span>
        <span>Very likely</span>
      </div>
      <div class="survey__actions">
        <button class="btn ${canNext ? 'btn--primary' : 'btn--disabled'}"
                onclick="window.survey.nextStep()"
                ${canNext ? '' : 'disabled'}>
          Next
        </button>
      </div>
    </div>
  `;
}

// ── Step 2: Text Feedback ──────────────────────────────────

function renderFeedbackStep() {
  const safeComment = escapeAttr(commentText);
  const safeImprovement = escapeAttr(improvementText);

  return `
    <div class="survey survey--step-feedback">
      <label class="survey__label">Why that score?</label>
      <textarea id="survey-comment" class="survey__textarea" rows="2"
                placeholder="Tell us why..."
                oninput="window.survey.saveText()">${safeComment}</textarea>
      <label class="survey__label">What could we improve?</label>
      <textarea id="survey-improvement" class="survey__textarea" rows="2"
                placeholder="Your suggestions..."
                oninput="window.survey.saveText()">${safeImprovement}</textarea>
      <div class="survey__actions">
        <button class="btn ${submitting ? 'btn--disabled' : 'btn--primary'}"
                onclick="window.survey.submit()"
                ${submitting ? 'disabled' : ''}>
          ${submitting ? 'Sending...' : 'Submit Feedback'}
        </button>
      </div>
    </div>
  `;
}

// ── Thank You ──────────────────────────────────────────────

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

// ── Actions ────────────────────────────────────────────────

function expand() {
  if (autoExpandTimer !== null) { clearTimeout(autoExpandTimer); autoExpandTimer = null; }
  step = 1;
  rerender();
}

function setScore(n) {
  selectedScore = n;
  rerender();
}

function nextStep() {
  if (selectedScore === null) return;
  step = 2;
  rerender();
}

function prevStep() {
  saveTextFromDOM();
  step = 1;
  rerender();
}

function saveText() {
  saveTextFromDOM();
}

function saveTextFromDOM() {
  const c = document.getElementById('survey-comment');
  const i = document.getElementById('survey-improvement');
  if (c) commentText = c.value;
  if (i) improvementText = i.value;
}

async function submit() {
  if (selectedScore === null || submitting) return;
  const state = getState();

  saveTextFromDOM();
  const comment = commentText.trim();
  const improvement = improvementText.trim();

  submitting = true;
  rerender();

  const myPlayer = state.players.find(p => p.sessionId === state.mySessionId);

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
  step = 0;
  commentText = '';
  improvementText = '';

  rerender();
}

export function reset() {
  if (autoExpandTimer !== null) { clearTimeout(autoExpandTimer); autoExpandTimer = null; }
  step = 0;
  selectedScore = null;
  submitting = false;
  justSubmitted = false;
  commentText = '';
  improvementText = '';
}

// ── Helpers ────────────────────────────────────────────────

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Attach to window for inline onclick handlers
window.survey = { expand, setScore, submit, reset, nextStep, prevStep, saveText };
