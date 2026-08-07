// CarkedIt Online — Desktop join QR
//
// CarkedIt is a phone game: your hand is private, so every player needs their
// own device. Someone who opens a share link on a laptop has no way of knowing
// that until after they've joined on the wrong screen.
//
// So when a share link lands on a desktop we make the phone the default: the
// Join button is hidden and the QR sits under the form, with an explicit
// "I can't use my phone" escape hatch. The escape hatch stays — it's just a
// deliberate choice now instead of the path of least resistance.
//
// Deliberately dependency-light: the join URL and the device check are passed
// in by the screen rather than read from `window` here, so this stays a pure
// string renderer that runs under `node --test`.
'use strict';

import { toQrSvg } from '../utils/qr.js';

/**
 * Whether to steer this visitor to their phone.
 *
 * The single gate for both effects — the QR block and the hidden Join button —
 * so the two can never disagree and strand someone with neither.
 *
 * @param {object} args
 * @param {string} [args.roomCode] — the room being joined
 * @param {boolean} [args.isDesktop] — false on phones and tablets
 * @param {boolean} [args.viaShareLink] — true only when they arrived on ?join=
 * @returns {boolean}
 */
export function shouldNudgeToPhone({ roomCode, isDesktop, viaShareLink } = {}) {
  return !!(isDesktop && viaShareLink && roomCode);
}

/**
 * Builds the block, or returns '' when it shouldn't show.
 *
 * @param {object} args
 * @param {string} args.roomCode — the room being joined
 * @param {string} args.joinUrl — the invite URL to encode
 * @param {boolean} args.isDesktop — false on phones and tablets
 * @param {boolean} args.viaShareLink — true only when they arrived on ?join=
 * @param {boolean} [args.revealed] — true once they've opted into playing here
 * @returns {string} HTML string
 */
export function buildJoinQrBanner({ roomCode, joinUrl, isDesktop, viaShareLink, revealed } = {}) {
  if (!shouldNudgeToPhone({ roomCode, isDesktop, viaShareLink }) || !joinUrl) return '';

  // A failed encode must not cost them the join form underneath.
  let qrSvg = '';
  try {
    qrSvg = toQrSvg(joinUrl, { label: `QR code to open room ${roomCode} on your phone` });
  } catch {
    return '';
  }

  // Same divider the rest of the join screen uses between sections.
  return `
    <div class="online-lobby__divider"></div>
    <div class="join-qr">
      <h2 class="join-qr__title">Best played on your phone</h2>
      <div class="join-qr__code">${qrSvg}</div>
      <p class="join-qr__scan">Scan with your phone camera to open the game there.</p>
      <p class="join-qr__why">Everyone needs their own device — your cards are private.</p>
      ${revealed ? '' : `
      <button type="button" class="join-qr__reveal" onclick="window.game.revealDesktopJoin()">
        I can't use my phone, play from computer
      </button>`}
    </div>
  `;
}
