// CarkedIt Online — Card Preloader
// Fetches all card JSON and preloads card images during the lobby screen.
'use strict';

import { CARD_TYPES, loadAllCards } from './data/cardTypes.js';

/**
 * Preload all card data and images.
 * @param {(loaded: number, total: number) => void} [onProgress] — called after each image loads/fails
 * @returns {Promise<{ decks: Record<string, object[]>, total: number }>}
 */
export async function preloadCards(onProgress) {
  const allCards = await loadAllCards();

  // Group cards into decks by typeId
  const decks = {};
  for (const card of allCards) {
    const bucket = decks[card.typeId] ?? [];
    bucket.push(card);
    decks[card.typeId] = bucket;
  }

  // Build image paths for every card that has an illustrationKey
  const imagePaths = allCards
    .filter(card => card.illustrationKey)
    .map(card => `assets/illustrations/${card.typeId}/${card.illustrationKey}.jpg`);

  const total = imagePaths.length;
  let loaded = 0;

  // Preload images in parallel — failures are silent (images may not exist yet)
  await Promise.all(
    imagePaths.map(
      src =>
        new Promise(resolve => {
          const img = new Image();
          img.onload = img.onerror = () => {
            loaded += 1;
            if (onProgress) onProgress(loaded, total);
            resolve();
          };
          img.src = src;
        })
    )
  );

  console.log(`[preloader] ${allCards.length} cards loaded, ${total} images cached`);
  return { decks, total: allCards.length };
}
