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
import {
  loadExchange,
  saveExchange,
  loadMobileTab,
  saveMobileTab,
  type MobileTab,
} from '@/utils/localPreferences';

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
  /** Whether the persisted exchange has been hydrated from localStorage */
  isExchangeHydrated: boolean;
  /** WebSocket connection state (discriminated union) */
  connectionState: ConnectionState;
  /** Current dashboard widget layout configuration */
  layout: LayoutItem[];
  /** Active mobile tab (bottom tab bar selection) */
  activeMobileTab: MobileTab;
  /** Whether the symbol search modal (command palette) is open */
  isSymbolSearchOpen: boolean;
  /** Whether the keyboard shortcuts help modal is open */
  isShortcutsHelpOpen: boolean;
  /** Whether the settings panel is open */
  isSettingsOpen: boolean;
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
  /** Set the active mobile tab */
  setActiveMobileTab: (tab: MobileTab) => void;
  /** Open or close the symbol search modal */
  setSymbolSearchOpen: (open: boolean) => void;
  /** Open or close the keyboard shortcuts help modal */
  setShortcutsHelpOpen: (open: boolean) => void;
  /** Open or close the settings panel */
  setSettingsOpen: (open: boolean) => void;
  /** Close all overlay modals */
  closeAllOverlays: () => void;
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
    set({
      exchange: loadExchange(),
      isExchangeHydrated: true,
      activeMobileTab: loadMobileTab(),
    });
  }

  function setConnectionState(connectionState: ConnectionState): void {
    set({ connectionState });
  }

  function setLayout(layout: LayoutItem[]): void {
    set({ layout });
  }

  function setActiveMobileTab(tab: MobileTab): void {
    saveMobileTab(tab);
    set({ activeMobileTab: tab });
  }

  function setSymbolSearchOpen(open: boolean): void {
    set({ isSymbolSearchOpen: open });
  }

  function setShortcutsHelpOpen(open: boolean): void {
    set({ isShortcutsHelpOpen: open });
  }

  function setSettingsOpen(open: boolean): void {
    set({ isSettingsOpen: open });
  }

  function closeAllOverlays(): void {
    set({ isSymbolSearchOpen: false, isShortcutsHelpOpen: false, isSettingsOpen: false });
  }

  return {
    // -- State ----------------------------------------------------------------
    theme: 'dark',
    symbol: DEFAULT_SYMBOL,
    exchange: DEFAULT_EXCHANGE,
    isExchangeHydrated: false,
    connectionState: { status: 'idle' },
    layout: [],
    activeMobileTab: 'chart',
    isSymbolSearchOpen: false,
    isShortcutsHelpOpen: false,
    isSettingsOpen: false,

    // -- Actions --------------------------------------------------------------
    setTheme,
    toggleTheme,
    setSymbol,
    setExchange,
    hydrateExchange,
    setConnectionState,
    setLayout,
    setActiveMobileTab,
    setSymbolSearchOpen,
    setShortcutsHelpOpen,
    setSettingsOpen,
    closeAllOverlays,
  };
});

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export type { Theme, UiStoreState, UiStoreActions, UiStore };
export type { MobileTab } from '@/utils/localPreferences';
