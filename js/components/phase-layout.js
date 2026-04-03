// CarkedIt Online — Phase Layout Component
'use strict';

import { render as renderPhaseHeader } from './phase-header.js';
import { render as renderPlayerList } from './player-list.js';

/**
 * Renders the standard phase screen wrapper used by all game phases.
 * Provides consistent structure: header → player list → children.
 *
 * @param {object} options
 * @param {string} options.phase - Phase number string ('1', '2', '3', '4')
 * @param {string} options.label - Phase label (e.g. 'Phase 1 - DIE')
 * @param {Array} options.players - Player array from state
 * @param {object} [options.playerListOptions={}] - Options for renderPlayerList
 * @param {string} options.children - Inner HTML content unique to this screen
 * @returns {string} HTML string
 */
export function render({ phase, label, players, playerListOptions = {}, children, roundLabel = '' }) {
  const fullLabel = roundLabel ? `${label} - ${roundLabel}` : label;
  return `
    <div class="screen screen--phase" data-phase="${phase}">
      ${renderPhaseHeader({ phase, label: fullLabel })}
      ${renderPlayerList(players, playerListOptions)}
      ${children}
    </div>
  `;
}
