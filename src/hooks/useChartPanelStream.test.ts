// =============================================================================
// useChartPanelStream Tests
// =============================================================================

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChartPanelStream } from './useChartPanelStream';
import type { CandleData } from '@/types/chart';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

// Mock uiStore — exchange selector
let mockExchange = 'binance';

vi.mock('@/stores/uiStore', () => ({
  useUiStore: (selector: (state: { exchange: string }) => unknown) =>
    selector({ exchange: mockExchange }),
}));

// Mock fetchKlines (Binance)
vi.mock('@/lib/binance/restApi', () => ({
  fetchKlines: vi.fn(),
}));

// Mock stream URL builders (Binance)
vi.mock('@/lib/binance/streamUrls', () => ({
  buildStreamUrl: vi.fn(
    (streams: string[]) => `wss://mock.test/stream?streams=${streams.join('/')}`,
  ),
  getKlineStream: vi.fn(
    (symbol: string, interval: string) => `${symbol.toLowerCase()}@kline_${interval}`,
  ),
}));

// Mock constants
vi.mock('@/utils/constants', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    RECONNECT_BASE_DELAY_MS: 10, // Speed up tests
    RECONNECT_MAX_DELAY_MS: 100,
    MAX_CANDLES: 2000,
  };
});

// Mock Upbit modules
const mockUpbitConnect = vi.fn();
const mockUpbitDisconnect = vi.fn();
const mockUpbitDisconnectGroup = vi.fn();
const mockUpbitSubscribe = vi.fn().mockReturnValue(vi.fn());

vi.mock('@/lib/upbit/UpbitWebSocketManager', () => ({
  UpbitWebSocketManager: {
    getInstance: () => ({
      connect: mockUpbitConnect,
      disconnect: mockUpbitDisconnect,
      disconnectGroup: mockUpbitDisconnectGroup,
      subscribe: mockUpbitSubscribe,
    }),
  },
}));

const mockFetchUpbitCandles = vi.fn().mockResolvedValue([]);

vi.mock('@/lib/upbit/restClient', () => ({
  fetchUpbitCandles: (...args: unknown[]) => mockFetchUpbitCandles(...args),
}));

vi.mock('@/utils/symbolMap', () => ({
  toUpbitSymbol: (s: string) => {
    const map: Record<string, string> = {
      BTCUSDT: 'KRW-BTC',
      ETHUSDT: 'KRW-ETH',
      SOLUSDT: 'KRW-SOL',
    };
    return map[s] ?? s;
  },
  BINANCE_TO_UPBIT_MAP: new Map([
    ['BTCUSDT', 'KRW-BTC'],
    ['ETHUSDT', 'KRW-ETH'],
    ['SOLUSDT', 'KRW-SOL'],
  ]),
}));

vi.mock('@/utils/intervalAlign', () => ({
  alignToIntervalSec: (timestampMs: number, _interval: string) =>
    Math.floor(timestampMs / 60000) * 60,
}));

// Mock WebSocket (Binance path)
class MockWebSocket {
  static instances: MockWebSocket[] = [];

  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    // Simulate async open
    setTimeout(() => {
      this.readyState = 1;
      this.onopen?.();
    }, 0);
  }

  simulateMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateClose(): void {
    this.readyState = 3;
    this.onclose?.();
  }
}

(global as Record<string, unknown>).WebSocket = MockWebSocket;

// Import mocked module
const { fetchKlines } = await import('@/lib/binance/restApi');

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function makeMockCandles(count: number, startTime = 1000): CandleData[] {
  return Array.from({ length: count }, (_, i) => ({
    time: startTime + i * 60,
    open: 50000 + i,
    high: 50100 + i,
    low: 49900 + i,
    close: 50050 + i,
    volume: 100 + i,
  }));
}

function makeKlineMessage(time: number, close: string, isClosed: boolean) {
  return {
    stream: 'btcusdt@kline_1m',
    data: {
      e: 'kline',
      E: Date.now(),
      s: 'BTCUSDT',
      k: {
        t: time * 1000,
        T: (time + 60) * 1000,
        s: 'BTCUSDT',
        i: '1m',
        o: '50000',
        c: close,
        h: '50100',
        l: '49900',
        v: '100',
        n: 10,
        x: isClosed,
        q: '5000000',
        V: '50',
        Q: '2500000',
        f: 1,
        L: 10,
      },
    },
  };
}

// -----------------------------------------------------------------------------
// Tests — Binance Exchange
// -----------------------------------------------------------------------------

describe('useChartPanelStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockWebSocket.instances = [];
    mockExchange = 'binance';
    (fetchKlines as Mock).mockResolvedValue(makeMockCandles(5));
    mockFetchUpbitCandles.mockResolvedValue([]);
    mockUpbitSubscribe.mockReturnValue(vi.fn());
  });

  // ---------------------------------------------------------------------------
  // Initial data loading (Binance)
  // ---------------------------------------------------------------------------

  describe('initial data loading', () => {
    it('starts with isLoading true and empty candles', () => {
      const { result } = renderHook(() =>
        useChartPanelStream({ panelId: 'panel-1', symbol: 'BTCUSDT', interval: '1m' }),
      );
      expect(result.current.isLoading).toBe(true);
      expect(result.current.candles).toEqual([]);
    });

    it('loads candles from REST API and sets isLoading to false', async () => {
      const mockCandles = makeMockCandles(3);
      (fetchKlines as Mock).mockResolvedValue(mockCandles);

      const { result } = renderHook(() =>
        useChartPanelStream({ panelId: 'panel-1', symbol: 'BTCUSDT', interval: '1m' }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.candles).toEqual(mockCandles);
      });
    });

    it('handles REST API failure gracefully', async () => {
      (fetchKlines as Mock).mockRejectedValue(new Error('network error'));

      const { result } = renderHook(() =>
        useChartPanelStream({ panelId: 'panel-1', symbol: 'BTCUSDT', interval: '1m' }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.candles).toEqual([]);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // WebSocket connection (Binance)
  // ---------------------------------------------------------------------------

  describe('websocket connection', () => {
    it('creates a WebSocket connection with correct URL', async () => {
      renderHook(() =>
        useChartPanelStream({ panelId: 'panel-1', symbol: 'BTCUSDT', interval: '1m' }),
      );

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(1);
      });

      const ws = MockWebSocket.instances[0];
      expect(ws.url).toContain('btcusdt@kline_1m');
    });

    it('updates last candle on live kline message (not closed)', async () => {
      const mockCandles = makeMockCandles(3, 1000);
      (fetchKlines as Mock).mockResolvedValue(mockCandles);

      const { result } = renderHook(() =>
        useChartPanelStream({ panelId: 'panel-1', symbol: 'BTCUSDT', interval: '1m' }),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const ws = MockWebSocket.instances[0];

      // Update the last candle (same time as last candle)
      const lastTime = mockCandles[mockCandles.length - 1].time;
      act(() => {
        ws.simulateMessage(makeKlineMessage(lastTime, '51000', false));
      });

      expect(result.current.candles[result.current.candles.length - 1].close).toBe(51000);
      expect(result.current.candles).toHaveLength(3); // No new candle added
    });

    it('appends new candle on closed kline message', async () => {
      const mockCandles = makeMockCandles(3, 1000);
      (fetchKlines as Mock).mockResolvedValue(mockCandles);

      const { result } = renderHook(() =>
        useChartPanelStream({ panelId: 'panel-1', symbol: 'BTCUSDT', interval: '1m' }),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const ws = MockWebSocket.instances[0];

      // New closed candle at a new time
      const newTime = mockCandles[mockCandles.length - 1].time + 60;
      act(() => {
        ws.simulateMessage(makeKlineMessage(newTime, '52000', true));
      });

      expect(result.current.candles).toHaveLength(4);
      expect(result.current.candles[3].close).toBe(52000);
    });
  });

  // ---------------------------------------------------------------------------
  // Symbol/interval change (Binance)
  // ---------------------------------------------------------------------------

  describe('symbol/interval change', () => {
    it('resets candles and reconnects on symbol change', async () => {
      const { result, rerender } = renderHook(
        (props: { symbol: string; interval: string }) =>
          useChartPanelStream({
            panelId: 'panel-1',
            symbol: props.symbol,
            interval: props.interval as '1m',
          }),
        { initialProps: { symbol: 'BTCUSDT', interval: '1m' } },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const firstWs = MockWebSocket.instances[0];

      // Change symbol
      const ethCandles = makeMockCandles(2, 2000);
      (fetchKlines as Mock).mockResolvedValue(ethCandles);

      rerender({ symbol: 'ETHUSDT', interval: '1m' });

      // Old WebSocket should be closed
      expect(firstWs.close).toHaveBeenCalled();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.candles).toEqual(ethCandles);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Cleanup (Binance)
  // ---------------------------------------------------------------------------

  describe('cleanup', () => {
    it('closes WebSocket on unmount', async () => {
      const { unmount } = renderHook(() =>
        useChartPanelStream({ panelId: 'panel-1', symbol: 'BTCUSDT', interval: '1m' }),
      );

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(1);
      });

      const ws = MockWebSocket.instances[0];
      unmount();

      expect(ws.close).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases (Binance)
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('ignores malformed WebSocket messages', async () => {
      const mockCandles = makeMockCandles(2);
      (fetchKlines as Mock).mockResolvedValue(mockCandles);

      const { result } = renderHook(() =>
        useChartPanelStream({ panelId: 'panel-1', symbol: 'BTCUSDT', interval: '1m' }),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const ws = MockWebSocket.instances[0];

      // Send invalid JSON
      act(() => {
        ws.onmessage?.({ data: 'not json' });
      });

      // Candles should remain unchanged
      expect(result.current.candles).toEqual(mockCandles);
    });
  });

  // ---------------------------------------------------------------------------
  // Upbit Exchange
  // ---------------------------------------------------------------------------

  describe('upbit exchange', () => {
    beforeEach(() => {
      mockExchange = 'upbit';
    });

    it('loads initial candles from upbit REST API', async () => {
      const upbitCandles = makeMockCandles(3, 5000);
      mockFetchUpbitCandles.mockResolvedValue(upbitCandles);

      const { result } = renderHook(() =>
        useChartPanelStream({ panelId: 'panel-1', symbol: 'BTCUSDT', interval: '1m' }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.candles).toEqual(upbitCandles);
      });

      expect(mockFetchUpbitCandles).toHaveBeenCalledWith('KRW-BTC', '1m');
    });

    it('connects UpbitWebSocketManager with correct group ID', async () => {
      mockFetchUpbitCandles.mockResolvedValue([]);

      renderHook(() =>
        useChartPanelStream({ panelId: 'panel-2', symbol: 'ETHUSDT', interval: '5m' }),
      );

      await waitFor(() => {
        expect(mockUpbitConnect).toHaveBeenCalledWith('multichart-panel-2', [
          { type: 'trade', codes: ['KRW-ETH'], isOnlyRealtime: true },
        ]);
      });
    });

    it('creates a new candle from trade event in new period', async () => {
      const initialCandles = makeMockCandles(2, 60);
      mockFetchUpbitCandles.mockResolvedValue(initialCandles);

      // Capture the subscribe callback
      let subscribedCallback: ((msg: Record<string, unknown>) => void) | null = null;
      mockUpbitSubscribe.mockImplementation((cb: (msg: Record<string, unknown>) => void) => {
        subscribedCallback = cb;
        return vi.fn();
      });

      const { result } = renderHook(() =>
        useChartPanelStream({ panelId: 'panel-1', symbol: 'BTCUSDT', interval: '1m' }),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(subscribedCallback).not.toBeNull();

      // Trade at a new candle period (time 180 = 3rd minute, initial candles end at 120)
      act(() => {
        subscribedCallback!({
          type: 'trade',
          code: 'KRW-BTC',
          trade_price: 95000000,
          trade_volume: 0.5,
          trade_timestamp: 180 * 1000, // alignToIntervalSec → 180
          ask_bid: 'BID',
          sequential_id: 1,
        });
      });

      expect(result.current.candles).toHaveLength(3);
      const newCandle = result.current.candles[2];
      expect(newCandle.open).toBe(95000000);
      expect(newCandle.close).toBe(95000000);
      expect(newCandle.volume).toBe(0.5);
    });

    it('merges OHLCV for trade in same candle period', async () => {
      const initialCandles: CandleData[] = [
        { time: 60, open: 90000000, high: 91000000, low: 89000000, close: 90500000, volume: 1.0 },
      ];
      mockFetchUpbitCandles.mockResolvedValue(initialCandles);

      let subscribedCallback: ((msg: Record<string, unknown>) => void) | null = null;
      mockUpbitSubscribe.mockImplementation((cb: (msg: Record<string, unknown>) => void) => {
        subscribedCallback = cb;
        return vi.fn();
      });

      const { result } = renderHook(() =>
        useChartPanelStream({ panelId: 'panel-1', symbol: 'BTCUSDT', interval: '1m' }),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Trade in the same period (time 60 * 1000 + 30000 → aligns to 60)
      act(() => {
        subscribedCallback!({
          type: 'trade',
          code: 'KRW-BTC',
          trade_price: 92000000,
          trade_volume: 0.3,
          trade_timestamp: 60 * 1000 + 30000, // alignToIntervalSec → 60
          ask_bid: 'BID',
          sequential_id: 2,
        });
      });

      expect(result.current.candles).toHaveLength(1);
      const merged = result.current.candles[0];
      expect(merged.open).toBe(90000000); // Unchanged
      expect(merged.high).toBe(92000000); // Updated (92M > 91M)
      expect(merged.low).toBe(89000000); // Unchanged
      expect(merged.close).toBe(92000000); // Updated to trade price
      expect(merged.volume).toBeCloseTo(1.3); // 1.0 + 0.3
    });

    it('filters trade events from other symbols', async () => {
      mockFetchUpbitCandles.mockResolvedValue(makeMockCandles(1, 60));

      let subscribedCallback: ((msg: Record<string, unknown>) => void) | null = null;
      mockUpbitSubscribe.mockImplementation((cb: (msg: Record<string, unknown>) => void) => {
        subscribedCallback = cb;
        return vi.fn();
      });

      const { result } = renderHook(() =>
        useChartPanelStream({ panelId: 'panel-1', symbol: 'BTCUSDT', interval: '1m' }),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Trade event for a different symbol
      act(() => {
        subscribedCallback!({
          type: 'trade',
          code: 'KRW-ETH', // Not KRW-BTC
          trade_price: 5000000,
          trade_volume: 1.0,
          trade_timestamp: 120 * 1000,
          ask_bid: 'BID',
          sequential_id: 3,
        });
      });

      // Should not have added a new candle
      expect(result.current.candles).toHaveLength(1);
    });

    it('handles unmapped symbol gracefully with empty state', async () => {
      const { result } = renderHook(() =>
        useChartPanelStream({ panelId: 'panel-1', symbol: 'BNBUSDT', interval: '1m' }),
      );

      // BNBUSDT has no upbit mapping — should immediately resolve with empty
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.candles).toEqual([]);
      expect(mockFetchUpbitCandles).not.toHaveBeenCalled();
      expect(mockUpbitConnect).not.toHaveBeenCalled();
    });

    it('cleans up upbit WS on unmount', async () => {
      const mockUnsubscribe = vi.fn();
      mockUpbitSubscribe.mockReturnValue(mockUnsubscribe);
      mockFetchUpbitCandles.mockResolvedValue([]);

      const { unmount } = renderHook(() =>
        useChartPanelStream({ panelId: 'panel-3', symbol: 'BTCUSDT', interval: '1m' }),
      );

      await waitFor(() => {
        expect(mockUpbitSubscribe).toHaveBeenCalled();
      });

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(mockUpbitDisconnectGroup).toHaveBeenCalledWith('multichart-panel-3');
      expect(mockUpbitDisconnect).toHaveBeenCalled();
    });

    it('reconnects when exchange switches from binance to upbit', async () => {
      // Start with binance
      mockExchange = 'binance';
      const binanceCandles = makeMockCandles(3, 1000);
      (fetchKlines as Mock).mockResolvedValue(binanceCandles);

      const { result, rerender } = renderHook(
        (props: { exchange: string }) => {
          mockExchange = props.exchange;
          return useChartPanelStream({ panelId: 'panel-1', symbol: 'BTCUSDT', interval: '1m' });
        },
        { initialProps: { exchange: 'binance' } },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.candles).toEqual(binanceCandles);

      // Switch to upbit
      const upbitCandles = makeMockCandles(2, 5000);
      mockFetchUpbitCandles.mockResolvedValue(upbitCandles);
      mockExchange = 'upbit';

      rerender({ exchange: 'upbit' });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.candles).toEqual(upbitCandles);
      });

      expect(mockFetchUpbitCandles).toHaveBeenCalledWith('KRW-BTC', '1m');
    });
  });
});
