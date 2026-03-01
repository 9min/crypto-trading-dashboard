// =============================================================================
// Multi-Chart Store
// =============================================================================
// Manages multi-chart widget state: layout mode, panel configurations,
// and synchronization settings. Persisted to localStorage.
// =============================================================================

import { create } from 'zustand';
import type { MultiChartLayout, ChartPanelConfig, MultiChartStore } from '@/types/multiChart';
import type { KlineInterval } from '@/types/chart';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const STORAGE_KEY = 'dashboard-multichart';

const DEFAULT_PANELS: ChartPanelConfig[] = [
  { id: 'panel-1', symbol: 'BTCUSDT', interval: '1m' },
  { id: 'panel-2', symbol: 'ETHUSDT', interval: '1m' },
];

const EXTRA_PANELS: ChartPanelConfig[] = [
  { id: 'panel-3', symbol: 'BNBUSDT', interval: '1m' },
  { id: 'panel-4', symbol: 'SOLUSDT', interval: '1m' },
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getPanelCountForLayout(layout: MultiChartLayout): number {
  return layout === '2x2' ? 4 : 2;
}

function persist(state: {
  layout: MultiChartLayout;
  panels: ChartPanelConfig[];
  crosshairSync: boolean;
  intervalSync: boolean;
}): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

function loadPersistedState(): Partial<{
  layout: MultiChartLayout;
  panels: ChartPanelConfig[];
  crosshairSync: boolean;
  intervalSync: boolean;
}> | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

    const obj = parsed as Record<string, unknown>;

    // Validate layout
    if (obj.layout !== '2x1' && obj.layout !== '1x2' && obj.layout !== '2x2') return null;

    // Validate panels
    if (!Array.isArray(obj.panels) || obj.panels.length < 2) return null;
    for (const panel of obj.panels) {
      if (
        typeof panel !== 'object' ||
        panel === null ||
        typeof (panel as Record<string, unknown>).id !== 'string' ||
        typeof (panel as Record<string, unknown>).symbol !== 'string' ||
        typeof (panel as Record<string, unknown>).interval !== 'string'
      ) {
        return null;
      }
    }

    return {
      layout: obj.layout as MultiChartLayout,
      panels: obj.panels as ChartPanelConfig[],
      crosshairSync: typeof obj.crosshairSync === 'boolean' ? obj.crosshairSync : true,
      intervalSync: typeof obj.intervalSync === 'boolean' ? obj.intervalSync : true,
    };
  } catch {
    return null;
  }
}

function getInitialState(): {
  layout: MultiChartLayout;
  panels: ChartPanelConfig[];
  crosshairSync: boolean;
  intervalSync: boolean;
} {
  const saved = loadPersistedState();
  if (saved && saved.layout && saved.panels) {
    return {
      layout: saved.layout,
      panels: saved.panels,
      crosshairSync: saved.crosshairSync ?? true,
      intervalSync: saved.intervalSync ?? true,
    };
  }
  return {
    layout: '2x1',
    panels: [...DEFAULT_PANELS],
    crosshairSync: true,
    intervalSync: true,
  };
}

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

const initialState = getInitialState();

export const useMultiChartStore = create<MultiChartStore>()((set) => ({
  // -- State ------------------------------------------------------------------
  layout: initialState.layout,
  panels: initialState.panels,
  crosshairSync: initialState.crosshairSync,
  intervalSync: initialState.intervalSync,

  // -- Actions ----------------------------------------------------------------

  setLayout: (layout: MultiChartLayout): void => {
    set((state) => {
      const targetCount = getPanelCountForLayout(layout);
      let nextPanels = [...state.panels];

      if (nextPanels.length < targetCount) {
        // Add extra panels to reach target count
        const existingIds = new Set(nextPanels.map((p) => p.id));
        for (const extra of EXTRA_PANELS) {
          if (nextPanels.length >= targetCount) break;
          if (!existingIds.has(extra.id)) {
            nextPanels.push({ ...extra });
          }
        }
      } else if (nextPanels.length > targetCount) {
        // Trim to target count
        nextPanels = nextPanels.slice(0, targetCount);
      }

      const next = {
        layout,
        panels: nextPanels,
        crosshairSync: state.crosshairSync,
        intervalSync: state.intervalSync,
      };
      persist(next);
      return { layout, panels: nextPanels };
    });
  },

  setPanelSymbol: (panelId: string, symbol: string): void => {
    set((state) => {
      const nextPanels = state.panels.map((p) => (p.id === panelId ? { ...p, symbol } : p));
      const next = {
        layout: state.layout,
        panels: nextPanels,
        crosshairSync: state.crosshairSync,
        intervalSync: state.intervalSync,
      };
      persist(next);
      return { panels: nextPanels };
    });
  },

  setPanelInterval: (panelId: string, interval: KlineInterval): void => {
    set((state) => {
      const nextPanels = state.intervalSync
        ? state.panels.map((p) => ({ ...p, interval }))
        : state.panels.map((p) => (p.id === panelId ? { ...p, interval } : p));
      const next = {
        layout: state.layout,
        panels: nextPanels,
        crosshairSync: state.crosshairSync,
        intervalSync: state.intervalSync,
      };
      persist(next);
      return { panels: nextPanels };
    });
  },

  toggleCrosshairSync: (): void => {
    set((state) => {
      const crosshairSync = !state.crosshairSync;
      const next = {
        layout: state.layout,
        panels: state.panels,
        crosshairSync,
        intervalSync: state.intervalSync,
      };
      persist(next);
      return { crosshairSync };
    });
  },

  toggleIntervalSync: (): void => {
    set((state) => {
      const intervalSync = !state.intervalSync;
      const next = {
        layout: state.layout,
        panels: state.panels,
        crosshairSync: state.crosshairSync,
        intervalSync,
      };
      persist(next);
      return { intervalSync };
    });
  },

  reset: (): void => {
    const defaults = {
      layout: '2x1' as const,
      panels: [...DEFAULT_PANELS],
      crosshairSync: true,
      intervalSync: true,
    };
    persist(defaults);
    set(defaults);
  },
}));

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export { STORAGE_KEY, DEFAULT_PANELS, EXTRA_PANELS };
