// CarkedIt Online — HTML Escape Utility
'use strict';

/**
 * Escapes a string for safe interpolation into HTML — text content AND
 * attribute values. The previous textContent/innerHTML round-trip only
 * escaped <, >, &, leaving " and ' literal. That broke onclick handlers
 * like onclick="...selectEulogist(${escapeHtml(JSON.stringify(name))})..."
 * because JSON.stringify wraps in literal " that closed the attribute.
 *
 * @param {string} str — untrusted string
 * @returns {string} HTML-safe string
 */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
