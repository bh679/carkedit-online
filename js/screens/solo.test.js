import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from './solo.js';

function lifeStoryState(lifeStory, eulogy) {
  return { solo: { stage: 'lifestory', picks: {}, lifeStory, eulogy } };
}

test('life story: plain story section renders before the eulogy card', () => {
  const html = render(lifeStoryState({ status: 'ready', text: 'Once upon a time.\n\nThe end.' }, 'Here lies me.'));
  const storyAt = html.indexOf('solo__story-section');
  const eulogyAt = html.indexOf('solo__eulogy-panel');
  assert.ok(storyAt > -1, 'story box present');
  assert.ok(eulogyAt > storyAt, 'eulogy box comes after story box');
  assert.match(html, /<p>Once upon a time\.<\/p><p>The end\.<\/p>/);
  assert.match(html, /<p>Here lies me\.<\/p>/);
  const storySection = html.slice(storyAt, html.indexOf('</section>', storyAt));
  assert.ok(!storySection.includes('solo__eulogy-panel'), 'story is not inside the card');
});

test('life story: eulogy text is HTML-escaped', () => {
  const html = render(lifeStoryState({ status: 'ready', text: 'Story.' }, '<img src=x onerror=alert(1)>'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img'));
});

test('life story: eulogy box omitted when eulogy is empty', () => {
  for (const eulogy of ['', '   ', undefined]) {
    const html = render(lifeStoryState({ status: 'ready', text: 'Story.' }, eulogy));
    assert.ok(!html.includes('solo__eulogy-panel'));
  }
});

test('life story: eulogy still shows while loading and on error', () => {
  assert.ok(render(lifeStoryState({ status: 'loading' }, 'Bye.')).includes('solo__eulogy-panel'));
  assert.ok(render(lifeStoryState({ status: 'error', error: 'nope' }, 'Bye.')).includes('solo__eulogy-panel'));
});

function roundState(intro) {
  const card = (i) => ({ id: i, deckType: 'die', compositeId: `die:${i}`, title: `Card ${i}` });
  return { solo: { stage: 'round', deckIndex: 0, round: 1, pair: [1, 2, 3, 4].map(card), picks: {}, rathers: {}, answers: {}, inspectIndex: null, intro } };
}

test('round intro: question marked for the intro and cards held back', () => {
  const html = render(roundState(true));
  assert.match(html, /screen--solo-intro/);
  assert.match(html, /data-solo-intro/);
  assert.match(html, /solo__skip-hint/);
  assert.ok(!html.includes('data-solo-reveal'), 'cards do not flip in during the intro');
});

test('round after the intro: cards flip in, no intro markup', () => {
  const html = render(roundState(false));
  assert.ok(!html.includes('screen--solo-intro'));
  assert.ok(!html.includes('data-solo-intro'));
  assert.ok(!html.includes('solo__skip-hint'));
  assert.equal(html.match(/data-solo-reveal/g).length, 4);
});
