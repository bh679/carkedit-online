'use strict';

import { buildCard } from './card.js';

// Static CardType registry — one entry per deck type.
// Each type knows its backgroundImageKey and the path to its JSON data file.
// Cards reference a type by its string id (serialisable); access the full type via CARD_TYPES.BYE.
const CARD_TYPES = Object.freeze({
  BYE: Object.freeze({
    id: 'bye',
    backgroundImageKey: 'bg-bye',
    dataFile: 'js/data/cards/bye.json',
  }),
  LIVE: Object.freeze({
    id: 'live',
    backgroundImageKey: 'bg-live',
    dataFile: 'js/data/cards/live.json',
  }),
  DIE: Object.freeze({
    id: 'die',
    backgroundImageKey: 'bg-die',
    dataFile: 'js/data/cards/die.json',
  }),
});

// Resolve a typeId string → CardType object
function getCardType(typeId) {
  return Object.values(CARD_TYPES).find(t => t.id === typeId) ?? null;
}

// Fetch all decks, run each raw card through buildCard() so every consumer
// sees a canonical frozen Card (deckType, normalised special/options, resolved image).
async function loadAllCards() {
  const decks = await Promise.all(
    Object.values(CARD_TYPES).map(async (cardType) => {
      const res = await fetch(cardType.dataFile);
      const cards = await res.json();
      return cards.map(card => buildCard({ ...card, deckType: cardType.id }, { source: 'static' }));
    })
  );
  return decks.flat();
}

// Fetch a single deck by typeId and return canonical Card objects.
async function loadDeck(typeId) {
  const cardType = getCardType(typeId);
  if (!cardType) throw new Error(`Unknown card type: ${typeId}`);
  const res = await fetch(cardType.dataFile);
  const cards = await res.json();
  return cards.map(card => buildCard({ ...card, deckType: cardType.id }, { source: 'static' }));
}

export { CARD_TYPES, getCardType, loadAllCards, loadDeck };
