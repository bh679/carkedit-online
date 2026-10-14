// CarkedIt Online — Error Logger (adapter around generic error-monitor)
'use strict';

import * as errorMonitor from './error-monitor.js';

let _consoleHooked = false;

export function initErrorLogger() {
  errorMonitor.init();

  if (!_consoleHooked) {
    _consoleHooked = true;
    const originalError = console.error;
    console.error = function (...args) {
      errorMonitor.notifyError({
        type: 'console.error',
        message: args.map(String).join(' '),
      });
      originalError.apply(console, args);
    };
  }
}

export function getErrorLog() {
  return errorMonitor.getState().errors;
}

// Captured errors, each tagged with a `relevant` flag relative to the last
// markErrorContext() call (errors before it are stale / likely unrelated).
export function getTaggedErrorLog() {
  return errorMonitor.getTaggedErrors();
}

// Mark "now" as the start of the current game/context so later reports can
// separate this game's errors from stale ones earlier in the page session.
export function markErrorContext() {
  errorMonitor.markBoundary();
}

export function clearErrorState() {
  errorMonitor.clear();
}

export function subscribeErrorState(listener) {
  return errorMonitor.subscribe(listener);
}
