// CarkedIt Online — Share your life story
//
// Overlay opened from the single-player Your Life Story screen. Shows the
// generated image, offers the OS share sheet (with the image) where the browser
// supports sharing files, a download, and quick links to post on socials.
// Social intent URLs can't carry an image, so they share text + the solo link.
//
// Reuses the invite panel's `share-panel__*` styles. Mounted on document.body by
// the router so it survives screen re-renders.
'use strict';

import { escapeHtml } from '../utils/escape.js';

export const SHARE_TEXT = 'This is how I carked it. Write your own life story on CarkedIt:';

/**
 * Social share-intent URLs for the given text and link. Pure.
 * @param {string} text
 * @param {string} url
 * @returns {{ id: string, label: string, href: string }[]}
 */
export function buildSocialLinks(text, url) {
  const t = encodeURIComponent(text);
  const u = encodeURIComponent(url);
  return [
    { id: 'x', label: 'X', href: `https://x.com/intent/post?text=${t}&url=${u}` },
    { id: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { id: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
    { id: 'reddit', label: 'Reddit', href: `https://www.reddit.com/submit?url=${u}&title=${t}` },
  ];
}

/**
 * Overlay markup. Pure string renderer.
 * @param {object} opts
 * @param {string} opts.previewUrl — object URL of the generated PNG
 * @param {boolean} opts.canShareFiles — offer the OS share sheet with the image
 * @param {{ id: string, label: string, href: string }[]} opts.links
 * @returns {string}
 */
export function renderStorySharePanel({ previewUrl, canShareFiles, links }) {
  const shareBtn = canShareFiles
    ? `<button class="btn btn--primary story-share__native" onclick="window.game.soloShareImage()">Share image</button>`
    : '';
  const socials = (links ?? []).map((l) => `
    <a class="btn btn--secondary story-share__social story-share__social--${escapeHtml(l.id)}"
       href="${escapeHtml(l.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}</a>
  `).join('');

  return `
    <div class="share-panel__overlay" onclick="window.game.closeStoryShare()">
      <div class="share-panel__panel story-share__panel" onclick="event.stopPropagation()" role="dialog" aria-label="Share your life story">
        <div class="share-panel__header">
          <h2 class="share-panel__title">Share Your Story</h2>
          <button class="share-panel__close" aria-label="Close" onclick="window.game.closeStoryShare()">✕</button>
        </div>
        <div class="share-panel__body">
          <img class="story-share__preview" src="${escapeHtml(previewUrl)}" alt="Your life story as an image: your three cards and the story">
        </div>
        <div class="share-panel__actions story-share__actions">
          ${shareBtn}
          <button class="btn ${canShareFiles ? 'btn--secondary' : 'btn--primary'} story-share__download" onclick="window.game.soloDownloadImage()">Download image</button>
        </div>
        <p class="story-share__socials-label">Post to</p>
        <div class="story-share__socials">${socials}</div>
      </div>
    </div>
  `;
}
