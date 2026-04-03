// CarkedIt Online — Error Logger (ring buffer for issue reports)
'use strict';

const MAX_ENTRIES = 50;
const _errorLog = [];
let _initialized = false;

export function initErrorLogger() {
  if (_initialized) return;
  _initialized = true;

  const originalError = console.error;
  console.error = function (...args) {
    _push({ type: 'console.error', message: args.map(String).join(' ') });
    originalError.apply(console, args);
  };

  window.addEventListener('error', (e) => {
    _push({
      type: 'window.onerror',
      message: e.message,
      source: e.filename,
      line: e.lineno,
      col: e.colno,
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    _push({
      type: 'unhandledrejection',
      message: String(e.reason),
    });
  });
}

function _push(entry) {
  entry.timestamp = new Date().toISOString();
  _errorLog.push(entry);
  if (_errorLog.length > MAX_ENTRIES) _errorLog.shift();
}

export function getErrorLog() {
  return [..._errorLog];
}
