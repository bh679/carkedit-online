import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toQrSvg } from './qr.js';

const JOIN_URL = 'https://play.carkedit.com/?join=KXQZ';

/** viewBox is `0 0 size size`; size = modules * cellSize(4) + 2 * margin(16). */
function moduleCount(svg) {
  const m = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  assert.ok(m, 'svg has a viewBox');
  assert.equal(m[1], m[2], 'QR codes are square');
  return (Number(m[1]) - 32) / 4;
}

// ── Shape ─────────────────────────────────────────────────

test('toQrSvg: returns standalone, scalable SVG markup', () => {
  const svg = toQrSvg(JOIN_URL);
  assert.ok(svg.startsWith('<svg '), 'starts with an svg tag');
  assert.ok(svg.endsWith('</svg>'), 'is a closed, standalone document');
  const openTag = svg.slice(0, svg.indexOf('>'));
  assert.ok(!/ width=| height=/.test(openTag), 'no fixed size — the caller scales it with CSS');
});

test('toQrSvg: a valid QR version — 21 modules, +4 per version, capped at 177', () => {
  const modules = moduleCount(toQrSvg(JOIN_URL));
  assert.ok(Number.isInteger(modules), `module count is a whole number (got ${modules})`);
  assert.ok(modules >= 21 && modules <= 177, `within QR versions 1-40 (got ${modules})`);
  assert.equal((modules - 21) % 4, 0, `sits on a real version boundary (got ${modules})`);
});

test('toQrSvg: stays dark-on-white so phone cameras can read it off a dark screen', () => {
  const svg = toQrSvg(JOIN_URL);
  assert.ok(svg.includes('fill="white"'), 'white backing rect');
  assert.ok(svg.includes('fill="black"'), 'black modules');
  assert.ok(!svg.includes('currentColor'), 'never inherits the theme colour');
});

test('toQrSvg: keeps the mandatory 4-module quiet zone', () => {
  const svg = toQrSvg(JOIN_URL);
  const size = Number(svg.match(/viewBox="0 0 (\d+)/)[1]);
  // Every drawn module sits at >= margin and ends by size - margin.
  const coords = [...svg.matchAll(/M(\d+),(\d+)l/g)].flatMap(m => [Number(m[1]), Number(m[2])]);
  assert.ok(coords.length > 0, 'some modules were drawn');
  assert.ok(Math.min(...coords) >= 16, 'nothing encroaches on the leading quiet zone');
  assert.ok(Math.max(...coords) + 4 <= size - 16, 'nothing encroaches on the trailing quiet zone');
});

// ── Encoding ──────────────────────────────────────────────

test('toQrSvg: same input always encodes identically', () => {
  assert.equal(toQrSvg(JOIN_URL), toQrSvg(JOIN_URL));
});

test('toQrSvg: different room codes produce different codes', () => {
  assert.notEqual(
    toQrSvg('https://play.carkedit.com/?join=AAAA'),
    toQrSvg('https://play.carkedit.com/?join=BBBB'),
  );
});

test('toQrSvg: grows to fit longer payloads', () => {
  const short = moduleCount(toQrSvg('https://play.carkedit.com/?join=KXQZ'));
  const long = moduleCount(toQrSvg(`https://play.carkedit.com/?join=${'X'.repeat(400)}`));
  assert.ok(long > short, `longer data needs a bigger code (${short} -> ${long})`);
});

// ── Accessibility + escaping ──────────────────────────────

test('toQrSvg: label becomes an accessible title', () => {
  const svg = toQrSvg(JOIN_URL, { label: 'Scan to join' });
  assert.ok(svg.includes('role="img"'), 'exposed as an image');
  assert.ok(svg.includes('<title id="qrcode-title">Scan to join</title>'));
});

test('toQrSvg: no label means no empty title element', () => {
  const svg = toQrSvg(JOIN_URL);
  assert.ok(!svg.includes('<title'), 'omits the title rather than emitting a blank one');
});

test('toQrSvg: escapes markup in the label', () => {
  const svg = toQrSvg(JOIN_URL, { label: '<script>x</script>' });
  assert.ok(!svg.includes('<script>'), 'label cannot inject markup');
  assert.ok(svg.includes('&lt;script&gt;'), 'label is XML-escaped');
});

// ── Bad input ─────────────────────────────────────────────

test('toQrSvg: rejects empty and non-string input', () => {
  for (const bad of ['', '   ', null, undefined, 42, {}]) {
    assert.throws(() => toQrSvg(bad), TypeError, `rejects ${JSON.stringify(bad)}`);
  }
});
