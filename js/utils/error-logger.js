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

export function clearErrorState() {
  errorMonitor.clear();
}

export function subscribeErrorState(listener) {
  return errorMonitor.subscribe(listener);
}
