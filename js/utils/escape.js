// CarkedIt Online — HTML Escape Utility
'use strict';

/**
 * Escapes a string for safe interpolation into HTML.
 * Prevents XSS when inserting user-controlled text (e.g. player names)
 * into innerHTML / template literals.
 *
 * @param {string} str — untrusted string
 * @returns {string} HTML-safe string
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
