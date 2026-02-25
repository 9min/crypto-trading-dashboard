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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
  } catch (error) {
    console.error('[layoutStorage] Failed to save layout', {
      timestamp: Date.now(),
      error,
    });
  }
}

/**
 * Loads responsive grid layouts from localStorage.
 * Returns null if no saved layout exists or if the data is invalid.
 */
export function loadLayout(): ResponsiveLayouts | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);

    // Basic shape validation: must be a non-null object
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    return parsed as ResponsiveLayouts;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export { STORAGE_KEY };
