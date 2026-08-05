import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectPlatform,
  isSafeLink,
  toDialHref,
  defaultLabel,
  parseVideoCallText,
  MAX_ENTRIES,
} from './video-call.js';

const links = (r) => r.entries.filter((e) => e.kind === 'link');
const phones = (r) => r.entries.filter((e) => e.kind === 'phone');
const codes = (r) => r.entries.filter((e) => e.kind === 'code');

// ── detectPlatform ─────────────────────────────────────

test('detectPlatform: recognises the main platforms', () => {
  assert.equal(detectPlatform('https://us02web.zoom.us/j/81234567890'), 'zoom');
  assert.equal(detectPlatform('https://meet.google.com/abc-defg-hij'), 'google-meet');
  assert.equal(detectPlatform('https://teams.microsoft.com/l/meetup-join/x'), 'teams');
  assert.equal(detectPlatform('https://discord.gg/aBcDeF'), 'discord');
  assert.equal(detectPlatform('https://chat.whatsapp.com/GroupId'), 'whatsapp');
  assert.equal(detectPlatform('https://facetime.apple.com/join#v=1'), 'facetime');
  assert.equal(detectPlatform('https://acme.webex.com/meet/jo'), 'webex');
  assert.equal(detectPlatform('https://meet.jit.si/carkedit'), 'jitsi');
});

test('detectPlatform: unknown hosts and junk fall back to "other"', () => {
  assert.equal(detectPlatform('https://example.com/room/7'), 'other');
  assert.equal(detectPlatform('not a url'), 'other');
});

test('isSafeLink: web schemes only', () => {
  assert.equal(isSafeLink('https://zoom.us/j/1'), true);
  assert.equal(isSafeLink('http://zoom.us/j/1'), true);
  assert.equal(isSafeLink('javascript:alert(1)'), false);
  assert.equal(isSafeLink('data:text/html,<script>'), false);
});

test('toDialHref: keeps dial characters only', () => {
  assert.equal(toDialHref('+61 2 8015 6011,,86123456789#'), 'tel:+61280156011,,86123456789#');
  assert.equal(toDialHref('nonsense'), '');
});

test('defaultLabel: platform-aware button text', () => {
  assert.equal(defaultLabel({ kind: 'link', platform: 'zoom' }), 'Join Zoom');
  assert.equal(defaultLabel({ kind: 'link', platform: 'discord' }), 'Open Discord');
  assert.equal(defaultLabel({ kind: 'phone' }), 'Dial-in');
});

// ── parseVideoCallText: real invites ───────────────────

test('parses a full Zoom invite into link, meeting ID, passcode and dial-in', () => {
  const result = parseVideoCallText(`
Brennan Hatton is inviting you to a scheduled Zoom meeting.

Topic: Carked It game night
Time: Aug 6, 2026 07:00 PM Canberra

Join Zoom Meeting
https://us02web.zoom.us/j/81234567890?pwd=Zm9vYmFy

Meeting ID: 812 3456 7890
Passcode: 481522

One tap mobile
+61280156011,,81234567890# Australia

Dial by your location
+61 2 8015 6011 Australia
Find your local number: https://us02web.zoom.us/u/kb1AbCd
`);

  const link = links(result)[0];
  assert.equal(link.value, 'https://us02web.zoom.us/j/81234567890?pwd=Zm9vYmFy');
  assert.equal(link.platform, 'zoom');
  assert.equal(link.label, 'Join Zoom');

  const codeValues = codes(result).map((c) => `${c.label}=${c.value}`);
  assert.ok(codeValues.includes('Meeting ID=812 3456 7890'), codeValues.join(', '));
  assert.ok(codeValues.includes('Passcode=481522'), codeValues.join(', '));

  assert.ok(phones(result).some((p) => p.value.includes('8015 6011') || p.value.includes('280156011')));

  // Human context survives; Zoom's boilerplate lines do not.
  assert.match(result.notes, /Topic: Carked It game night/);
  assert.doesNotMatch(result.notes, /inviting you to a scheduled/i);
  assert.doesNotMatch(result.notes, /One tap mobile/i);
  assert.doesNotMatch(result.notes, /Dial by your location/i);
});

test('"Find your local number" is not turned into a second join button', () => {
  const result = parseVideoCallText(
    'https://us02web.zoom.us/j/81234567890\nFind your local number: https://us02web.zoom.us/u/kb1AbCd',
  );
  assert.deepEqual(links(result).map((l) => l.value), ['https://us02web.zoom.us/j/81234567890']);
  assert.doesNotMatch(result.notes, /local number|zoom\.us\/u\//i);
});

test('the meeting ID is never mistaken for a phone number', () => {
  const result = parseVideoCallText('Meeting ID: 812 3456 7890');
  assert.equal(phones(result).length, 0);
  assert.deepEqual(codes(result).map((c) => c.value), ['812 3456 7890']);
});

test('derives the Zoom meeting ID from the join link when it is not spelled out', () => {
  const result = parseVideoCallText('https://us02web.zoom.us/j/81234567890');
  assert.deepEqual(codes(result).map((c) => [c.label, c.value]), [['Meeting ID', '812 3456 7890']]);
});

test('parses a Google Meet invite with dial-in and PIN', () => {
  const result = parseVideoCallText(`
Google Meet joining info
Video call link: https://meet.google.com/abc-defg-hij
Or dial: +1 402-555-0163 (US)
PIN: 452 918 271#
`);
  assert.equal(links(result)[0].platform, 'google-meet');
  assert.equal(links(result)[0].label, 'Join Google Meet');
  assert.ok(phones(result).length >= 1, 'expected the dial-in number');
  assert.ok(codes(result).some((c) => c.label === 'PIN'));
});

test('parses a Teams link', () => {
  const result = parseVideoCallText('Click here to join the meeting\nhttps://teams.microsoft.com/l/meetup-join/19%3ameeting_abc');
  assert.equal(links(result)[0].platform, 'teams');
  assert.equal(result.notes, '');
});

test('parses bare platform links without a scheme', () => {
  const result = parseVideoCallText('Hop on discord.gg/aBcDeF when you can');
  assert.equal(links(result)[0].value, 'https://discord.gg/aBcDeF');
  assert.equal(links(result)[0].label, 'Open Discord');
  assert.match(result.notes, /Hop on .*when you can/);
});

test('parses a WhatsApp group call link', () => {
  const result = parseVideoCallText('https://call.whatsapp.com/video/AbCdEf');
  assert.equal(links(result)[0].platform, 'whatsapp');
});

test('parses a plain conference dial-in with an extension', () => {
  const result = parseVideoCallText('Dial in: +61 2 8015 6011,,86123456789#');
  const phone = phones(result)[0];
  assert.equal(phone.value, '+61 2 8015 6011,,86123456789#');
  assert.equal(phone.platform, 'phone');
});

test('a tel: link becomes a phone entry, not a link', () => {
  const result = parseVideoCallText('Call tel:+61280156011');
  assert.equal(links(result).length, 0);
  assert.equal(phones(result).length, 1);
});

test('labels a dial-in with its region when the line names one', () => {
  const result = parseVideoCallText('Dial by your location\n+1 253 215 8782 US Tacoma');
  assert.equal(phones(result)[0].label, 'US Tacoma');
});

test('a sentence containing a link and a number is kept whole in the instructions', () => {
  const text = 'Hop on https://meet.google.com/abc-defg-hij around 7pm, or call me on +61 2 8015 6011 if you get stuck.';
  const result = parseVideoCallText(text);
  assert.equal(links(result).length, 1);
  assert.equal(phones(result).length, 1);
  // The sentence must still read as a sentence — not "Hop on around 7pm, or call me on if…"
  assert.equal(result.notes, text);
});

test('label-style lines are dropped from the instructions, not half-kept', () => {
  const result = parseVideoCallText('Meeting ID: 812 3456 7890\nPasscode: 481522');
  assert.equal(result.notes, '');
});

test('text with no link or number is all instructions', () => {
  const result = parseVideoCallText('We are using the usual Zoom room.\nAsk Brennan for the link.');
  assert.equal(result.entries.length, 0);
  assert.equal(result.notes, 'We are using the usual Zoom room.\nAsk Brennan for the link.');
});

test('empty and non-string input is handled', () => {
  assert.deepEqual(parseVideoCallText(''), { entries: [], notes: '' });
  assert.deepEqual(parseVideoCallText('   '), { entries: [], notes: '' });
  assert.deepEqual(parseVideoCallText(undefined), { entries: [], notes: '' });
});

// ── Safety and limits ──────────────────────────────────

test('drops javascript: URLs instead of turning them into buttons', () => {
  const result = parseVideoCallText('javascript:alert(document.cookie)\nhttps://zoom.us/j/812345678');
  assert.equal(links(result).length, 1);
  assert.equal(links(result)[0].value, 'https://zoom.us/j/812345678');
  assert.ok(!result.entries.some((e) => e.value.includes('javascript:')));
});

test('markup in leftover text is preserved verbatim for the renderer to escape', () => {
  const result = parseVideoCallText('<script>alert(1)</script>');
  assert.equal(result.notes, '<script>alert(1)</script>');
});

test('duplicate links and numbers are collapsed', () => {
  const result = parseVideoCallText('https://zoom.us/j/812345678\nhttps://zoom.us/j/812345678');
  assert.equal(links(result).length, 1);
});

test('caps entries, keeping links and codes over a long dial-in list', () => {
  const dialIns = Array.from({ length: 12 }, (_, i) => `+1 253 215 87${String(i).padStart(2, '0')}`).join('\n');
  const result = parseVideoCallText(`https://us02web.zoom.us/j/81234567890\nDial by your location\n${dialIns}`);
  assert.equal(result.entries.length, MAX_ENTRIES);
  assert.equal(result.entries[0].kind, 'link');
  assert.ok(codes(result).length >= 1, 'derived meeting ID survives the cap');
});

test('notes are capped at 1000 characters', () => {
  const result = parseVideoCallText('word '.repeat(500));
  assert.ok(result.notes.length <= 1000);
});
