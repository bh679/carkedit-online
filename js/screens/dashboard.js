// CarkedIt Online — Dashboard Screen
'use strict';

import { getGameHistory, syncWithServer } from '../managers/game-history.js';

/**
 * Format a relative time string from an ISO date.
 * @param {string} isoDate
 * @returns {string}
 */
function timeAgo(isoDate) {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(isoDate).toLocaleDateString();
}

/**
 * Render a single game card.
 * @param {object} game
 * @param {number} index
 * @returns {string} HTML
 */
function renderGameCard(game, index) {
  const players = game.players || [];
  const modeLabel = game.mode === 'online' ? 'Online' : 'Local';
  const modeBadgeClass = game.mode === 'online' ? 'dashboard__badge--online' : 'dashboard__badge--local';

  return `
    <div class="dashboard__game" onclick="window.game.toggleGameDetail(${index})">
      <div class="dashboard__game-header">
        <div class="dashboard__game-meta">
          <span class="dashboard__badge ${modeBadgeClass}">${modeLabel}</span>
          <span class="dashboard__time">${timeAgo(game.finishedAt)}</span>
        </div>
        <div class="dashboard__game-winner">
          <span class="dashboard__winner-name">${game.winnerName}</span>
          <span class="dashboard__winner-score">${game.winnerScore} pts</span>
        </div>
      </div>
      <div class="dashboard__game-detail" id="game-detail-${index}" style="display:none;">
        <div class="dashboard__players-list">
          ${players.map((p) => `
            <div class="dashboard__player-row">
              <span class="dashboard__player-rank">#${p.rank}</span>
              <span class="dashboard__player-name">${p.name}</span>
              <span class="dashboard__player-score">${p.score} pts</span>
            </div>
          `).join('')}
        </div>
        <div class="dashboard__game-info">
          ${game.rounds ? `<span>${game.rounds} round${game.rounds !== 1 ? 's' : ''}</span>` : ''}
          <span>${players.length} player${players.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * @param {object} state
 * @returns {string} HTML string
 */
export function render(state) {
  const history = getGameHistory();
  const totalGames = history.length;
  const totalOnline = history.filter((g) => g.mode === 'online').length;
  const totalLocal = totalGames - totalOnline;

  // Trigger background sync
  syncWithServer().then(() => {
    // Re-render game list if new data arrived
    const listEl = document.getElementById('dashboard-game-list');
    if (listEl) {
      const updated = getGameHistory();
      if (updated.length !== totalGames) {
        listEl.innerHTML = updated.map(renderGameCard).join('');
        const countEl = document.getElementById('dashboard-total');
        if (countEl) countEl.textContent = updated.length;
      }
    }
  });

  const emptyState = totalGames === 0 ? `
    <div class="dashboard__empty">
      <p class="dashboard__empty-text">No games played yet.</p>
      <p class="dashboard__empty-hint">Play a game and your results will appear here!</p>
    </div>
  ` : '';

  const gameList = history.map(renderGameCard).join('');

  return `
    <div class="screen screen--dashboard">
      <div class="dashboard__header">
        <button class="dashboard__back-btn" onclick="window.game.showScreen('menu')" aria-label="Back to menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1 class="dashboard__title">Game History</h1>
      </div>

      <div class="dashboard__stats">
        <div class="dashboard__stat">
          <span class="dashboard__stat-value" id="dashboard-total">${totalGames}</span>
          <span class="dashboard__stat-label">Games</span>
        </div>
        <div class="dashboard__stat">
          <span class="dashboard__stat-value">${totalOnline}</span>
          <span class="dashboard__stat-label">Online</span>
        </div>
        <div class="dashboard__stat">
          <span class="dashboard__stat-value">${totalLocal}</span>
          <span class="dashboard__stat-label">Local</span>
        </div>
      </div>

      ${emptyState}

      <div class="dashboard__game-list" id="dashboard-game-list">
        ${gameList}
      </div>
    </div>
  `;
}
