// CarkedIt Online — Online Timer Manager
// Client-side timers for online mode, matching shared device timer behavior.
'use strict';

import { getState, setState } from '../state.js';
import { sendMessage } from '../network/client.js';

let _pitchTimer = null;
let _playCardTimer = null;
let _onUpdate = null;

/** Register a callback to re-render when timer ticks */
export function onTimerUpdate(callback) {
  _onUpdate = callback;
}

function notify(updates) {
  setState(updates);
  if (_onUpdate) _onUpdate();
}

// ── Play Card Timer (submit phase) ─────────────────────

export function startPlayCardTimer() {
  clearPlayCardTimer();
  const state = getState();
  const { timerEnabled, playCardTimerEnabled, timerCountUp, pitchDuration } = state.gameSettings ?? {};
  if (!timerEnabled || !playCardTimerEnabled) return;

  const duration = pitchDuration ?? 120;
  notify({ playCardTimerSeconds: timerCountUp ? 0 : duration });

  _playCardTimer = setInterval(() => {
    const s = getState();
    const countUp = s.gameSettings?.timerCountUp ?? false;
    if (countUp) {
      notify({ playCardTimerSeconds: s.playCardTimerSeconds + 1 });
    } else {
      const remaining = s.playCardTimerSeconds - 1;
      if (remaining <= 0) {
        clearPlayCardTimer();
        if (s.gameSettings?.timerAutoAdvance ?? true) {
          // Auto-submit: use selected card or first card in hand
          const hand = s.hand ?? [];
          const cardToSubmit = s.selectedCard ?? hand[0];
          if (cardToSubmit) {
            const cardIndex = hand.findIndex(c => c.id === cardToSubmit.id);
            if (cardIndex >= 0) {
              sendMessage('submit_card', { cardIndex });
            }
          }
          notify({ playCardTimerSeconds: 0 });
        } else {
          notify({ playCardTimerSeconds: 0 });
        }
      } else {
        notify({ playCardTimerSeconds: remaining });
      }
    }
  }, 1000);
}

export function clearPlayCardTimer() {
  if (_playCardTimer !== null) {
    clearInterval(_playCardTimer);
    _playCardTimer = null;
  }
}

// ── Pitch Timer (convince phase) ───────────────────────

export function startPitchTimer() {
  clearPitchTimer();
  const state = getState();
  const { timerEnabled, pitchTimerEnabled, timerCountUp, pitchDuration } = state.gameSettings ?? {};
  if (!timerEnabled || !pitchTimerEnabled) return;

  const duration = pitchDuration ?? 120;
  notify({ pitchTimerSeconds: timerCountUp ? 0 : duration });

  _pitchTimer = setInterval(() => {
    const s = getState();
    const countUp = s.gameSettings?.timerCountUp ?? false;
    if (countUp) {
      notify({ pitchTimerSeconds: s.pitchTimerSeconds + 1 });
    } else {
      const remaining = s.pitchTimerSeconds - 1;
      if (remaining <= 0) {
        clearPitchTimer();
        if (s.gameSettings?.timerAutoAdvance ?? true) {
          // Auto-advance: if it's my turn to convince, end my turn
          if (s.isMyConvinceTurn) {
            sendMessage('end_convince_turn');
          }
        }
        notify({ pitchTimerSeconds: 0 });
      } else {
        notify({ pitchTimerSeconds: remaining });
      }
    }
  }, 1000);
}

export function clearPitchTimer() {
  if (_pitchTimer !== null) {
    clearInterval(_pitchTimer);
    _pitchTimer = null;
  }
}

/** Clear all timers (called on phase transitions, room leave, etc.) */
export function clearAllTimers() {
  clearPlayCardTimer();
  clearPitchTimer();
}
