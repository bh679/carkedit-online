// CarkedIt Online — Card Registry
//
// Singleton identity map for Card instances. Keyed by compositeId
// (`"die:1"`, `"live:42"`, etc.) because card IDs are NOT unique across
// deck types. Every card that enters the game should be registered here
// so all state references resolve to one source of truth.
'use strict';

import { Card, normaliseDeckType } from './card.js';

const _cards = new Map();

/**
 * Register a Card instance. If a card with the same compositeId already
 * exists, the existing instance is returned (deduplication).
 * @param {Card} card
 * @returns {Card} the registered (possibly pre-existing) card
 */
export function register(card) {
  const key = card.compositeId;
  if (_cards.has(key)) return _cards.get(key);
  _cards.set(key, card);
  return card;
}

/**
 * Look up a card by compositeId or by (deckType, id) pair.
 * @param {string} deckTypeOrCompositeId
 * @param {string|number} [id]
 * @returns {Card|undefined}
 */
export function get(deckTypeOrCompositeId, id) {
  if (id !== undefined) return _cards.get(`${deckTypeOrCompositeId}:${id}`);
  return _cards.get(deckTypeOrCompositeId);
}

/**
 * Look up an existing card or create + register a new one from raw data.
 * Used by serverCardToLocal() to deduplicate against preloaded cards.
 * @param {object} raw
 * @param {object} [opts]
 * @returns {Card}
 */
export function getOrCreate(raw, opts) {
  const deckType = normaliseDeckType(raw);
  const cardId = raw.id;
  const key = `${deckType}:${cardId}`;
  if (_cards.has(key)) return _cards.get(key);
  const card = new Card(raw, opts);
  _cards.set(key, card);
  return card;
}

/**
 * Force-write a Card, overwriting any existing entry with the same compositeId.
 * Used when card data updates (e.g. after image generation saves a new image_url).
 * @param {Card} card
 * @returns {Card}
 */
export function set(card) {
  _cards.set(card.compositeId, card);
  return card;
}

/** Remove all registered cards (game reset). */
export function clear() { _cards.clear(); }

/** Check if a compositeId is registered. */
export function has(compositeId) { return _cards.has(compositeId); }

/** Iterate all registered cards. */
export function values() { return _cards.values(); }

/** Number of registered cards. */
export function size() { return _cards.size; }
