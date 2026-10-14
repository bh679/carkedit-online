import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapLines, fitStory, linesHeight, layoutShareImage, footerText, IMAGE_WIDTH, IMAGE_HEIGHT, STORY_FONT_MAX, STORY_FONT_MIN } from './story-image.js';

// Monospace stand-in: every character is half the font size wide.
const mono = (text, size = 20) => text.length * size * 0.5;

test('wrapLines wraps words to the width and marks paragraph gaps', () => {
  const lines = wrapLines('aaa bbb ccc\n\nddd', 70, (t) => mono(t));
  assert.deepEqual(lines, [
    { text: 'aaa bbb', gapBefore: false },
    { text: 'ccc', gapBefore: false },
    { text: 'ddd', gapBefore: true },
  ]);
});

test('wrapLines breaks a word wider than the line', () => {
  const lines = wrapLines('hi abcdefghij ok', 40, (t) => mono(t));
  assert.deepEqual(lines.map((l) => l.text), ['hi', 'abcd', 'efgh', 'ij', 'ok']);
  assert.ok(lines.every((l) => mono(l.text) <= 40));
});

test('wrapLines handles empty and whitespace-only text', () => {
  assert.deepEqual(wrapLines('', 100, mono), []);
  assert.deepEqual(wrapLines('  \n\n ', 100, mono), []);
});

test('fitStory uses the largest size that fits', () => {
  const fit = fitStory('short story', { width: 900, height: 600 }, mono);
  assert.equal(fit.fontSize, STORY_FONT_MAX);
  assert.equal(fit.truncated, false);
});

test('fitStory shrinks a long story and stays inside the box', () => {
  const story = Array.from({ length: 200 }, () => 'word').join(' ');
  const box = { width: 900, height: 600 };
  const fit = fitStory(story, box, mono);
  assert.ok(fit.fontSize < STORY_FONT_MAX && fit.fontSize >= STORY_FONT_MIN);
  assert.ok(linesHeight(fit.lines, fit.fontSize) <= box.height);
  assert.equal(fit.truncated, false);
});

test('fitStory truncates with an ellipsis at the minimum size', () => {
  const story = Array.from({ length: 2000 }, () => 'word').join(' ');
  const box = { width: 900, height: 300 };
  const fit = fitStory(story, box, mono);
  assert.equal(fit.fontSize, STORY_FONT_MIN);
  assert.equal(fit.truncated, true);
  assert.ok(fit.lines.at(-1).text.endsWith('…'));
  assert.ok(linesHeight(fit.lines, fit.fontSize) <= box.height);
  assert.ok(fit.lines.every((l) => mono(l.text, STORY_FONT_MIN) <= box.width));
});

test('layoutShareImage keeps everything on the canvas in order', () => {
  const layout = layoutShareImage('You lived.\n\nYou died.', mono);
  assert.deepEqual(layout.tiles.map((t) => t.deck), ['live', 'die', 'bye']);
  const last = layout.tiles.at(-1);
  assert.ok(last.x + last.width <= IMAGE_WIDTH);
  assert.ok(layout.storyBox.y > last.y + last.height);
  assert.ok(layout.storyBox.y + layout.storyBox.height < layout.footer.y);
  assert.ok(layout.footer.y <= IMAGE_HEIGHT);
  assert.equal(layout.story.lines.length, 2);
});

test('footerText strips the scheme and points at the solo link', () => {
  assert.equal(footerText('https://play.carkedit.com/'), 'Write yours → play.carkedit.com/?solo=1');
  assert.equal(footerText('http://localhost:4600'), 'Write yours → localhost:4600/?solo=1');
});
