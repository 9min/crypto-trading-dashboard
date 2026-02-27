// =============================================================================
// Trade Store
// =============================================================================
// Manages the trade history feed displayed in the trades widget.
// Internally uses a Float64Array RingBuffer for O(1) push and zero-allocation
// reads from the Canvas renderer. React-accessible TradeEntry[] is materialized
// on demand via toTradeEntries().
// =============================================================================

import { create } from 'zustand';
import type { TradeEntry } from '@/types/chart';
import { RingBuffer } from '@/utils/ringBuffer';
import {
  MAX_TRADES,
  TRADE_FIELDS_PER_ENTRY,
  TRADE_FIELD_ID,
  TRADE_FIELD_PRICE,
  TRADE_FIELD_QUANTITY,
  TRADE_FIELD_TIME,
  TRADE_FIELD_IS_BUYER_MAKER,
  DEFAULT_WHALE_THRESHOLD,
} from '@/utils/constants';
import { useToastStore } from '@/stores/toastStore';
import { formatPrice } from '@/utils/formatPrice';
import { saveWhaleThreshold } from '@/utils/localPreferences';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Direction of the last price change relative to the previous trade */
type PriceDirection = 'up' | 'down' | 'neutral';

interface TradeStoreState {
  /** RingBuffer backing store — Canvas renderer reads directly via getField() */
  buffer: RingBuffer;
  /** Last trade ID for dirty detection (Canvas renderer skips redraw if unchanged) */
  lastTradeId: number;
  /** Most recent trade price (0 when no trades have been received) */
  lastPrice: number;
  /** Direction of last price movement */
  lastPriceDirection: PriceDirection;
  /** Minimum notional value (price * quantity) to classify a trade as a whale trade */
  whaleThreshold: number;
}

interface TradeStoreActions {
  /** Push a single trade into the ring buffer — O(1) */
  addTrade: (trade: TradeEntry) => void;
  /** Bulk-set trades (e.g., from REST API initial fetch) */
  setTrades: (trades: TradeEntry[]) => void;
  /** Materialize buffer contents as TradeEntry[] (newest-first) for React UI */
  toTradeEntries: () => TradeEntry[];
  /** Update the whale trade detection threshold */
  setWhaleThreshold: (threshold: number) => void;
  /** Reset store to initial state */
  reset: () => void;
}

type TradeStore = TradeStoreState & TradeStoreActions;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Computes the price direction by comparing the new price against the previous.
 */
function computePriceDirection(newPrice: number, previousPrice: number): PriceDirection {
  if (previousPrice === 0) return 'neutral';
  if (newPrice > previousPrice) return 'up';
  if (newPrice < previousPrice) return 'down';
  return 'neutral';
}

/**
 * Packs a TradeEntry into a number[] suitable for RingBuffer.push().
 */
function packTrade(trade: TradeEntry): number[] {
  return [trade.id, trade.price, trade.quantity, trade.time, trade.isBuyerMaker ? 1 : 0];
}

/**
 * Creates a fresh RingBuffer instance for trade data.
 */
function createTradeBuffer(): RingBuffer {
  return new RingBuffer(MAX_TRADES, TRADE_FIELDS_PER_ENTRY);
}

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const INITIAL_STATE: TradeStoreState = {
  buffer: createTradeBuffer(),
  lastTradeId: -1,
  lastPrice: 0,
  lastPriceDirection: 'neutral',
  whaleThreshold: DEFAULT_WHALE_THRESHOLD,
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useTradeStore = create<TradeStore>()((set, get) => ({
  // -- State ------------------------------------------------------------------
  ...INITIAL_STATE,

  // -- Actions ----------------------------------------------------------------
  addTrade: (trade: TradeEntry): void => {
    const state = get();
    const direction = computePriceDirection(trade.price, state.lastPrice);

    state.buffer.push(packTrade(trade));

    // Whale trade toast notification (ingestion-time check)
    const notional = trade.price * trade.quantity;
    if (notional >= state.whaleThreshold) {
      const side = trade.isBuyerMaker ? 'SELL' : 'BUY';
      const formatted =
        notional >= 1_000_000
          ? `$${(notional / 1_000_000).toFixed(1)}M`
          : notional >= 1_000
            ? `$${(notional / 1_000).toFixed(1)}K`
            : `$${notional.toFixed(0)}`;
      useToastStore
        .getState()
        .addToast(`Whale ${side}: ${formatted} @ ${formatPrice(trade.price)}`, 'warning', 6000);
    }

    set({
      lastTradeId: trade.id,
      lastPrice: trade.price,
      lastPriceDirection: direction,
    });
  },

  /**
   * Bulk-set trades from an external source (e.g., REST API).
   * Input must be newest-first. Buffer stores oldest-first internally,
   * so we iterate in reverse.
   */
  setTrades: (trades: TradeEntry[]): void => {
    const buffer = createTradeBuffer();
    const capped = trades.length > MAX_TRADES ? trades.slice(0, MAX_TRADES) : trades;

    // Push oldest-first so that buffer order matches chronological order
    for (let i = capped.length - 1; i >= 0; i--) {
      buffer.push(packTrade(capped[i]));
    }

    const lastPrice = capped.length > 0 ? capped[0].price : 0;
    const lastTradeId = capped.length > 0 ? capped[0].id : -1;

    set({
      buffer,
      lastTradeId,
      lastPrice,
      lastPriceDirection: 'neutral',
    });
  },

  toTradeEntries: (): TradeEntry[] => {
    const { buffer } = get();
    const result: TradeEntry[] = [];

    // Return newest-first (reverse iteration over the buffer)
    for (let i = buffer.length - 1; i >= 0; i--) {
      const id = buffer.getField(i, TRADE_FIELD_ID);
      const price = buffer.getField(i, TRADE_FIELD_PRICE);
      const quantity = buffer.getField(i, TRADE_FIELD_QUANTITY);
      const time = buffer.getField(i, TRADE_FIELD_TIME);
      const isBuyerMaker = buffer.getField(i, TRADE_FIELD_IS_BUYER_MAKER);

      if (
        id === null ||
        price === null ||
        quantity === null ||
        time === null ||
        isBuyerMaker === null
      ) {
        continue;
      }

      result.push({
        id,
        price,
        quantity,
        time,
        isBuyerMaker: isBuyerMaker === 1,
      });
    }

    return result;
  },

  setWhaleThreshold: (threshold: number): void => {
    saveWhaleThreshold(threshold);
    set({ whaleThreshold: threshold });
  },

  reset: (): void => {
    set({
      buffer: createTradeBuffer(),
      lastTradeId: -1,
      lastPrice: 0,
      lastPriceDirection: 'neutral',
      whaleThreshold: get().whaleThreshold,
    });
  },
}));

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export type { PriceDirection, TradeStoreState, TradeStoreActions, TradeStore };
