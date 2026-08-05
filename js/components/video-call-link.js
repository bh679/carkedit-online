// CarkedIt Online — "Join the video call" button.
//
// CarkedIt is a storytelling game; the how-to-play tip already tells hosts to
// get everyone on Zoom/Meet/FaceTime. When a scheduled game carries a call
// link, this puts it wherever players are already looking — the confirmation,
// the join screen and the waiting lobby — so nobody has to dig back through
// chat for it.
'use strict';

import { escapeHtml } from '../utils/escape.js';

/**
 * @param {string|null} url  http(s) link; validated server-side on write.
 *   Escaped again here because the value is host-supplied and ends up in an
 *   href attribute.
 * @returns {string} HTML string — empty when there is no call
 */
export function renderVideoCallLink(url) {
  if (!url) return '';
  return `
    <a
      class="btn btn--secondary schedule__video-btn"
      href="${escapeHtml(url)}"
      target="_blank"
      rel="noopener noreferrer"
    >
      📹 Join the video call
    </a>
  `;
}
