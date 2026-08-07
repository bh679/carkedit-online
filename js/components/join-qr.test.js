import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildJoinQrBanner } from './join-qr.js';

const JOIN_URL = 'https://play.carkedit.com/?join=KXQZ';
const DESKTOP_ARRIVAL = {
  roomCode: 'KXQZ',
  joinUrl: JOIN_URL,
  isDesktop: true,
  viaShareLink: true,
};

// ── Gating ────────────────────────────────────────────────

test('shows for a share link opened on a desktop', () => {
  assert.notEqual(buildJoinQrBanner(DESKTOP_ARRIVAL), '');
});

test('hidden on phones and tablets — they are already on the right device', () => {
  assert.equal(buildJoinQrBanner({ ...DESKTOP_ARRIVAL, isDesktop: false }), '');
});

test('hidden for a code typed by hand — no invite was followed', () => {
  assert.equal(buildJoinQrBanner({ ...DESKTOP_ARRIVAL, viaShareLink: false }), '');
});

test('hidden without a room code or a join URL', () => {
  assert.equal(buildJoinQrBanner({ ...DESKTOP_ARRIVAL, roomCode: '' }), '');
  assert.equal(buildJoinQrBanner({ ...DESKTOP_ARRIVAL, joinUrl: '' }), '');
});

test('hidden rather than throwing when called with nothing', () => {
  assert.equal(buildJoinQrBanner(), '');
  assert.equal(buildJoinQrBanner({}), '');
});

// ── Content ───────────────────────────────────────────────

test('leads with the QR code and says why', () => {
  const html = buildJoinQrBanner(DESKTOP_ARRIVAL);
  assert.ok(html.includes('Best played on your phone'), 'states the recommendation');
  assert.ok(html.includes('<svg '), 'embeds the QR');
  assert.ok(html.includes('Scan with your phone camera'), 'says what to do');
  assert.ok(html.includes('your cards are private'), 'says why a shared screen will not do');
});

test('the QR comes before the "or join on this computer" hand-off', () => {
  const html = buildJoinQrBanner(DESKTOP_ARRIVAL);
  assert.ok(html.indexOf('<svg ') < html.indexOf('or join on this computer'));
});

test('does not disable or replace the join form — it only prepends a block', () => {
  const html = buildJoinQrBanner(DESKTOP_ARRIVAL);
  assert.ok(!html.includes('disabled'), 'nothing is disabled');
  assert.ok(!html.includes('online-room-code'), 'the form is untouched');
});

test('QR carries an accessible label naming the room', () => {
  const html = buildJoinQrBanner(DESKTOP_ARRIVAL);
  assert.ok(html.includes('QR code to open room KXQZ on your phone'));
  assert.ok(html.includes('role="img"'));
});

test('QR stays dark-on-white so a phone camera can read it', () => {
  const html = buildJoinQrBanner(DESKTOP_ARRIVAL);
  assert.ok(html.includes('fill="white"'));
  assert.ok(html.includes('fill="black"'));
});

test('encodes the join URL it was given, not the room code', () => {
  const a = buildJoinQrBanner(DESKTOP_ARRIVAL);
  const b = buildJoinQrBanner({ ...DESKTOP_ARRIVAL, joinUrl: 'https://play.carkedit.com/?join=ZZZZ' });
  assert.notEqual(a, b, 'a different URL produces a different code');
});

test('a room code that cannot be encoded degrades to nothing, not a broken block', () => {
  // toQrSvg throws on empty input; the banner must swallow it and step aside
  // so the join form underneath still renders.
  assert.equal(buildJoinQrBanner({ ...DESKTOP_ARRIVAL, joinUrl: '   ' }), '');
});
