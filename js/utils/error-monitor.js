// error-monitor.js
//
// Generic, framework-agnostic error monitor. No app-specific imports, no DOM
// access, no network calls. Designed to be lifted as-is into a standalone
// issue-reporter package.
//
// Public API:
//   init(options?)        — install window.onerror + unhandledrejection listeners
//                           options.onError?: (entry) => void  (optional hook)
//   notifyError(entry)    — manually push an error (e.g. from a console.error override)
//   subscribe(listener)   — listener(state) called whenever state changes; returns unsubscribe
//   getState()            — { hasError: boolean, errors: Entry[] }
//   clear()               — reset hasError flag and clear ring buffer
//
// Entry shape: { type, message, timestamp, ...arbitrary extras }
'use strict';

const MAX_ENTRIES = 50;
const _errors = [];
const _listeners = new Set();
let _hasError = false;
let _initialized = false;
let _onErrorHook = null;

export function init(options = {}) {
  if (_initialized) return;
  _initialized = true;
  _onErrorHook = typeof options.onError === 'function' ? options.onError : null;

  if (typeof window !== 'undefined') {
    window.addEventListener('error', (e) => {
      notifyError({
        type: 'window.onerror',
        message: e?.message ?? String(e),
        source: e?.filename,
        line: e?.lineno,
        col: e?.colno,
      });
    });

    window.addEventListener('unhandledrejection', (e) => {
      notifyError({
        type: 'unhandledrejection',
        message: String(e?.reason),
      });
    });
  }
}

export function notifyError(entry) {
  const enriched = { ...entry, timestamp: new Date().toISOString() };
  _errors.push(enriched);
  if (_errors.length > MAX_ENTRIES) _errors.shift();

  const wasError = _hasError;
  _hasError = true;

  if (_onErrorHook) {
    try { _onErrorHook(enriched); } catch { /* swallow */ }
  }

  if (!wasError) _emit();
}

export function subscribe(listener) {
  _listeners.add(listener);
  // Fire immediately with current state so subscribers can sync up.
  try { listener(getState()); } catch { /* swallow */ }
  return () => _listeners.delete(listener);
}

export function getState() {
  return { hasError: _hasError, errors: [..._errors] };
}

export function clear() {
  _errors.length = 0;
  if (_hasError) {
    _hasError = false;
    _emit();
  }
}

function _emit() {
  const state = getState();
  for (const l of _listeners) {
    try { l(state); } catch { /* swallow */ }
  }
}
