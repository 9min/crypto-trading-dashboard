// =============================================================================
// useExchangeWebSocket Tests
// =============================================================================
// Tests that the hook correctly delegates to the appropriate exchange-specific
// WebSocket hook based on the current exchange selection.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

const mockUseWebSocket = vi.fn();
const mockUseUpbitStream = vi.fn();

vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: (...args: unknown[]) => mockUseWebSocket(...args),
}));

vi.mock('@/hooks/useUpbitStream', () => ({
  useUpbitStream: (...args: unknown[]) => mockUseUpbitStream(...args),
}));

vi.mock('@/utils/symbolMap', () => ({
  toUpbitSymbol: (s: string) => {
    const map: Record<string, string> = {
      BTCUSDT: 'KRW-BTC',
      ETHUSDT: 'KRW-ETH',
      BNBUSDT: 'BNBUSDT',
    };
    return map[s] ?? s;
  },
}));

import { useUiStore } from '@/stores/uiStore';
import { useKlineStore } from '@/stores/klineStore';
import { useExchangeWebSocket } from './useExchangeWebSocket';

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('useExchangeWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.getState().setExchange('binance');
    useUiStore.getState().setSymbol('BTCUSDT');
    useKlineStore.getState().setInterval('1m');
  });

  it('activates Binance hook when exchange is binance', () => {
    useUiStore.getState().setExchange('binance');

    renderHook(() => useExchangeWebSocket());

    expect(mockUseWebSocket).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
    expect(mockUseUpbitStream).toHaveBeenCalledWith(expect.objectContaining({ symbol: null }));
  });

  it('activates Upbit hook when exchange is upbit', () => {
    useUiStore.getState().setExchange('upbit');
    useUiStore.getState().setSymbol('BTCUSDT');

    renderHook(() => useExchangeWebSocket());

    expect(mockUseWebSocket).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    expect(mockUseUpbitStream).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'KRW-BTC' }));
  });

  it('disables both hooks when enabled is false', () => {
    renderHook(() => useExchangeWebSocket(false));

    expect(mockUseWebSocket).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    expect(mockUseUpbitStream).toHaveBeenCalledWith(expect.objectContaining({ symbol: null }));
  });

  it('passes interval to useWebSocket', () => {
    useKlineStore.getState().setInterval('5m');

    renderHook(() => useExchangeWebSocket());

    expect(mockUseWebSocket).toHaveBeenCalledWith(expect.objectContaining({ interval: '5m' }));
  });

  it('passes interval to useUpbitStream', () => {
    useUiStore.getState().setExchange('upbit');
    useKlineStore.getState().setInterval('15m');

    renderHook(() => useExchangeWebSocket());

    expect(mockUseUpbitStream).toHaveBeenCalledWith(expect.objectContaining({ interval: '15m' }));
  });

  it('passes symbol to useWebSocket', () => {
    useUiStore.getState().setSymbol('ETHUSDT');

    renderHook(() => useExchangeWebSocket());

    expect(mockUseWebSocket).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'ETHUSDT' }));
  });
});
