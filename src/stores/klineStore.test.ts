// =============================================================================
// Kline Store Unit Tests
// =============================================================================

import { useKlineStore } from './klineStore';
import type { CandleData } from '@/types/chart';
import { MAX_CANDLES } from '@/utils/constants';

// Helper to create a candle with sensible defaults
function createCandle(overrides: Partial<CandleData> = {}): CandleData {
  return {
    time: 1700000000,
    open: 50000,
    high: 51000,
    low: 49000,
    close: 50500,
    volume: 100,
    ...overrides,
  };
}

// Helper to reset store state between tests
function resetStore(): void {
  useKlineStore.getState().reset();
}

describe('klineStore', () => {
  beforeEach(() => {
    resetStore();
  });

  // ---------------------------------------------------------------------------
  // setCandles
  // ---------------------------------------------------------------------------

  describe('setCandles', () => {
    it('sets candles from an array', () => {
      const candles = [
        createCandle({ time: 1 }),
        createCandle({ time: 2 }),
        createCandle({ time: 3 }),
      ];

      useKlineStore.getState().setCandles(candles);
      const state = useKlineStore.getState();

      expect(state.candles).toHaveLength(3);
      expect(state.candles[0].time).toBe(1);
      expect(state.candles[2].time).toBe(3);
    });

    it('caps at MAX_CANDLES when given more', () => {
      const candles = Array.from({ length: MAX_CANDLES + 100 }, (_, i) =>
        createCandle({ time: i }),
      );

      useKlineStore.getState().setCandles(candles);
      const state = useKlineStore.getState();

      expect(state.candles).toHaveLength(MAX_CANDLES);
      // Should keep the most recent (last) candles
      expect(state.candles[0].time).toBe(100); // oldest kept
      expect(state.candles[MAX_CANDLES - 1].time).toBe(MAX_CANDLES + 99); // newest
    });

    it('replaces existing candles', () => {
      useKlineStore.getState().setCandles([createCandle({ time: 1 })]);
      useKlineStore.getState().setCandles([createCandle({ time: 10 }), createCandle({ time: 20 })]);

      const state = useKlineStore.getState();
      expect(state.candles).toHaveLength(2);
      expect(state.candles[0].time).toBe(10);
      expect(state.candles[1].time).toBe(20);
    });
  });

  // ---------------------------------------------------------------------------
  // addCandle
  // ---------------------------------------------------------------------------

  describe('addCandle', () => {
    it('appends a candle to the end', () => {
      useKlineStore.getState().setCandles([createCandle({ time: 1 }), createCandle({ time: 2 })]);

      useKlineStore.getState().addCandle(createCandle({ time: 3 }));
      const state = useKlineStore.getState();

      expect(state.candles).toHaveLength(3);
      expect(state.candles[2].time).toBe(3);
    });

    it('evicts the oldest candle when exceeding MAX_CANDLES', () => {
      // Fill to capacity
      const candles = Array.from({ length: MAX_CANDLES }, (_, i) => createCandle({ time: i }));
      useKlineStore.getState().setCandles(candles);
      expect(useKlineStore.getState().candles).toHaveLength(MAX_CANDLES);

      // Add one more — should evict the oldest (time: 0)
      useKlineStore.getState().addCandle(createCandle({ time: MAX_CANDLES }));
      const state = useKlineStore.getState();

      expect(state.candles).toHaveLength(MAX_CANDLES);
      expect(state.candles[0].time).toBe(1); // oldest is now time: 1
      expect(state.candles[MAX_CANDLES - 1].time).toBe(MAX_CANDLES); // newest
    });

    it('works on an empty array', () => {
      useKlineStore.getState().addCandle(createCandle({ time: 42 }));
      const state = useKlineStore.getState();

      expect(state.candles).toHaveLength(1);
      expect(state.candles[0].time).toBe(42);
    });

    it('replaces the last candle when timestamps match (in-progress → closed transition)', () => {
      useKlineStore
        .getState()
        .setCandles([createCandle({ time: 1 }), createCandle({ time: 2, close: 200 })]);

      // Simulate closed kline arriving with same timestamp as in-progress candle
      useKlineStore.getState().addCandle(createCandle({ time: 2, close: 250 }));
      const state = useKlineStore.getState();

      expect(state.candles).toHaveLength(2);
      expect(state.candles[1].time).toBe(2);
      expect(state.candles[1].close).toBe(250);
    });

    it('does not create duplicate timestamps after updateLastCandle + addCandle', () => {
      // Start with candle at time=1 (closed) and time=2 (in-progress)
      useKlineStore
        .getState()
        .setCandles([createCandle({ time: 1 }), createCandle({ time: 2, close: 100 })]);

      // Simulate: WebSocket sends in-progress update (same time=2)
      useKlineStore.getState().updateLastCandle(createCandle({ time: 2, close: 120 }));
      // Then kline closes: addCandle with same time=2
      useKlineStore.getState().addCandle(createCandle({ time: 2, close: 150 }));

      const state = useKlineStore.getState();
      // Should have exactly 2 candles (time=1, time=2), NOT 3
      expect(state.candles).toHaveLength(2);
      expect(state.candles[0].time).toBe(1);
      expect(state.candles[1].time).toBe(2);
      expect(state.candles[1].close).toBe(150);

      // Verify all timestamps are strictly ascending
      for (let i = 1; i < state.candles.length; i++) {
        expect(state.candles[i].time).toBeGreaterThan(state.candles[i - 1].time);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // updateLastCandle
  // ---------------------------------------------------------------------------

  describe('updateLastCandle', () => {
    it('replaces the last candle in the array', () => {
      useKlineStore
        .getState()
        .setCandles([createCandle({ time: 1, close: 100 }), createCandle({ time: 2, close: 200 })]);

      const updatedCandle = createCandle({ time: 2, close: 250, high: 260 });
      useKlineStore.getState().updateLastCandle(updatedCandle);

      const state = useKlineStore.getState();
      expect(state.candles).toHaveLength(2);
      expect(state.candles[1].close).toBe(250);
      expect(state.candles[1].high).toBe(260);
    });

    it('does not affect other candles', () => {
      useKlineStore
        .getState()
        .setCandles([
          createCandle({ time: 1, close: 100 }),
          createCandle({ time: 2, close: 200 }),
          createCandle({ time: 3, close: 300 }),
        ]);

      useKlineStore.getState().updateLastCandle(createCandle({ time: 3, close: 350 }));

      const state = useKlineStore.getState();
      expect(state.candles[0].close).toBe(100);
      expect(state.candles[1].close).toBe(200);
      expect(state.candles[2].close).toBe(350);
    });

    it('adds a candle if the array is empty', () => {
      useKlineStore.getState().updateLastCandle(createCandle({ time: 1, close: 500 }));

      const state = useKlineStore.getState();
      expect(state.candles).toHaveLength(1);
      expect(state.candles[0].close).toBe(500);
    });

    it('creates a new array reference (immutability)', () => {
      const initial = [createCandle({ time: 1 }), createCandle({ time: 2 })];
      useKlineStore.getState().setCandles(initial);
      const before = useKlineStore.getState().candles;

      useKlineStore.getState().updateLastCandle(createCandle({ time: 2, close: 999 }));
      const after = useKlineStore.getState().candles;

      expect(before).not.toBe(after);
    });
  });

  // ---------------------------------------------------------------------------
  // setInterval
  // ---------------------------------------------------------------------------

  describe('setInterval', () => {
    it('changes the interval', () => {
      useKlineStore.getState().setInterval('5m');
      expect(useKlineStore.getState().interval).toBe('5m');
    });

    it('accepts all valid intervals', () => {
      const intervals = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
      for (const interval of intervals) {
        useKlineStore.getState().setInterval(interval);
        expect(useKlineStore.getState().interval).toBe(interval);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // setLoading
  // ---------------------------------------------------------------------------

  describe('setLoading', () => {
    it('sets isLoading to true', () => {
      useKlineStore.getState().setLoading(true);
      expect(useKlineStore.getState().isLoading).toBe(true);
    });

    it('sets isLoading to false', () => {
      useKlineStore.getState().setLoading(true);
      useKlineStore.getState().setLoading(false);
      expect(useKlineStore.getState().isLoading).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // reset
  // ---------------------------------------------------------------------------

  describe('resetData', () => {
    it('clears candles and isLoading but preserves interval', () => {
      useKlineStore.getState().setCandles([createCandle({ time: 1 }), createCandle({ time: 2 })]);
      useKlineStore.getState().setInterval('4h');
      useKlineStore.getState().setLoading(true);

      useKlineStore.getState().resetData();
      const state = useKlineStore.getState();

      expect(state.candles).toEqual([]);
      expect(state.isLoading).toBe(false);
      // Interval MUST be preserved — resetting it would cause infinite
      // effect loops when useWebSocket re-runs on interval change
      expect(state.interval).toBe('4h');
    });
  });

  // ---------------------------------------------------------------------------
  // reset
  // ---------------------------------------------------------------------------

  describe('reset', () => {
    it('clears all state to initial values', () => {
      useKlineStore.getState().setCandles([createCandle({ time: 1 }), createCandle({ time: 2 })]);
      useKlineStore.getState().setInterval('4h');
      useKlineStore.getState().setLoading(true);

      useKlineStore.getState().reset();
      const state = useKlineStore.getState();

      expect(state.candles).toEqual([]);
      expect(state.interval).toBe('1m');
      expect(state.isLoading).toBe(false);
    });
  });
});
