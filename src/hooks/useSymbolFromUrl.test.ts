import { renderHook } from '@testing-library/react';
import { useUiStore } from '@/stores/uiStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { DEFAULT_SYMBOL } from '@/utils/constants';

// Must import after mocks are ready
import { useSymbolFromUrl } from './useSymbolFromUrl';

describe('useSymbolFromUrl', () => {
  const originalLocation = window.location;
  let replaceStateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset stores
    useUiStore.setState({
      theme: 'dark',
      symbol: DEFAULT_SYMBOL,
      exchange: 'binance',
      isExchangeHydrated: false,
      connectionState: { status: 'idle' },
      layout: [],
    });
    useWatchlistStore.getState().reset();

    replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
  });

  afterEach(() => {
    replaceStateSpy.mockRestore();
    // Reset location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  function setUrlParam(symbol: string): void {
    Object.defineProperty(window, 'location', {
      value: {
        ...originalLocation,
        search: `?symbol=${symbol}`,
        href: `http://localhost:3000/?symbol=${symbol}`,
      },
      writable: true,
    });
  }

  it('parses ?symbol= from URL and sets uiStore symbol', () => {
    setUrlParam('ETHUSDT');

    renderHook(() => useSymbolFromUrl());

    expect(useUiStore.getState().symbol).toBe('ETHUSDT');
  });

  it('normalizes symbol to uppercase', () => {
    setUrlParam('ethusdt');

    renderHook(() => useSymbolFromUrl());

    expect(useUiStore.getState().symbol).toBe('ETHUSDT');
  });

  it('does not update store when no symbol param exists', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '', href: 'http://localhost:3000/' },
      writable: true,
    });

    renderHook(() => useSymbolFromUrl());

    expect(useUiStore.getState().symbol).toBe(DEFAULT_SYMBOL);
  });

  it('does not update store when symbol is invalid', () => {
    setUrlParam('INVALID');

    renderHook(() => useSymbolFromUrl());

    // 'INVALID' does not end with 'USDT' and is not in any watchlist
    expect(useUiStore.getState().symbol).toBe(DEFAULT_SYMBOL);
  });

  it('accepts symbols matching the USDT pattern', () => {
    setUrlParam('SOLUSDT');

    renderHook(() => useSymbolFromUrl());

    expect(useUiStore.getState().symbol).toBe('SOLUSDT');
  });

  it('syncs uiStore symbol changes to URL via replaceState', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '', href: 'http://localhost:3000/' },
      writable: true,
    });

    renderHook(() => useSymbolFromUrl());

    // Trigger a symbol change
    useUiStore.getState().setSymbol('ADAUSDT');

    expect(replaceStateSpy).toHaveBeenCalledWith(
      null,
      '',
      expect.stringContaining('symbol=ADAUSDT'),
    );
  });

  it('does not update when URL symbol matches current store symbol', () => {
    setUrlParam(DEFAULT_SYMBOL);
    const setSymbolSpy = vi.spyOn(useUiStore.getState(), 'setSymbol');

    renderHook(() => useSymbolFromUrl());

    // Symbol already matches, should not call setSymbol
    expect(setSymbolSpy).not.toHaveBeenCalled();
    setSymbolSpy.mockRestore();
  });
});
