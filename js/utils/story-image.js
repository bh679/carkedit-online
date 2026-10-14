// CarkedIt Online — Shareable life-story image
//
// Draws the single-player life story (three picks + Claude's story) onto a
// 1080×1350 canvas for sharing. Plain Canvas 2D rather than a DOM screenshot
// library: the cards use 3D flips and CSS that those libraries render badly.
//
// The layout half (wrapLines / fitStory / layoutShareImage) is pure and takes a
// `measure(text, fontSize) → width` function so it can be unit-tested in node.
'use strict';

export const IMAGE_WIDTH = 1080;
export const IMAGE_HEIGHT = 1350;
export const PADDING = 64;
export const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const STORY_FONT_MAX = 40;
export const STORY_FONT_MIN = 22;
export const LINE_HEIGHT = 1.4;
export const PARAGRAPH_GAP = 0.6; // in lines
const IMAGE_TIMEOUT_MS = 4000;

const COLORS = Object.freeze({
  bg: '#1C1C2E',
  text: '#FFFFFF',
  muted: 'rgba(255, 255, 255, 0.7)',
  accent: '#9842FF',
  live: '#4D9E4D',
  die: '#DAA520',
  bye: '#6B88B0',
});

const TILE_ORDER = Object.freeze([
  { deck: 'live', label: 'Your life' },
  { deck: 'die', label: 'Your death' },
  { deck: 'bye', label: 'Your afterlife' },
]);

/**
 * Wrap text into lines no wider than maxWidth. Blank lines split paragraphs;
 * the result marks the first line of each paragraph after the first with
 * `gapBefore: true`. Words wider than the line are broken by character. Pure.
 * @returns {{ text: string, gapBefore: boolean }[]}
 */
export function wrapLines(text, maxWidth, measure) {
  const paragraphs = String(text ?? '').split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return paragraphs.flatMap((para, pi) => {
    const lines = [];
    let current = '';
    for (const word of para.split(' ')) {
      const candidate = current ? `${current} ${word}` : word;
      if (measure(candidate) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      const pieces = breakWord(word, maxWidth, measure);
      lines.push(...pieces.slice(0, -1));
      current = pieces[pieces.length - 1];
    }
    if (current) lines.push(current);
    return lines.map((line, li) => ({ text: line, gapBefore: pi > 0 && li === 0 }));
  });
}

/** Split a word into pieces that each fit; the last piece may take more words. */
function breakWord(word, maxWidth, measure) {
  if (measure(word) <= maxWidth) return [word];
  const pieces = [];
  let piece = '';
  for (const ch of word) {
    if (piece && measure(piece + ch) > maxWidth) {
      pieces.push(piece);
      piece = ch;
    } else {
      piece += ch;
    }
  }
  if (piece) pieces.push(piece);
  return pieces;
}

/** Total height of wrapped lines at a font size. Pure. */
export function linesHeight(lines, fontSize) {
  const lineHeight = fontSize * LINE_HEIGHT;
  const gaps = lines.filter((l) => l.gapBefore).length;
  return lines.length * lineHeight + gaps * lineHeight * PARAGRAPH_GAP;
}

/**
 * Largest font size (max → min, 2px steps) at which the story fits the box.
 * At the minimum size, lines that still overflow are dropped and the last kept
 * line gets an ellipsis. Pure.
 * @param {string} text
 * @param {{ width: number, height: number }} box
 * @param {(text: string, fontSize: number) => number} measure
 */
export function fitStory(text, box, measure) {
  for (let size = STORY_FONT_MAX; size >= STORY_FONT_MIN; size -= 2) {
    const lines = wrapLines(text, box.width, (t) => measure(t, size));
    if (linesHeight(lines, size) <= box.height) return { fontSize: size, lines, truncated: false };
  }
  const size = STORY_FONT_MIN;
  const all = wrapLines(text, box.width, (t) => measure(t, size));
  const kept = [];
  for (const line of all) {
    if (linesHeight([...kept, line], size) > box.height) break;
    kept.push(line);
  }
  if (!kept.length) return { fontSize: size, lines: [], truncated: true };
  const last = kept[kept.length - 1];
  let trimmed = last.text;
  while (trimmed && measure(`${trimmed}…`, size) > box.width) trimmed = trimmed.slice(0, -1);
  const lines = [...kept.slice(0, -1), { ...last, text: `${trimmed.trimEnd()}…` }];
  return { fontSize: size, lines, truncated: true };
}

/**
 * Positions for every element of the share image. Pure.
 * @param {string} story
 * @param {(text: string, fontSize: number) => number} measure
 */
export function layoutShareImage(story, measure) {
  const contentWidth = IMAGE_WIDTH - PADDING * 2;
  const logoHeight = 96;
  const header = { logo: { x: PADDING, y: PADDING - 8, height: logoHeight }, title: { x: IMAGE_WIDTH - PADDING, y: PADDING + 58, fontSize: 40 } };
  const gap = 28;
  const tileWidth = (contentWidth - gap * 2) / 3;
  const tileHeight = tileWidth * 7 / 5;
  const labelY = PADDING + logoHeight + 28;
  const tilesY = labelY + 20;
  const tiles = TILE_ORDER.map((t, i) => ({
    ...t,
    x: PADDING + i * (tileWidth + gap),
    y: tilesY,
    width: tileWidth,
    height: tileHeight,
    labelY,
  }));
  const footer = { x: IMAGE_WIDTH / 2, y: IMAGE_HEIGHT - PADDING + 8, fontSize: 30 };
  const storyBox = {
    x: PADDING,
    y: tilesY + tileHeight + 48,
    width: contentWidth,
    height: footer.y - footer.fontSize - 40 - (tilesY + tileHeight + 48),
  };
  return { header, tiles, storyBox, footer, story: fitStory(story, storyBox, measure) };
}

/** Footer text pointing back at single player. Pure. */
export function footerText(origin) {
  const host = String(origin ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `Write yours → ${host}/?solo=1`;
}

// ── Drawing (browser only) ──────────────────────────────────

function font(size, weight = 400) {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

/** Load an image, resolving null on error or timeout rather than rejecting. */
function loadImage(src) {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), IMAGE_TIMEOUT_MS);
    img.crossOrigin = 'anonymous';
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw an image cover-fitted into a rect. */
function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function drawTile(ctx, tile, card, img) {
  const { x, y, width, height } = tile;
  ctx.fillStyle = COLORS[tile.deck];
  ctx.font = font(26, 700);
  ctx.textAlign = 'left';
  ctx.fillText(tile.label.toUpperCase(), x, tile.labelY);

  ctx.save();
  roundRect(ctx, x, y, width, height, 18);
  ctx.clip();
  ctx.fillStyle = COLORS[tile.deck];
  ctx.fillRect(x, y, width, height);
  if (img) {
    drawCover(ctx, img, x, y, width, height);
  } else {
    const inner = width - 36;
    const size = 30;
    const lines = wrapLines(String(card?.title ?? ''), inner, (t) => { ctx.font = font(size, 800); return ctx.measureText(t).width; });
    ctx.fillStyle = '#FFFFFF';
    ctx.font = font(size, 800);
    ctx.textAlign = 'center';
    const lh = size * 1.2;
    const startY = y + height / 2 - (lines.length * lh) / 2 + size;
    lines.slice(0, 8).forEach((line, i) => ctx.fillText(line.text, x + width / 2, startY + i * lh));
  }
  ctx.restore();
  ctx.lineWidth = 4;
  ctx.strokeStyle = COLORS[tile.deck];
  roundRect(ctx, x, y, width, height, 18);
  ctx.stroke();
}

/**
 * Render the share image for a finished solo game.
 * @param {object} solo — needs `picks` and a ready `lifeStory`
 * @param {{ origin: string, logoSrc?: string }} opts
 * @returns {Promise<Blob>} PNG
 */
export async function renderStoryImage(solo, { origin, logoSrc = 'assets/CarkedIt-skull.webp' }) {
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  const measure = (text, size) => { ctx.font = font(size); return ctx.measureText(text).width; };
  const layout = layoutShareImage(solo.lifeStory?.text ?? '', measure);
  const [logo, ...cardImages] = await Promise.all([
    loadImage(logoSrc),
    ...layout.tiles.map((t) => loadImage(solo.picks?.[t.deck]?.image)),
  ]);

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
  ctx.textBaseline = 'alphabetic';

  const { header } = layout;
  let wordmarkX = header.logo.x;
  if (logo) {
    const w = logo.width * (header.logo.height / logo.height);
    ctx.drawImage(logo, header.logo.x - 24, header.logo.y, w, header.logo.height);
    wordmarkX = header.logo.x - 24 + w + 4;
  }
  ctx.fillStyle = COLORS.text;
  ctx.font = font(52, 800);
  ctx.textAlign = 'left';
  ctx.fillText('CarkedIt', wordmarkX, header.title.y + 4);
  ctx.fillStyle = COLORS.muted;
  ctx.font = font(header.title.fontSize, 600);
  ctx.textAlign = 'right';
  ctx.fillText('How I carked it', header.title.x, header.title.y);

  layout.tiles.forEach((tile, i) => drawTile(ctx, tile, solo.picks?.[tile.deck], cardImages[i]));

  const { story, storyBox } = layout;
  const lh = story.fontSize * LINE_HEIGHT;
  ctx.fillStyle = COLORS.text;
  ctx.font = font(story.fontSize);
  ctx.textAlign = 'left';
  let y = storyBox.y + story.fontSize;
  story.lines.forEach((line, i) => {
    if (i > 0) y += lh + (line.gapBefore ? lh * PARAGRAPH_GAP : 0);
    ctx.fillText(line.text, storyBox.x, y);
  });

  ctx.fillStyle = COLORS.accent;
  ctx.font = font(layout.footer.fontSize, 700);
  ctx.textAlign = 'center';
  ctx.fillText(footerText(origin), layout.footer.x, layout.footer.y);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create image'))), 'image/png');
  });
}
