// CarkedIt Online — Canonical Card factory
//
// Single source of truth for what a "Card" looks like in memory.
// Takes raw input from any of three sources (static JSON, server payload,
// card-designer) and produces a frozen, normalised Card object. Every
// downstream consumer (renderer, phase screens, dashboard) reads this shape
// and nothing else — no renaming, no fallback chains, no magic strings.
//
// Disk formats are UNCHANGED. JSON files stay as-is; server keeps emitting
// `deck`/`card_special`; the designer still writes snake_case to the DB.
// This factory is the single translation layer that makes them agree.
'use strict';

import { getPackBrand } from '../state.js';

/**
 * @typedef {Object} BaseCard
 * @property {number|string} id
 * @property {'die'|'live'|'bye'} deckType
 * @property {string} typeId                         - alias of deckType for legacy readers
 * @property {string} title
 * @property {string} description
 * @property {string} prompt
 * @property {string} illustrationKey
 * @property {string} image
 * @property {string} packId
 * @property {string} brandImageUrl
 * @property {null|'mystery'|'split'} special
 * @property {null|[string,string]} options
 *
 * @typedef {BaseCard} Card
 */

/**
 * Normalise any deck identifier into the canonical `deckType` string.
 *  - `'living'` (server schema)  → `'live'`
 *  - any of `deckType` / `typeId` / `deck_type` / `deck` supported
 */
function normaliseDeckType(raw) {
  const v = raw?.deckType ?? raw?.typeId ?? raw?.deck_type ?? raw?.deck ?? '';
  if (v === 'living') return 'live';
  return String(v);
}

/**
 * Normalise any `special` marker into the canonical enum.
 *  - `'?'`     → `'mystery'`
 *  - `'Split'` → `'split'`
 *  - falsy     → `null`
 */
function normaliseSpecial(raw) {
  const v = raw?.special ?? raw?.card_special ?? null;
  if (!v) return null;
  if (v === '?' || v === 'mystery') return 'mystery';
  if (v === 'Split' || v === 'split') return 'split';
  return null;
}

/**
 * Normalise options into `[a, b] | null` regardless of source shape.
 *  - `options` array              → used directly
 *  - `options_json` string        → parsed
 *  - anything else                → null
 * Only returns a 2-tuple (split cards always have exactly 2 options today).
 */
function normaliseOptions(raw) {
  let arr = null;
  if (Array.isArray(raw?.options)) arr = raw.options;
  else if (typeof raw?.options_json === 'string') {
    try { const parsed = JSON.parse(raw.options_json); if (Array.isArray(parsed)) arr = parsed; }
    catch { /* fall through */ }
  } else if (raw?.options && typeof raw.options[Symbol.iterator] === 'function') {
    arr = Array.from(raw.options);
  }
  if (!arr || arr.length < 2) return null;
  return [String(arr[0]), String(arr[1])];
}

/**
 * Resolve the image URL for this card, using the same rule `card.js`
 * previously applied at render time: prefer an explicit `image`, else build
 * from `illustrationKey` + `deckType`.
 */
function resolveImage(raw, deckType) {
  if (raw?.image) return String(raw.image);
  const key = raw?.illustrationKey ?? raw?.illustration_key ?? '';
  if (key && deckType) return `assets/illustrations/${deckType}/${key}.jpg`;
  return '';
}

/**
 * Build a canonical, frozen Card from any raw input.
 *
 * @param {object} raw               - raw card-ish object from any source
 * @param {object} [opts]
 * @param {'static'|'server'|'designer'} [opts.source] - diagnostic only
 * @returns {Readonly<Card> & Record<string, any>}
 */
export function buildCard(raw, _opts = {}) {
  if (!raw || typeof raw !== 'object') {
    throw new TypeError('buildCard: raw card must be an object');
  }

  const deckType = normaliseDeckType(raw);
  const special = normaliseSpecial(raw);
  const options = special === 'split' ? normaliseOptions(raw) : null;
  const image = resolveImage(raw, deckType);
  const packId = String(raw.packId ?? raw.pack_id ?? '');
  const brandImageUrl = String(
    raw.brandImageUrl ?? raw.brand_image_url ?? (packId ? getPackBrand(packId) : '')
  );

  const canonical = {
    // Preserve identity + runtime fields from raw via spread first, so the
    // normalised fields below win on key collision.
    ...raw,
    id: raw.id,
    deckType,
    typeId: deckType,                // legacy alias for preloader / dev-dashboard
    title: String(raw.title ?? raw.text ?? ''),
    description: String(raw.description ?? ''),
    prompt: raw.prompt == null ? '' : String(raw.prompt),
    illustrationKey: String(raw.illustrationKey ?? raw.illustration_key ?? ''),
    image,
    special,
    options,
    packId,
    brandImageUrl,
  };

  return Object.freeze(canonical);
}

/**
 * Re-build a canonical card, overriding a subset of fields. Frozen cards
 * cannot be mutated, so use this anywhere code previously did
 * `{ ...card, foo: bar }` and then handed the result to the renderer.
 * Runtime fields (faceUp, submittedBy) are preserved via the spread.
 */
export function withCard(card, patch) {
  return buildCard({ ...card, ...patch });
}
