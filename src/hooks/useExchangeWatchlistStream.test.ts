// =============================================================================
// useExchangeWatchlistStream Tests
// =============================================================================
// Tests that the hook correctly delegates to the appropriate exchange-specific
// watchlist hook and filters symbols for Upbit mapping.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

const mockUseWatchlistStream = vi.fn();
const mockUseUpbitWatchlistStream = vi.fn();
const mockUseFuturesBinanceStream = vi.fn();

vi.mock('@/hooks/useWatchlistStream', () => ({
  useWatchlistStream: (...args: unknown[]) => mockUseWatchlistStream(...args),
}));

vi.mock('@/hooks/useUpbitWatchlistStream', () => ({
  useUpbitWatchlistStream: (...args: unknown[]) => mockUseUpbitWatchlistStream(...args),
}));

vi.mock('@/hooks/useFuturesBinanceStream', () => ({
  useFuturesBinanceStream: (...args: unknown[]) => mockUseFuturesBinanceStream(...args),
}));

vi.mock('@/utils/symbolMap', () => ({
  toUpbitSymbol: (s: string) => {
    const map: Record<string, string> = {
      BTCUSDT: 'KRW-BTC',
      ETHUSDT: 'KRW-ETH',
      BNBUSDT: 'BNBUSDT', // No KRW- prefix → filtered out
      SOLUSDT: 'KRW-SOL',
    };
    return map[s] ?? s;
  },
}));

import { useUiStore } from '@/stores/uiStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useExchangeWatchlistStream } from './useExchangeWatchlistStream';

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('useExchangeWatchlistStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.getState().setExchange('binance');
    useWatchlistStore.getState().reset();
  });

  it('activates Binance watchlist when exchange is binance', () => {
    useUiStore.getState().setExchange('binance');

    renderHook(() => useExchangeWatchlistStream());

    expect(mockUseWatchlistStream).toHaveBeenCalledWith(true);
    expect(mockUseUpbitWatchlistStream).toHaveBeenCalledWith({ symbols: [] });
  });

  it('activates Upbit watchlist when exchange is upbit', () => {
    useUiStore.getState().setExchange('upbit');
    // Add symbols that have Upbit mappings
    useWatchlistStore.getState().addSymbol('BTCUSDT');
    useWatchlistStore.getState().addSymbol('ETHUSDT');

    renderHook(() => useExchangeWatchlistStream());

    expect(mockUseWatchlistStream).toHaveBeenCalledWith(false);
    expect(mockUseUpbitWatchlistStream).toHaveBeenCalledWith({
      symbols: expect.arrayContaining(['KRW-BTC', 'KRW-ETH']),
    });
  });

  it('filters out symbols without KRW- prefix for Upbit', () => {
    useUiStore.getState().setExchange('upbit');
    useWatchlistStore.getState().addSymbol('BTCUSDT');
    useWatchlistStore.getState().addSymbol('BNBUSDT'); // No Upbit mapping

    renderHook(() => useExchangeWatchlistStream());

    const upbitCall = mockUseUpbitWatchlistStream.mock.calls[0][0];
    expect(upbitCall.symbols).toContain('KRW-BTC');
    expect(upbitCall.symbols).not.toContain('BNBUSDT');
  });

  it('returns empty upbit symbols when exchange is binance', () => {
    useUiStore.getState().setExchange('binance');
    useWatchlistStore.getState().addSymbol('BTCUSDT');

    renderHook(() => useExchangeWatchlistStream());

    expect(mockUseUpbitWatchlistStream).toHaveBeenCalledWith({ symbols: [] });
  });

  it('passes empty array to Upbit when watchlist has no mappable symbols', () => {
    useUiStore.getState().setExchange('upbit');
    // Remove all default symbols and add only unmappable ones
    const state = useWatchlistStore.getState();
    for (const s of state.symbols) {
      state.removeSymbol(s);
    }
    useWatchlistStore.getState().addSymbol('BNBUSDT'); // No KRW- mapping

    renderHook(() => useExchangeWatchlistStream());

    expect(mockUseUpbitWatchlistStream).toHaveBeenCalledWith({ symbols: [] });
  });

  it('recalculates upbit symbols when exchange changes', () => {
    // Clear default symbols and add only BTCUSDT
    const state = useWatchlistStore.getState();
    for (const s of state.symbols) {
      state.removeSymbol(s);
    }
    useWatchlistStore.getState().addSymbol('BTCUSDT');

    const { rerender } = renderHook(() => useExchangeWatchlistStream());

    // Initially binance
    expect(mockUseUpbitWatchlistStream).toHaveBeenLastCalledWith({ symbols: [] });

    // Switch to upbit
    useUiStore.getState().setExchange('upbit');
    rerender();

    expect(mockUseUpbitWatchlistStream).toHaveBeenLastCalledWith({
      symbols: ['KRW-BTC'],
    });
  });

  it('recalculates upbit symbols when symbols change', () => {
    useUiStore.getState().setExchange('upbit');

    const { rerender } = renderHook(() => useExchangeWatchlistStream());

    useWatchlistStore.getState().addSymbol('SOLUSDT');
    rerender();

    const lastCall = mockUseUpbitWatchlistStream.mock.calls.at(-1);
    expect(lastCall?.[0].symbols).toContain('KRW-SOL');
  });

  it('memoizes upbit symbols array reference', () => {
    useUiStore.getState().setExchange('upbit');
    useWatchlistStore.getState().addSymbol('BTCUSDT');

    const { rerender } = renderHook(() => useExchangeWatchlistStream());

    const firstCall = mockUseUpbitWatchlistStream.mock.calls.at(-1)?.[0].symbols;
    rerender();
    const secondCall = mockUseUpbitWatchlistStream.mock.calls.at(-1)?.[0].symbols;

    // useMemo should return the same reference if dependencies haven't changed
    expect(firstCall).toBe(secondCall);
  });

  // ---------------------------------------------------------------------------
  // Futures Binance stream
  // ---------------------------------------------------------------------------

  it('enables futures binance stream when exchange is upbit', () => {
    useUiStore.getState().setExchange('upbit');

    renderHook(() => useExchangeWatchlistStream());

    expect(mockUseFuturesBinanceStream).toHaveBeenCalledWith({ enabled: true });
  });

  it('disables futures binance stream when exchange is binance', () => {
    useUiStore.getState().setExchange('binance');

    renderHook(() => useExchangeWatchlistStream());

    expect(mockUseFuturesBinanceStream).toHaveBeenCalledWith({ enabled: false });
  });

  it('toggles futures binance stream when exchange changes', () => {
    useUiStore.getState().setExchange('binance');

    const { rerender } = renderHook(() => useExchangeWatchlistStream());

    expect(mockUseFuturesBinanceStream).toHaveBeenLastCalledWith({ enabled: false });

    useUiStore.getState().setExchange('upbit');
    rerender();

    expect(mockUseFuturesBinanceStream).toHaveBeenLastCalledWith({ enabled: true });
  });
});
