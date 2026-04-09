// CarkedIt Online — Admin Image Generator page app.
//
// Single-module SPA for the admin-only test page that generates AI
// illustrations for custom expansion-pack cards. Mirrors the "Edit Card"
// form from js/card-designer/app.js lines 389-475, then layers on:
//
//   1. A tab switcher (Scratch card vs Pick from pack).
//   2. A provider picker populated from GET /image-gen/providers.
//   3. An editable style JSON (per-field inputs loaded from
//      js/data/image-gen-style.json, with a raw-JSON toggle).
//   4. A final-prompt preview the user can override before generating.
//   5. A generated-image panel with Download and Save-to-Card buttons.
//
// The page is mounted by admin-image-gen.html after the Firebase admin gate
// has been cleared. The shell passes in a pre-fetched provider list and a
// signOut callback; all other API calls go through image-gen-api.js.

'use strict';

import { render as renderCard } from '../components/card.js';
import { buildCard } from '../data/card.js';
import {
  listProviders,
  generateImage,
  saveImageToCard,
  saveStyleJson,
  listGenerationLog,
  listMyPacks,
  getPackWithCards,
} from './image-gen-api.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = {
  // Shell-provided
  container: null,
  firebaseUser: null,
  signOut: () => {},

  // Tabs
  activeTab: 'scratch',          // 'scratch' | 'pick'

  // Card form fields — mirror of card-designer state
  cardFormDeckType: 'die',
  cardFormText: '',
  cardFormPrompt: '',
  cardFormSpecial: '',            // '' | '?' | 'Split'
  cardFormOption1: '',
  cardFormOption2: '',

  // Pick-from-pack state
  packs: [],
  packsLoading: false,
  selectedPackId: null,
  selectedPack: null,
  selectedCardId: null,

  // Image generation panel
  providers: [],                  // from shell
  selectedProviderId: null,
  style: {},                      // editable clone of the default JSON
  defaultStyle: {},               // shipped default (Reset target)
  rawJsonMode: false,             // false = per-field inputs, true = textarea
  rawJsonDraft: '',               // when in rawJsonMode, the textarea contents
  rawJsonError: null,
  // Both style editor sections start collapsed — once the defaults
  // are dialled in, the user doesn't need to see the editor on every
  // mount. Click the caret on either header to expand.
  styleCollapsed: true,           // collapse the Style JSON body (field or raw)
  decksCollapsed: true,           // collapse only the Decks subsection
  promptOverride: null,           // null = use auto-assembled, string = overridden
  promptPreview: '',              // last auto-assembled prompt for the UI

  // Generation status
  generating: false,
  generateError: null,
  generated: null,                // { imageUrl, provider, promptSent, meta }

  // Save-to-card status
  saving: false,
  saveError: null,

  // Save-style-to-disk status (Save JSON button)
  savingStyle: false,
  saveStyleError: null,
  savedAt: 0,                     // ms timestamp of last successful save (for "Saved ✓" flash)

  // Recent generations gallery — driven by /api/carkedit/image-gen/log.
  // Loaded once at mount + refreshed after every successful generate +
  // when the user clicks a scope filter button.
  generationLog: [],
  generationLogScope: 'all',      // 'all' | 'mine' | 'admins'
  generationLogLoading: false,
  generationLogError: null,
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function humanizeKey(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
}

/**
 * Mirror of the server's buildPrompt() — lets us show a live prompt preview
 * in the UI without a round-trip. Must stay in sync with
 * carkedit-api/src/services/image-gen/buildPrompt.ts.
 *
 * Per-deck config is pulled from `style.decks[deckType]`:
 *   - `prefix`     — prepended as "<prefix>: <cardText>…"
 *   - `annotation` — parenthesized and appended as "<cardText>. (<annotation>)"
 * The nested `decks` key is filtered out of the style clause.
 */
function buildPromptClient({ cardText, cardPrompt, deckType, style }) {
  // Extract per-deck config from the nested `decks` sub-object.
  let deckPrefix = '';
  let deckAnnotation = '';
  if (style && typeof style === 'object' && style.decks && typeof style.decks === 'object' && deckType) {
    const cfg = style.decks[deckType];
    if (cfg && typeof cfg === 'object') {
      if (typeof cfg.prefix === 'string' && cfg.prefix.trim()) deckPrefix = cfg.prefix.trim();
      if (typeof cfg.annotation === 'string' && cfg.annotation.trim()) deckAnnotation = cfg.annotation.trim();
    }
  }

  const parts = [];
  if (cardText && cardText.trim()) parts.push(cardText.trim());
  if (cardPrompt && cardPrompt.trim()) parts.push(cardPrompt.trim());
  if (deckAnnotation) parts.push(`(${deckAnnotation})`);
  const cardBody = parts.join('. ');
  const cardSection = deckPrefix && cardBody
    ? `${deckPrefix}: ${cardBody}`
    : (deckPrefix || cardBody);

  let styleSection = '';
  if (style && typeof style === 'object') {
    const styleParts = Object.entries(style)
      // Skip the nested `decks` object — its prefix/annotation are used
      // above, not as flat style fields.
      .filter(([k, v]) => k !== 'decks' && typeof v === 'string' && v.trim().length > 0)
      .map(([k, v]) => `${humanizeKey(k)}: ${v.trim()}`);
    if (styleParts.length > 0) {
      styleSection = `Style: ${styleParts.join('; ')}.`;
    }
  }
  if (cardSection && styleSection) return `${cardSection}. ${styleSection}`;
  if (cardSection) return `${cardSection}.`;
  return styleSection;
}

function recomputePromptPreview() {
  state.promptPreview = buildPromptClient({
    cardText: state.cardFormText,
    cardPrompt: state.cardFormPrompt,
    deckType: state.cardFormDeckType,
    style: state.style,
  });
}

function resetStyle() {
  state.style = JSON.parse(JSON.stringify(state.defaultStyle));
  state.rawJsonDraft = JSON.stringify(state.style, null, 2);
  state.rawJsonError = null;
  recomputePromptPreview();
}

/**
 * Target pixel dimensions for an image generation request, sized to the
 * actual card region the image will fill. Values are BFL-friendly
 * (multiples of 32) and also work for Leonardo.
 *
 * - Die standard / mystery fill the whole 5:7 card → portrait.
 * - Die split (Would You Rather) carves the card into two horizontal
 *   halves, so each half is ~10:7 landscape.
 * - Live / Bye graphic area is the top ~55% with a 4% margin → ~4:3
 *   landscape.
 */
function targetDimensions(deckType, special) {
  if (deckType === 'die' && special === 'Split') {
    return { width: 1152, height: 800 };   // ≈10:7 landscape per split half
  }
  if (deckType === 'die') {
    return { width: 960, height: 1344 };   // exact 5:7 portrait (full card)
  }
  return { width: 1024, height: 768 };     // exact 4:3 landscape (live/bye)
}

function currentCardForPreview() {
  const isDie = state.cardFormDeckType === 'die';
  const isSplit = isDie && state.cardFormSpecial === 'Split';
  const isMystery = isDie && state.cardFormSpecial === '?';
  const generatedUrl = state.generated?.imageUrl || '';
  return {
    title: state.cardFormText || 'Card text preview…',
    description: '',
    prompt: state.cardFormPrompt,
    // `image` (full-bleed illustration) left blank — AI-generated art uses
    // the new `graphicImage` / `graphicImages` paths in card.js which keep
    // the text-only layout and just swap the splatter pattern.
    image: '',
    // Non-split variants fill the whole graphic area with a single image.
    graphicImage: isSplit ? '' : generatedUrl,
    // Split variants render two half-slots. Today we only generate one
    // image at a time, so it lands in the top slot and the bottom slot
    // shows the default --split-bg-b colour (visible proof that the
    // two-slot layout is in place). When dual-gen lands, pass both URLs.
    graphicImages: isSplit ? [generatedUrl, ''] : null,
    illustrationKey: '',
    deckType: state.cardFormDeckType,
    brandImageUrl: state.selectedPack?.brand_image_url || '',
    special: isDie ? state.cardFormSpecial : '',
    options: isSplit
      ? [state.cardFormOption1 || 'Option A', state.cardFormOption2 || 'Option B']
      : null,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render() {
  if (!state.container) return;
  state.container.innerHTML = `
    ${renderAuthBar()}
    <div class="admin-img-gen">
      <header class="admin-img-gen__header">
        <h1 class="admin-img-gen__title">Card Image Generator</h1>
        <p class="admin-img-gen__subtitle">Test AI image generation styles against a structured prompt. Admin only.</p>
      </header>
      ${renderTabs()}
      <div class="admin-img-gen__grid">
        <section class="admin-img-gen__col admin-img-gen__col--left">
          ${state.activeTab === 'pick' ? renderPickPanel() : ''}
          ${renderCardForm()}
          ${renderGenerationPanel()}
        </section>
        <section class="admin-img-gen__col admin-img-gen__col--right">
          ${renderPreviewPanel()}
          ${renderGeneratedPanel()}
        </section>
      </div>
      ${renderGenerationLog()}
    </div>
  `;
}

function renderAuthBar() {
  const name = state.firebaseUser?.displayName || 'Admin';
  const photo = state.firebaseUser?.photoURL;
  const initial = (name || 'A').charAt(0).toUpperCase();
  const avatar = photo
    ? `<img class="auth-bar__avatar" src="${esc(photo)}" alt="">`
    : `<span class="auth-bar__avatar auth-bar__avatar--initial">${esc(initial)}</span>`;
  return `
    <div class="page-auth">
      <div class="auth-bar">
        <span class="auth-bar__label" style="margin-right:0.5em;color:var(--color-text-muted,#888);font-size:0.85rem">${esc(name)}</span>
        ${avatar}
        <button class="btn btn--small" data-action="sign-out" style="margin-left:0.5em">Sign out</button>
      </div>
    </div>`;
}

function renderTabs() {
  return `
    <div class="admin-img-gen__tabs">
      <button class="btn btn--small admin-img-gen__tab ${state.activeTab === 'scratch' ? 'admin-img-gen__tab--active' : ''}" data-action="set-tab" data-tab="scratch">Scratch card</button>
      <button class="btn btn--small admin-img-gen__tab ${state.activeTab === 'pick' ? 'admin-img-gen__tab--active' : ''}" data-action="set-tab" data-tab="pick">Pick from pack</button>
    </div>
  `;
}

function renderPickPanel() {
  const opts = state.packs.map(p =>
    `<option value="${esc(p.id)}" ${p.id === state.selectedPackId ? 'selected' : ''}>${esc(p.title || '(untitled)')}</option>`
  ).join('');
  const cards = state.selectedPack?.cards || [];
  const cardList = cards.length
    ? cards.map(c => {
        const active = c.id === state.selectedCardId ? 'admin-img-gen__card-row--active' : '';
        const label = `[${esc(c.deck_type)}${c.card_special ? ' ' + esc(c.card_special) : ''}] ${esc(c.text || '').slice(0, 60)}`;
        const hasImg = c.image_url ? ' ✓' : '';
        return `<button class="admin-img-gen__card-row ${active}" data-action="pick-card" data-card-id="${esc(c.id)}">${label}${hasImg}</button>`;
      }).join('')
    : (state.selectedPackId
        ? '<p class="admin-img-gen__muted">This pack has no cards.</p>'
        : '<p class="admin-img-gen__muted">Pick a pack above to see its cards.</p>');

  return `
    <div class="admin-img-gen__section">
      <h2 class="admin-img-gen__section-title">Pick a pack + card</h2>
      ${state.packsLoading
        ? '<p class="admin-img-gen__muted">Loading packs…</p>'
        : `
          <label class="designer__label">
            Pack
            <select class="designer__input" data-action="select-pack">
              <option value="">— choose a pack —</option>
              ${opts}
            </select>
          </label>
          <div class="admin-img-gen__card-list">${cardList}</div>
        `
      }
    </div>
  `;
}

function renderCardForm() {
  const isDie = state.cardFormDeckType === 'die';
  const isSplit = isDie && state.cardFormSpecial === 'Split';
  const isMystery = isDie && state.cardFormSpecial === '?';

  const deckTypes = ['die', 'live', 'bye'];
  const deckPicker = deckTypes.map(t => {
    const label = t.charAt(0).toUpperCase() + t.slice(1);
    const active = state.cardFormDeckType === t ? 'designer__deck-btn--active' : '';
    return `<button class="btn btn--small designer__deck-btn ${active}" data-action="set-deck-type" data-type="${t}">${label}</button>`;
  }).join('');

  const variantPicker = isDie ? `
    <div class="designer__field">
      <span class="designer__label">Die Card Type</span>
      <div class="designer__deck-picker">
        <button class="btn btn--small designer__deck-btn ${state.cardFormSpecial === '' ? 'designer__deck-btn--active' : ''}" data-action="set-special" data-special="">Standard</button>
        <button class="btn btn--small designer__deck-btn ${isMystery ? 'designer__deck-btn--active' : ''}" data-action="set-special" data-special="?">Mystery (?)</button>
        <button class="btn btn--small designer__deck-btn ${isSplit ? 'designer__deck-btn--active' : ''}" data-action="set-special" data-special="Split">Would You Rather</button>
      </div>
    </div>` : '';

  const splitFields = isSplit ? `
    <label class="designer__label">
      Option A
      <input class="designer__input" type="text" data-field="card-option-1" maxlength="100" placeholder="First option..." value="${esc(state.cardFormOption1)}">
    </label>
    <label class="designer__label">
      Option B
      <input class="designer__input" type="text" data-field="card-option-2" maxlength="100" placeholder="Second option..." value="${esc(state.cardFormOption2)}">
    </label>` : '';

  const promptField = isDie ? '' : `
    <label class="designer__label">
      Prompt (optional)
      <textarea class="designer__input designer__textarea" data-field="card-prompt" maxlength="200" placeholder="Optional follow-up question shown under the card text...">${esc(state.cardFormPrompt)}</textarea>
    </label>
    <div class="designer__char-count">${state.cardFormPrompt.length}/200</div>`;

  return `
    <div class="admin-img-gen__section">
      <h2 class="admin-img-gen__section-title">Card details</h2>
      <div class="designer__card-form">
        <div class="designer__field">
          <span class="designer__label">Deck Type</span>
          <div class="designer__deck-picker">${deckPicker}</div>
        </div>
        ${variantPicker}
        <label class="designer__label">
          Card Text${isSplit ? ' (auto-generated for Split cards)' : ''}
          <textarea class="designer__input designer__textarea" data-field="card-text" maxlength="200" placeholder="What's on the card..."${isSplit ? ' readonly' : ''}>${esc(state.cardFormText)}</textarea>
        </label>
        <div class="designer__char-count">${state.cardFormText.length}/200</div>
        ${splitFields}
        ${promptField}
      </div>
    </div>
  `;
}

function renderGenerationPanel() {
  const providerOpts = state.providers.length === 0
    ? '<option value="">No providers registered</option>'
    : state.providers.map(p => {
        const label = p.configured ? p.label : `${p.label} — API key missing`;
        const selected = p.id === state.selectedProviderId ? 'selected' : '';
        const disabled = p.configured ? '' : 'disabled';
        return `<option value="${esc(p.id)}" ${selected} ${disabled}>${esc(label)}</option>`;
      }).join('');

  const styleBody = state.rawJsonMode ? renderStyleRaw() : renderStyleFields();

  const promptValue = state.promptOverride !== null
    ? state.promptOverride
    : state.promptPreview;

  return `
    <div class="admin-img-gen__section">
      <h2 class="admin-img-gen__section-title">Image generation</h2>

      <label class="designer__label">
        Provider
        <select class="designer__input" data-action="select-provider">${providerOpts}</select>
      </label>

      <div class="admin-img-gen__style-header">
        <button class="admin-img-gen__collapse-toggle" data-action="toggle-style-collapse" aria-expanded="${!state.styleCollapsed}">
          <span class="admin-img-gen__caret">${state.styleCollapsed ? '\u25B8' : '\u25BE'}</span>
          <span class="designer__label">Style JSON</span>
        </button>
        <div>
          <button class="btn btn--small btn--ghost" data-action="toggle-style-mode">${state.rawJsonMode ? 'Switch to fields' : 'Edit raw JSON'}</button>
          <button class="btn btn--small btn--ghost" data-action="reset-style">Reset</button>
          <button class="btn btn--small btn--ghost" data-action="save-style" ${state.savingStyle || state.rawJsonError ? 'disabled' : ''} title="Write the current style JSON back to js/data/image-gen-style.json on disk">${
            state.savingStyle ? 'Saving…'
            : (state.savedAt && (Date.now() - state.savedAt < 2000)) ? 'Saved \u2713'
            : 'Save JSON'
          }</button>
        </div>
      </div>
      ${state.saveStyleError ? `<p class="admin-img-gen__error">${esc(state.saveStyleError)}</p>` : ''}
      ${state.styleCollapsed ? '' : styleBody}

      <label class="designer__label">
        Final prompt (editable — override auto-assembly)
        <textarea class="designer__input designer__textarea admin-img-gen__prompt-preview" data-field="prompt-override" rows="5" placeholder="Assembled prompt appears here…">${esc(promptValue)}</textarea>
      </label>
      <div class="admin-img-gen__prompt-actions">
        <button class="btn btn--small btn--ghost" data-action="reset-prompt">Reset to auto-assembled</button>
      </div>

      ${state.generateError ? `<p class="admin-img-gen__error">${esc(state.generateError)}</p>` : ''}

      <div class="admin-img-gen__gen-actions">
        <button class="btn btn--primary" data-action="generate" ${state.generating ? 'disabled' : ''}>${state.generating ? 'Generating…' : 'Generate image'}</button>
      </div>
    </div>
  `;
}

function renderStyleFields() {
  // Main style fields: iterate all keys EXCEPT the nested `decks` object
  // — that renders in its own dedicated sub-section below.
  const styleKeys = Object.keys(state.style).filter(k => k !== 'decks');
  const rows = styleKeys.map(k => `
    <label class="designer__label admin-img-gen__style-row">
      ${esc(humanizeKey(k))}
      <textarea class="designer__input designer__textarea admin-img-gen__style-input" data-field="style-key" data-key="${esc(k)}" rows="2">${esc(state.style[k])}</textarea>
    </label>
  `).join('');

  // Dedicated sub-section for per-deck config. Each deck gets two inputs:
  // - Prefix:     prepended to card text ("Died from: <card>…")
  // - Annotation: parenthesized and joined with card sentences
  //               ("<card>. (die card for a board game)")
  // Either or both can be blank. The full `decks` object also appears
  // verbatim in the raw-JSON view when the user toggles it.
  const decks = (state.style.decks && typeof state.style.decks === 'object')
    ? state.style.decks
    : {};
  const deckRows = ['die', 'live', 'bye'].map(deck => {
    const cfg = (decks[deck] && typeof decks[deck] === 'object') ? decks[deck] : {};
    const cap = deck.charAt(0).toUpperCase() + deck.slice(1);
    return `
      <div class="admin-img-gen__deck-group">
        <div class="admin-img-gen__deck-group-label">${cap}</div>
        <label class="designer__label admin-img-gen__style-row">
          Prefix
          <input class="designer__input admin-img-gen__style-input" type="text" data-field="deck-config" data-deck="${deck}" data-key="prefix" placeholder="(e.g. 'Died from')" value="${esc(cfg.prefix ?? '')}">
        </label>
        <label class="designer__label admin-img-gen__style-row">
          Annotation
          <input class="designer__input admin-img-gen__style-input" type="text" data-field="deck-config" data-deck="${deck}" data-key="annotation" placeholder="(e.g. '${deck} card for a board game')" value="${esc(cfg.annotation ?? '')}">
        </label>
      </div>
    `;
  }).join('');

  return `
    <div class="admin-img-gen__style-fields">${rows}</div>
    <div class="admin-img-gen__style-header" style="margin-top: 0.75rem">
      <button class="admin-img-gen__collapse-toggle" data-action="toggle-decks-collapse" aria-expanded="${!state.decksCollapsed}">
        <span class="admin-img-gen__caret">${state.decksCollapsed ? '\u25B8' : '\u25BE'}</span>
        <span class="designer__label">Decks</span>
      </button>
    </div>
    ${state.decksCollapsed ? '' : `<div class="admin-img-gen__style-fields">${deckRows}</div>`}
  `;
}

function renderStyleRaw() {
  return `
    <textarea class="designer__input designer__textarea admin-img-gen__style-raw" data-field="style-raw" rows="14" spellcheck="false">${esc(state.rawJsonDraft)}</textarea>
    ${state.rawJsonError ? `<p class="admin-img-gen__error">${esc(state.rawJsonError)}</p>` : ''}
  `;
}

function renderPreviewPanel() {
  const cardHtml = renderCard(buildCard(currentCardForPreview()));
  return `
    <div class="admin-img-gen__section">
      <h2 class="admin-img-gen__section-title">Card preview</h2>
      <div class="admin-img-gen__card-preview">${cardHtml}</div>
    </div>
  `;
}

function renderGeneratedPanel() {
  if (!state.generated && !state.generating && !state.generateError) {
    return `
      <div class="admin-img-gen__section">
        <h2 class="admin-img-gen__section-title">Generated image</h2>
        <p class="admin-img-gen__muted">Nothing yet — fill out the form and click Generate.</p>
      </div>
    `;
  }
  if (state.generating) {
    return `
      <div class="admin-img-gen__section">
        <h2 class="admin-img-gen__section-title">Generated image</h2>
        <p class="admin-img-gen__muted">Generating… (this can take 10–60 seconds)</p>
      </div>
    `;
  }
  const g = state.generated;
  if (!g) return '';
  const canSave = state.activeTab === 'pick' && !!state.selectedPackId && !!state.selectedCardId;
  const saveBtn = canSave
    ? `<button class="btn btn--primary" data-action="save-to-card" ${state.saving ? 'disabled' : ''}>${state.saving ? 'Saving…' : 'Save to card'}</button>`
    : `<button class="btn btn--primary" disabled title="Pick a card in the Pick tab to enable">Save to card</button>`;
  return `
    <div class="admin-img-gen__section">
      <h2 class="admin-img-gen__section-title">Generated image</h2>
      <img class="admin-img-gen__generated" src="${esc(g.imageUrl)}" alt="Generated card illustration">
      <div class="admin-img-gen__gen-meta">
        <strong>Provider:</strong> ${esc(g.provider)}<br>
        <strong>Prompt sent:</strong> <span class="admin-img-gen__muted">${esc(g.promptSent)}</span>
      </div>
      ${state.saveError ? `<p class="admin-img-gen__error">${esc(state.saveError)}</p>` : ''}
      <div class="admin-img-gen__gen-actions">
        <a class="btn" href="${esc(g.imageUrl)}" download="card-${Date.now()}.png" target="_blank" rel="noopener">Download</a>
        ${saveBtn}
      </div>
    </div>
  `;
}

/**
 * Recent generations gallery — full-width section below the main grid.
 * Every successful generate auto-saves a row to `generation_log` on the
 * server; this renders the latest 50 (default scope) as a grid of
 * clickable card thumbnails. Clicking a thumbnail hydrates the form
 * with the logged card context so the user can iterate.
 */
function renderGenerationLog() {
  const scopes = [
    { id: 'all', label: 'Everything' },
    { id: 'mine', label: 'Mine' },
    { id: 'admins', label: 'All admins' },
  ];
  const filters = scopes.map(s => {
    const active = state.generationLogScope === s.id ? 'admin-img-gen__log-filter--active' : '';
    return `<button class="btn btn--small ${active}" data-action="set-log-scope" data-scope="${s.id}">${s.label}</button>`;
  }).join('');

  let body = '';
  if (state.generationLogLoading) {
    body = '<p class="admin-img-gen__muted">Loading…</p>';
  } else if (state.generationLogError) {
    body = `<p class="admin-img-gen__error">${esc(state.generationLogError)}</p>`;
  } else if (state.generationLog.length === 0) {
    body = '<p class="admin-img-gen__muted">No generations yet — click Generate to start.</p>';
  } else {
    const cells = state.generationLog.map(entry => {
      let optsArr = null;
      try { optsArr = entry.options_json ? JSON.parse(entry.options_json) : null; } catch {}
      const isSplit = entry.deck_type === 'die' && entry.card_special === 'Split';
      const cardHtml = renderCard(buildCard({
        title: entry.text || '(untitled)',
        description: '',
        prompt: entry.prompt || '',
        image: '',
        graphicImage: isSplit ? '' : (entry.image_url || ''),
        graphicImages: isSplit ? [entry.image_url || '', entry.image_url_b || ''] : null,
        deckType: entry.deck_type,
        // buildCard normalises '?'/'Split' → 'mystery'/'split' so pass the raw DB value through.
        special: entry.deck_type === 'die' ? (entry.card_special || '') : '',
        options: optsArr,
      }));
      return `
        <button class="admin-img-gen__log-cell" data-action="hydrate-from-log" data-log-id="${esc(entry.id)}" title="${esc(entry.text || '')}&#10;${esc(entry.provider)} · ${esc(entry.created_at)}">
          ${cardHtml}
        </button>
      `;
    }).join('');
    body = `<div class="admin-img-gen__log-grid">${cells}</div>`;
  }

  return `
    <div class="admin-img-gen__section admin-img-gen__log-section">
      <h2 class="admin-img-gen__section-title">Recent generations</h2>
      <div class="admin-img-gen__log-filters">${filters}</div>
      ${body}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function onClick(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.getAttribute('data-action');

  switch (action) {
    case 'sign-out':
      state.signOut();
      return;

    case 'set-tab': {
      const tab = target.getAttribute('data-tab');
      if (tab === 'pick' && state.packs.length === 0 && !state.packsLoading) {
        loadPacks();
      }
      state.activeTab = tab;
      render();
      return;
    }

    case 'set-deck-type': {
      const t = target.getAttribute('data-type');
      state.cardFormDeckType = t;
      if (t !== 'die') state.cardFormSpecial = '';
      recomputePromptPreview();
      render();
      return;
    }

    case 'set-special': {
      state.cardFormSpecial = target.getAttribute('data-special') || '';
      if (state.cardFormSpecial !== 'Split') {
        // Option fields are irrelevant for non-Split cards.
      }
      recomputePromptPreview();
      render();
      return;
    }

    case 'toggle-style-mode':
      if (!state.rawJsonMode) {
        state.rawJsonDraft = JSON.stringify(state.style, null, 2);
        state.rawJsonError = null;
      } else {
        // Switching back to field mode — try to commit any pending raw edit.
        try {
          const parsed = JSON.parse(state.rawJsonDraft);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            state.style = parsed;
            state.rawJsonError = null;
          } else {
            state.rawJsonError = 'Style JSON must be an object';
            return;
          }
        } catch (err) {
          state.rawJsonError = 'Invalid JSON — ' + (err?.message || 'parse error');
          render();
          return;
        }
      }
      state.rawJsonMode = !state.rawJsonMode;
      recomputePromptPreview();
      render();
      return;

    case 'reset-style':
      resetStyle();
      render();
      return;

    case 'save-style':
      saveStyle();
      return;

    case 'reset-prompt':
      state.promptOverride = null;
      recomputePromptPreview();
      render();
      return;

    case 'generate':
      generate();
      return;

    case 'pick-card': {
      const id = target.getAttribute('data-card-id');
      hydrateFromCard(id);
      return;
    }

    case 'save-to-card':
      handleSaveToCard();
      return;

    case 'set-log-scope': {
      const scope = target.getAttribute('data-scope') || 'all';
      if (scope === state.generationLogScope) return;
      state.generationLogScope = scope;
      loadGenerationLog();
      return;
    }

    case 'hydrate-from-log': {
      const id = target.getAttribute('data-log-id');
      if (id) hydrateFromLog(id);
      return;
    }

    case 'toggle-style-collapse':
      state.styleCollapsed = !state.styleCollapsed;
      render();
      return;

    case 'toggle-decks-collapse':
      state.decksCollapsed = !state.decksCollapsed;
      render();
      return;
  }
}

function onInput(e) {
  const t = e.target;
  const field = t?.getAttribute?.('data-field');
  if (!field) return;

  switch (field) {
    case 'card-text':
      state.cardFormText = t.value;
      recomputePromptPreview();
      // Partial re-render: update preview, prompt textarea, and char count.
      updatePreviewParts();
      return;
    case 'card-prompt':
      state.cardFormPrompt = t.value;
      recomputePromptPreview();
      updatePreviewParts();
      return;
    case 'card-option-1':
      state.cardFormOption1 = t.value;
      recomputePromptPreview();
      updatePreviewParts();
      return;
    case 'card-option-2':
      state.cardFormOption2 = t.value;
      recomputePromptPreview();
      updatePreviewParts();
      return;
    case 'style-key': {
      const key = t.getAttribute('data-key');
      if (!key) return;
      state.style[key] = t.value;
      recomputePromptPreview();
      updatePromptPreviewText();
      return;
    }
    case 'deck-config': {
      const deck = t.getAttribute('data-deck');
      const key = t.getAttribute('data-key');
      if (!deck || !key) return;
      if (!state.style.decks || typeof state.style.decks !== 'object') {
        state.style.decks = { die: {}, bye: {}, live: {} };
      }
      if (!state.style.decks[deck] || typeof state.style.decks[deck] !== 'object') {
        state.style.decks[deck] = {};
      }
      state.style.decks[deck][key] = t.value;
      recomputePromptPreview();
      updatePromptPreviewText();
      return;
    }
    case 'style-raw':
      state.rawJsonDraft = t.value;
      try {
        const parsed = JSON.parse(t.value);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          state.style = parsed;
          state.rawJsonError = null;
          recomputePromptPreview();
          updatePromptPreviewText();
        } else {
          state.rawJsonError = 'Style JSON must be an object';
          showRawError();
        }
      } catch (err) {
        state.rawJsonError = 'Invalid JSON — ' + (err?.message || 'parse error');
        showRawError();
      }
      return;
    case 'prompt-override':
      state.promptOverride = t.value;
      return;
  }
}

function onChange(e) {
  const t = e.target;
  const action = t?.getAttribute?.('data-action');
  if (action === 'select-pack') {
    const id = t.value || null;
    state.selectedPackId = id;
    state.selectedPack = null;
    state.selectedCardId = null;
    if (id) loadPackCards(id);
    else render();
  } else if (action === 'select-provider') {
    state.selectedProviderId = t.value || null;
  }
}

// Partial re-render helpers to avoid clobbering the user's focus on every
// keystroke. Full render() is still used for tab/provider/style-mode changes.
function updatePreviewParts() {
  const previewContainer = state.container?.querySelector('.admin-img-gen__card-preview');
  if (previewContainer) previewContainer.innerHTML = renderCard(buildCard(currentCardForPreview()));
  updatePromptPreviewText();
}

function updatePromptPreviewText() {
  if (state.promptOverride !== null) return;
  const ta = state.container?.querySelector('[data-field="prompt-override"]');
  if (ta) ta.value = state.promptPreview;
}

function showRawError() {
  // Only re-render the style section's error slot to avoid killing textarea focus.
  // We do a full render on mode switch, so the raw error here just needs to
  // update in place.
  const raw = state.container?.querySelector('.admin-img-gen__style-raw');
  if (!raw) return;
  let err = raw.parentElement.querySelector('.admin-img-gen__error');
  if (state.rawJsonError) {
    if (!err) {
      err = document.createElement('p');
      err.className = 'admin-img-gen__error';
      raw.parentElement.appendChild(err);
    }
    err.textContent = state.rawJsonError;
  } else if (err) {
    err.remove();
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function loadPacks() {
  state.packsLoading = true;
  render();
  try {
    const packs = await listMyPacks(state.firebaseUser?.uid || null);
    state.packs = packs;
  } catch (err) {
    console.error('[admin-image-gen] loadPacks failed:', err);
    state.packs = [];
  } finally {
    state.packsLoading = false;
    render();
  }
}

async function loadPackCards(packId) {
  try {
    const pack = await getPackWithCards(packId);
    state.selectedPack = pack;
    state.selectedCardId = null;
  } catch (err) {
    console.error('[admin-image-gen] loadPackCards failed:', err);
    state.selectedPack = null;
  }
  render();
}

function hydrateFromCard(cardId) {
  const card = state.selectedPack?.cards?.find(c => c.id === cardId);
  if (!card) return;
  state.selectedCardId = cardId;
  state.cardFormDeckType = card.deck_type || 'die';
  state.cardFormText = card.text || '';
  state.cardFormPrompt = card.prompt || '';
  state.cardFormSpecial = card.card_special || '';
  let opts = [];
  try { opts = card.options_json ? JSON.parse(card.options_json) : []; } catch {}
  state.cardFormOption1 = opts[0] || '';
  state.cardFormOption2 = opts[1] || '';
  state.promptOverride = null;
  recomputePromptPreview();
  render();
}

async function generate() {
  if (!state.selectedProviderId) {
    state.generateError = 'Pick a provider first.';
    render();
    return;
  }
  state.generating = true;
  state.generateError = null;
  state.generated = null;
  state.saveError = null;
  render();
  try {
    // Size the generation request to the target card region so the
    // provider renders the right aspect ratio instead of the default 1:1.
    const dims = targetDimensions(state.cardFormDeckType, state.cardFormSpecial);
    const result = await generateImage({
      providerId: state.selectedProviderId,
      cardText: state.cardFormText,
      cardPrompt: state.cardFormPrompt,
      deckType: state.cardFormDeckType,
      style: state.style,
      promptOverride: state.promptOverride,
      options: { width: dims.width, height: dims.height },
    });
    state.generated = result;
    // Refresh the Recent generations gallery so the new entry appears
    // at the top. Fire-and-forget — the main render() below doesn't
    // need to wait for it.
    loadGenerationLog();
  } catch (err) {
    console.error('[admin-image-gen] generate failed:', err);
    state.generateError = err?.message || 'Image generation failed';
  } finally {
    state.generating = false;
    render();
  }
}

async function handleSaveToCard() {
  if (!state.generated || !state.selectedPackId || !state.selectedCardId) return;
  state.saving = true;
  state.saveError = null;
  render();
  try {
    // The backend's /generate route now returns a local URL
    // (/uploads/card-images/...) rather than a provider URL. The
    // /image-from-url endpoint uses fetch() which can't resolve a
    // relative path — prefix with location.origin so it can round-trip.
    const srcUrl = state.generated.imageUrl.startsWith('/')
      ? `${location.origin}${state.generated.imageUrl}`
      : state.generated.imageUrl;
    const updated = await saveImageToCard(
      state.selectedPackId,
      state.selectedCardId,
      srcUrl
    );
    // Patch the cached card so the card list shows the ✓ checkmark next load.
    if (state.selectedPack?.cards) {
      const i = state.selectedPack.cards.findIndex(c => c.id === state.selectedCardId);
      if (i >= 0) state.selectedPack.cards[i] = updated;
    }
  } catch (err) {
    console.error('[admin-image-gen] saveToCard failed:', err);
    state.saveError = err?.message || 'Save failed';
  } finally {
    state.saving = false;
    render();
  }
}

/**
 * Write the current `state.style` back to the shipped default file on
 * disk via `POST /api/carkedit/image-gen/style`. The button in the
 * style header is disabled while this is in flight, and flashes
 * "Saved ✓" for 2 seconds on success.
 */
async function saveStyle() {
  if (state.savingStyle) return;
  if (state.rawJsonError) return;  // don't save known-invalid JSON
  state.savingStyle = true;
  state.saveStyleError = null;
  render();
  try {
    await saveStyleJson(state.style);
    state.savedAt = Date.now();
    // Clear the "Saved ✓" flash after 2 seconds.
    setTimeout(() => {
      state.savedAt = 0;
      render();
    }, 2000);
  } catch (err) {
    console.error('[admin-image-gen] saveStyle failed:', err);
    state.saveStyleError = err?.message || 'Save failed';
  } finally {
    state.savingStyle = false;
    render();
  }
}

/**
 * Fetch the Recent generations list from the server and re-render.
 * Called on mount, after every successful generate, and when the user
 * clicks a scope filter button. Fire-and-forget — errors land in
 * state.generationLogError and render inline.
 */
async function loadGenerationLog() {
  state.generationLogLoading = true;
  state.generationLogError = null;
  render();
  try {
    const entries = await listGenerationLog({ scope: state.generationLogScope, limit: 50 });
    state.generationLog = entries;
  } catch (err) {
    console.error('[admin-image-gen] loadGenerationLog failed:', err);
    state.generationLogError = err?.message || 'Failed to load recent generations';
  } finally {
    state.generationLogLoading = false;
    render();
  }
}

/**
 * Hydrate the form + generated panel from a log entry, so the user
 * can see the logged image in the preview and iterate on the card
 * text / style fields without losing the original entry (the log is
 * append-only from the client's perspective).
 */
function hydrateFromLog(logId) {
  const entry = state.generationLog.find(e => e.id === logId);
  if (!entry) return;
  state.activeTab = 'scratch';
  state.selectedCardId = null;
  state.cardFormDeckType = entry.deck_type || 'die';
  state.cardFormText = entry.text || '';
  state.cardFormPrompt = entry.prompt || '';
  state.cardFormSpecial = entry.card_special || '';
  let opts = [];
  try { opts = entry.options_json ? JSON.parse(entry.options_json) : []; } catch {}
  state.cardFormOption1 = opts[0] || '';
  state.cardFormOption2 = opts[1] || '';
  state.promptOverride = null;
  state.generated = {
    imageUrl: entry.image_url,
    provider: entry.provider,
    promptSent: entry.prompt_sent,
  };
  state.generateError = null;
  recomputePromptPreview();
  render();
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

export async function mount({ container, firebaseUser, providers, signOut }) {
  state.container = container;
  state.firebaseUser = firebaseUser;
  state.providers = Array.isArray(providers) ? providers : [];
  state.signOut = typeof signOut === 'function' ? signOut : () => {};

  // Pre-select the first configured provider, if any.
  const firstConfigured = state.providers.find(p => p.configured) || state.providers[0];
  state.selectedProviderId = firstConfigured?.id || null;

  // Load the default style JSON.
  try {
    const res = await fetch('/js/data/image-gen-style.json');
    if (res.ok) {
      state.defaultStyle = await res.json();
      state.style = JSON.parse(JSON.stringify(state.defaultStyle));
      state.rawJsonDraft = JSON.stringify(state.style, null, 2);
    } else {
      throw new Error(`Style JSON ${res.status}`);
    }
  } catch (err) {
    console.warn('[admin-image-gen] Failed to load default style JSON, using empty:', err);
    state.defaultStyle = {};
    state.style = {};
    state.rawJsonDraft = '{}';
  }

  recomputePromptPreview();
  render();

  container.addEventListener('click', onClick);
  container.addEventListener('input', onInput);
  container.addEventListener('change', onChange);

  // Kick off the Recent generations load now that the basic UI is
  // mounted. Fire-and-forget — it'll re-render when the fetch returns.
  loadGenerationLog();
}
