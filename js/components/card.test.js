import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from './card.js';

test('legacy render() illustrated onerror compiles when card text has an apostrophe', () => {
  const html = render({ deckType: 'live', title: "Don't hold back", prompt: "It's fine", image: '/x.png' });
  const m = html.match(/<img [^>]*class="card__img"[^>]*\sonerror="([^"]*)"/);
  assert.ok(m, 'expected an illustrated <img> with onerror');
  const onError = m[1].replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  assert.doesNotThrow(() => new Function(onError));
  assert.match(html, /data-fallback="[^"]*Don&#39;t hold back/);
});
