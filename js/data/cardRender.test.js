import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFrontHtml } from './cardRender.js';

/** Decode the entities escAttr emits, as the HTML parser would. */
function decodeAttr(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Pull a double-quoted attribute off the first <img class="card__img">. */
function imgAttr(html, name) {
  const img = html.match(/<img [^>]*class="card__img"[^>]*>/);
  assert.ok(img, 'expected an illustrated <img class="card__img">');
  const m = img[0].match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? decodeAttr(m[1]) : null;
}

/** Text-only render of the same card — what the fallback must reproduce. */
function textOnlyInner(card) {
  const html = renderFrontHtml({ ...card, image: undefined });
  return html.replace(/\s+/g, ' ').trim();
}

const trickyLive = {
  deckType: 'live',
  title: "Don't hold back",
  description: 'A back\\slash and a\nnewline',
  prompt: 'Say "hi" — it\'s fine',
  image: '/assets/cards/missing.png',
};

test('illustrated onerror handler compiles when card text has quotes, backslashes and newlines', () => {
  const onError = imgAttr(renderFrontHtml(trickyLive), 'onerror');
  assert.ok(onError, 'expected an onerror attribute');
  assert.doesNotThrow(() => new Function(onError));
});

test('onerror carries no card text — it is identical across cards', () => {
  const a = imgAttr(renderFrontHtml(trickyLive), 'onerror');
  const b = imgAttr(renderFrontHtml({ deckType: 'bye', title: 'Other', image: '/x.png' }), 'onerror');
  assert.equal(a, b);
  assert.ok(!a.includes('hold back'));
});

test('data-fallback round-trips to the text-only inner markup for live cards', () => {
  const fallback = imgAttr(renderFrontHtml(trickyLive), 'data-fallback');
  assert.ok(fallback, 'expected a data-fallback attribute');
  assert.ok(fallback.includes("Don't hold back"));
  assert.ok(textOnlyInner(trickyLive).includes(fallback));
});

test('data-fallback round-trips for die cards with an apostrophe in the title', () => {
  const die = { deckType: 'die', title: "Can't stop", image: '/x.png' };
  const fallback = imgAttr(renderFrontHtml(die), 'data-fallback');
  assert.ok(fallback, 'expected a data-fallback attribute');
  // Die titles are attribute-escaped inside the fallback markup itself.
  assert.ok(fallback.includes('Can&#39;t stop'));
  assert.ok(textOnlyInner(die).includes(fallback));
});
