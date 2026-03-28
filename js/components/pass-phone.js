// CarkedIt Online — Pass Phone Component
'use strict';

/**
 * Renders the "pass the phone to…" interstitial screen content.
 *
 * @param {object} options
 * @param {string} options.playerName - Name of the player to hand the phone to
 * @param {string} options.onReady - onclick expression for the confirmation button
 * @param {string} [options.subtitle] - Optional subtitle line below the name
 * @returns {string} HTML string
 */
export function render({ playerName, onReady, subtitle = '' }) {
  const subtitleHtml = subtitle
    ? `<p class="pass-phone__subtitle">${subtitle}</p>`
    : '';

  return `
    <div class="pass-phone">
      <div class="pass-phone__message">
        <h2 class="pass-phone__title">Pass the phone to</h2>
        <p class="pass-phone__name">${playerName}</p>
        ${subtitleHtml}
      </div>
      <button class="btn btn--primary" onclick="${onReady}">
        I'm ${playerName}
      </button>
    </div>
  `;
}
