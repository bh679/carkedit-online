// CarkedIt Online — Desktop join QR
//
// CarkedIt is a phone game: your hand is private, so every player needs their
// own device. Someone who opens a share link on a laptop has no way of knowing
// that until after they've joined on the wrong screen.
//
// So when a share link lands on a desktop, we lead with the QR code — scan it,
// carry on with your phone. The join form below stays fully usable: this is
// guidance, not a wall.
//
// Deliberately dependency-light: the join URL and the device check are passed
// in by the screen rather than read from `window` here, so this stays a pure
// string renderer that runs under `node --test`.
'use strict';

import { toQrSvg } from '../utils/qr.js';

/**
 * Builds the block, or returns '' when it shouldn't show.
 *
 * @param {object} args
 * @param {string} args.roomCode — the room being joined
 * @param {string} args.joinUrl — the invite URL to encode
 * @param {boolean} args.isDesktop — false on phones and tablets
 * @param {boolean} args.viaShareLink — true only when they arrived on ?join=
 * @returns {string} HTML string
 */
export function buildJoinQrBanner({ roomCode, joinUrl, isDesktop, viaShareLink } = {}) {
  if (!isDesktop || !viaShareLink || !roomCode || !joinUrl) return '';

  // A failed encode must not cost them the join form underneath.
  let qrSvg = '';
  try {
    qrSvg = toQrSvg(joinUrl, { label: `QR code to open room ${roomCode} on your phone` });
  } catch {
    return '';
  }

  return `
    <div class="join-qr">
      <h2 class="join-qr__title">Best played on your phone</h2>
      <div class="join-qr__code">${qrSvg}</div>
      <p class="join-qr__scan">Scan with your phone camera to open the game there.</p>
      <p class="join-qr__why">Everyone needs their own device — your cards are private.</p>
      <div class="join-qr__or"><span>or join on this computer</span></div>
    </div>
  `;
}
