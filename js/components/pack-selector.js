'use strict';

// Sentinel "base" pack — counts must match carkedit-api/src/data/cards.ts
const BASE_PACK = {
  id: 'base',
  title: 'CarkedIt (Base Game)',
  card_count: 184,
  die_count: 48,
  live_count: 68,
  bye_count: 68,
  isBase: true,
};

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderItem(pack, on, isHost) {
  const title = escapeHtml(pack.title);
  const count = Number(pack.card_count ?? 0);
  const control = isHost
    ? `<button class="btn btn--small pack-selector__toggle ${on ? 'btn--active' : ''}"
               onclick="window.game.togglePack('${escapeHtml(pack.id)}')">
         ${on ? 'On' : 'Off'}
       </button>`
    : `<span class="pack-selector__tag">${on ? 'Selected' : ''}</span>`;
  return `
    <div class="pack-selector__item ${on ? 'is-selected' : ''} ${pack.isBase ? 'is-base' : ''}">
      <div class="pack-selector__info">
        <span class="pack-selector__title">${title}</span>
        <span class="pack-selector__meta">${count} card${count === 1 ? '' : 's'}</span>
      </div>
      ${control}
    </div>
  `;
}

/**
 * Render the expansion pack selector for the online lobby.
 * Host sees toggle buttons; non-hosts see a read-only list of selected packs.
 */
export function render(state, { isHost } = { isHost: false }) {
  const expansionPacks = state.availablePacks || [];
  const selected = new Set(state.selectedPackIds || []);
  const allPacks = [BASE_PACK, ...expansionPacks];

  // Compute per-deck totals for currently-selected packs
  let dieTotal = 0, liveTotal = 0, byeTotal = 0;
  for (const p of allPacks) {
    if (!selected.has(p.id)) continue;
    dieTotal += Number(p.die_count ?? 0);
    liveTotal += Number(p.live_count ?? 0);
    byeTotal += Number(p.bye_count ?? 0);
  }

  const totalsHeader = `
    <div class="pack-selector__totals">
      <span class="pack-selector__total pack-selector__total--die">Die: ${dieTotal}</span>
      <span class="pack-selector__total pack-selector__total--live">Live: ${liveTotal}</span>
      <span class="pack-selector__total pack-selector__total--bye">Bye: ${byeTotal}</span>
    </div>
  `;

  // Non-host view: show only selected packs (read-only)
  if (!isHost) {
    const visible = allPacks.filter((p) => selected.has(p.id));
    const items = visible.length === 0
      ? `<div class="pack-selector__empty">No packs selected.</div>`
      : visible.map((p) => renderItem(p, true, false)).join('');
    return `<div class="pack-selector">${totalsHeader}${items}</div>`;
  }

  // Host view: full list with toggles
  const items = allPacks.map((p) => renderItem(p, selected.has(p.id), true)).join('');
  return `<div class="pack-selector">${totalsHeader}${items}</div>`;
}
