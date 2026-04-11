// CarkedIt Online — Card Data Module
//
// Single source of truth for what a "Card" looks like in memory. Contains:
//   1. Normalisation helpers (exported for CardRegistry.js)
//   2. The Card class — OOP representation with cached rendered HTML
//   3. `buildCard()` / `withCard()` — factory functions (backwards-compatible API)
//
// Takes raw input from any of three sources (static JSON, server payload,
// card-designer) and produces a Card instance. Every downstream consumer
// reads `.title`, `.deckType`, `.frontHtml`, etc. — no renaming, no fallback
// chains, no magic strings.
//
// Disk formats are UNCHANGED. JSON files stay as-is; server keeps emitting
// `deck`/`card_special`; the designer still writes snake_case to the DB.
// This module is the single translation layer that makes them agree.
'use strict';

import { getPackBrand } from '../state.js';
import { renderFrontHtml, renderBackHtml } from './cardRender.js';

// ─── Normalisation helpers ──────────────────────────────────────────────────
// Exported so CardRegistry.js can compute compositeIds from raw data without
// creating a full Card instance.

/**
 * Normalise any deck identifier into the canonical `deckType` string.
 *  - `'living'` (server schema)  → `'live'`
 *  - any of `deckType` / `typeId` / `deck_type` / `deck` supported
 */
export function normaliseDeckType(raw) {
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
export function normaliseSpecial(raw) {
  const v = raw?.special ?? raw?.card_special ?? null;
  if (!v) return null;
  if (v === '?' || v === 'mystery') return 'mystery';
  if (v === 'Split' || v === 'split') return 'split';
  return null;
}

/**
 * Normalise options into `[a, b] | null` regardless of source shape.
 */
export function normaliseOptions(raw) {
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
 * Resolve the full-bleed image URL for this card.
 */
export function resolveImage(raw, deckType) {
  if (raw?.image) return String(raw.image);
  const key = raw?.illustrationKey ?? raw?.illustration_key ?? '';
  if (key && deckType) return `assets/illustrations/${deckType}/${key}.jpg`;
  return '';
}

/**
 * Resolve the graphic-area background image (AI-generated custom-card art).
 */
export function resolveGraphicImage(raw) {
  if (raw?.graphicImage) return String(raw.graphicImage);
  if (raw?.image_url) return String(raw.image_url);
  return '';
}

// ─── Card Class ─────────────────────────────────────────────────────────────

/**
 * OOP representation of a game card. Normalises raw input and caches the
 * rendered front/back HTML on construction. Property names match the old
 * canonical shape so existing consumers work unchanged.
 */
export class Card {
  /**
   * @param {object} raw  - raw card-ish object from any source
   * @param {object} [opts]
   * @param {'static'|'server'|'designer'} [opts.source] - diagnostic only
   */
  constructor(raw, _opts = {}) {
    if (!raw || typeof raw !== 'object') {
      throw new TypeError('Card: raw card must be an object');
    }

    // ── Normalised content fields ──────────────────────────────────────────
    this.deckType     = normaliseDeckType(raw);
    this.id           = raw.id;
    this.typeId       = this.deckType;  // legacy alias
    this.title        = String(raw.title ?? raw.text ?? '');
    this.description  = String(raw.description ?? '');
    this.prompt       = raw.prompt == null ? '' : String(raw.prompt);
    this.special      = normaliseSpecial(raw);
    this.options      = this.special === 'split' ? normaliseOptions(raw) : null;

    this.illustrationKey = String(raw.illustrationKey ?? raw.illustration_key ?? '');
    this.image           = resolveImage(raw, this.deckType);
    this.graphicImage    = resolveGraphicImage(raw);
    this.graphicImages   = raw.graphicImages ?? null;

    this.packId       = String(raw.packId ?? raw.pack_id ?? '');
    this.brandImageUrl = String(
      raw.brandImageUrl ?? raw.brand_image_url ?? (this.packId ? getPackBrand(this.packId) : '')
    );

    this.textPosition = String(raw.textPosition ?? raw.text_position ?? 'top');
    this.textColor    = String(raw.textColor ?? raw.text_color ?? 'black');

    // ── Runtime fields (not used in rendering, but consumers may read) ─────
    // Preserved from raw input for backwards compatibility during Phase 1.
    // In future phases these move to separate state fields.
    if (raw.faceUp !== undefined)      this.faceUp = raw.faceUp;
    if (raw.submittedBy !== undefined) this.submittedBy = raw.submittedBy;

    // ── Cached rendered HTML ───────────────────────────────────────────────
    this.frontHtml = renderFrontHtml(this);
    this.backHtml  = renderBackHtml(this.deckType);
  }

  /** Unique key across all deck types: `"die:1"`, `"live:42"`, etc. */
  get compositeId() {
    return `${this.deckType}:${this.id}`;
  }

  /**
   * Create a new Card with a subset of fields overridden.
   * Use this instead of mutating properties directly.
   */
  withOverrides(patch) {
    return new Card({ ...this, ...patch });
  }

  /** Convenience factory. */
  static from(raw, opts) {
    return new Card(raw, opts);
  }
}

// ─── Factory functions (backwards-compatible API) ───────────────────────────

/**
 * Build a canonical Card from any raw input.
 * Returns a Card class instance (replaces the old frozen plain object).
 *
 * @param {object} raw               - raw card-ish object from any source
 * @param {object} [opts]
 * @param {'static'|'server'|'designer'} [opts.source] - diagnostic only
 * @returns {Card}
 */
export function buildCard(raw, opts = {}) {
  return new Card(raw, opts);
}

/**
 * Re-build a card with overridden fields.
 * @param {Card|object} card
 * @param {object} patch
 * @returns {Card}
 */
export function withCard(card, patch) {
  if (card instanceof Card) return card.withOverrides(patch);
  return new Card({ ...card, ...patch });
}
