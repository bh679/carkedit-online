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

function ribbonState(round) {
  const card = (n) => ({ id: n, deckType: 'die', compositeId: `die:${n}`, title: `Card ${n}` });
  return {
    solo: {
      deckIndex: 0, round, stage: 'round', picks: {}, answers: {}, inspectIndex: null,
      rathers: round === 2 ? { die: card(3) } : {},
      pair: [card(5), card(3), card(6), card(7)],
    },
  };
}

test('more likely round: only the carried-over rather card gets the ribbon', () => {
  const html = render(ribbonState(2));
  assert.equal(html.match(/solo__rather-ribbon/g)?.length, 1);
  assert.equal(html.match(/solo__choice--rather/g)?.length, 1);
  const choices = html.split('class="solo__choice').slice(1);
  assert.ok(choices[1].startsWith(' solo__choice--rather'), 'second card (die:3) is marked');
  assert.match(html, /How I'd rather/);
});

test('would rather round: no ribbon', () => {
  const html = render(ribbonState(1));
  assert.ok(!html.includes('solo__rather-ribbon'));
  assert.ok(!html.includes('solo__choice--rather'));
});

test('life story: Share, Play with friends, Play Again close the page in every state', () => {
  for (const story of [{ status: 'loading' }, { status: 'ready', text: 'Story.' }, { status: 'error', error: 'nope' }]) {
    const html = render(lifeStoryState(story, 'Bye.'));
    const ctasAt = html.indexOf('solo__ctas');
    assert.ok(ctasAt > html.indexOf('solo__eulogy-panel'), `CTAs after the eulogy (${story.status})`);
    const ctas = html.slice(ctasAt);
    const shareAt = ctas.indexOf('>Share<');
    const friendsAt = ctas.indexOf('>Play with friends<');
    const againAt = ctas.indexOf('>Play Again<');
    assert.ok(shareAt > -1 && shareAt < friendsAt && friendsAt < againAt, `CTA order (${story.status})`);
    assert.match(ctas, /onclick="window\.game\.soloMenu\(\)">Play with friends</);
    assert.match(ctas, /onclick="window\.game\.soloStart\(\)">Play Again</);
    assert.equal(html.match(/>Share</g).length, 1, `one Share button (${story.status})`);
  }
});

test('life story: Share sends the story image once ready, the link before that', () => {
  const ready = render(lifeStoryState({ status: 'ready', text: 'Story.' }));
  assert.match(ready, /solo__story-share" onclick="window\.game\.soloShareStory\(\)"/);
  for (const story of [{ status: 'loading' }, { status: 'error', error: 'nope' }]) {
    const html = render(lifeStoryState(story));
    assert.ok(!html.includes('soloShareStory'));
    assert.match(html, /solo__share-btn" onclick="window\.game\.copySoloLink\(\)"/);
  }
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

const splitCard = { compositeId: 'die:9', deckType: 'die', special: 'split', title: 'Would you rather', options: ['Fire <b>', 'Ice'] };

test('choice step: a split card breaks into two tappable halves', () => {
  const html = render({ solo: { deckIndex: 0, round: 2, pair: [], picks: {}, stage: 'round', pendingChoice: splitCard } });
  assert.equal((html.match(/solo__split-piece--a/g) ?? []).length, 1);
  assert.equal((html.match(/solo__split-piece--b/g) ?? []).length, 1);
  assert.match(html, /window\.game\.soloChoose\(0\)/);
  assert.match(html, /window\.game\.soloChoose\(1\)/);
  assert.ok(html.includes('aria-label="Fire &lt;b&gt;"'));
  assert.ok(!html.includes('Fire <b>'));
});

test('story: a split pick shows the option taken', () => {
  const html = render({ solo: { deckIndex: 1, stage: 'story', picks: { die: splitCard }, answers: {}, choices: { 'die:9': 1 } } });
  assert.match(html, /solo__answer--choice">Ice</);
});

function answerState(card) {
  return { solo: { pendingAnswer: card, deckIndex: 1, stage: 'round', picks: {}, answers: {} } };
}

test('answer step: a question prompt shows the question and a text box', () => {
  const html = render(answerState({ deckType: 'live', id: 5, title: 'Bucket List', prompt: "What's on your bucket list?" }));
  assert.match(html, /What&#39;s on your bucket list\?|What&#x27;s on your bucket list\?|What's on your bucket list\?/);
  assert.ok(html.includes('id="solo-answer"'));
  assert.ok(html.includes('soloSkipAnswer'));
  assert.ok(!html.includes('solo__reflect'));
  assert.ok(!html.includes('class="card'), 'the card itself is not shown');
});

test('answer step: a tip prompt shows a note to reflect on, no text box', () => {
  const html = render(answerState({ deckType: 'live', id: 3, title: 'Write a Will', prompt: 'Tell your <family>!' }));
  assert.ok(html.includes('solo__reflect'));
  assert.ok(html.includes('Something to think about'));
  assert.ok(html.includes('Tell your &lt;family&gt;!'));
  assert.ok(!html.includes('id="solo-answer"'));
  assert.ok(!html.includes('soloAnswer()'));
});
