import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  groupHasMultipleSubStates,
  renderGameFilters,
  renderStatusChips,
  STATUS_GROUP_ORDER,
  STATUS_GROUP_LABELS,
} from './game-filters.js';

test('groupHasMultipleSubStates: lobby has one effective member (empty-string filtered out)', () => {
  assert.equal(groupHasMultipleSubStates('lobby'), false);
});

test('groupHasMultipleSubStates: die has multiple sub-states', () => {
  assert.equal(groupHasMultipleSubStates('die'), true);
});

test('groupHasMultipleSubStates: living has multiple sub-states', () => {
  assert.equal(groupHasMultipleSubStates('living'), true);
});

test('groupHasMultipleSubStates: bye has multiple sub-states', () => {
  assert.equal(groupHasMultipleSubStates('bye'), true);
});

test('groupHasMultipleSubStates: eulogy has multiple sub-states', () => {
  assert.equal(groupHasMultipleSubStates('eulogy'), true);
});

test('groupHasMultipleSubStates: finished has multiple sub-states', () => {
  assert.equal(groupHasMultipleSubStates('finished'), true);
});

test('groupHasMultipleSubStates: other has a single member (abandoned)', () => {
  assert.equal(groupHasMultipleSubStates('other'), false);
});

test('groupHasMultipleSubStates: unknown group string returns false', () => {
  assert.equal(groupHasMultipleSubStates('not-a-real-group'), false);
});

test('renderStatusChips: renders a toggleHideGroup chip for every group in STATUS_GROUP_ORDER', () => {
  const html = renderStatusChips({ filterCounts: {} }, 'testNS');
  for (const g of STATUS_GROUP_ORDER) {
    assert.ok(
      html.includes(`window.testNS.toggleHideGroup('${g}')`),
      `expected toggleHideGroup chip for "${g}" in output`,
    );
    assert.ok(
      html.includes(STATUS_GROUP_LABELS[g]),
      `expected label "${STATUS_GROUP_LABELS[g]}" for group "${g}" in output`,
    );
  }
});

test('renderStatusChips: expand chevron present for multi-sub-state groups', () => {
  const html = renderStatusChips({ filterCounts: {} }, 'testNS');
  for (const g of ['die', 'living', 'bye', 'eulogy', 'finished']) {
    assert.ok(
      html.includes(`window.testNS.toggleExpandGroup('${g}')`),
      `expected toggleExpandGroup handler for "${g}"`,
    );
  }
  // dashboard__chip--expand should appear once per expandable group (5).
  const matches = html.match(/dashboard__chip--expand/g) || [];
  assert.equal(matches.length, 5, `expected 5 expand chips, got ${matches.length}`);
});

test('renderStatusChips: expand chevron absent for single-sub-state groups (lobby, other) — regression lock', () => {
  const html = renderStatusChips({ filterCounts: {} }, 'testNS');
  assert.ok(
    !html.includes(`window.testNS.toggleExpandGroup('lobby')`),
    'lobby must not render an expand chevron',
  );
  assert.ok(
    !html.includes(`window.testNS.toggleExpandGroup('other')`),
    'other must not render an expand chevron',
  );
});

test('renderGameFilters: button labels come from the internal label maps', () => {
  const state = {
    filterStatus: 'all',
    filterDev: 'all',
    filterDateRange: 'all',
    filterErrorsOnly: false,
    filterCounts: {},
  };
  const html = renderGameFilters(state, 'testNS');
  assert.ok(html.includes('All Time'),   'expected "All Time" date label');
  assert.ok(html.includes('Errors'),     'expected "Errors" label');
  assert.ok(html.includes('With Dev'),   'expected "With Dev" label');
  assert.ok(html.includes('All Status'), 'expected "All Status" label');
});
