// CarkedIt Online — "Video call details" button for a scheduled game.
//
// The in-game version of this lives in the phase header (video-call-panel.js's
// renderCallButton), but that only appears once you're connected to a room. A
// scheduled game has no room for most of its life, so the confirmation and join
// screens need their own way into the same panel — which they can, because the
// details are seeded into state from the reservation.
'use strict';

/**
 * @param {object} state
 * @returns {string} HTML string — empty when the host set no call
 */
export function renderVideoCallLink(state) {
  const hasEntries = (state?.videoCall?.length ?? 0) > 0;
  const hasNotes = !!(state?.videoCallNotes || '').trim();
  if (!hasEntries && !hasNotes) return '';
  return `
    <button class="btn btn--secondary schedule__video-btn" onclick="window.game.openVideoCall()">
      📹 Video call details
    </button>
  `;
}
