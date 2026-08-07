import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildJoinUrl } from './join-url.js';

test('buildJoinUrl: builds an invite URL from the current page', () => {
  assert.equal(
    buildJoinUrl('KXQZ', 'https://play.carkedit.com/'),
    'https://play.carkedit.com/?join=KXQZ',
  );
});

test('buildJoinUrl: keeps the path so brand vanity URLs stay branded', () => {
  assert.equal(
    buildJoinUrl('KXQZ', 'https://play.carkedit.com/acme'),
    'https://play.carkedit.com/acme?join=KXQZ',
  );
});

test('buildJoinUrl: works against a local dev server', () => {
  assert.equal(
    buildJoinUrl('AB12', 'http://localhost:4600/'),
    'http://localhost:4600/?join=AB12',
  );
});

test('buildJoinUrl: replaces an existing join param rather than stacking one', () => {
  const url = buildJoinUrl('NEW1', 'https://play.carkedit.com/?join=OLD1');
  assert.equal(url, 'https://play.carkedit.com/?join=NEW1');
  assert.equal(url.match(/join=/g).length, 1, 'only one join param');
});

test('buildJoinUrl: drops unrelated query params so invites carry no stale state', () => {
  assert.equal(
    buildJoinUrl('KXQZ', 'https://play.carkedit.com/?debug=1&ref=twitter'),
    'https://play.carkedit.com/?join=KXQZ',
  );
});

test('buildJoinUrl: percent-encodes the room code', () => {
  assert.equal(
    buildJoinUrl('A B&C', 'https://play.carkedit.com/'),
    'https://play.carkedit.com/?join=A%20B%26C',
  );
});

test('buildJoinUrl: returns null without a room code or a usable href', () => {
  assert.equal(buildJoinUrl(null, 'https://play.carkedit.com/'), null);
  assert.equal(buildJoinUrl('', 'https://play.carkedit.com/'), null);
  assert.equal(buildJoinUrl('KXQZ', ''), null);
  assert.equal(buildJoinUrl('KXQZ', 'not a url'), null);
});
