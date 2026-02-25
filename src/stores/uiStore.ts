// =============================================================================
// UI Store
// =============================================================================
// Manages global UI state: theme, active symbol, WebSocket connection status,
// and dashboard grid layout configuration.
// =============================================================================

import { create } from 'zustand';
import type { ConnectionState } from '@/types/chart';
import type { LayoutItem } from '@/types/widget';
import type { ExchangeId } from '@/types/exchange';
import { DEFAULT_SYMBOL } from '@/utils/constants';
import { loadExchange, saveExchange } from '@/utils/localPreferences';

/** Default exchange used for SSR and initial hydration */
const DEFAULT_EXCHANGE: ExchangeId = 'binance';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Theme = 'dark' | 'light';

interface UiStoreState {
  /** Current color theme */
  theme: Theme;
  /** Active trading symbol across the dashboard (e.g., "BTCUSDT" or "KRW-BTC") */
  symbol: string;
  /** Currently selected exchange */
  exchange: ExchangeId;
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
  /** Change the active exchange */
  setExchange: (exchange: ExchangeId) => void;
  /** Hydrate exchange from localStorage after mount (SSR-safe) */
  hydrateExchange: () => void;
  /** Update WebSocket connection state */
  setConnectionState: (state: ConnectionState) => void;
  /** Replace the entire dashboard layout */
  setLayout: (layout: LayoutItem[]) => void;
}

type UiStore = UiStoreState & UiStoreActions;

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useUiStore = create<UiStore>()((set) => {
  function setTheme(theme: Theme): void {
    set({ theme });
  }

  function toggleTheme(): void {
    set((state) => ({
      theme: state.theme === 'dark' ? 'light' : 'dark',
    }));
  }

  function setSymbol(symbol: string): void {
    set({ symbol });
  }

  function setExchange(exchange: ExchangeId): void {
    saveExchange(exchange);
    set({ exchange });
  }

  function hydrateExchange(): void {
    const persisted = loadExchange();
    if (persisted !== DEFAULT_EXCHANGE) {
      set({ exchange: persisted });
    }
  }

  function setConnectionState(connectionState: ConnectionState): void {
    set({ connectionState });
  }

  function setLayout(layout: LayoutItem[]): void {
    set({ layout });
  }

  return {
    // -- State ----------------------------------------------------------------
    theme: 'dark',
    symbol: DEFAULT_SYMBOL,
    exchange: DEFAULT_EXCHANGE,
    connectionState: { status: 'idle' },
    layout: [],

    // -- Actions --------------------------------------------------------------
    setTheme,
    toggleTheme,
    setSymbol,
    setExchange,
    hydrateExchange,
    setConnectionState,
    setLayout,
  };
});

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export type { Theme, UiStoreState, UiStoreActions, UiStore };
