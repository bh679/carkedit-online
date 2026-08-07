// CarkedIt Online — Room Join URL
//
// One place builds the invite URL, so the clipboard copy, the QR code and the
// native share sheet can never hand out three different links.
'use strict';

/**
 * Builds the invite URL for a room.
 *
 * The whole query string is replaced rather than appended: the host may well
 * have arrived on a `?join=` link themselves, and carrying stale params (or a
 * second `join`) into an invite is how people end up in the wrong room. The
 * path is kept, so brand vanity URLs keep their branding.
 *
 * @param {string} roomCode — the room's code
 * @param {string} href — the current page URL to derive the origin/path from
 * @returns {string|null} the invite URL, or null when there is no room yet
 */
export function buildJoinUrl(roomCode, href) {
  if (!roomCode || !href) return null;
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  url.search = `?join=${encodeURIComponent(roomCode)}`;
  return url.toString();
}
