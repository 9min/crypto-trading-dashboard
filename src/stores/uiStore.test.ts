import { useUiStore } from './uiStore';
import { DEFAULT_SYMBOL } from '@/utils/constants';

vi.mock('@/utils/localPreferences', () => ({
  saveExchange: vi.fn(),
  loadExchange: vi.fn(() => 'upbit' as const),
  saveMobileTab: vi.fn(),
  loadMobileTab: vi.fn(() => 'chart' as const),
}));

// Import mocked functions for assertion
import { saveExchange, loadExchange, saveMobileTab, loadMobileTab } from '@/utils/localPreferences';

describe('uiStore', () => {
  beforeEach(() => {
    // Reset store by setting back to initial values
    useUiStore.setState({
      theme: 'dark',
      symbol: DEFAULT_SYMBOL,
      exchange: 'binance',
      isExchangeHydrated: false,
      connectionState: { status: 'idle' },
      layout: [],
      activeMobileTab: 'chart',
      isSymbolSearchOpen: false,
      isShortcutsHelpOpen: false,
    });
    vi.clearAllMocks();
  });

  it('has correct initial state', () => {
    const state = useUiStore.getState();
    expect(state.theme).toBe('dark');
    expect(state.symbol).toBe(DEFAULT_SYMBOL);
    expect(state.exchange).toBe('binance');
    expect(state.isExchangeHydrated).toBe(false);
    expect(state.connectionState).toEqual({ status: 'idle' });
    expect(state.layout).toEqual([]);
    expect(state.activeMobileTab).toBe('chart');
    expect(state.isSymbolSearchOpen).toBe(false);
    expect(state.isShortcutsHelpOpen).toBe(false);
  });

  describe('setTheme', () => {
    it('sets the theme to light', () => {
      useUiStore.getState().setTheme('light');
      expect(useUiStore.getState().theme).toBe('light');
    });

    it('sets the theme to dark', () => {
      useUiStore.getState().setTheme('light');
      useUiStore.getState().setTheme('dark');
      expect(useUiStore.getState().theme).toBe('dark');
    });
  });

  describe('toggleTheme', () => {
    it('toggles from dark to light', () => {
      useUiStore.getState().toggleTheme();
      expect(useUiStore.getState().theme).toBe('light');
    });

    it('toggles from light to dark', () => {
      useUiStore.getState().setTheme('light');
      useUiStore.getState().toggleTheme();
      expect(useUiStore.getState().theme).toBe('dark');
    });
  });

  describe('setSymbol', () => {
    it('sets the active symbol', () => {
      useUiStore.getState().setSymbol('ETHUSDT');
      expect(useUiStore.getState().symbol).toBe('ETHUSDT');
    });
  });

  describe('setExchange', () => {
    it('sets the exchange and calls saveExchange', () => {
      useUiStore.getState().setExchange('upbit');
      expect(useUiStore.getState().exchange).toBe('upbit');
      expect(saveExchange).toHaveBeenCalledWith('upbit');
    });
  });

  describe('hydrateExchange', () => {
    it('loads exchange from localStorage and sets isExchangeHydrated', () => {
      useUiStore.getState().hydrateExchange();
      expect(loadExchange).toHaveBeenCalled();
      expect(loadMobileTab).toHaveBeenCalled();
      expect(useUiStore.getState().exchange).toBe('upbit');
      expect(useUiStore.getState().isExchangeHydrated).toBe(true);
      expect(useUiStore.getState().activeMobileTab).toBe('chart');
    });
  });

  describe('setActiveMobileTab', () => {
    it('sets the active mobile tab and persists to localStorage', () => {
      useUiStore.getState().setActiveMobileTab('portfolio');
      expect(useUiStore.getState().activeMobileTab).toBe('portfolio');
      expect(saveMobileTab).toHaveBeenCalledWith('portfolio');
    });

    it('sets the more tab', () => {
      useUiStore.getState().setActiveMobileTab('more');
      expect(useUiStore.getState().activeMobileTab).toBe('more');
      expect(saveMobileTab).toHaveBeenCalledWith('more');
    });
  });

  describe('setConnectionState', () => {
    it('sets idle state', () => {
      useUiStore.getState().setConnectionState({ status: 'idle' });
      expect(useUiStore.getState().connectionState).toEqual({ status: 'idle' });
    });

    it('sets connecting state', () => {
      useUiStore.getState().setConnectionState({ status: 'connecting' });
      expect(useUiStore.getState().connectionState).toEqual({ status: 'connecting' });
    });

    it('sets connected state with connectedAt', () => {
      const connectedAt = Date.now();
      useUiStore.getState().setConnectionState({ status: 'connected', connectedAt });
      const state = useUiStore.getState().connectionState;
      expect(state.status).toBe('connected');
      if (state.status === 'connected') {
        expect(state.connectedAt).toBe(connectedAt);
      }
    });

    it('sets reconnecting state with attempt', () => {
      useUiStore.getState().setConnectionState({ status: 'reconnecting', attempt: 3 });
      const state = useUiStore.getState().connectionState;
      expect(state.status).toBe('reconnecting');
      if (state.status === 'reconnecting') {
        expect(state.attempt).toBe(3);
      }
    });

    it('sets failed state with error', () => {
      useUiStore.getState().setConnectionState({ status: 'failed', error: 'Max retries' });
      const state = useUiStore.getState().connectionState;
      expect(state.status).toBe('failed');
      if (state.status === 'failed') {
        expect(state.error).toBe('Max retries');
      }
    });
  });

  describe('setLayout', () => {
    it('replaces the layout', () => {
      const layout = [
        { i: 'w1', type: 'candlestick' as const, symbol: 'BTCUSDT', x: 0, y: 0, w: 6, h: 8 },
      ];
      useUiStore.getState().setLayout(layout);
      expect(useUiStore.getState().layout).toEqual(layout);
    });
  });

  // ---------------------------------------------------------------------------
  // Symbol Search & Shortcuts Help Overlays
  // ---------------------------------------------------------------------------

  describe('setSymbolSearchOpen', () => {
    it('opens the symbol search modal', () => {
      useUiStore.getState().setSymbolSearchOpen(true);
      expect(useUiStore.getState().isSymbolSearchOpen).toBe(true);
    });

    it('closes the symbol search modal', () => {
      useUiStore.getState().setSymbolSearchOpen(true);
      useUiStore.getState().setSymbolSearchOpen(false);
      expect(useUiStore.getState().isSymbolSearchOpen).toBe(false);
    });
  });

  describe('setShortcutsHelpOpen', () => {
    it('opens the shortcuts help modal', () => {
      useUiStore.getState().setShortcutsHelpOpen(true);
      expect(useUiStore.getState().isShortcutsHelpOpen).toBe(true);
    });

    it('closes the shortcuts help modal', () => {
      useUiStore.getState().setShortcutsHelpOpen(true);
      useUiStore.getState().setShortcutsHelpOpen(false);
      expect(useUiStore.getState().isShortcutsHelpOpen).toBe(false);
    });
  });

  describe('closeAllOverlays', () => {
    it('closes both modals when both are open', () => {
      useUiStore.getState().setSymbolSearchOpen(true);
      useUiStore.getState().setShortcutsHelpOpen(true);

      useUiStore.getState().closeAllOverlays();

      const state = useUiStore.getState();
      expect(state.isSymbolSearchOpen).toBe(false);
      expect(state.isShortcutsHelpOpen).toBe(false);
    });

    it('is safe to call when no overlays are open', () => {
      useUiStore.getState().closeAllOverlays();

      const state = useUiStore.getState();
      expect(state.isSymbolSearchOpen).toBe(false);
      expect(state.isShortcutsHelpOpen).toBe(false);
    });
  });
});
