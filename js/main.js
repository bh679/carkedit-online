// CarkedIt Online — Main Game Logic

import { CARD_TYPES, getCardType, loadAllCards } from './data/cardTypes.js';

async function init() {
  const allCards = await loadAllCards();
  console.log(`Loaded ${allCards.length} cards`);
  console.log('Sample card:', allCards[0]);
  console.log('BYE background:', CARD_TYPES.BYE.backgroundImageKey);
  console.log('getCardType("bye"):', getCardType('bye'));
}

init();
