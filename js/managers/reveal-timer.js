// CarkedIt Online — Card Reveal Animation Timer
// Drives the sequential card-flip reveal between submit and convince phases.
'use strict';

import { getState, setState } from '../state.js';
import { sendMessage } from '../network/client.js';

let _revealTimer = null;
let _revealIndex = 0;
let _revealStarted = false;

/**
 * Start the card reveal sequence (idempotent — safe to call multiple times).
 * Flips one card every 1.5s via CSS class, then sends reveal_complete after a 2s pause.
 * Does NOT trigger re-renders — the flip is pure CSS class toggling on existing DOM.
 * revealIndex is stored in state so that if a Colyseus sync triggers a re-render,
 * already-flipped cards are rendered face-up directly (no animation wrapper).
 */
export function startRevealSequence() {
  if (_revealStarted) return; // already running — don't restart
  _revealStarted = true;

  _revealIndex = 0;
  const state = getState();
  const totalCards = (state.onlineSubmittedCards ?? []).length;
  if (totalCards === 0) {
    _revealStarted = false;
    return;
  }

  setState({ revealIndex: 0 });

  _revealTimer = setInterval(() => {
    const el = document.querySelector(`[data-reveal-index="${_revealIndex}"]`);
    if (el) {
      el.classList.add('card-flip--revealed');
    }
    _revealIndex++;
    setState({ revealIndex: _revealIndex });

    if (_revealIndex >= totalCards) {
      clearInterval(_revealTimer);
      // Assign timeout handle immediately (no null gap)
      _revealTimer = setTimeout(() => {
        _revealTimer = null;
        _revealStarted = false;
        sendMessage('reveal_complete');
      }, 2000);
    }
  }, 1500);
}

export function clearRevealTimer() {
  if (_revealTimer) {
    clearInterval(_revealTimer);
    clearTimeout(_revealTimer);
    _revealTimer = null;
  }
  _revealIndex = 0;
  _revealStarted = false;
}
