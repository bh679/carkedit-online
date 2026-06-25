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
//   markBoundary()        — record "now" as a relevance boundary; errors captured
//                           after it are tagged relevant=true, earlier ones false
//   getTaggedErrors()     — buffer copy with a `relevant` flag per entry
//   clear()               — reset hasError flag, ring buffer, and boundary
//
// Entry shape: { type, message, timestamp, ...arbitrary extras }
'use strict';

const MAX_ENTRIES = 50;
const _errors = [];
const _listeners = new Set();
let _hasError = false;
let _initialized = false;
let _onErrorHook = null;
// ISO timestamp marking the start of the "current" context (e.g. a game). Errors
// with a timestamp >= this are considered relevant to it; earlier ones are stale.
let _boundaryTs = null;

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

// Mark the present moment as the relevance boundary. Call this when a new context
// of interest begins (e.g. a game starts) so a later report can distinguish errors
// from this context from stale ones left over earlier in the page session.
export function markBoundary() {
  _boundaryTs = new Date().toISOString();
}

// Buffer copy where each entry gains a `relevant` flag: true when it was captured
// at/after the last markBoundary() (or when no boundary has been set), false when
// it predates the boundary.
export function getTaggedErrors() {
  return _errors.map((e) => ({
    ...e,
    relevant: !_boundaryTs || (typeof e.timestamp === 'string' && e.timestamp >= _boundaryTs),
  }));
}

export function clear() {
  _errors.length = 0;
  _boundaryTs = null;
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
