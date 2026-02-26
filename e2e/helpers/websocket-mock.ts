import type { Page } from '@playwright/test';
import type {
  BinanceCombinedStreamMessage,
  BinanceKlineEvent,
  BinanceDepthEvent,
  BinanceTradeEvent,
  BinanceMiniTickerEvent,
  BinanceKlineRaw,
  BinanceDepthSnapshot,
} from '@/types/binance';

// =============================================================================
// WebSocket & REST API Mock Helpers
// =============================================================================
// Intercepts Binance and Upbit WebSocket connections using page.routeWebSocket()
// and REST API calls using page.route(). Provides stable mock data so E2E tests
// don't depend on live exchange servers.
// =============================================================================

// -----------------------------------------------------------------------------
// Mock Data Factories
// -----------------------------------------------------------------------------

const NOW = Date.now();

// Align to current minute boundary (same logic as real Binance: kline open time is the minute start)
const CURRENT_MINUTE = Math.floor(NOW / 60000) * 60000;

function createMockKlineEvent(symbol = 'btcusdt'): BinanceCombinedStreamMessage<BinanceKlineEvent> {
  return {
    stream: `${symbol}@kline_1m`,
    data: {
      e: 'kline',
      E: NOW,
      s: symbol.toUpperCase(),
      k: {
        t: CURRENT_MINUTE,
        T: CURRENT_MINUTE + 59999,
        s: symbol.toUpperCase(),
        i: '1m',
        f: 100000,
        L: 100050,
        o: '67000.00',
        c: '67250.50',
        h: '67300.00',
        l: '66950.00',
        v: '12.345',
        n: 50,
        x: false,
        q: '830000.00',
        V: '6.123',
        Q: '411000.00',
      },
    },
  };
}

function createMockDepthEvent(symbol = 'btcusdt'): BinanceCombinedStreamMessage<BinanceDepthEvent> {
  return {
    stream: `${symbol}@depth@100ms`,
    data: {
      e: 'depthUpdate',
      E: NOW,
      s: symbol.toUpperCase(),
      U: 1,
      u: 2,
      b: [
        ['67200.00', '1.500'],
        ['67190.00', '2.300'],
        ['67180.00', '0.800'],
      ],
      a: [
        ['67210.00', '1.200'],
        ['67220.00', '3.100'],
        ['67230.00', '0.500'],
      ],
    },
  };
}

function createMockTradeEvent(symbol = 'btcusdt'): BinanceCombinedStreamMessage<BinanceTradeEvent> {
  return {
    stream: `${symbol}@trade`,
    data: {
      e: 'trade',
      E: NOW,
      s: symbol.toUpperCase(),
      t: 100001,
      p: '67250.50',
      q: '0.025',
      T: NOW,
      m: false,
      b: 50000,
      a: 50001,
    },
  };
}

function createMockMiniTickerEvent(
  symbol = 'btcusdt',
): BinanceCombinedStreamMessage<BinanceMiniTickerEvent> {
  return {
    stream: `${symbol}@miniTicker`,
    data: {
      e: '24hrMiniTicker',
      E: NOW,
      s: symbol.toUpperCase(),
      c: '67250.50',
      o: '66800.00',
      h: '67500.00',
      l: '66500.00',
      v: '15000.00',
      q: '1005000000.00',
    },
  };
}

function createMockKlinesResponse(): BinanceKlineRaw[] {
  const candles: BinanceKlineRaw[] = [];
  // Generate 100 candles ending at CURRENT_MINUTE (aligned to minute boundaries)
  for (let i = 0; i < 100; i++) {
    const time = CURRENT_MINUTE - (99 - i) * 60000;
    const open = 67000 + (i % 10) * 50;
    const close = open + ((i % 3) - 1) * 30;
    const high = Math.max(open, close) + 50;
    const low = Math.min(open, close) - 50;
    candles.push([
      time,
      open.toFixed(2),
      high.toFixed(2),
      low.toFixed(2),
      close.toFixed(2),
      '1.234',
      time + 59999,
      '70000.00',
      50,
      '0.617',
      '35000.00',
      '0',
    ]);
  }
  return candles;
}

function createMockDepthResponse(): BinanceDepthSnapshot {
  const bids: [string, string][] = [];
  const asks: [string, string][] = [];
  for (let i = 0; i < 20; i++) {
    bids.push([(67200 - i * 10).toFixed(2), (1 + i * 0.2).toFixed(3)]);
    asks.push([(67210 + i * 10).toFixed(2), (1 + i * 0.2).toFixed(3)]);
  }
  return { lastUpdateId: 1000, bids, asks };
}

// -----------------------------------------------------------------------------
// Mock Setup Functions
// -----------------------------------------------------------------------------

/**
 * Mocks Binance REST API endpoints (klines, depth snapshot, 24hr ticker).
 * Must be called before page.goto().
 */
export async function mockBinanceRest(page: Page): Promise<void> {
  await page.route('**/api/v3/klines*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createMockKlinesResponse()),
    }),
  );

  await page.route('**/api/v3/depth*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createMockDepthResponse()),
    }),
  );

  // 24hr ticker for watchlist initial data
  await page.route('**/api/v3/ticker/24hr*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { symbol: 'BTCUSDT', lastPrice: '67250.50', priceChangePercent: '1.25' },
        { symbol: 'ETHUSDT', lastPrice: '3450.00', priceChangePercent: '-0.50' },
        { symbol: 'SOLUSDT', lastPrice: '145.30', priceChangePercent: '2.10' },
        { symbol: 'XRPUSDT', lastPrice: '0.5200', priceChangePercent: '0.80' },
        { symbol: 'DOGEUSDT', lastPrice: '0.1100', priceChangePercent: '-1.20' },
      ]),
    }),
  );

  // Exchange rate API for kimchi premium (proxied via Next.js rewrite)
  await page.route('**/api/exchange-rate/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        result: 'success',
        base_code: 'USD',
        rates: { KRW: 1380.0 },
      }),
    }),
  );

  // Binance ticker price API for kimchi premium (proxied via Next.js rewrite)
  await page.route('**/api/binance/ticker/price*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ symbol: 'BTCUSDT', price: '67500.00000000' }),
    }),
  );

  // Upbit ticker API for kimchi premium (proxied via Next.js rewrite)
  await page.route('**/api/upbit/ticker*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ market: 'KRW-BTC', trade_price: 93150000, opening_price: 93000000 }]),
    }),
  );
}

/**
 * Mocks Binance Combined Stream WebSocket.
 * Periodically sends kline, depth, trade, and miniTicker events.
 * Must be called before page.goto().
 *
 * Returns a cleanup function that stops the periodic sending.
 */
export async function mockBinanceWebSocket(page: Page): Promise<() => void> {
  const intervalIds = new Set<ReturnType<typeof setInterval>>();

  await page.routeWebSocket(/stream\.binance\.com/, (ws) => {
    // Send initial burst of data so widgets render quickly
    ws.send(JSON.stringify(createMockKlineEvent()));
    ws.send(JSON.stringify(createMockDepthEvent()));
    ws.send(JSON.stringify(createMockTradeEvent()));
    ws.send(JSON.stringify(createMockMiniTickerEvent()));

    // Periodic updates to keep connection alive and feed widgets
    const intervalId = setInterval(() => {
      ws.send(JSON.stringify(createMockKlineEvent()));
      ws.send(JSON.stringify(createMockDepthEvent()));
      ws.send(JSON.stringify(createMockTradeEvent()));
      ws.send(JSON.stringify(createMockMiniTickerEvent()));
    }, 500);
    intervalIds.add(intervalId);

    ws.onClose(() => {
      clearInterval(intervalId);
      intervalIds.delete(intervalId);
    });
  });

  return () => {
    intervalIds.forEach((id) => clearInterval(id));
    intervalIds.clear();
  };
}

/**
 * Mocks Upbit WebSocket and REST endpoints.
 * Must be called before page.goto().
 */
export async function mockUpbitApis(page: Page): Promise<() => void> {
  const intervalIds = new Set<ReturnType<typeof setInterval>>();

  // Upbit REST: candles
  await page.route('**/api.upbit.com/v1/candles/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );

  // Upbit REST: orderbook
  await page.route('**/api.upbit.com/v1/orderbook*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          market: 'KRW-BTC',
          orderbook_units: [
            { ask_price: 95000000, bid_price: 94990000, ask_size: 0.5, bid_size: 0.8 },
          ],
        },
      ]),
    }),
  );

  // Upbit WebSocket
  await page.routeWebSocket(/api\.upbit\.com/, (ws) => {
    const upbitTrade = {
      type: 'trade',
      code: 'KRW-BTC',
      trade_price: 95000000,
      trade_volume: 0.01,
      ask_bid: 'BID',
      trade_timestamp: NOW,
    };

    ws.send(JSON.stringify(upbitTrade));

    const intervalId = setInterval(() => {
      ws.send(JSON.stringify({ ...upbitTrade, trade_timestamp: Date.now() }));
    }, 500);
    intervalIds.add(intervalId);

    ws.onClose(() => {
      clearInterval(intervalId);
      intervalIds.delete(intervalId);
    });
  });

  return () => {
    intervalIds.forEach((id) => clearInterval(id));
    intervalIds.clear();
  };
}

/**
 * Sets up all mock APIs (Binance REST + WebSocket).
 * Convenience wrapper for the most common test setup.
 * Must be called before page.goto().
 */
export async function setupMocks(page: Page): Promise<() => void> {
  await mockBinanceRest(page);
  const cleanupWs = await mockBinanceWebSocket(page);
  return cleanupWs;
}
