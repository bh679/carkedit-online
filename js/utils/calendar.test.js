import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildIcs, googleCalendarUrl } from './calendar.js';

const EVENT = {
  title: 'Nan, Bob & Co',
  joinUrl: 'https://play.carkedit.com/?join=GRAVE',
  startsAt: '2026-08-08T09:30:00.000Z',
};

describe('buildIcs', () => {
  test('emits a single VEVENT with CRLF line endings', () => {
    const ics = buildIcs(EVENT);
    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
    assert.ok(ics.endsWith('END:VCALENDAR'));
    assert.equal(ics.match(/BEGIN:VEVENT/g).length, 1);
  });

  test('stamps UTC start/end, defaulting to a 90 minute game', () => {
    const ics = buildIcs(EVENT);
    assert.ok(ics.includes('DTSTART:20260808T093000Z'));
    assert.ok(ics.includes('DTEND:20260808T110000Z'));
  });

  test('honours an explicit duration', () => {
    const ics = buildIcs({ ...EVENT, durationMinutes: 30 });
    assert.ok(ics.includes('DTEND:20260808T100000Z'));
  });

  test('escapes commas so the SUMMARY is not split into fields', () => {
    const ics = buildIcs(EVENT);
    assert.ok(ics.includes('SUMMARY:Nan\\, Bob & Co'));
  });

  test('folds description newlines into literal \\n', () => {
    const ics = buildIcs(EVENT);
    const description = ics.split('\r\n').find((l) => l.startsWith('DESCRIPTION:'));
    assert.ok(description.includes('\\n'));
    // A raw newline inside the value would terminate the property.
    assert.ok(!description.includes('\n'));
  });

  test('falls back to a generic title', () => {
    assert.ok(buildIcs({ ...EVENT, title: null }).includes('SUMMARY:CarkedIt game'));
  });

  test('includes the join link and a reminder', () => {
    const ics = buildIcs(EVENT);
    assert.ok(ics.includes(`URL:${EVENT.joinUrl}`));
    assert.ok(ics.includes('TRIGGER:-PT15M'));
  });
});

describe('googleCalendarUrl', () => {
  test('builds a TEMPLATE url with a UTC start/end range', () => {
    const url = new URL(googleCalendarUrl(EVENT));
    assert.equal(url.origin + url.pathname, 'https://calendar.google.com/calendar/render');
    assert.equal(url.searchParams.get('action'), 'TEMPLATE');
    assert.equal(url.searchParams.get('dates'), '20260808T093000Z/20260808T110000Z');
    assert.equal(url.searchParams.get('text'), EVENT.title);
  });

  test('carries the join link so the invitee can get back to the game', () => {
    const url = new URL(googleCalendarUrl(EVENT));
    assert.equal(url.searchParams.get('location'), EVENT.joinUrl);
    assert.ok(url.searchParams.get('details').includes(EVENT.joinUrl));
  });
});
