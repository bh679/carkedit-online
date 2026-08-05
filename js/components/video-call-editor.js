// CarkedIt Online — Video Call Details editor (host only)
//
// Smart paste: the host drops in a raw invite, parseVideoCallText splits it
// into link / phone / code entries and leftover instructions, and everything
// stays editable afterwards so a wrong guess is never a dead end.
//
// The working copy lives in the DOM rather than in state — harvestDraft() reads
// it back on save (and before any re-render), so typing never fights a
// re-render for focus.
'use strict';

import { escapeHtml } from '../utils/escape.js';
import { detectPlatform, parseVideoCallText, MAX_ENTRIES } from '../utils/video-call.js';

export const REMEMBERED_KEY = 'carkedit:videoCallDetails';

/** Details the host chose to keep on this device, or null. */
export function loadRememberedVideoCall() {
  try {
    const raw = localStorage.getItem(REMEMBERED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.entries)) return null;
    return { entries: parsed.entries, notes: typeof parsed.notes === 'string' ? parsed.notes : '' };
  } catch {
    return null;
  }
}

export function saveRememberedVideoCall(draft) {
  try {
    localStorage.setItem(REMEMBERED_KEY, JSON.stringify({
      entries: draft.entries, notes: draft.notes,
    }));
  } catch { /* private mode / quota — remembering is a convenience, not a requirement */ }
}

export function clearRememberedVideoCall() {
  try { localStorage.removeItem(REMEMBERED_KEY); } catch { /* ignore */ }
}

/** Fresh draft for the editor: the room's current details, or remembered ones. */
export function buildDraft(state) {
  const entries = (state.videoCall || []).map((e) => ({ ...e }));
  const notes = state.videoCallNotes || '';
  if (entries.length === 0 && !notes.trim()) {
    const remembered = loadRememberedVideoCall();
    if (remembered) {
      return { entries: remembered.entries.map((e) => ({ ...e })), notes: remembered.notes, remember: true };
    }
  }
  return { entries, notes, remember: !!loadRememberedVideoCall() };
}

/** Reads the live editor DOM back into a draft object. */
export function harvestDraft(fallback) {
  const root = document.getElementById('vc-editor');
  if (!root) return fallback ?? { entries: [], notes: '', remember: false };

  const entries = Array.from(root.querySelectorAll('.vc-editor__row')).map((row) => {
    const kind = row.dataset.kind || 'link';
    const value = row.querySelector('[data-field="value"]')?.value?.trim() || '';
    return {
      kind,
      // Auto-detected from the value, never typed by the host.
      platform: kind === 'phone' ? 'phone' : kind === 'link' ? detectPlatform(value) : 'other',
      value,
      label: row.querySelector('[data-field="label"]')?.value?.trim() || '',
    };
  });

  return {
    entries,
    notes: root.querySelector('#vc-notes')?.value ?? '',
    remember: !!root.querySelector('#vc-remember')?.checked,
    paste: root.querySelector('#vc-paste')?.value ?? '',
  };
}

/**
 * Merges freshly parsed entries into the draft, skipping duplicates so hitting
 * Detect twice doesn't double everything up.
 */
export function mergeParsed(draft, text) {
  const parsed = parseVideoCallText(text);
  const key = (e) => `${e.kind}:${(e.value || '').toLowerCase().replace(/\s+/g, '')}`;
  const seen = new Set(draft.entries.filter((e) => e.value).map(key));
  const entries = draft.entries.filter((e) => e.value);

  for (const entry of parsed.entries) {
    if (entries.length >= MAX_ENTRIES) break;
    if (seen.has(key(entry))) continue;
    seen.add(key(entry));
    entries.push(entry);
  }

  const notes = [draft.notes.trim(), parsed.notes.trim()].filter(Boolean).join('\n\n');
  return { ...draft, entries, notes };
}

/** Blank row for the manual "+ Link" / "+ Phone" buttons. */
export function blankEntry(kind) {
  return {
    kind: kind === 'phone' ? 'phone' : kind === 'code' ? 'code' : 'link',
    platform: kind === 'phone' ? 'phone' : 'other',
    value: '',
    label: '',
  };
}

/**
 * One entry = a label and a value, nothing else. The platform isn't a field the
 * host fills in — detectPlatform works it out from the link on save.
 */
function renderRow(entry, index) {
  const isPhone = entry.kind === 'phone';
  const isCode = entry.kind === 'code';
  const placeholder = isPhone ? '+61 2 8015 6011' : isCode ? '812 3456 7890' : 'https://…';
  const labelPlaceholder = isPhone ? 'Dial-in' : isCode ? 'Meeting ID' : 'Join Zoom';

  return `
    <div class="vc-editor__row" data-index="${index}" data-kind="${entry.kind}">
      <div class="vc-editor__row-head">
        <input class="input vc-editor__label" data-field="label" type="text"
               placeholder="${labelPlaceholder}" value="${escapeHtml(entry.label)}"
               aria-label="Label for entry ${index + 1}" maxlength="60">
        <button type="button" class="vc-editor__remove" aria-label="Remove entry ${index + 1}"
                onclick="window.game.removeVideoCallEntry(${index})">✕</button>
      </div>
      <input class="input" data-field="value" type="text" inputmode="${isPhone ? 'tel' : 'text'}"
             placeholder="${placeholder}" value="${escapeHtml(entry.value)}"
             aria-label="Value for entry ${index + 1}" maxlength="500">
    </div>
  `;
}

/**
 * @param {object} state — needs state.videoCallDraft (see buildDraft)
 * @returns {string} HTML string
 */
export function renderEditor(state) {
  const draft = state.videoCallDraft ?? { entries: [], notes: '', remember: false, paste: '' };
  const rows = draft.entries.map((e, i) => renderRow(e, i)).join('');
  const atCap = draft.entries.length >= MAX_ENTRIES;

  return `
    <div class="vc-editor" id="vc-editor">
      <label class="vc-editor__field-label" for="vc-paste">Paste your invite</label>
      <textarea id="vc-paste" class="input vc-editor__paste" rows="3" maxlength="4000"
        placeholder="Paste a Zoom, Google Meet, Teams, Discord or WhatsApp invite — we'll sort out the links, numbers and codes."
        onpaste="setTimeout(() => window.game.parseVideoCallPaste(), 0)"
        onchange="window.game.parseVideoCallPaste()">${escapeHtml(draft.paste || '')}</textarea>
      <button type="button" class="btn btn--secondary vc-editor__detect" onclick="window.game.parseVideoCallPaste()">
        Detect details
      </button>

      <div class="vc-editor__list">
        ${rows || '<p class="vc-editor__empty">Nothing detected yet — paste an invite above, or add a link or number by hand.</p>'}
      </div>

      <div class="vc-editor__add-row">
        <button type="button" class="btn btn--secondary" ${atCap ? 'disabled' : ''}
                onclick="window.game.addVideoCallEntry('link')">+ Link</button>
        <button type="button" class="btn btn--secondary" ${atCap ? 'disabled' : ''}
                onclick="window.game.addVideoCallEntry('phone')">+ Phone</button>
        <button type="button" class="btn btn--secondary" ${atCap ? 'disabled' : ''}
                onclick="window.game.addVideoCallEntry('code')">+ Code</button>
      </div>
      ${atCap ? `<p class="vc-editor__hint">Maximum ${MAX_ENTRIES} entries.</p>` : ''}

      <label class="vc-editor__field-label" for="vc-notes">Instructions</label>
      <textarea id="vc-notes" class="input vc-editor__notes" rows="3" maxlength="1000"
        placeholder="Anything else players need to know — e.g. &quot;Cameras on, mics muted until the eulogy.&quot;">${escapeHtml(draft.notes || '')}</textarea>

      <label class="vc-editor__remember">
        <input type="checkbox" id="vc-remember" ${draft.remember ? 'checked' : ''}>
        <span>Remember on this device for my next game</span>
      </label>

      <div class="vc-editor__actions">
        <button type="button" class="btn btn--secondary" onclick="window.game.closeVideoCallEditor()">Cancel</button>
        <button type="button" class="btn btn--primary" onclick="window.game.saveVideoCall()">Save</button>
      </div>
    </div>
  `;
}

/** Drops empty rows and anything the server would reject anyway. */
export function cleanDraftEntries(entries) {
  return entries
    .filter((e) => (e.value || '').trim().length > 0)
    .map((e) => ({
      kind: e.kind,
      platform: e.kind === 'phone' ? 'phone' : e.kind === 'link' ? detectPlatform(e.value) : 'other',
      value: e.value.trim(),
      label: (e.label || '').trim(),
    }))
    .slice(0, MAX_ENTRIES);
}
