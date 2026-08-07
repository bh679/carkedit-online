import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildJoinQrBanner, shouldNudgeToPhone } from './join-qr.js';

const JOIN_URL = 'https://play.carkedit.com/?join=KXQZ';
const DESKTOP_ARRIVAL = {
  roomCode: 'KXQZ',
  joinUrl: JOIN_URL,
  isDesktop: true,
  viaShareLink: true,
};

// ── The shared gate ───────────────────────────────────────
// One function decides both the QR block and the hidden Join button, so the
// two can't disagree and leave someone with neither.

test('shouldNudgeToPhone: only a desktop that followed a share link', () => {
  const args = { roomCode: 'KXQZ', isDesktop: true, viaShareLink: true };
  assert.equal(shouldNudgeToPhone(args), true);
  assert.equal(shouldNudgeToPhone({ ...args, isDesktop: false }), false, 'phones and tablets');
  assert.equal(shouldNudgeToPhone({ ...args, viaShareLink: false }), false, 'code typed by hand');
  assert.equal(shouldNudgeToPhone({ ...args, roomCode: '' }), false, 'no room');
  assert.equal(shouldNudgeToPhone(), false, 'called with nothing');
});

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

// ── The escape hatch ──────────────────────────────────────

test('offers a way to play on the computer anyway', () => {
  const html = buildJoinQrBanner(DESKTOP_ARRIVAL);
  assert.ok(html.includes("I can't use my phone, play from computer"), 'the escape hatch is worded plainly');
  assert.ok(html.includes('window.game.revealDesktopJoin()'), 'it reveals the Join button');
  assert.ok(html.includes('<button type="button"'), 'a real button — it acts, it does not navigate');
});

test('the escape hatch comes after the QR and the reason', () => {
  const html = buildJoinQrBanner(DESKTOP_ARRIVAL);
  assert.ok(html.indexOf('<svg ') < html.indexOf('revealDesktopJoin'), 'QR first');
  assert.ok(html.indexOf('cards are private') < html.indexOf('revealDesktopJoin'), 'reason before the opt-out');
});

test('once revealed the block stays but the escape hatch is spent', () => {
  const html = buildJoinQrBanner({ ...DESKTOP_ARRIVAL, revealed: true });
  assert.ok(html.includes('<svg '), 'the QR is still offered');
  assert.ok(!html.includes('revealDesktopJoin'), 'no second reveal control');
});

test('does not disable or replace the join form — it only adds a block', () => {
  const html = buildJoinQrBanner(DESKTOP_ARRIVAL);
  assert.ok(!html.includes('disabled'), 'nothing is disabled');
  assert.ok(!html.includes('online-room-code'), 'the form is untouched');
});

test('is separated from the form by the screen\'s usual divider', () => {
  const html = buildJoinQrBanner(DESKTOP_ARRIVAL);
  assert.ok(html.includes('online-lobby__divider'), 'reuses the join screen divider');
  assert.ok(html.indexOf('online-lobby__divider') < html.indexOf('join-qr__title'), 'sits above the block');
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
