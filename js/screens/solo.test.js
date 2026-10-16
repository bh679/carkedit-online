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
