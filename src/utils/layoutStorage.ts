// =============================================================================
// Layout Storage Utility
// =============================================================================
// Persists and restores dashboard grid layouts to/from localStorage.
// Handles serialization errors gracefully — returns null on any failure.
// =============================================================================

import type { ResponsiveLayouts } from 'react-grid-layout';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const STORAGE_KEY = 'dashboard-layout';
const VERSION_KEY = 'dashboard-layout-version';

/**
 * Bump this number whenever DEFAULT_LAYOUTS in DashboardGrid changes.
 * Stale saved layouts with a different version are automatically discarded.
 */
export const LAYOUT_VERSION = 13;

/** Widget keys that every breakpoint must contain for a saved layout to be valid. */
export const REQUIRED_WIDGET_KEYS = [
  'candlestick',
  'orderbook',
  'trades',
  'watchlist',
  'premium',
  'depth',
  'perf',
  'portfolio',
] as const;

// -----------------------------------------------------------------------------
// Functions
// -----------------------------------------------------------------------------

/**
 * Saves responsive grid layouts to localStorage with the current version tag.
 * Silently fails if localStorage is unavailable (e.g., incognito quota exceeded).
 */
export function saveLayout(layouts: ResponsiveLayouts): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
    localStorage.setItem(VERSION_KEY, String(LAYOUT_VERSION));
  } catch (error) {
    console.error('[layoutStorage] Failed to save layout', {
      timestamp: Date.now(),
      error,
    });
  }
}

/**
 * Validates that a single layout item has the required fields with correct types.
 */
export function isValidLayoutItem(item: unknown): boolean {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.i === 'string' &&
    typeof obj.x === 'number' &&
    typeof obj.y === 'number' &&
    typeof obj.w === 'number' &&
    typeof obj.h === 'number'
  );
}

/** Removes stale layout data from localStorage. */
function clearStoredLayout(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(VERSION_KEY);
}

/**
 * Loads responsive grid layouts from localStorage.
 * Returns null if no saved layout exists, if the data is invalid,
 * if the version doesn't match, or if required widget keys are missing.
 * Invalid data is always cleaned up from localStorage.
 */
export function loadLayout(): ResponsiveLayouts | null {
  try {
    if (typeof window === 'undefined') return null;

    // Version mismatch → discard stale layout
    const savedVersion = localStorage.getItem(VERSION_KEY);
    if (savedVersion !== String(LAYOUT_VERSION)) {
      clearStoredLayout();
      return null;
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);

    // Must be a non-null, non-array object
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      clearStoredLayout();
      return null;
    }

    // Validate each breakpoint: must be an array of valid layout items
    const record = parsed as Record<string, unknown>;
    const breakpointKeys = Object.keys(record);
    if (breakpointKeys.length === 0) {
      clearStoredLayout();
      return null;
    }

    for (const key of breakpointKeys) {
      const value = record[key];
      if (!Array.isArray(value) || !value.every(isValidLayoutItem)) {
        clearStoredLayout();
        return null;
      }

      // Validate that each item's key is a known widget key (structural validation).
      // We no longer require ALL widget keys to be present — users may intentionally
      // hide widgets via the widget selector.
      const validKeys = new Set<string>(REQUIRED_WIDGET_KEYS);
      const items = value as Array<{ i: string }>;
      for (const item of items) {
        if (!validKeys.has(item.i)) {
          clearStoredLayout();
          return null;
        }
      }
    }

    return parsed as ResponsiveLayouts;
  } catch (error) {
    try {
      clearStoredLayout();
    } catch {
      // cleanup best-effort
    }
    console.error('[layoutStorage] Failed to load layout', {
      timestamp: Date.now(),
      error,
    });
    return null;
  }
}

// -----------------------------------------------------------------------------
// Layout Change Event
// -----------------------------------------------------------------------------

/** Custom event name dispatched when cloud layout is applied. */
const LAYOUT_CHANGE_EVENT = 'dashboard-layout-change';

/**
 * Saves layout to localStorage AND dispatches a custom event so that
 * already-mounted components (e.g., DashboardGrid) can react to the change.
 * Use this when applying cloud-loaded layout after initial mount.
 */
export function applyCloudLayout(layouts: ResponsiveLayouts): void {
  saveLayout(layouts);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LAYOUT_CHANGE_EVENT, { detail: layouts }));
  }
}

/**
 * Subscribes to cloud-applied layout changes.
 * Returns an unsubscribe function.
 */
export function onCloudLayoutApplied(callback: (layouts: ResponsiveLayouts) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler = (event: Event): void => {
    callback((event as CustomEvent<ResponsiveLayouts>).detail);
  };
  window.addEventListener(LAYOUT_CHANGE_EVENT, handler);
  return () => window.removeEventListener(LAYOUT_CHANGE_EVENT, handler);
}

// -----------------------------------------------------------------------------
// Layout Reset Event
// -----------------------------------------------------------------------------

/** Custom event name dispatched when user requests a layout reset. */
const LAYOUT_RESET_EVENT = 'dashboard-layout-reset';

/**
 * Dispatches a layout reset event. Clears localStorage layout data.
 * DashboardGrid listens for this event to reset layouts to defaults.
 */
export function dispatchLayoutReset(): void {
  clearStoredLayout();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LAYOUT_RESET_EVENT));
  }
}

/**
 * Subscribes to layout reset events.
 * Returns an unsubscribe function.
 */
export function onLayoutReset(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler = (): void => {
    callback();
  };
  window.addEventListener(LAYOUT_RESET_EVENT, handler);
  return () => window.removeEventListener(LAYOUT_RESET_EVENT, handler);
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export { STORAGE_KEY, VERSION_KEY };
