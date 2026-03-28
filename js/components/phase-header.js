// CarkedIt Online — Phase Header Component
'use strict';

const SETTINGS_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M8 3.5C8 3.5 9.5 2 11 2C12.5 2 14 3.5 14 5C14 6.5 12.5 8 11 8" stroke="#374151" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M8 12.5C8 12.5 6.5 14 5 14C3.5 14 2 12.5 2 11C2 9.5 3.5 8 5 8" stroke="#374151" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M11 8H5" stroke="#374151" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

/**
 * @param {{ phase: string, label: string }} options
 * @returns {string} HTML string
 */
export function render({ phase = '', label = '' } = {}) {
  return `
    <header class="phase-header" data-phase="${phase}">
      <div class="phase-header__left">
        <span class="phase-header__app-name">CarkedIt</span>
        <span class="phase-header__phase-label">${label}</span>
      </div>
      <button class="phase-header__settings-btn" aria-label="Settings">
        ${SETTINGS_ICON}
      </button>
    </header>
  `;
}
