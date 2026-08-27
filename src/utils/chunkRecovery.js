/**
 * Recovery for "stale chunk" errors: a dynamically-imported JS chunk fails to load (usually a
 * 404) because a browser tab has an older index.html open - referencing hashed chunk filenames
 * from a deployment that has since been replaced - across a new deployment going live. The fix
 * is simply to reload so the browser re-fetches the current index.html (already served with
 * Cache-Control: no-cache/no-store - see firebase.json) and its current chunk references. That
 * reload must be bounded (a genuinely missing/broken chunk must not reload forever) and must
 * never surface the raw error/stack trace to the user while it happens.
 *
 * Two independent call sites share the one bounded budget below:
 *  - the global `vite:preloadError` listener (main.jsx) - Vite's own documented hook for this
 *    exact problem, fires for every failed dynamic import, whether it came from React.lazy() or
 *    a bare import() call, so it is the single global catch-all across the whole app.
 *  - the top-level ErrorBoundary (main.jsx) - a backup path, in case an error reaches a
 *    component's render cycle without (or before) the preloadError event being handled.
 */

const STORAGE_KEY = 'aiprep_chunk_reload_attempts';
const MAX_ATTEMPTS = 2;
// Attempts more than this far apart are treated as a fresh problem, not a loop, and reset the count.
const EPISODE_WINDOW_MS = 60000;

// Per-page-load guard (not persisted) - both call sites above can fire for the same underlying
// failure, but only one of them should actually issue the reload() call.
let reloadedThisPageLoad = false;

export function isChunkLoadError(error) {
  const msg = (error?.message || error?.toString?.() || '').toLowerCase();
  return (
    error?.name === 'ChunkLoadError' ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('importing a module script failed')
  );
}

function claimAttempt() {
  let state = null;
  try {
    state = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    state = null;
  }
  const now = Date.now();
  const count = state && (now - state.time) < EPISODE_WINDOW_MS ? state.count : 0;
  if (count >= MAX_ATTEMPTS) return false;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ count: count + 1, time: now }));
  } catch {
    // sessionStorage unavailable (e.g. private browsing) - allow the reload anyway, just without
    // a cross-reload loop counter for this session.
  }
  return true;
}

/**
 * Attempts a bounded, single-per-page-load reload to pick up the latest deployed version.
 * Returns true if a reload was (or already has been) triggered this page load, false if the
 * retry budget is exhausted - the caller should show a manual "please refresh" fallback instead
 * of reloading again.
 */
export function attemptChunkRecovery() {
  if (reloadedThisPageLoad) return true;
  if (!claimAttempt()) return false;
  reloadedThisPageLoad = true;
  window.location.reload();
  return true;
}
