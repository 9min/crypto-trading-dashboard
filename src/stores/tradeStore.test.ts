// =============================================================================
// Trade Store Unit Tests
// =============================================================================

import { useTradeStore } from './tradeStore';
import { useToastStore } from './toastStore';
import type { TradeEntry } from '@/types/chart';
import { MAX_TRADES, DEFAULT_WHALE_THRESHOLD } from '@/utils/constants';

vi.mock('@/utils/localPreferences', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/localPreferences')>();
  return {
    ...actual,
    saveWhaleThreshold: vi.fn(),
    saveWhaleAlertEnabled: vi.fn(),
  };
});

import { saveWhaleThreshold, saveWhaleAlertEnabled } from '@/utils/localPreferences';

// Helper to create a trade entry with sensible defaults
function createTrade(overrides: Partial<TradeEntry> = {}): TradeEntry {
  return {
    id: 1,
    price: 50000,
    quantity: 0.5,
    time: Date.now(),
    isBuyerMaker: false,
    ...overrides,
  };
}

// Helper to reset store state between tests
function resetStore(): void {
  useTradeStore.setState({ whaleThreshold: DEFAULT_WHALE_THRESHOLD, isWhaleAlertEnabled: false });
  useTradeStore.getState().reset();
  useToastStore.setState({ toasts: [] });
}

describe('tradeStore', () => {
  beforeEach(() => {
    resetStore();
  });

  // ---------------------------------------------------------------------------
  // addTrade
  // ---------------------------------------------------------------------------

  describe('addTrade', () => {
    it('adds a trade to the buffer', () => {
      const trade1 = createTrade({ id: 1, price: 50000 });
      const trade2 = createTrade({ id: 2, price: 51000 });

      useTradeStore.getState().addTrade(trade1);
      useTradeStore.getState().addTrade(trade2);

      const state = useTradeStore.getState();
      expect(state.buffer.length).toBe(2);
      expect(state.lastTradeId).toBe(2);
    });

    it('toTradeEntries returns newest-first order', () => {
      useTradeStore.getState().addTrade(createTrade({ id: 1, price: 50000 }));
      useTradeStore.getState().addTrade(createTrade({ id: 2, price: 51000 }));

      const entries = useTradeStore.getState().toTradeEntries();
      expect(entries).toHaveLength(2);
      // Newest first
      expect(entries[0].id).toBe(2);
      expect(entries[1].id).toBe(1);
    });

    it('caps trades at MAX_TRADES', () => {
      // Add MAX_TRADES + 5 trades
      for (let i = 0; i < MAX_TRADES + 5; i++) {
        useTradeStore.getState().addTrade(createTrade({ id: i, price: 50000 + i }));
      }

      const state = useTradeStore.getState();
      expect(state.buffer.length).toBe(MAX_TRADES);

      // Most recent trade should be first in toTradeEntries
      const entries = state.toTradeEntries();
      expect(entries[0].id).toBe(MAX_TRADES + 4);
    });

    it('does not exceed MAX_TRADES when adding one past capacity', () => {
      // Fill to capacity
      for (let i = 0; i < MAX_TRADES; i++) {
        useTradeStore.getState().addTrade(createTrade({ id: i }));
      }
      expect(useTradeStore.getState().buffer.length).toBe(MAX_TRADES);

      // Add one more
      useTradeStore.getState().addTrade(createTrade({ id: MAX_TRADES }));
      expect(useTradeStore.getState().buffer.length).toBe(MAX_TRADES);
    });

    it('preserves isBuyerMaker flag correctly', () => {
      useTradeStore.getState().addTrade(createTrade({ id: 1, isBuyerMaker: true }));
      useTradeStore.getState().addTrade(createTrade({ id: 2, isBuyerMaker: false }));

      const entries = useTradeStore.getState().toTradeEntries();
      // newest first
      expect(entries[0].isBuyerMaker).toBe(false);
      expect(entries[1].isBuyerMaker).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // lastPrice and lastPriceDirection
  // ---------------------------------------------------------------------------

  describe('lastPrice and lastPriceDirection tracking', () => {
    it('starts with lastPrice 0 and neutral direction', () => {
      const state = useTradeStore.getState();
      expect(state.lastPrice).toBe(0);
      expect(state.lastPriceDirection).toBe('neutral');
    });

    it('sets lastPrice from the first trade with neutral direction', () => {
      useTradeStore.getState().addTrade(createTrade({ price: 50000 }));

      const state = useTradeStore.getState();
      expect(state.lastPrice).toBe(50000);
      // First trade has previousPrice === 0, so direction is neutral
      expect(state.lastPriceDirection).toBe('neutral');
    });

    it('detects upward price movement', () => {
      useTradeStore.getState().addTrade(createTrade({ id: 1, price: 50000 }));
      useTradeStore.getState().addTrade(createTrade({ id: 2, price: 51000 }));

      const state = useTradeStore.getState();
      expect(state.lastPrice).toBe(51000);
      expect(state.lastPriceDirection).toBe('up');
    });

    it('detects downward price movement', () => {
      useTradeStore.getState().addTrade(createTrade({ id: 1, price: 50000 }));
      useTradeStore.getState().addTrade(createTrade({ id: 2, price: 49000 }));

      const state = useTradeStore.getState();
      expect(state.lastPrice).toBe(49000);
      expect(state.lastPriceDirection).toBe('down');
    });

    it('detects neutral when same price', () => {
      useTradeStore.getState().addTrade(createTrade({ id: 1, price: 50000 }));
      useTradeStore.getState().addTrade(createTrade({ id: 2, price: 50000 }));

      const state = useTradeStore.getState();
      expect(state.lastPrice).toBe(50000);
      expect(state.lastPriceDirection).toBe('neutral');
    });

    it('tracks direction changes across multiple trades', () => {
      useTradeStore.getState().addTrade(createTrade({ id: 1, price: 100 }));
      useTradeStore.getState().addTrade(createTrade({ id: 2, price: 200 }));
      expect(useTradeStore.getState().lastPriceDirection).toBe('up');

      useTradeStore.getState().addTrade(createTrade({ id: 3, price: 150 }));
      expect(useTradeStore.getState().lastPriceDirection).toBe('down');

      useTradeStore.getState().addTrade(createTrade({ id: 4, price: 150 }));
      expect(useTradeStore.getState().lastPriceDirection).toBe('neutral');
    });
  });

  // ---------------------------------------------------------------------------
  // setTrades
  // ---------------------------------------------------------------------------

  describe('setTrades', () => {
    it('replaces all trades', () => {
      useTradeStore.getState().addTrade(createTrade({ id: 1 }));
      useTradeStore.getState().addTrade(createTrade({ id: 2 }));

      const newTrades = [
        createTrade({ id: 10, price: 60000 }),
        createTrade({ id: 11, price: 61000 }),
      ];
      useTradeStore.getState().setTrades(newTrades);

      const entries = useTradeStore.getState().toTradeEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0].id).toBe(10);
    });

    it('sets lastPrice from the first (newest) trade', () => {
      useTradeStore
        .getState()
        .setTrades([createTrade({ id: 10, price: 60000 }), createTrade({ id: 11, price: 59000 })]);

      expect(useTradeStore.getState().lastPrice).toBe(60000);
    });

    it('sets lastTradeId from the first (newest) trade', () => {
      useTradeStore
        .getState()
        .setTrades([createTrade({ id: 10, price: 60000 }), createTrade({ id: 11, price: 59000 })]);

      expect(useTradeStore.getState().lastTradeId).toBe(10);
    });

    it('sets direction to neutral on setTrades', () => {
      // First create some direction
      useTradeStore.getState().addTrade(createTrade({ price: 100 }));
      useTradeStore.getState().addTrade(createTrade({ price: 200 }));
      expect(useTradeStore.getState().lastPriceDirection).toBe('up');

      // setTrades resets direction
      useTradeStore.getState().setTrades([createTrade({ price: 300 })]);
      expect(useTradeStore.getState().lastPriceDirection).toBe('neutral');
    });

    it('caps at MAX_TRADES', () => {
      const manyTrades = Array.from({ length: MAX_TRADES + 10 }, (_, i) => createTrade({ id: i }));

      useTradeStore.getState().setTrades(manyTrades);
      expect(useTradeStore.getState().buffer.length).toBe(MAX_TRADES);
    });

    it('preserves chronological order in buffer after setTrades', () => {
      // Input is newest-first: [id=3, id=2, id=1]
      const trades = [
        createTrade({ id: 3, price: 53000, time: 3000 }),
        createTrade({ id: 2, price: 52000, time: 2000 }),
        createTrade({ id: 1, price: 51000, time: 1000 }),
      ];
      useTradeStore.getState().setTrades(trades);

      // toTradeEntries should return newest-first
      const entries = useTradeStore.getState().toTradeEntries();
      expect(entries[0].id).toBe(3);
      expect(entries[1].id).toBe(2);
      expect(entries[2].id).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // toTradeEntries
  // ---------------------------------------------------------------------------

  describe('toTradeEntries', () => {
    it('returns empty array when buffer is empty', () => {
      expect(useTradeStore.getState().toTradeEntries()).toEqual([]);
    });

    it('returns TradeEntry objects with correct types', () => {
      useTradeStore
        .getState()
        .addTrade(
          createTrade({ id: 42, price: 50000, quantity: 1.5, time: 1000, isBuyerMaker: true }),
        );

      const entries = useTradeStore.getState().toTradeEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({
        id: 42,
        price: 50000,
        quantity: 1.5,
        time: 1000,
        isBuyerMaker: true,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // reset
  // ---------------------------------------------------------------------------

  describe('reset', () => {
    it('clears all state to initial values', () => {
      useTradeStore.getState().addTrade(createTrade({ price: 50000 }));
      useTradeStore.getState().addTrade(createTrade({ price: 51000 }));

      useTradeStore.getState().reset();
      const state = useTradeStore.getState();

      expect(state.buffer.length).toBe(0);
      expect(state.toTradeEntries()).toEqual([]);
      expect(state.lastPrice).toBe(0);
      expect(state.lastTradeId).toBe(-1);
      expect(state.lastPriceDirection).toBe('neutral');
    });

    it('preserves whale threshold through reset', () => {
      useTradeStore.getState().setWhaleThreshold(100_000);
      useTradeStore.getState().reset();
      expect(useTradeStore.getState().whaleThreshold).toBe(100_000);
    });
  });

  // ---------------------------------------------------------------------------
  // Whale Threshold
  // ---------------------------------------------------------------------------

  describe('whaleThreshold', () => {
    it('has default whale threshold', () => {
      expect(useTradeStore.getState().whaleThreshold).toBe(DEFAULT_WHALE_THRESHOLD);
    });

    it('setWhaleThreshold updates threshold and persists', () => {
      useTradeStore.getState().setWhaleThreshold(100_000);

      expect(useTradeStore.getState().whaleThreshold).toBe(100_000);
      expect(saveWhaleThreshold).toHaveBeenCalledWith(100_000);
    });

    it('triggers toast for whale trade above threshold', () => {
      useTradeStore.getState().setWhaleAlertEnabled(true);
      useTradeStore.getState().setWhaleThreshold(10_000);

      // Trade with notional = 50000 * 1 = 50000 >= 10000 → whale
      useTradeStore.getState().addTrade(createTrade({ id: 1, price: 50000, quantity: 1 }));

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe('warning');
      expect(toasts[0].message).toContain('Whale');
    });

    it('does not trigger toast for trades below threshold', () => {
      useTradeStore.getState().setWhaleAlertEnabled(true);
      useTradeStore.getState().setWhaleThreshold(100_000);

      // Trade with notional = 50000 * 0.5 = 25000 < 100000
      useTradeStore.getState().addTrade(createTrade({ id: 1, price: 50000, quantity: 0.5 }));

      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it('formats whale toast with K suffix', () => {
      useTradeStore.getState().setWhaleAlertEnabled(true);
      useTradeStore.getState().setWhaleThreshold(10_000);

      // notional = 50000 * 1 = 50000 → "$50.0K"
      useTradeStore
        .getState()
        .addTrade(createTrade({ id: 1, price: 50000, quantity: 1, isBuyerMaker: false }));

      const toasts = useToastStore.getState().toasts;
      expect(toasts[0].message).toContain('BUY');
      expect(toasts[0].message).toContain('$50.0K');
    });

    it('formats whale toast with M suffix for large trades', () => {
      useTradeStore.getState().setWhaleAlertEnabled(true);
      useTradeStore.getState().setWhaleThreshold(10_000);

      // notional = 50000 * 30 = 1500000 → "$1.5M"
      useTradeStore
        .getState()
        .addTrade(createTrade({ id: 1, price: 50000, quantity: 30, isBuyerMaker: true }));

      const toasts = useToastStore.getState().toasts;
      expect(toasts[0].message).toContain('SELL');
      expect(toasts[0].message).toContain('$1.5M');
    });
  });

  // ---------------------------------------------------------------------------
  // Whale Alert Enabled
  // ---------------------------------------------------------------------------

  describe('isWhaleAlertEnabled', () => {
    it('defaults to false', () => {
      expect(useTradeStore.getState().isWhaleAlertEnabled).toBe(false);
    });

    it('setWhaleAlertEnabled updates state and persists', () => {
      useTradeStore.getState().setWhaleAlertEnabled(false);

      expect(useTradeStore.getState().isWhaleAlertEnabled).toBe(false);
      expect(saveWhaleAlertEnabled).toHaveBeenCalledWith(false);
    });

    it('suppresses whale toast when disabled', () => {
      useTradeStore.getState().setWhaleThreshold(10_000);
      useTradeStore.getState().setWhaleAlertEnabled(false);

      // Trade with notional = 50000 * 1 = 50000 >= 10000 → would be whale, but alerts disabled
      useTradeStore.getState().addTrade(createTrade({ id: 1, price: 50000, quantity: 1 }));

      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it('shows whale toast when re-enabled', () => {
      useTradeStore.getState().setWhaleThreshold(10_000);
      useTradeStore.getState().setWhaleAlertEnabled(false);
      useTradeStore.getState().setWhaleAlertEnabled(true);

      useTradeStore.getState().addTrade(createTrade({ id: 1, price: 50000, quantity: 1 }));

      expect(useToastStore.getState().toasts).toHaveLength(1);
      expect(useToastStore.getState().toasts[0].message).toContain('Whale');
    });

    it('preserves isWhaleAlertEnabled through reset', () => {
      useTradeStore.getState().setWhaleAlertEnabled(true);
      useTradeStore.getState().reset();
      expect(useTradeStore.getState().isWhaleAlertEnabled).toBe(true);
    });
  });
});
