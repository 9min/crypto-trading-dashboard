// =============================================================================
// Widget Visibility Storage Utility
// =============================================================================
// Persists and restores which widgets are visible to/from localStorage.
// Handles serialization errors gracefully — returns null on any failure.
// =============================================================================

import { WIDGET_TYPES, type WidgetType } from '@/types/widget';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const STORAGE_KEY = 'dashboard-visible-widgets';
const VERSION_KEY = 'dashboard-visible-widgets-version';
const STORAGE_VERSION = 1;

// -----------------------------------------------------------------------------
// Functions
// -----------------------------------------------------------------------------

/**
 * Saves the list of visible widget types to localStorage.
 * Silently fails if localStorage is unavailable.
 */
export function saveVisibleWidgets(widgets: WidgetType[]): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
    localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION));
  } catch (error) {
    console.error('[widgetStorage] Failed to save visible widgets', {
      timestamp: Date.now(),
      error,
    });
  }
}

/**
 * Loads the list of visible widget types from localStorage.
 * Returns null if no data exists, version mismatches, or data is invalid.
 */
export function loadVisibleWidgets(): WidgetType[] | null {
  try {
    if (typeof window === 'undefined') return null;

    const savedVersion = localStorage.getItem(VERSION_KEY);
    if (savedVersion !== String(STORAGE_VERSION)) {
      clearVisibleWidgets();
      return null;
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      clearVisibleWidgets();
      return null;
    }

    const validTypes = new Set<string>(WIDGET_TYPES);
    const filtered = parsed.filter(
      (item): item is WidgetType => typeof item === 'string' && validTypes.has(item),
    );

    // Must have at least one visible widget
    if (filtered.length === 0) {
      clearVisibleWidgets();
      return null;
    }

    return filtered;
  } catch (error) {
    try {
      clearVisibleWidgets();
    } catch {
      // cleanup best-effort
    }
    console.error('[widgetStorage] Failed to load visible widgets', {
      timestamp: Date.now(),
      error,
    });
    return null;
  }
}

/**
 * Removes stored widget visibility data from localStorage.
 */
export function clearVisibleWidgets(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(VERSION_KEY);
}
