// =============================================================================
// useMobileBreakpoint Hook
// =============================================================================
// SSR-safe hook that detects whether the viewport is below 768px (mobile).
// Uses `useSyncExternalStore` with `matchMedia` to avoid hydration mismatches
// and only re-render when the breakpoint threshold is actually crossed.
// =============================================================================

import { useSyncExternalStore } from 'react';

// -----------------------------------------------------------------------------
// matchMedia subscription (stable references)
// -----------------------------------------------------------------------------

const MOBILE_QUERY = '(max-width: 767px)';

let mediaQueryList: MediaQueryList | null = null;

function getMediaQueryList(): MediaQueryList {
  if (!mediaQueryList) {
    mediaQueryList = window.matchMedia(MOBILE_QUERY);
  }
  return mediaQueryList;
}

function subscribe(callback: () => void): () => void {
  const mql = getMediaQueryList();
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
  return getMediaQueryList().matches;
}

function getServerSnapshot(): boolean {
  return false;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Returns `true` when the viewport width is below 768px.
 * Returns `false` on the server to avoid hydration mismatch.
 */
export function useMobileBreakpoint(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
