// =============================================================================
// Upbit Message Router Unit Tests
// =============================================================================

import { describe, it, expect, vi } from 'vitest';
import { createUpbitMessageRouter } from './messageRouter';
import type { UpbitTickerEvent, UpbitTradeEvent, UpbitOrderBookEvent } from '@/types/upbit';

// -----------------------------------------------------------------------------
// Test Data
// -----------------------------------------------------------------------------

const mockTickerEvent: UpbitTickerEvent = {
  type: 'ticker',
  code: 'KRW-BTC',
  trade_price: 60000000,
  opening_price: 59000000,
  high_price: 61000000,
  low_price: 58000000,
  prev_closing_price: 59500000,
  signed_change_rate: 0.0169,
  signed_change_price: 1000000,
  acc_trade_volume_24h: 1500.5,
  acc_trade_price_24h: 90000000000,
  trade_timestamp: 1704067200000,
  change: 'RISE',
};

const mockTradeEvent: UpbitTradeEvent = {
  type: 'trade',
  code: 'KRW-BTC',
  trade_price: 60000000,
  trade_volume: 0.001,
  ask_bid: 'BID',
  trade_timestamp: 1704067200000,
  sequential_id: 12345,
};

const mockOrderBookEvent: UpbitOrderBookEvent = {
  type: 'orderbook',
  code: 'KRW-BTC',
  total_ask_size: 10.5,
  total_bid_size: 8.3,
  orderbook_units: [{ ask_price: 60100000, bid_price: 60000000, ask_size: 0.5, bid_size: 0.3 }],
  timestamp: 1704067200000,
};

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('createUpbitMessageRouter', () => {
  it('routes ticker events to onTicker handler', () => {
    const onTicker = vi.fn();
    const router = createUpbitMessageRouter({ onTicker });

    router(mockTickerEvent);

    expect(onTicker).toHaveBeenCalledTimes(1);
    expect(onTicker).toHaveBeenCalledWith(mockTickerEvent);
  });

  it('routes trade events to onTrade handler', () => {
    const onTrade = vi.fn();
    const router = createUpbitMessageRouter({ onTrade });

    router(mockTradeEvent);

    expect(onTrade).toHaveBeenCalledTimes(1);
    expect(onTrade).toHaveBeenCalledWith(mockTradeEvent);
  });

  it('routes orderbook events to onOrderBook handler', () => {
    const onOrderBook = vi.fn();
    const router = createUpbitMessageRouter({ onOrderBook });

    router(mockOrderBookEvent);

    expect(onOrderBook).toHaveBeenCalledTimes(1);
    expect(onOrderBook).toHaveBeenCalledWith(mockOrderBookEvent);
  });

  it('does not call unregistered handlers', () => {
    const onTicker = vi.fn();
    const router = createUpbitMessageRouter({ onTicker });

    // Send a trade event — onTicker should NOT be called
    router(mockTradeEvent);
    expect(onTicker).not.toHaveBeenCalled();
  });

  it('does not throw when handler is undefined', () => {
    const router = createUpbitMessageRouter({});

    expect(() => router(mockTickerEvent)).not.toThrow();
    expect(() => router(mockTradeEvent)).not.toThrow();
    expect(() => router(mockOrderBookEvent)).not.toThrow();
  });

  it('routes multiple events correctly', () => {
    const onTicker = vi.fn();
    const onTrade = vi.fn();
    const onOrderBook = vi.fn();
    const router = createUpbitMessageRouter({ onTicker, onTrade, onOrderBook });

    router(mockTickerEvent);
    router(mockTradeEvent);
    router(mockOrderBookEvent);
    router(mockTickerEvent);

    expect(onTicker).toHaveBeenCalledTimes(2);
    expect(onTrade).toHaveBeenCalledTimes(1);
    expect(onOrderBook).toHaveBeenCalledTimes(1);
  });
});
