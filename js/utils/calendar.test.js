import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildIcs, googleCalendarUrl, outlookCalendarUrl } from './calendar.js';

const EVENT = {
  title: 'Nan, Bob & Co',
  joinUrl: 'https://play.carkedit.com/?join=GRAVE',
  startsAt: '2026-08-08T09:30:00.000Z',
};

const MEET = 'https://meet.google.com/abc-defg-hij';

// A typical parsed invite: the link, a dial-in and a passcode, plus notes.
const CALL = {
  videoCall: [
    { kind: 'link', platform: 'google-meet', value: MEET, label: 'Join Google Meet' },
    { kind: 'phone', platform: 'phone', value: '+61 2 8015 6011', label: 'Dial-in' },
    { kind: 'code', platform: 'other', value: '481516', label: 'Passcode' },
  ],
  videoCallNotes: 'Cameras on, mics muted until the eulogy.',
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

  test('without a call, the game link is the location', () => {
    assert.ok(buildIcs(EVENT).includes(`LOCATION:${EVENT.joinUrl}`));
  });

  test('a video call takes over the location and joins the description', () => {
    const ics = buildIcs({ ...EVENT, ...CALL });
    // LOCATION is the field calendar apps turn into a "join" button.
    assert.ok(ics.includes(`LOCATION:${MEET}`));
    assert.ok(ics.includes('Join Google Meet: ' + MEET));
    // Dial-in and code matter as much as the link when joining from a phone.
    assert.ok(ics.includes('Dial-in: +61 2 8015 6011'));
    assert.ok(ics.includes('Passcode: 481516'));
    assert.ok(ics.includes('Cameras on'));
    // The game link still has to be reachable from the event.
    assert.ok(ics.includes(`URL:${EVENT.joinUrl}`));
  });

  test('a call with no link leaves the game link as the location', () => {
    const ics = buildIcs({ ...EVENT, videoCall: [{ kind: 'phone', value: '+61 2 8015 6011', label: 'Dial-in' }] });
    assert.ok(ics.includes(`LOCATION:${EVENT.joinUrl}`));
    assert.ok(ics.includes('Dial-in: +61 2 8015 6011'));
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

  test('prefers the video call as the location when there is one', () => {
    const url = new URL(googleCalendarUrl({ ...EVENT, ...CALL }));
    assert.equal(url.searchParams.get('location'), MEET);
    assert.ok(url.searchParams.get('details').includes(MEET));
    assert.ok(url.searchParams.get('details').includes(EVENT.joinUrl));
  });
});

describe('outlookCalendarUrl', () => {
  test('builds a compose deeplink with ISO-8601 start/end', () => {
    const url = new URL(outlookCalendarUrl(EVENT));
    assert.equal(url.origin + url.pathname, 'https://outlook.live.com/calendar/0/deeplink/compose');
    assert.equal(url.searchParams.get('rru'), 'addevent');
    assert.equal(url.searchParams.get('subject'), EVENT.title);
    // Outlook wants full ISO-8601, not the compact basic format ICS/Google use.
    assert.equal(url.searchParams.get('startdt'), '2026-08-08T09:30:00.000Z');
    assert.equal(url.searchParams.get('enddt'), '2026-08-08T11:00:00.000Z');
  });

  test('carries the join link, and the call as location when present', () => {
    const plain = new URL(outlookCalendarUrl(EVENT));
    assert.equal(plain.searchParams.get('location'), EVENT.joinUrl);

    const withCall = new URL(outlookCalendarUrl({ ...EVENT, ...CALL }));
    assert.equal(withCall.searchParams.get('location'), MEET);
    assert.ok(withCall.searchParams.get('body').includes(EVENT.joinUrl));
  });
});
