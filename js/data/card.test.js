import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildCard, normaliseSpecial, isWildcard } from './card.js';

const here = dirname(fileURLToPath(import.meta.url));
const byeDeck = JSON.parse(readFileSync(join(here, 'cards', 'bye.json'), 'utf8'));

test('normaliseSpecial maps raw markers to the canonical enum', () => {
  assert.equal(normaliseSpecial({ special: 'Wildcard' }), 'wildcard');
  assert.equal(normaliseSpecial({ special: 'wildcard' }), 'wildcard');
  assert.equal(normaliseSpecial({ card_special: 'Wildcard' }), 'wildcard');
  assert.equal(normaliseSpecial({ special: '?' }), 'mystery');
  assert.equal(normaliseSpecial({ special: 'Split' }), 'split');
  assert.equal(normaliseSpecial({ special: 'bogus' }), null);
  assert.equal(normaliseSpecial({}), null);
  assert.equal(normaliseSpecial(undefined), null);
});

test('bye.json wildcard cards (ids 67/68) survive buildCard as wildcards', () => {
  const wildcards = byeDeck.filter(c => c.special === 'Wildcard');
  assert.equal(wildcards.length, 2);
  for (const raw of wildcards) {
    const card = buildCard({ ...raw, deckType: 'bye' }, { source: 'static' });
    assert.equal(card.special, 'wildcard', `card ${raw.id}`);
    assert.equal(isWildcard(card), true, `card ${raw.id}`);
  }
});

test('non-wildcard bye cards are not wildcards', () => {
  const raw = byeDeck.find(c => !c.special);
  const card = buildCard({ ...raw, deckType: 'bye' }, { source: 'static' });
  assert.equal(card.special, null);
  assert.equal(isWildcard(card), false);
});

test('server-shaped wildcard card is detected', () => {
  const card = buildCard({ id: '67', text: 'Wildcard Eulogy', deck: 'bye', special: 'Wildcard' }, { source: 'server' });
  assert.equal(isWildcard(card), true);
});

test('isWildcard tolerates null/undefined input', () => {
  assert.equal(isWildcard(null), false);
  assert.equal(isWildcard(undefined), false);
});
