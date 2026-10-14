// CarkedIt Online — Share / QR panel
//
// Copying a link is useless when the person you want to invite is sitting across
// the table. This panel shows the room's join URL as a QR code they can point a
// camera at, alongside the code, the URL and a copy button.
//
// Mounted on document.body by the router (same approach as the video call panel)
// so it survives screen re-renders and closes without navigating away — losing
// the room on mobile is exactly what we're trying to avoid.
'use strict';

import { escapeHtml } from '../utils/escape.js';
import { toQrSvg } from '../utils/qr.js';

const QR_ICON = `<svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="1.75" y="1.75" width="4.5" height="4.5" rx="1" stroke="currentColor" stroke-width="1.3"/>
  <rect x="9.75" y="1.75" width="4.5" height="4.5" rx="1" stroke="currentColor" stroke-width="1.3"/>
  <rect x="1.75" y="9.75" width="4.5" height="4.5" rx="1" stroke="currentColor" stroke-width="1.3"/>
  <rect x="3.5" y="3.5" width="1" height="1" fill="currentColor"/>
  <rect x="11.5" y="3.5" width="1" height="1" fill="currentColor"/>
  <rect x="3.5" y="11.5" width="1" height="1" fill="currentColor"/>
  <path d="M9.75 9.75h2v2h-2zM12.75 12.75h1.5v1.5h-1.5zM9.75 13h1.5v1.25h-1.5zM13 9.75h1.25v1.5H13z" fill="currentColor"/>
</svg>`;

const COPY_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
  <path d="M10.5 3.5A1.5 1.5 0 0 0 9 2H4a2 2 0 0 0-2 2v5a1.5 1.5 0 0 0 1.5 1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;

const SHARE_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M8 10.5V2m0 0L5.5 4.5M8 2l2.5 2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M3.5 8.5v4a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;

/** True when there is a room worth sharing. */
export function canShare(state) {
  return state?.gameMode === 'online'
    && state?.connectionStatus === 'connected'
    && !!state?.roomCode;
}

/**
 * The small header button. Absent (not disabled) without a room — there is
 * nothing to show, and a dead button just invites a pointless tap.
 */
export function renderShareButton(state) {
  if (!canShare(state)) return '';
  return `
    <button class="phase-header__qr-btn" aria-label="Show QR code" title="Show QR code"
            onclick="window.game.openShare()">
      ${QR_ICON}
    </button>
  `;
}

/**
 * Full overlay markup. `joinUrl` is passed in rather than derived here so this
 * stays a pure string renderer with no window access — the router owns the URL.
 *
 * @param {object} state
 * @param {string} joinUrl — the invite URL, from buildJoinUrl()
 * @param {object} [opts]
 * @param {boolean} [opts.nativeShare] — whether to offer the OS share sheet
 * @returns {string} HTML string, or '' when there is nothing to share
 */
export function renderPanel(state, joinUrl, opts = {}) {
  if (!canShare(state) || !joinUrl) return '';

  // The QR encoder throws only on empty input, which canShare already rules
  // out — but a broken code must not take the whole lobby down with it, so the
  // panel degrades to the code and URL it already has.
  let qrSvg = '';
  try {
    qrSvg = toQrSvg(joinUrl, { label: `QR code to join room ${state.roomCode}` });
  } catch {
    qrSvg = '';
  }

  const qrBlock = qrSvg
    ? `<div class="share-panel__qr">${qrSvg}</div>
       <p class="share-panel__scan-hint">Point a phone camera at this to join</p>`
    : `<p class="share-panel__qr-error">Couldn't draw the QR code — use the link below instead.</p>`;

  const shareBtn = opts.nativeShare
    ? `<button class="btn btn--primary share-panel__share" onclick="window.game.nativeShare()">
         ${SHARE_ICON} Share
       </button>`
    : '';

  return `
    <div class="share-panel__overlay" onclick="window.game.closeShare()">
      <div class="share-panel__panel" onclick="event.stopPropagation()" role="dialog" aria-label="Invite players">
        <div class="share-panel__header">
          <h2 class="share-panel__title">Invite Players</h2>
          <button class="share-panel__close" aria-label="Close" onclick="window.game.closeShare()">✕</button>
        </div>
        <div class="share-panel__body">
          ${qrBlock}
          <div class="share-panel__code">
            <span class="share-panel__code-label">Room Code</span>
            <span class="share-panel__code-value">${escapeHtml(state.roomCode)}</span>
          </div>
          <p class="share-panel__url" id="share-panel-url">${escapeHtml(joinUrl)}</p>
        </div>
        <div class="share-panel__actions">
          <button class="btn btn--secondary share-panel__copy" onclick="window.game.copyShareLink()">
            ${COPY_ICON} Copy Link
          </button>
          ${shareBtn}
        </div>
      </div>
    </div>
  `;
}
