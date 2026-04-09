// CarkedIt Online — Swipe + Drag Navigation
//
// Two document-level pointer-event delegates in one module:
//
// 1. **Inspect overlay swipe** — a horizontal swipe inside any
//    `.hand__inspect-overlay` clicks the overlay's matching
//    `.hand__nav-btn--prev` / `.hand__nav-btn--next` button. Every
//    full-screen card preview in the app (hand inspect, judging card
//    inspect, dashboard card preview, lobby card preview, expansion pack
//    detail preview) shares that markup, so none of those call sites
//    need to change. Overlays without prev/next buttons no-op cleanly.
//
// 2. **Drag-to-scroll** — on non-touch pointers (mouse/pen), clicking and
//    dragging horizontally inside any element whose computed `overflow-x`
//    is `auto` or `scroll` pans that element's `scrollLeft`. Touch
//    pointers bail out so native touch-scroll + CSS scroll-snap continue
//    to work on mobile. Covers `.card-list__scroll`, `.player-list`,
//    `.detail__player-cards`, `.detail__phases-row`, `.detail__phase-cards`,
//    `.dashboard__pack-stats-wrap`, and any future horizontal scroll
//    container without a per-surface allowlist.
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

  // ── Part C: drag-to-scroll for horizontal lists ─────────────────────
  //
  // On non-touch pointers (mouse, pen), click-and-drag horizontally inside
  // any horizontally-scrollable ancestor pans its scrollLeft. This gives
  // desktop users a gestural alternative to the arrow buttons. Touch
  // pointers bail out so native touch-scroll + CSS scroll-snap continue
  // to work on mobile.

  const DRAG_THRESHOLD = 5; // px: pointer movement before drag is "active"
  const INTERACTIVE_SEL = 'button, input, select, textarea, a[href], [role="button"], [contenteditable], [contenteditable=""], [contenteditable="true"]';

  let drag = null; // { container, startX, startScrollLeft, active, pointerId }

  function findScrollableAncestor(el) {
    let n = el;
    while (n && n !== document.body && n.nodeType === 1) {
      if (n.scrollWidth > n.clientWidth) {
        const cs = getComputedStyle(n);
        if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') return n;
      }
      n = n.parentElement;
    }
    return null;
  }

  document.addEventListener('pointerdown', (e) => {
    // Touch devices use native scroll + Part A scroll-snap; don't interfere.
    if (e.pointerType === 'touch') return;
    // Only left-button drags (mouse) or primary pen contact.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Skip interactive controls so their taps still work.
    if (e.target.closest(INTERACTIVE_SEL)) return;
    // Let Part B (overlay swipe) handle taps inside an inspect overlay.
    if (e.target.closest('.hand__inspect-overlay')) return;

    const container = findScrollableAncestor(e.target);
    if (!container) return;

    drag = {
      container,
      startX: e.clientX,
      startScrollLeft: container.scrollLeft,
      active: false,
      pointerId: e.pointerId,
    };
    // Pointer capture makes pointermove/pointerup fire reliably on this
    // element even if the cursor leaves it.
    try { container.setPointerCapture(e.pointerId); } catch { /* not all elements allow it */ }
  }, { passive: true });

  document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.startX;
    if (!drag.active && Math.abs(dx) > DRAG_THRESHOLD) {
      drag.active = true;
      drag.container.style.cursor = 'grabbing';
      drag.container.style.userSelect = 'none';
      // Temporarily disable scroll-snap AND scroll-behavior:smooth so
      // the drag can pan fluidly. The shared `.card-list__scroll`
      // stylesheet sets both (snap to card boundaries, smooth arrow
      // button scrolls), but during a drag we want instant, unsnapped
      // 1:1 pixel response. We restore both inline overrides on release
      // — the natural resting position then snaps to the nearest card
      // boundary, giving free "snap on release".
      drag.prevSnapType = drag.container.style.scrollSnapType;
      drag.prevScrollBehavior = drag.container.style.scrollBehavior;
      drag.container.style.scrollSnapType = 'none';
      drag.container.style.scrollBehavior = 'auto';
    }
    if (drag.active) {
      drag.container.scrollLeft = drag.startScrollLeft - dx;
      // Non-passive so we can preventDefault to stop native text selection
      // and back/forward swipe navigation on trackpads.
      if (e.cancelable) e.preventDefault();
    }
  }, { passive: false });

  function endDrag(e) {
    if (!drag) return;
    if (e && e.pointerId !== drag.pointerId) return;
    const wasActive = drag.active;
    const container = drag.container;
    try { container.releasePointerCapture(drag.pointerId); } catch { /* may already be released */ }
    container.style.cursor = '';
    container.style.userSelect = '';
    if (drag.active) {
      // Restore scroll-snap + scroll-behavior. Writing back the original
      // inline values (empty string if we didn't have one) lets the
      // stylesheet rules take over again. The current scrollLeft then
      // settles to the nearest card boundary, giving a "snap on release"
      // UX for free.
      container.style.scrollSnapType = drag.prevSnapType || '';
      container.style.scrollBehavior = drag.prevScrollBehavior || '';
    }
    drag = null;
    if (wasActive) {
      // Swallow the trailing click so a drag doesn't open a card/pack.
      // One-shot capture-phase listener — removes itself after firing or
      // after a short timeout if no click arrives.
      let consumed = false;
      const killOnce = (ev) => {
        if (consumed) return;
        consumed = true;
        ev.stopPropagation();
        ev.preventDefault();
        document.removeEventListener('click', killOnce, true);
      };
      document.addEventListener('click', killOnce, { capture: true });
      setTimeout(() => {
        if (!consumed) document.removeEventListener('click', killOnce, true);
      }, 300);
    }
  }

  document.addEventListener('pointerup', endDrag, { passive: true });
  document.addEventListener('pointercancel', endDrag, { passive: true });

  // ── Suppress right-click / long-press context menu on card images ──
  //
  // Pair with the CSS rules on `.card__img` / `.card-back__image` /
  // `.ld-profile__card-img` that set `pointer-events: none`. Even though
  // the img itself no longer receives events, browsers may still show a
  // context menu on long-press of the image area (iOS Safari) or when the
  // pointer walks through the parent element. Prevent the default menu
  // whenever the contextmenu event occurs on (or inside) a `.card` or
  // any of the card-image classes — so users can't save the illustration.
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.card, .card__img, .card-back__image, .ld-profile__card-img, .pack-bg__card')) {
      e.preventDefault();
    }
  }, { capture: true });
}
