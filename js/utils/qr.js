// CarkedIt Online — QR Code Generation
//
// Thin wrapper over the vendored qrcode-generator library (see js/vendor/README.md).
// Returns an SVG *string* rather than drawing to a canvas, so callers stay pure
// render-a-string components like everything else in js/components/.
//
// The SVG is deliberately dark-on-white regardless of the app theme: the game is
// dark-themed, and inverted QR codes fail to decode on a lot of phone cameras.
// The library's createSvgTag already emits a white backing rect and black modules.
'use strict';

import qrcode from '../vendor/qrcode-generator.js';

/** 0 = pick the smallest version that fits the data. */
const AUTO_TYPE_NUMBER = 0;

/**
 * 'M' recovers ~15% damage. 'L' would give a chunkier (easier to scan) code, but
 * 'M' survives a phone screen's glare and fingerprints, and join URLs are short
 * enough that the extra data costs us nothing visually.
 */
const ERROR_CORRECTION_LEVEL = 'M';

/** SVG user units per module. Scaled by CSS, so this is only the internal grid. */
const CELL_SIZE = 4;

/** The spec's mandatory quiet zone — 4 modules of blank on every side. */
const QUIET_ZONE_MODULES = 4;

/**
 * Encodes text as a QR code and returns standalone SVG markup.
 *
 * The returned SVG has no width/height (scalable), so the caller sizes it with
 * CSS. It is generated, not interpolated — the only caller-supplied strings that
 * reach the markup are `label`/`description`, which the library XML-escapes.
 *
 * @param {string} text — the payload to encode, e.g. a join URL
 * @param {object} [opts]
 * @param {string} [opts.label] — accessible name, rendered as <title>
 * @param {string} [opts.description] — longer accessible description
 * @returns {string} SVG markup
 * @throws {TypeError} when `text` is not a non-empty string
 */
export function toQrSvg(text, opts = {}) {
  if (typeof text !== 'string' || text.trim() === '') {
    throw new TypeError('toQrSvg: text must be a non-empty string');
  }

  const qr = qrcode(AUTO_TYPE_NUMBER, ERROR_CORRECTION_LEVEL);
  qr.addData(text);
  qr.make();

  return qr.createSvgTag({
    cellSize: CELL_SIZE,
    margin: CELL_SIZE * QUIET_ZONE_MODULES,
    scalable: true,
    title: opts.label || null,
    alt: opts.description || null,
  });
}
