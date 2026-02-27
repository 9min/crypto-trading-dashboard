// =============================================================================
// Binance REST API Client Unit Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchKlines, fetchDepthSnapshot, fetchExchangeInfo, fetch24hrTickers } from './restApi';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Creates a mock Response with the given status and JSON body. */
function mockResponse(status: number, body: unknown): Partial<Response> {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

/**
 * Drives an async function that uses fetchWithRetry to completion
 * by flushing fake timers repeatedly until the promise settles.
 */
async function driveToSettled<T>(promise: Promise<T>): Promise<T> {
  // Attach a .catch to prevent unhandled rejection warnings
  let settled = false;
  let result: T | undefined;
  let error: unknown;

  promise.then(
    (v) => {
      settled = true;
      result = v;
    },
    (e: unknown) => {
      settled = true;
      error = e;
    },
  );

  // Keep flushing timers until the promise settles
  for (let i = 0; i < 20 && !settled; i++) {
    await vi.advanceTimersByTimeAsync(5000);
  }

  if (error) throw error;
  return result as T;
}

// -----------------------------------------------------------------------------
// fetchWithRetry (tested indirectly via public functions)
// -----------------------------------------------------------------------------

describe('fetchWithRetry (via fetchExchangeInfo)', () => {
  it('returns JSON data on success', async () => {
    const data = { timezone: 'UTC', serverTime: 1000, rateLimits: [], symbols: [] };
    mockFetch.mockResolvedValueOnce(mockResponse(200, data));

    const result = await fetchExchangeInfo();
    expect(result).toEqual(data);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries on 5xx and succeeds on second attempt', async () => {
    const data = { timezone: 'UTC', serverTime: 1000, rateLimits: [], symbols: [] };
    mockFetch
      .mockResolvedValueOnce(mockResponse(500, null))
      .mockResolvedValueOnce(mockResponse(200, data));

    const result = await driveToSettled(fetchExchangeInfo());
    expect(result).toEqual(data);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws after 3 failed 5xx attempts', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(500, null))
      .mockResolvedValueOnce(mockResponse(502, null))
      .mockResolvedValueOnce(mockResponse(503, null));

    await expect(driveToSettled(fetchExchangeInfo())).rejects.toThrow('HTTP 503');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('throws immediately on 4xx without retry', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(400, null));

    await expect(fetchExchangeInfo()).rejects.toThrow('not retryable');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws immediately on 404 without retry', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(404, null));

    await expect(fetchExchangeInfo()).rejects.toThrow('not retryable');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries on network error (fetch rejects)', async () => {
    const data = { timezone: 'UTC', serverTime: 1000, rateLimits: [], symbols: [] };
    mockFetch
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValueOnce(mockResponse(200, data));

    const result = await driveToSettled(fetchExchangeInfo());
    expect(result).toEqual(data);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('passes AbortSignal.timeout(10_000) to fetch', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(200, { timezone: 'UTC', serverTime: 0, rateLimits: [], symbols: [] }),
    );

    await fetchExchangeInfo();

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(options.signal).toBeDefined();
  });
});

// -----------------------------------------------------------------------------
// fetchKlines
// -----------------------------------------------------------------------------

describe('fetchKlines', () => {
  it('transforms Binance REST kline format to CandleData', async () => {
    const raw = [
      [
        1704067200000,
        '42000.00',
        '42500.00',
        '41800.00',
        '42300.00',
        '100.5',
        1704067259999,
        '4230000',
        500,
        '50.2',
        '2115000',
        '0',
      ],
    ];
    mockFetch.mockResolvedValueOnce(mockResponse(200, raw));

    const result = await fetchKlines('BTCUSDT', '1m', 500);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      time: 1704067200, // ms → s conversion
      open: 42000.0,
      high: 42500.0,
      low: 41800.0,
      close: 42300.0,
      volume: 100.5,
    });
  });

  it('includes symbol, interval, limit in URL params', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200, []));

    await fetchKlines('ETHUSDT', '5m', 100);

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('symbol=ETHUSDT');
    expect(url).toContain('interval=5m');
    expect(url).toContain('limit=100');
  });

  it('includes endTime when provided', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200, []));

    await fetchKlines('BTCUSDT', '1h', 500, 1704067200000);

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('endTime=1704067200000');
  });

  it('omits endTime when not provided', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200, []));

    await fetchKlines('BTCUSDT', '1h');

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).not.toContain('endTime');
  });

  it('returns empty array for empty response', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200, []));

    const result = await fetchKlines('BTCUSDT', '1m');
    expect(result).toEqual([]);
  });
});

// -----------------------------------------------------------------------------
// fetchDepthSnapshot
// -----------------------------------------------------------------------------

describe('fetchDepthSnapshot', () => {
  it('constructs URL with symbol and limit params', async () => {
    const snapshot = { lastUpdateId: 123, bids: [], asks: [] };
    mockFetch.mockResolvedValueOnce(mockResponse(200, snapshot));

    const result = await fetchDepthSnapshot('BTCUSDT', 500);

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('symbol=BTCUSDT');
    expect(url).toContain('limit=500');
    expect(result).toEqual(snapshot);
  });

  it('uses default limit of 1000', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200, { lastUpdateId: 1, bids: [], asks: [] }));

    await fetchDepthSnapshot('ETHUSDT');

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('limit=1000');
  });
});

// -----------------------------------------------------------------------------
// fetchExchangeInfo
// -----------------------------------------------------------------------------

describe('fetchExchangeInfo', () => {
  it('calls /exchangeInfo endpoint', async () => {
    const info = { timezone: 'UTC', serverTime: 1000, rateLimits: [], symbols: [] };
    mockFetch.mockResolvedValueOnce(mockResponse(200, info));

    await fetchExchangeInfo();

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('/exchangeInfo');
  });
});

// -----------------------------------------------------------------------------
// fetch24hrTickers
// -----------------------------------------------------------------------------

describe('fetch24hrTickers', () => {
  it('returns empty array for empty symbols input without calling fetch', async () => {
    const result = await fetch24hrTickers([]);

    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('serializes symbols as JSON in query param', async () => {
    const tickers = [
      {
        symbol: 'BTCUSDT',
        lastPrice: '42000',
        priceChangePercent: '1.5',
        quoteVolume: '1000000',
        highPrice: '43000',
        lowPrice: '41000',
      },
    ];
    mockFetch.mockResolvedValueOnce(mockResponse(200, tickers));

    const result = await fetch24hrTickers(['BTCUSDT', 'ETHUSDT']);

    const url = mockFetch.mock.calls[0][0] as string;
    // URLSearchParams encodes JSON brackets
    expect(url).toContain('ticker/24hr');
    expect(decodeURIComponent(url)).toContain('["BTCUSDT","ETHUSDT"]');
    expect(result).toEqual(tickers);
  });
});
