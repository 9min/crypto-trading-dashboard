// =============================================================================
// UI Store
// =============================================================================
// Manages global UI state: theme, active symbol, WebSocket connection status,
// and dashboard grid layout configuration.
// =============================================================================

import { create } from 'zustand';
import type { ConnectionState } from '@/types/chart';
import type { LayoutItem } from '@/types/widget';
import { DEFAULT_SYMBOL } from '@/utils/constants';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Theme = 'dark' | 'light';

interface UiStoreState {
  /** Current color theme */
  theme: Theme;
  /** Active trading symbol across the dashboard (e.g., "BTCUSDT") */
  symbol: string;
  /** WebSocket connection state (discriminated union) */
  connectionState: ConnectionState;
  /** Current dashboard widget layout configuration */
  layout: LayoutItem[];
}

interface UiStoreActions {
  /** Set the color theme explicitly */
  setTheme: (theme: Theme) => void;
  /** Toggle between dark and light themes */
  toggleTheme: () => void;
  /** Change the active trading symbol */
  setSymbol: (symbol: string) => void;
  /** Update WebSocket connection state */
  setConnectionState: (state: ConnectionState) => void;
  /** Replace the entire dashboard layout */
  setLayout: (layout: LayoutItem[]) => void;
}

type UiStore = UiStoreState & UiStoreActions;

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useUiStore = create<UiStore>()((set) => ({
  // -- State ------------------------------------------------------------------
  theme: 'dark',
  symbol: DEFAULT_SYMBOL,
  connectionState: { status: 'idle' },
  layout: [],

  // -- Actions ----------------------------------------------------------------
  setTheme: (theme: Theme): void => {
    set({ theme });
  },

  toggleTheme: (): void => {
    set((state) => ({
      theme: state.theme === 'dark' ? 'light' : 'dark',
    }));
  },

  setSymbol: (symbol: string): void => {
    set({ symbol });
  },

  setConnectionState: (connectionState: ConnectionState): void => {
    set({ connectionState });
  },

  setLayout: (layout: LayoutItem[]): void => {
    set({ layout });
  },
}));

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export type { Theme, UiStoreState, UiStoreActions, UiStore };
