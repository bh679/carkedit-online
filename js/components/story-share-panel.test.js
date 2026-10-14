import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSocialLinks, renderStorySharePanel, SHARE_TEXT } from './story-share-panel.js';

const URL_ = 'https://play.carkedit.com/?solo=1';

test('buildSocialLinks encodes text and url for each network', () => {
  const links = buildSocialLinks('Me & you?', URL_);
  assert.deepEqual(links.map((l) => l.id), ['x', 'facebook', 'whatsapp', 'reddit']);
  const byId = Object.fromEntries(links.map((l) => [l.id, new URL(l.href)]));
  assert.equal(byId.x.searchParams.get('text'), 'Me & you?');
  assert.equal(byId.x.searchParams.get('url'), URL_);
  assert.equal(byId.facebook.searchParams.get('u'), URL_);
  assert.equal(byId.whatsapp.searchParams.get('text'), `Me & you? ${URL_}`);
  assert.equal(byId.reddit.searchParams.get('title'), 'Me & you?');
});

test('panel offers Share image only when files can be shared', () => {
  const links = buildSocialLinks(SHARE_TEXT, URL_);
  const withShare = renderStorySharePanel({ previewUrl: 'blob:x', canShareFiles: true, links });
  const without = renderStorySharePanel({ previewUrl: 'blob:x', canShareFiles: false, links });
  assert.match(withShare, /soloShareImage\(\)/);
  assert.doesNotMatch(without, /soloShareImage\(\)/);
  assert.match(without, /btn--primary story-share__download/);
  assert.match(without, /src="blob:x"/);
  assert.equal((without.match(/target="_blank" rel="noopener noreferrer"/g) ?? []).length, 4);
});

test('panel escapes link hrefs', () => {
  const html = renderStorySharePanel({ previewUrl: 'blob:x', canShareFiles: false, links: [{ id: 'x', label: 'X', href: 'https://x.com/?a=1&b="2"' }] });
  assert.match(html, /href="https:\/\/x\.com\/\?a=1&amp;b=&quot;2&quot;"/);
});
