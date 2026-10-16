// CarkedIt Online — Single Player Screen
//
// Pure render(state) over `state.solo` (see managers/solo-manager.js).
// Four cards; tap one to preview it full-screen and confirm the pick
// (same overlay as the multiplayer hand). Two questions per deck ("would
// rather", then "more likely" with the rather card back in the hand), three
// decks, then a summary of the three picks and a
// space to write your own eulogy. Done turns the picks and eulogy into a
// Claude-written life story. Picking a `?` card shows an answer step.
'use strict';

import { render as renderPhaseHeader } from '../components/phase-header.js';
import { render as renderCard } from '../components/card.js';
import { render as renderCardBack } from '../components/cardBack.js';
import { renderInspectOverlay } from '../components/hand.js';
import { escapeHtml } from '../utils/escape.js';
import { cardId, currentDeck, DECK_LABELS, ROUNDS_PER_DECK, SOLO_DECKS, SUMMARY_ORDER, answerFor, ratherFor } from '../managers/solo-manager.js';

/**
 * @param {object} state
 * @returns {string} HTML string
 */
export function render(state) {
  const solo = state.solo;
  if (!solo) return renderLoading(state);
  if (solo.pendingAnswer) return renderAnswer(solo);
  if (solo.stage === 'eulogy') return renderEulogyScreen(solo);
  if (solo.stage === 'lifestory') return renderLifeStory(solo);
  if (solo.stage === 'story' || solo.done) return renderStory(solo);
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
  const isLikely = solo.round === ROUNDS_PER_DECK;
  const roundLabel = `${isLikely ? 'More likely' : 'Would you rather'} (${solo.round} of ${ROUNDS_PER_DECK})`;
  const prompt = isLikely ? meta.likelyPrompt : meta.ratherPrompt;
  // In the "more likely" hand, the card carried over from "would rather".
  const ratherId = isLikely && solo.rathers?.[deck] ? cardId(solo.rathers[deck]) : null;
  // A <div role=button> rather than <button>: Chromium flattens 3D transforms
  // inside <button>, which breaks the card flip.
  const cards = solo.pair.map((card, i) => {
    const isRather = ratherId !== null && cardId(card) === ratherId;
    return `
    <div class="solo__choice${isRather ? ' solo__choice--rather' : ''}" role="button" tabindex="0"
         aria-label="Pick card ${i + 1}${isRather ? " (your 'rather' pick)" : ''}"
         onclick="window.game.soloInspect(${i})"
         onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); window.game.soloInspect(${i}); }">
      <div class="card-flip" data-solo-reveal style="--solo-delay: ${i * 120}ms">
        <div class="card-flip__inner">
          <div class="card-flip__back">${renderCardBack({ deckType: deck })}</div>
          <div class="card-flip__front">${renderCard(card)}</div>
        </div>
        ${isRather ? `<div class="solo__rather-clip" aria-hidden="true"><span class="solo__rather-ribbon">How I'd rather</span></div>` : ''}
      </div>
    </div>
  `;
  }).join('');

  return `
    <div class="screen screen--phase screen--solo" data-phase="${meta.phase}">
      ${renderPhaseHeader({ phase: meta.phase, label: `${meta.label} - ${roundLabel}` })}
      <p class="phase__prompt solo__prompt">${escapeHtml(prompt)}</p>
      <div class="solo__pair solo__pair--${deck}${solo.pair.length > 2 ? ' solo__pair--four' : ''}">
        ${cards}
      </div>
      <p class="solo__hint">Tap a card to take a closer look</p>
      ${renderProgress(solo)}
      ${renderInspect(solo, deck, isLikely)}
    </div>
  `;
}

/** Full-screen preview of the tapped card, reusing the multiplayer hand overlay. */
function renderInspect(solo, deck, isLikely) {
  const index = solo.inspectIndex;
  if (index === null || index === undefined) return '';
  const card = solo.pair[index];
  if (!card) return '';
  return renderInspectOverlay({
    selectedCard: card,
    deckType: deck,
    submitLabel: isLikely ? 'Most likely this' : "I'd rather this",
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

/** The picks so far, in life → death → afterlife order. */
function renderPicks(solo, { compact = false } = {}) {
  return SUMMARY_ORDER.map((deck) => {
    const card = solo.picks[deck];
    if (!card) return '';
    const answer = answerFor(solo, card);
    const rather = ratherFor(solo, deck);
    return `
      <div class="solo__pick solo__pick--${deck}">
        <span class="solo__pick-label">${escapeHtml(DECK_LABELS[deck].pickLabel)}</span>
        ${renderCard(card)}
        ${answer && !compact ? `<p class="solo__answer">“${escapeHtml(answer)}”</p>` : ''}
        ${rather ? `<p class="solo__rather">You'd rather: ${escapeHtml(rather.title ?? '')}</p>` : ''}
      </div>
    `;
  }).join('');
}

/**
 * Story screen: after each deck's final, the picks so far. After the last
 * deck it is the ending, with a button through to the eulogy.
 */
function renderStory(solo) {
  const done = solo.done;
  const prompt = done ? 'This is how you carked it.' : 'Your story so far.';
  const action = done
    ? `<button class="btn btn--primary" onclick="window.game.soloOpenEulogy()">Write your eulogy</button>`
    : `<button class="btn btn--primary" onclick="window.game.soloContinue()">Continue</button>`;
  return `
    <div class="screen screen--phase screen--solo" data-phase="solo">
      ${renderPhaseHeader({ phase: 'solo', label: done ? 'Single Player - Your Story' : 'Single Player - So Far' })}
      <p class="phase__prompt solo__prompt">${escapeHtml(prompt)}</p>
      <div class="solo__summary">
        ${renderPicks(solo)}
      </div>
      <div class="phase__actions solo__actions">
        ${action}
      </div>
      ${done ? `
      <button class="btn btn--ghost solo__share-btn" onclick="window.game.copySoloLink()">
        Share Single Player
      </button>` : ''}
    </div>
  `;
}

/** Write-your-own-eulogy screen: the three picks small on top, a big text box below. */
function renderEulogyScreen(solo) {
  return `
    <div class="screen screen--phase screen--solo solo__eulogy-screen" data-phase="solo">
      ${renderPhaseHeader({ phase: 'solo', label: 'Single Player - Your Eulogy' })}
      <div class="solo__eulogy-cards">
        ${renderPicks(solo, { compact: true })}
      </div>
      <p class="solo__hint">Here lies you. Say a few words.</p>
      <textarea id="solo-eulogy" class="solo__textarea solo__textarea--eulogy" maxlength="1000"
                placeholder="They lived, they died, and then…" aria-label="Your eulogy">${escapeHtml(solo.eulogy ?? '')}</textarea>
      <button class="btn btn--primary solo__eulogy-done" onclick="window.game.soloDone()">
        Done
      </button>
      <div class="phase__actions solo__actions">
        <button class="btn btn--secondary" onclick="window.game.soloStart()">Play Again</button>
        <button class="btn btn--secondary" onclick="window.game.soloMenu()">Menu</button>
      </div>
    </div>
  `;
}

/** The life story Claude writes from the picks and eulogy: loading, the story, or an error. */
function renderLifeStory(solo) {
  const story = solo.lifeStory ?? { status: 'loading' };
  return `
    <div class="screen screen--phase screen--solo solo__lifestory-screen" data-phase="solo">
      ${renderPhaseHeader({ phase: 'solo', label: 'Single Player - Your Life Story' })}
      <div class="solo__eulogy-cards">
        ${renderPicks(solo, { compact: true })}
      </div>
      ${renderStoryBody(story, solo.eulogy)}
      <div class="phase__actions solo__actions">
        <button class="btn btn--secondary" onclick="window.game.soloStart()">Play Again</button>
        <button class="btn btn--secondary" onclick="window.game.soloMenu()">Menu</button>
      </div>
      <button class="btn btn--ghost solo__share-btn" onclick="window.game.copySoloLink()">
        Share Single Player
      </button>
    </div>
  `;
}

function renderStoryBody(story, eulogy) {
  const eulogyBox = renderEulogyBox(eulogy);
  if (story.status === 'ready') {
    return `
      <section class="solo__story-section">
        <h3 class="solo__section-title">Your life story</h3>
        <article class="solo__story" aria-live="polite">${toParagraphs(story.text)}</article>
      </section>
      ${eulogyBox}
      <button class="btn btn--primary solo__story-share" onclick="window.game.soloShareStory()">Share</button>
    `;
  }
  if (story.status === 'error') {
    return `
      <div class="solo__story solo__story--error" role="alert">
        <p>${escapeHtml(story.error || "Couldn't write your story right now.")}</p>
      </div>
      ${eulogyBox}
      <div class="phase__actions solo__actions">
        <button class="btn btn--primary" onclick="window.game.soloRetryStory()">Try again</button>
        <button class="btn btn--secondary" onclick="window.game.soloBackToEulogy()">Edit eulogy</button>
      </div>
    `;
  }
  return `
    <div class="solo__story solo__story--loading" aria-live="polite">
      <p class="solo__loading-text">Writing your life story…</p>
    </div>
    ${eulogyBox}
  `;
}

/** The player's own eulogy as a card under the story. Empty eulogy → nothing. */
function renderEulogyBox(eulogy) {
  const paragraphs = toParagraphs(eulogy ?? '');
  if (!paragraphs) return '';
  return `
    <section class="solo__eulogy-panel">
      <h3 class="solo__section-title">Your eulogy</h3>
      <div class="solo__story solo__eulogy-text">${paragraphs}</div>
    </section>
  `;
}

/** Split text on blank lines into escaped <p> elements. */
function toParagraphs(text) {
  return String(text).split(/\n\s*\n/)
    .map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`).join('');
}
