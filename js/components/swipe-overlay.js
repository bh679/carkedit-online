// CarkedIt Online — Swipe Navigation for Inspect Overlays
//
// Document-level pointer-event delegate that turns a horizontal swipe inside
// any `.hand__inspect-overlay` into a click on the overlay's matching
// `.hand__nav-btn--prev` / `.hand__nav-btn--next` button.
//
// Every full-screen card preview in the app (hand inspect, judging card
// inspect, dashboard card preview, lobby card preview, expansion pack detail
// preview) renders the same `.hand__inspect-overlay` markup with the same
// prev/next buttons. Because this module delegates at the document level
// based purely on that shared markup contract, none of those call sites
// need to change.
//
// Overlays that have no prev/next buttons (e.g. single-card previews, Living
// Dead profile Close-only view) are naturally no-ops — the querySelector
// returns null and the handler returns without clicking anything.
'use strict';

// Idempotent install guard: this module is imported from both `card-list.js`
// and `hand.js`, so it can be evaluated more than once across the page.
if (typeof window !== 'undefined' && !window.__swipeOverlayInit) {
  window.__swipeOverlayInit = true;

  const MIN_DX = 40;         // px: minimum horizontal travel to count as a swipe
  const MAX_DY = 60;         // px: max vertical deviation (reject near-vertical)
  const MAX_DURATION = 600;  // ms: max gesture duration

  let start = null;
  // Set to true briefly after a valid swipe fires a nav-button click. The
  // capture-phase click handler below uses it to swallow the synthetic click
  // event that pointerup would otherwise deliver to the overlay backdrop
  // (whose own onclick is a dismiss).
  let swiped = false;

  document.addEventListener('pointerdown', (e) => {
    const overlay = e.target.closest('.hand__inspect-overlay');
    if (!overlay) return;
    // Don't hijack taps on existing interactive elements inside the overlay.
    if (e.target.closest('.hand__nav-btn, .hand__submit-btn, .btn')) return;
    start = { x: e.clientX, y: e.clientY, t: Date.now(), overlay };
    swiped = false;
  }, { passive: true });

  document.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dt = Date.now() - start.t;
    const overlay = start.overlay;
    start = null;
    if (dt > MAX_DURATION) return;
    if (Math.abs(dy) > MAX_DY) return;
    if (Math.abs(dx) < MIN_DX) return;
    // dx < 0 → finger moved right-to-left → next card
    // dx > 0 → finger moved left-to-right → previous card
    const selector = dx < 0 ? '.hand__nav-btn--next' : '.hand__nav-btn--prev';
    const btn = overlay.querySelector(selector);
    if (btn) {
      swiped = true;
      btn.click();
      // Auto-clear after a short window so a lone `swiped=true` can never
      // linger past the trailing browser-synthesized click. If a trailing
      // backdrop click arrives within this window it will be swallowed;
      // otherwise the flag resets harmlessly.
      setTimeout(() => { swiped = false; }, 200);
    }
  }, { passive: true });

  document.addEventListener('pointercancel', () => { start = null; }, { passive: true });

  // Capture-phase click suppressor: after a valid swipe, the trailing click
  // event that pointerup synthesises on the release target would otherwise
  // land on the overlay backdrop and trigger its onclick dismiss handler.
  // Swallow that single click. IMPORTANT: skip (without consuming the flag)
  // the click on the nav-btn itself — that one comes from our own
  // `btn.click()` above and SHOULD reach its handler. Only the subsequent
  // backdrop click gets swallowed.
  document.addEventListener('click', (e) => {
    if (!swiped) return;
    // Clicks on the nav-btn or card wrapper are legitimate and must pass
    // through unchanged. Don't consume `swiped` for them — we still want
    // to suppress the backdrop click that follows.
    if (e.target.closest('.hand__nav-btn, .hand__inspect-card-wrapper')) return;
    const overlay = e.target.closest('.hand__inspect-overlay');
    if (!overlay) return;
    // This is the backdrop click we want to kill.
    swiped = false;
    e.stopPropagation();
    e.preventDefault();
  }, { capture: true });
}
