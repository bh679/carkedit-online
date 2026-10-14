import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendJoinDetails,
  parseJoinDetails,
  hasJoinDetails,
  stripJoinDetails,
} from './join-details.js';

const BASE = 'https://play.carkedit.com/?join=BOND';

// ── appendJoinDetails ─────────────────────────────────────

test('appendJoinDetails: adds name and birthday', () => {
  const url = appendJoinDetails(BASE, { name: 'Brennan', birthMonth: 11, birthDay: 1 });
  const p = new URL(url).searchParams;
  assert.equal(p.get('join'), 'BOND', 'the room survives');
  assert.equal(p.get('n'), 'Brennan');
  assert.equal(p.get('bm'), '11');
  assert.equal(p.get('bd'), '1');
});

test('appendJoinDetails: nothing typed leaves the invite exactly as it was', () => {
  assert.equal(appendJoinDetails(BASE, {}), BASE);
  assert.equal(appendJoinDetails(BASE), BASE);
  assert.equal(appendJoinDetails(BASE, { name: '   ', birthMonth: 0, birthDay: 0 }), BASE);
});

test('appendJoinDetails: omits the blanks, keeps the rest', () => {
  const p = new URL(appendJoinDetails(BASE, { name: 'Sam' })).searchParams;
  assert.equal(p.get('n'), 'Sam');
  assert.equal(p.get('bm'), null, 'no empty month');
  assert.equal(p.get('bd'), null, 'no empty day');
});

test('appendJoinDetails: rejects out-of-range months and days', () => {
  const p = new URL(appendJoinDetails(BASE, { birthMonth: 13, birthDay: 40 })).searchParams;
  assert.equal(p.get('bm'), null);
  assert.equal(p.get('bd'), null);
  const q = new URL(appendJoinDetails(BASE, { birthMonth: -1, birthDay: 0 })).searchParams;
  assert.equal(q.get('bm'), null);
  assert.equal(q.get('bd'), null);
});

test('appendJoinDetails: accepts the strings a <select> actually gives us', () => {
  const p = new URL(appendJoinDetails(BASE, { birthMonth: '5', birthDay: '12' })).searchParams;
  assert.equal(p.get('bm'), '5');
  assert.equal(p.get('bd'), '12');
});

test('appendJoinDetails: caps the name so a paste cannot bloat the QR', () => {
  const p = new URL(appendJoinDetails(BASE, { name: 'x'.repeat(200) })).searchParams;
  assert.equal(p.get('n').length, 24);
});

test('appendJoinDetails: trims surrounding whitespace', () => {
  const p = new URL(appendJoinDetails(BASE, { name: '  Brennan  ' })).searchParams;
  assert.equal(p.get('n'), 'Brennan');
});

test('appendJoinDetails: encodes names that need it', () => {
  for (const name of ['Ann & Bob', 'José', '日本語', 'a?b=c#d']) {
    const url = appendJoinDetails(BASE, { name });
    assert.equal(new URL(url).searchParams.get('n'), name, `round-trips ${name}`);
  }
});

test('appendJoinDetails: replaces rather than duplicates on a URL that already has details', () => {
  const once = appendJoinDetails(BASE, { name: 'First' });
  const twice = appendJoinDetails(once, { name: 'Second' });
  assert.equal(new URL(twice).searchParams.getAll('n').length, 1);
  assert.equal(new URL(twice).searchParams.get('n'), 'Second');
});

test('appendJoinDetails: survives junk input without throwing', () => {
  assert.equal(appendJoinDetails('', { name: 'x' }), '');
  assert.equal(appendJoinDetails(null), '');
  assert.equal(appendJoinDetails('not a url', { name: 'x' }), 'not a url');
});

// ── parseJoinDetails ──────────────────────────────────────

test('parseJoinDetails: reads back what append wrote', () => {
  const details = { name: 'Brennan', birthMonth: 11, birthDay: 1 };
  const url = new URL(appendJoinDetails(BASE, details));
  assert.deepEqual(parseJoinDetails(url.search), details);
});

test('parseJoinDetails: round-trips a name needing encoding', () => {
  const url = new URL(appendJoinDetails(BASE, { name: 'Ann & José' }));
  assert.equal(parseJoinDetails(url.search).name, 'Ann & José');
});

test('parseJoinDetails: absent params give empty values, not undefined', () => {
  assert.deepEqual(parseJoinDetails('?join=BOND'), { name: '', birthMonth: 0, birthDay: 0 });
  assert.deepEqual(parseJoinDetails(''), { name: '', birthMonth: 0, birthDay: 0 });
  assert.deepEqual(parseJoinDetails(undefined), { name: '', birthMonth: 0, birthDay: 0 });
});

test('parseJoinDetails: validates — a scanned code is untrusted input', () => {
  const bad = parseJoinDetails('?n=' + 'x'.repeat(200) + '&bm=99&bd=abc');
  assert.equal(bad.name.length, 24, 'name capped');
  assert.equal(bad.birthMonth, 0, 'nonsense month rejected');
  assert.equal(bad.birthDay, 0, 'non-numeric day rejected');
});

test('parseJoinDetails: accepts URLSearchParams directly', () => {
  const p = new URLSearchParams({ n: 'Sam', bm: '3', bd: '4' });
  assert.deepEqual(parseJoinDetails(p), { name: 'Sam', birthMonth: 3, birthDay: 4 });
});

// ── hasJoinDetails ────────────────────────────────────────

test('hasJoinDetails: true when anything is worth pre-filling', () => {
  assert.equal(hasJoinDetails({ name: 'Sam', birthMonth: 0, birthDay: 0 }), true);
  assert.equal(hasJoinDetails({ name: '', birthMonth: 3, birthDay: 0 }), true);
  assert.equal(hasJoinDetails({ name: '', birthMonth: 0, birthDay: 0 }), false);
  assert.equal(hasJoinDetails(null), false);
});

// ── stripJoinDetails ──────────────────────────────────────

test('stripJoinDetails: clears the personal params, keeps the room', () => {
  const url = appendJoinDetails(BASE, { name: 'Brennan', birthMonth: 11, birthDay: 1 });
  assert.equal(stripJoinDetails(url), BASE);
});

test('stripJoinDetails: leaves an already-clean URL alone', () => {
  assert.equal(stripJoinDetails(BASE), BASE);
});

test('stripJoinDetails: keeps unrelated params', () => {
  const url = appendJoinDetails('https://play.carkedit.com/?join=BOND&ref=x', { name: 'Sam' });
  const out = new URL(stripJoinDetails(url)).searchParams;
  assert.equal(out.get('n'), null, 'name gone');
  assert.equal(out.get('ref'), 'x', 'unrelated param kept');
  assert.equal(out.get('join'), 'BOND');
});

test('stripJoinDetails: survives junk without throwing', () => {
  assert.equal(stripJoinDetails(''), '');
  assert.equal(stripJoinDetails(null), '');
  assert.equal(stripJoinDetails('not a url'), 'not a url');
});
