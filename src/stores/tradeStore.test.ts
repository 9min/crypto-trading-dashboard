// =============================================================================
// Trade Store Unit Tests
// =============================================================================

import { useTradeStore } from './tradeStore';
import type { TradeEntry } from '@/types/chart';
import { MAX_TRADES } from '@/utils/constants';

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
  useTradeStore.getState().reset();
}

describe('tradeStore', () => {
  beforeEach(() => {
    resetStore();
  });

  // ---------------------------------------------------------------------------
  // addTrade
  // ---------------------------------------------------------------------------

  describe('addTrade', () => {
    it('prepends a trade to the list', () => {
      const trade1 = createTrade({ id: 1, price: 50000 });
      const trade2 = createTrade({ id: 2, price: 51000 });

      useTradeStore.getState().addTrade(trade1);
      useTradeStore.getState().addTrade(trade2);

      const state = useTradeStore.getState();
      expect(state.trades).toHaveLength(2);
      // Newest first
      expect(state.trades[0].id).toBe(2);
      expect(state.trades[1].id).toBe(1);
    });

    it('caps trades at MAX_TRADES', () => {
      // Add MAX_TRADES + 5 trades
      for (let i = 0; i < MAX_TRADES + 5; i++) {
        useTradeStore.getState().addTrade(createTrade({ id: i, price: 50000 + i }));
      }

      const state = useTradeStore.getState();
      expect(state.trades).toHaveLength(MAX_TRADES);
      // Most recent trade should be at index 0
      expect(state.trades[0].id).toBe(MAX_TRADES + 4);
    });

    it('does not exceed MAX_TRADES when adding one past capacity', () => {
      // Fill to capacity
      for (let i = 0; i < MAX_TRADES; i++) {
        useTradeStore.getState().addTrade(createTrade({ id: i }));
      }
      expect(useTradeStore.getState().trades).toHaveLength(MAX_TRADES);

      // Add one more
      useTradeStore.getState().addTrade(createTrade({ id: MAX_TRADES }));
      expect(useTradeStore.getState().trades).toHaveLength(MAX_TRADES);
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

      const state = useTradeStore.getState();
      expect(state.trades).toHaveLength(2);
      expect(state.trades[0].id).toBe(10);
    });

    it('sets lastPrice from the first (newest) trade', () => {
      useTradeStore
        .getState()
        .setTrades([createTrade({ id: 10, price: 60000 }), createTrade({ id: 11, price: 59000 })]);

      expect(useTradeStore.getState().lastPrice).toBe(60000);
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
      expect(useTradeStore.getState().trades).toHaveLength(MAX_TRADES);
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

      expect(state.trades).toEqual([]);
      expect(state.lastPrice).toBe(0);
      expect(state.lastPriceDirection).toBe('neutral');
    });
  });
});
