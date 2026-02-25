// =============================================================================
// Upbit REST Client Unit Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchUpbitCandles,
  fetchUpbitOrderBook,
  fetchUpbitTickers,
  getUpbitCandleEndpoint,
} from './restClient';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// -----------------------------------------------------------------------------
// getUpbitCandleEndpoint
// -----------------------------------------------------------------------------

describe('getUpbitCandleEndpoint', () => {
  it('maps 1m to /candles/minutes/1', () => {
    expect(getUpbitCandleEndpoint('1m')).toBe('/candles/minutes/1');
  });

  it('maps 5m to /candles/minutes/5', () => {
    expect(getUpbitCandleEndpoint('5m')).toBe('/candles/minutes/5');
  });

  it('maps 15m to /candles/minutes/15', () => {
    expect(getUpbitCandleEndpoint('15m')).toBe('/candles/minutes/15');
  });

  it('maps 1h to /candles/minutes/60', () => {
    expect(getUpbitCandleEndpoint('1h')).toBe('/candles/minutes/60');
  });

  it('maps 4h to /candles/minutes/240', () => {
    expect(getUpbitCandleEndpoint('4h')).toBe('/candles/minutes/240');
  });

  it('maps 1d to /candles/days', () => {
    expect(getUpbitCandleEndpoint('1d')).toBe('/candles/days');
  });

  it('returns default for unknown interval', () => {
    expect(getUpbitCandleEndpoint('2w')).toBe('/candles/minutes/1');
  });
});

// -----------------------------------------------------------------------------
// fetchUpbitCandles
// -----------------------------------------------------------------------------

describe('fetchUpbitCandles', () => {
  it('fetches candles and returns time-ascending CandleData', async () => {
    const mockCandles = [
      {
        market: 'KRW-BTC',
        candle_date_time_utc: '2024-01-02T00:00:00',
        opening_price: 60000000,
        high_price: 61000000,
        low_price: 59000000,
        trade_price: 60500000,
        timestamp: 1704153600000,
        candle_acc_trade_price: 100000000,
        candle_acc_trade_volume: 1.5,
      },
      {
        market: 'KRW-BTC',
        candle_date_time_utc: '2024-01-01T00:00:00',
        opening_price: 59000000,
        high_price: 60000000,
        low_price: 58000000,
        trade_price: 59500000,
        timestamp: 1704067200000,
        candle_acc_trade_price: 80000000,
        candle_acc_trade_volume: 1.2,
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockCandles),
    });

    const result = await fetchUpbitCandles('KRW-BTC', '1m');

    // Should be reversed to time-ascending order
    expect(result).toHaveLength(2);
    expect(result[0].close).toBe(59500000);
    expect(result[1].close).toBe(60500000);
    expect(result[0].time).toBeLessThan(result[1].time);
  });

  it('throws on 4xx error without retry', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(fetchUpbitCandles('KRW-INVALID', '1m')).rejects.toThrow('not retryable');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// -----------------------------------------------------------------------------
// fetchUpbitOrderBook
// -----------------------------------------------------------------------------

describe('fetchUpbitOrderBook', () => {
  it('fetches orderbook and returns first result', async () => {
    const mockOrderbook = [
      {
        market: 'KRW-BTC',
        orderbook_units: [
          { ask_price: 60100000, bid_price: 60000000, ask_size: 0.5, bid_size: 0.3 },
        ],
        total_ask_size: 10.5,
        total_bid_size: 8.3,
        timestamp: 1704067200000,
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockOrderbook),
    });

    const result = await fetchUpbitOrderBook('KRW-BTC');
    expect(result.market).toBe('KRW-BTC');
    expect(result.orderbook_units).toHaveLength(1);
  });

  it('throws when response is empty array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await expect(fetchUpbitOrderBook('KRW-INVALID')).rejects.toThrow('No orderbook data');
  });
});

// -----------------------------------------------------------------------------
// fetchUpbitTickers
// -----------------------------------------------------------------------------

describe('fetchUpbitTickers', () => {
  it('returns empty array for empty input', async () => {
    const result = await fetchUpbitTickers([]);
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches tickers for given markets', async () => {
    const mockTickers = [
      {
        market: 'KRW-BTC',
        trade_price: 60000000,
        opening_price: 59000000,
        high_price: 61000000,
        low_price: 58000000,
        prev_closing_price: 59500000,
        signed_change_rate: 0.0169,
        acc_trade_volume_24h: 1500.5,
        acc_trade_price_24h: 90000000000,
        trade_timestamp: 1704067200000,
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockTickers),
    });

    const result = await fetchUpbitTickers(['KRW-BTC']);
    expect(result).toHaveLength(1);
    expect(result[0].market).toBe('KRW-BTC');
  });
});
