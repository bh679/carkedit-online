// CarkedIt Online — Single Player Screen
//
// Pure render(state) over `state.solo` (see managers/solo-manager.js).
// Four cards; tap one to preview it full-screen and confirm the pick
// (same overlay as the multiplayer hand). Three rounds per deck (the final is the
// two favourites), three decks, then a summary of the three picks and a
// space to write your own eulogy. Picking a `?` card shows an answer step.
'use strict';

import { render as renderPhaseHeader } from '../components/phase-header.js';
import { render as renderCard } from '../components/card.js';
import { render as renderCardBack } from '../components/cardBack.js';
import { renderInspectOverlay } from '../components/hand.js';
import { escapeHtml } from '../utils/escape.js';
import { currentDeck, DECK_LABELS, ROUNDS_PER_DECK, SOLO_DECKS, SUMMARY_ORDER, answerFor } from '../managers/solo-manager.js';

/**
 * @param {object} state
 * @returns {string} HTML string
 */
export function render(state) {
  const solo = state.solo;
  if (!solo) return renderLoading(state);
  if (solo.done) return renderSummary(solo);
  if (solo.pendingAnswer) return renderAnswer(solo);
  return renderRound(solo);
}

function renderLoading(state) {
  const text = state.preloadComplete ? 'Shuffling…' : 'Loading cards…';
  return `
    <div class="screen screen--phase screen--solo" data-phase="solo">
      ${renderPhaseHeader({ phase: 'solo', label: 'Single Player' })}
      <div class="solo__loading">
        <p id="preload-progress" class="solo__loading-text">${text}</p>
      </div>
    </div>
  `;
}

function renderRound(solo) {
  const deck = currentDeck(solo);
  const meta = DECK_LABELS[deck];
  const isFinal = solo.round === ROUNDS_PER_DECK;
  const roundLabel = isFinal ? 'Final' : `Round ${solo.round} of ${ROUNDS_PER_DECK}`;
  const prompt = isFinal ? 'Your two favourites. Which one wins?' : meta.prompt;
  // A <div role=button> rather than <button>: Chromium flattens 3D transforms
  // inside <button>, which breaks the card flip.
  const cards = solo.pair.map((card, i) => `
    <div class="solo__choice" role="button" tabindex="0" aria-label="Pick card ${i + 1}"
         onclick="window.game.soloInspect(${i})"
         onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); window.game.soloInspect(${i}); }">
      <div class="card-flip" data-solo-reveal style="--solo-delay: ${i * 120}ms">
        <div class="card-flip__inner">
          <div class="card-flip__back">${renderCardBack({ deckType: deck })}</div>
          <div class="card-flip__front">${renderCard(card)}</div>
        </div>
      </div>
    </div>
  `).join('');

  return `
    <div class="screen screen--phase screen--solo" data-phase="${meta.phase}">
      ${renderPhaseHeader({ phase: meta.phase, label: `${meta.label} - ${roundLabel}` })}
      <p class="phase__prompt solo__prompt">${escapeHtml(prompt)}</p>
      <div class="solo__pair solo__pair--${deck}${solo.pair.length > 2 ? ' solo__pair--four' : ''}">
        ${cards}
      </div>
      <p class="solo__hint">Tap a card to take a closer look</p>
      ${renderProgress(solo)}
      ${renderInspect(solo, deck, isFinal)}
    </div>
  `;
}

/** Full-screen preview of the tapped card, reusing the multiplayer hand overlay. */
function renderInspect(solo, deck, isFinal) {
  const index = solo.inspectIndex;
  if (index === null || index === undefined) return '';
  const card = solo.pair[index];
  if (!card) return '';
  return renderInspectOverlay({
    selectedCard: card,
    deckType: deck,
    submitLabel: isFinal ? 'This one wins' : 'Pick this card',
    onSubmit: `window.game.soloPick(${index})`,
    onDismiss: 'window.game.soloDismissInspect()',
    onPrev: solo.pair.length > 1 ? 'window.game.soloStepInspect(-1)' : null,
    onNext: solo.pair.length > 1 ? 'window.game.soloStepInspect(1)' : null,
  });
}

/**
 * Answer step for a `?` card: the card asks a question, the player answers.
 * Continue stores the text; Skip moves on without one.
 */
function renderAnswer(solo) {
  const card = solo.pendingAnswer;
  // After the BYE final the deck index no longer advances, so fall back to
  // the last deck's label.
  const deck = solo.done ? SOLO_DECKS[SOLO_DECKS.length - 1] : currentDeck(solo);
  const meta = DECK_LABELS[deck];
  return `
    <div class="screen screen--phase screen--solo" data-phase="${meta.phase}">
      ${renderPhaseHeader({ phase: meta.phase, label: `${meta.label} - Your answer` })}
      <p class="phase__prompt solo__prompt">${escapeHtml(card.title ?? 'What do you say?')}</p>
      <div class="solo__answer-step">
        <div class="solo__answer-card">${renderCard(card)}</div>
        <textarea id="solo-answer" class="solo__textarea" rows="3" maxlength="140"
                  placeholder="Your answer…" aria-label="Your answer"></textarea>
      </div>
      <div class="phase__actions solo__actions">
        <button class="btn btn--primary" onclick="window.game.soloAnswer()">Continue</button>
        <button class="btn btn--secondary" onclick="window.game.soloSkipAnswer()">Skip</button>
      </div>
      ${renderProgress(solo)}
    </div>
  `;
}

function renderProgress(solo) {
  const dots = SOLO_DECKS.map((d, i) => {
    const cls = i < solo.deckIndex ? 'solo__dot--done' : i === solo.deckIndex ? 'solo__dot--active' : '';
    return `<span class="solo__dot solo__dot--${d} ${cls}" aria-label="${d}"></span>`;
  }).join('');
  return `<div class="solo__progress" aria-hidden="true">${dots}</div>`;
}

function renderSummary(solo) {
  const picks = SUMMARY_ORDER.map((deck) => {
    const card = solo.picks[deck];
    if (!card) return '';
    const answer = answerFor(solo, card);
    return `
      <div class="solo__pick solo__pick--${deck}">
        <span class="solo__pick-label">${escapeHtml(DECK_LABELS[deck].pickLabel)}</span>
        ${renderCard(card)}
        ${answer ? `<p class="solo__answer">“${escapeHtml(answer)}”</p>` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="screen screen--phase screen--solo" data-phase="solo">
      ${renderPhaseHeader({ phase: 'solo', label: 'Single Player - Your Story' })}
      <p class="phase__prompt solo__prompt">This is how you carked it.</p>
      <div class="solo__summary">
        ${picks}
      </div>
      ${renderEulogy()}
      <div class="phase__actions solo__actions">
        <button class="btn btn--primary" onclick="window.game.soloStart()">Play Again</button>
        <button class="btn btn--secondary" onclick="window.game.soloMenu()">Menu</button>
      </div>
      <button class="btn btn--ghost solo__share-btn" onclick="window.game.copySoloLink()">
        Share Single Player
      </button>
    </div>
  `;
}

/** "Write your own eulogy" section on the summary. */
function renderEulogy() {
  return `
    <section class="solo__eulogy" aria-labelledby="solo-eulogy-title">
      <h2 id="solo-eulogy-title" class="solo__eulogy-title">Write your own eulogy</h2>
      <p class="solo__hint">Here lies you. Say a few words.</p>
      <textarea id="solo-eulogy" class="solo__textarea" rows="4" maxlength="600"
                placeholder="They lived, they died, and then…" aria-label="Your eulogy"></textarea>
      <button class="btn btn--ghost solo__eulogy-copy" onclick="window.game.copySoloEulogy()">
        Copy eulogy
      </button>
    </section>
  `;
}
