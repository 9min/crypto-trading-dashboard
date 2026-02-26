// =============================================================================
// Widget Store
// =============================================================================
// Manages which dashboard widgets are currently visible. Persists visibility
// state to localStorage via widgetStorage utility.
// =============================================================================

import { create } from 'zustand';
import { WIDGET_TYPES, type WidgetType } from '@/types/widget';
import { saveVisibleWidgets, loadVisibleWidgets, clearVisibleWidgets } from '@/utils/widgetStorage';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface WidgetStoreState {
  /** Set of currently visible widget types */
  visibleWidgets: Set<WidgetType>;
  /** Whether the store has been hydrated from localStorage */
  isHydrated: boolean;
}

interface WidgetStoreActions {
  /** Hide a widget (remove from visible set). At least 1 widget must remain. */
  hideWidget: (type: WidgetType) => void;
  /** Show a widget (add to visible set). */
  showWidget: (type: WidgetType) => void;
  /** Reset to all widgets visible and clear persisted state. */
  resetWidgets: () => void;
  /** Hydrate visible widgets from localStorage after mount (SSR-safe). */
  hydrateWidgets: () => void;
}

type WidgetStore = WidgetStoreState & WidgetStoreActions;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function allWidgetsSet(): Set<WidgetType> {
  return new Set<WidgetType>(WIDGET_TYPES);
}

function persistSet(widgetSet: Set<WidgetType>): void {
  saveVisibleWidgets([...widgetSet]);
}

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useWidgetStore = create<WidgetStore>()((set) => ({
  // -- State ------------------------------------------------------------------
  visibleWidgets: allWidgetsSet(),
  isHydrated: false,

  // -- Actions ----------------------------------------------------------------
  hideWidget: (type: WidgetType): void => {
    set((state) => {
      // Must keep at least 1 widget visible
      if (state.visibleWidgets.size <= 1) return state;
      if (!state.visibleWidgets.has(type)) return state;

      const next = new Set(state.visibleWidgets);
      next.delete(type);
      persistSet(next);
      return { visibleWidgets: next };
    });
  },

  showWidget: (type: WidgetType): void => {
    set((state) => {
      if (state.visibleWidgets.has(type)) return state;

      const next = new Set(state.visibleWidgets);
      next.add(type);
      persistSet(next);
      return { visibleWidgets: next };
    });
  },

  resetWidgets: (): void => {
    clearVisibleWidgets();
    set({ visibleWidgets: allWidgetsSet() });
  },

  hydrateWidgets: (): void => {
    const saved = loadVisibleWidgets();
    if (saved) {
      set({ visibleWidgets: new Set<WidgetType>(saved), isHydrated: true });
    } else {
      set({ isHydrated: true });
    }
  },
}));

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export type { WidgetStoreState, WidgetStoreActions, WidgetStore };
