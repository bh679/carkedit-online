// CarkedIt Online — Video Call Details panel
//
// The host's call details (links, phone numbers, meeting codes, instructions)
// live behind one small header button so they never take up board space. The
// panel itself is mounted on document.body — the same approach as the issue
// report overlay — so it survives screen re-renders and works during the game,
// not just in the lobby.
'use strict';

import { escapeHtml } from '../utils/escape.js';
import { isSafeLink, toDialHref, defaultLabel } from '../utils/video-call.js';
import { renderEditor } from './video-call-editor.js';

const PHONE_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M5.2 2.5 6.6 5 5.3 6.6c.7 1.5 1.9 2.7 3.4 3.4L10.3 8.7l2.5 1.4v2.1c0 .7-.6 1.3-1.3 1.2C6.4 13 2.4 9 2 3.8c0-.7.5-1.3 1.2-1.3h2z"
    fill="currentColor"/>
</svg>`;

const COPY_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
  <path d="M10.5 3.5A1.5 1.5 0 0 0 9 2H4a2 2 0 0 0-2 2v5a1.5 1.5 0 0 0 1.5 1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;

/** True when the room has anything worth showing. */
export function hasVideoCall(state) {
  return (state?.videoCall?.length ?? 0) > 0 || !!(state?.videoCallNotes || '').trim();
}

/**
 * The small header button. Hidden for players until the host adds details;
 * the host always sees it so they have somewhere to add them.
 */
export function renderCallButton(state) {
  if (state?.gameMode !== 'online' || state?.connectionStatus !== 'connected') return '';
  const has = hasVideoCall(state);
  if (!has && !state?.isHost) return '';
  const cls = `phase-header__call-btn${has ? ' phase-header__call-btn--active' : ''}`;
  const label = has ? 'Video call details' : 'Add video call details';
  return `
    <button class="${cls}" aria-label="${label}" title="${label}" onclick="window.game.openVideoCall()">
      ${PHONE_ICON}${has ? '<span class="phase-header__call-dot" aria-hidden="true"></span>' : ''}
    </button>
  `;
}

function renderCopyBtn(index) {
  return `
    <button class="video-call__copy" aria-label="Copy" title="Copy"
            onclick="event.stopPropagation(); window.game.copyVideoCallValue(${index})">
      ${COPY_ICON}
    </button>
  `;
}

/**
 * Every entry reads the same way: the label is the title, the value sits under
 * it, and the copy button sits beside it. Links and phone numbers make that
 * pair pressable; codes are copy-only.
 */
function renderEntry(entry, index) {
  const label = escapeHtml(entry.label || defaultLabel(entry));

  if (entry.kind === 'link') {
    // Defence in depth: the server already restricts links to http/https.
    if (!isSafeLink(entry.value)) return '';
    return `
      <div class="video-call__row" data-index="${index}">
        <a class="btn btn--primary video-call__action" href="${escapeHtml(entry.value)}"
           target="_blank" rel="noopener noreferrer">${label}</a>
        ${renderCopyBtn(index)}
      </div>
    `;
  }

  if (entry.kind === 'phone') {
    const href = toDialHref(entry.value);
    if (!href) return '';
    return `
      <div class="video-call__row" data-index="${index}">
        <a class="video-call__field" href="${escapeHtml(href)}">
          <span class="video-call__field-label">${label}</span>
          <span class="video-call__field-value">${escapeHtml(entry.value)}</span>
        </a>
        ${renderCopyBtn(index)}
      </div>
    `;
  }

  return `
    <div class="video-call__row" data-index="${index}">
      <div class="video-call__field">
        <span class="video-call__field-label">${label}</span>
        <span class="video-call__field-value">${escapeHtml(entry.value)}</span>
      </div>
      ${renderCopyBtn(index)}
    </div>
  `;
}

function renderDetails(state) {
  const entries = state.videoCall || [];
  const notes = (state.videoCallNotes || '').trim();

  if (entries.length === 0 && !notes) {
    return `
      <p class="video-call__empty">
        ${state.isHost
          ? 'No call details yet. Paste your Zoom, Meet, Teams or Discord invite so everyone can join.'
          : 'The Funeral Director hasn\'t added call details yet.'}
      </p>
    `;
  }

  const rows = entries.map((e, i) => renderEntry(e, i)).join('');
  const notesHtml = notes
    ? `<div class="video-call__notes">
         <h3 class="video-call__notes-title">Instructions</h3>
         <p class="video-call__notes-body">${escapeHtml(notes).replace(/\n/g, '<br>')}</p>
       </div>`
    : '';

  return `${rows}${notesHtml}`;
}

/**
 * Full overlay markup — either the read-only details or, for the host, the
 * editor. Mounted by window.game.openVideoCall().
 */
export function renderPanel(state) {
  const editing = !!state.videoCallEditOpen && state.isHost;
  const hostBtn = state.isHost && !editing
    ? `<button class="btn btn--secondary video-call__edit-btn" onclick="window.game.openVideoCallEditor()">
         ✎ ${hasVideoCall(state) ? 'Edit call details' : 'Add call details'}
       </button>`
    : '';

  return `
    <div class="video-call__overlay" onclick="window.game.closeVideoCall()">
      <div class="video-call__panel" onclick="event.stopPropagation()" role="dialog" aria-label="Video call details">
        <div class="video-call__header">
          <h2 class="video-call__title">${editing ? 'Call Details' : 'Join the Call'}</h2>
          <button class="video-call__close" aria-label="Close" onclick="window.game.closeVideoCall()">✕</button>
        </div>
        <div class="video-call__body">
          ${editing ? renderEditor(state) : renderDetails(state)}
        </div>
        ${hostBtn}
      </div>
    </div>
  `;
}
