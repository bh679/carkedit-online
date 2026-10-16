// CarkedIt Online — Single Player question intro
//
// Each solo question first fills the screen, big and centred, for
// INTRO_HOLD_MS, then glides up into its usual place above the cards. Once it
// lands, `onDone` lets the router re-render without the intro so the cards
// flip in. A tap (or any key) skips straight to the cards.
//
// solo.js renders the intro markup (`.screen--solo-intro`, `[data-solo-intro]`);
// this module only measures, times and cleans up. Only one intro runs at a time.
'use strict';

export const INTRO_HOLD_MS = 2200;
export const INTRO_MOVE_MS = 600;

let cancelActive = null;

/** Stop any running intro (timers + listeners) without calling its onDone. */
export function cancelSoloIntro() {
  if (cancelActive) cancelActive();
  cancelActive = null;
}

/**
 * Start the intro for the solo question currently on screen.
 * @param {{ onDone: () => void }} options
 */
export function runSoloIntro({ onDone }) {
  cancelSoloIntro();
  const screen = document.querySelector('.screen--solo-intro');
  const prompt = screen?.querySelector('[data-solo-intro]');
  if (!screen || !prompt) return;

  const timers = [];
  const skip = (event) => {
    event.preventDefault();
    event.stopPropagation();
    finish();
  };
  const cleanup = () => {
    timers.forEach(clearTimeout);
    screen.removeEventListener('click', skip, true);
    document.removeEventListener('keydown', skip, true);
  };
  function finish() {
    if (cancelActive !== cleanup) return;
    cancelSoloIntro();
    onDone();
  }

  cancelActive = cleanup;
  // Click rather than pointerdown: skipping re-renders, and a pointerdown skip
  // would let the same tap's click land on a freshly dealt card.
  screen.addEventListener('click', skip, true);
  document.addEventListener('keydown', skip, true);

  centre(prompt);
  timers.push(setTimeout(() => settle(screen, prompt, timers, finish), INTRO_HOLD_MS));
}

/** Shift the in-flow prompt so it sits in the middle of the viewport. */
function centre(prompt) {
  const rect = prompt.getBoundingClientRect();
  const dy = window.innerHeight / 2 - (rect.top + rect.height / 2);
  prompt.style.setProperty('--intro-dy', `${Math.round(dy)}px`);
  prompt.classList.add('solo__prompt--placed');
}

/** Glide the prompt up to its resting place, then hand over to the cards. */
function settle(screen, prompt, timers, finish) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    finish();
    return;
  }
  screen.classList.add('screen--solo-intro-settling');
  prompt.classList.add('solo__prompt--settling');
  // Timed rather than transitionend, which can be missed (tab hidden, interrupted).
  timers.push(setTimeout(finish, INTRO_MOVE_MS + 50));
}
