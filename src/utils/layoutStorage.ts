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

// -----------------------------------------------------------------------------
// Functions
// -----------------------------------------------------------------------------

/**
 * Saves responsive grid layouts to localStorage.
 * Silently fails if localStorage is unavailable (e.g., incognito quota exceeded).
 */
export function saveLayout(layouts: ResponsiveLayouts): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
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

/**
 * Loads responsive grid layouts from localStorage.
 * Returns null if no saved layout exists or if the data is invalid.
 * Validates each breakpoint is an array of items with required fields (i/x/y/w/h).
 */
export function loadLayout(): ResponsiveLayouts | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);

    // Must be a non-null, non-array object
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    // Validate each breakpoint: must be an array of valid layout items
    const record = parsed as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const value = record[key];
      if (!Array.isArray(value)) return null;
      if (!value.every(isValidLayoutItem)) return null;
    }

    return parsed as ResponsiveLayouts;
  } catch (error) {
    console.error('[layoutStorage] Failed to load layout', {
      timestamp: Date.now(),
      error,
    });
    return null;
  }
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export { STORAGE_KEY };
