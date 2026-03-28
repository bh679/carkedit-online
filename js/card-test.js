// CarkedIt Online — Card Test Page
'use strict';

import { loadAllCards } from './data/cardTypes.js';
import { render as renderCard } from './components/card.js';
import { render as renderCardBack } from './components/cardBack.js';

const DECK_TYPES = ['die', 'live', 'bye'];

const state = {
  decks: {},
  deckType: 'die',
  index: 0,
  showBack: false,
};

function currentDeck() {
  return state.decks[state.deckType] ?? [];
}

function render() {
  const deck = currentDeck();
  const card = deck[state.index];
  const app = document.getElementById('app');

  const deckButtons = DECK_TYPES.map(type => `
    <button
      class="btn ${state.deckType === type ? 'btn--primary' : 'btn--secondary'}"
      onclick="window.cardTest.switchDeck('${type}')"
    >
      ${type.toUpperCase()}
    </button>
  `).join('');

  const imagePath = card ? `assets/illustrations/${card.typeId}/${card.illustrationKey}.jpg` : '';

  let cardHtml;
  if (state.showBack) {
    cardHtml = `<div class="card-test__card" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;width:100%">
        ${renderCardBack({ deckType: state.deckType })}
      </div>`;
  } else if (card) {
    cardHtml = `<div class="card-test__card" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;width:100%">
        ${renderCard({ title: card.title, description: card.description ?? '', prompt: card.prompt ?? '', image: imagePath, deckType: state.deckType })}
      </div>`;
  } else {
    cardHtml = '<p style="color:var(--color-text-muted)">No cards loaded.</p>';
  }

  const jsonHtml = card
    ? `<pre style="
        background:var(--color-surface);
        color:var(--color-text-muted);
        border:1px solid rgba(255,255,255,0.1);
        border-radius:var(--radius-md);
        padding:1rem;
        font-size:0.75rem;
        text-align:left;
        width:100%;
        max-width:400px;
        overflow-x:auto;
        white-space:pre-wrap;
        word-break:break-word;
      ">${JSON.stringify(card, null, 2)}</pre>`
    : '';

  app.innerHTML = `
    <div style="background:var(--color-background)">
      <div class="card-test" style="display:flex;flex-direction:column;align-items:center;gap:1rem;padding:1rem;height:100vh;overflow:hidden;box-sizing:border-box">
        <h1 style="color:var(--color-text);font-family:var(--font-display);margin:0;flex-shrink:0">Card Test</h1>

        <div style="display:flex;gap:0.75rem;flex-shrink:0">
          ${deckButtons}
          <button
            class="btn ${state.showBack ? 'btn--primary' : 'btn--secondary'}"
            onclick="window.cardTest.toggleBack()"
            style="font-size:0.75rem"
          >BACK</button>
        </div>

        ${cardHtml}

        <div style="display:flex;align-items:center;gap:1rem;flex-shrink:0">
          <button class="btn btn--secondary" onclick="window.cardTest.prevCard()" ${!deck.length ? 'disabled' : ''}>&larr;</button>
          <span style="color:var(--color-text-muted);font-size:0.875rem">
            Card ${deck.length ? state.index + 1 : 0} / ${deck.length}
          </span>
          <button class="btn btn--secondary" onclick="window.cardTest.nextCard()" ${!deck.length ? 'disabled' : ''}>&rarr;</button>
        </div>
      </div>

      <div style="padding:2rem;display:flex;flex-direction:column;align-items:center">
        ${jsonHtml}
      </div>
    </div>
  `;

  const cardEl = app.querySelector('.card-test__card');
  if (cardEl) {
    cardEl.addEventListener('click', nextCard);
    cardEl.style.cursor = 'pointer';
  }
}

function switchDeck(deckType) {
  state.deckType = deckType;
  state.index = 0;
  render();
}

function nextCard() {
  const deck = currentDeck();
  if (!deck.length) return;

  if (state.index < deck.length - 1) {
    state.index = state.index + 1;
    render();
  } else {
    const currentDeckIndex = DECK_TYPES.indexOf(state.deckType);
    const nextDeckType = DECK_TYPES[(currentDeckIndex + 1) % DECK_TYPES.length];
    switchDeck(nextDeckType);
  }
}

function prevCard() {
  const deck = currentDeck();
  if (!deck.length) return;
  state.index = (state.index - 1 + deck.length) % deck.length;
  render();
}

function toggleBack() {
  state.showBack = !state.showBack;
  render();
}

window.cardTest = { switchDeck, nextCard, prevCard, toggleBack };

document.addEventListener('DOMContentLoaded', async () => {
  const allCards = await loadAllCards();
  DECK_TYPES.forEach(type => {
    state.decks[type] = allCards.filter(c => c.typeId === type);
  });
  render();
});
