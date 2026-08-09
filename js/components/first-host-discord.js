// CarkedIt Online — first-host Discord bar (in-lobby)
//
// A first-time host has a room code and no way to ask a human anything. This is a
// slim, dismissible line at the foot of the connected lobby pointing them at the
// Discord — shown only to the host, and only until the first game they host has
// actually started.
//
// Import-safe / DOM-free: a pure string builder plus guarded localStorage helpers,
// so this module unit tests under `node --test` and imports into the game bundle
// without any bootstrap side effects. The invite URL is injectable (defaulting to
// the configured one) for the same reason share-panel.js takes its join URL —
// the renderer stays pure and testable.
'use strict';

import { DISCORD_INVITE_URL, DISCORD_PROMPT } from '../config/community.js';

const DISCORD_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M13.09 3.9A11.5 11.5 0 0 0 10.2 3l-.18.36c.98.24 1.84.63 2.62 1.14a9.2 9.2 0 0 0-9.28 0c.78-.51 1.64-.9 2.62-1.14L5.8 3a11.5 11.5 0 0 0-2.89.9C1.13 6.6.65 9.22.9 11.8a11.6 11.6 0 0 0 3.5 1.77l.77-1.2c-.42-.16-.82-.35-1.2-.58l.29-.22a8.3 8.3 0 0 0 7.48 0l.29.22c-.38.23-.78.42-1.2.58l.77 1.2A11.6 11.6 0 0 0 15.1 11.8c.3-3-.47-5.59-2.01-7.9ZM5.72 10.2c-.7 0-1.28-.64-1.28-1.43 0-.79.56-1.44 1.28-1.44s1.3.65 1.28 1.44c0 .79-.57 1.43-1.28 1.43Zm4.56 0c-.7 0-1.28-.64-1.28-1.43 0-.79.56-1.44 1.28-1.44s1.29.65 1.28 1.44c0 .79-.56 1.43-1.28 1.43Z"/>
</svg>`;

// ── First-host tracking ───────────────────────────────────
// Set when a game this player hosted reaches a phase — not when they open a room,
// so a host who creates a room and wanders off still gets the prompt next time.
export const HOSTED_KEY = 'carkedit:hasHostedOnline';

export function isFirstHostedGame() {
  try {
    return !(typeof localStorage !== 'undefined' && localStorage.getItem(HOSTED_KEY));
  } catch {
    return true;
  }
}

export function markOnlineHosted() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(HOSTED_KEY, '1');
  } catch {
    /* private-mode / storage disabled — the prompt simply persists, harmless */
  }
}

// The bar can also be dismissed with its ✕ before that first game; once dismissed
// it stays gone.
export const DISMISS_KEY = 'carkedit:discordBarDismissed';

export function isDiscordBarDismissed() {
  try {
    return !!(typeof localStorage !== 'undefined' && localStorage.getItem(DISMISS_KEY));
  } catch {
    return false;
  }
}

export function markDiscordBarDismissed() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* storage disabled — bar reappears on reload, harmless */
  }
}

// ── The bar ───────────────────────────────────────────────

/**
 * Slim dismissible Discord line for the foot of the connected lobby. Renders
 * nothing unless every condition holds — including a configured invite, so an
 * unset DISCORD_INVITE_URL can never produce a dead link.
 *
 * @param {object} state
 * @param {{url?: string}} [opts] injectable invite URL (defaults to config)
 * @returns {string} HTML string
 */
export function renderFirstHostDiscordBar(state, opts = {}) {
  const url = opts.url ?? DISCORD_INVITE_URL;
  if (!url) return '';
  if (!state?.isHost) return '';
  if (!isFirstHostedGame() || isDiscordBarDismissed()) return '';

  return `
    <div class="online-lobby__discord-bar">
      <a class="online-lobby__discord-link" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">
        <span class="online-lobby__discord-icon" aria-hidden="true">${DISCORD_ICON}</span>
        <span class="online-lobby__discord-text">${DISCORD_PROMPT}</span>
      </a>
      <button type="button" class="online-lobby__discord-x" aria-label="Dismiss" onclick="window.game.dismissDiscordBar()">&times;</button>
    </div>
  `;
}

/**
 * Minimal attribute escaping — the URL is a build-time constant, not user input,
 * but a stray quote would otherwise break out of the href.
 */
function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
