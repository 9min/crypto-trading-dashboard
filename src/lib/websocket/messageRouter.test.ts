import { createMessageRouter, parseCombinedStreamMessage } from './messageRouter';
import type { MessageHandlers } from './messageRouter';
import type {
  BinanceKlineEvent,
  BinanceDepthEvent,
  BinanceTradeEvent,
  BinanceMiniTickerEvent,
} from '@/types/binance';

describe('createMessageRouter', () => {
  const klineEvent: BinanceKlineEvent = {
    e: 'kline',
    E: 1234567890,
    s: 'BTCUSDT',
    k: {
      t: 1234567800,
      T: 1234567899,
      s: 'BTCUSDT',
      i: '1m',
      f: 100,
      L: 200,
      o: '50000.00',
      c: '50100.00',
      h: '50200.00',
      l: '49900.00',
      v: '10.5',
      n: 50,
      x: false,
      q: '525000.00',
      V: '5.0',
      Q: '250000.00',
    },
  };

  const depthEvent: BinanceDepthEvent = {
    e: 'depthUpdate',
    E: 1234567890,
    s: 'BTCUSDT',
    U: 100,
    u: 200,
    b: [['50000.00', '1.5']],
    a: [['50100.00', '2.0']],
  };

  const tradeEvent: BinanceTradeEvent = {
    e: 'trade',
    E: 1234567890,
    s: 'BTCUSDT',
    t: 12345,
    p: '50050.00',
    q: '0.5',
    T: 1234567890,
    m: false,
    b: 100,
    a: 200,
  };

  const miniTickerEvent: BinanceMiniTickerEvent = {
    e: '24hrMiniTicker',
    E: 1234567890,
    s: 'BTCUSDT',
    c: '50100.00',
    o: '49800.00',
    h: '50500.00',
    l: '49500.00',
    v: '1000.00',
    q: '50000000.00',
  };

  it('dispatches kline events to onKline handler', () => {
    const onKline = vi.fn();
    const router = createMessageRouter({ onKline });

    router(klineEvent);

    expect(onKline).toHaveBeenCalledWith(klineEvent);
  });

  it('dispatches depthUpdate events to onDepth handler', () => {
    const onDepth = vi.fn();
    const router = createMessageRouter({ onDepth });

    router(depthEvent);

    expect(onDepth).toHaveBeenCalledWith(depthEvent);
  });

  it('dispatches trade events to onTrade handler', () => {
    const onTrade = vi.fn();
    const router = createMessageRouter({ onTrade });

    router(tradeEvent);

    expect(onTrade).toHaveBeenCalledWith(tradeEvent);
  });

  it('dispatches 24hrMiniTicker events to onMiniTicker handler', () => {
    const onMiniTicker = vi.fn();
    const router = createMessageRouter({ onMiniTicker });

    router(miniTickerEvent);

    expect(onMiniTicker).toHaveBeenCalledWith(miniTickerEvent);
  });

  it('does not crash when handler is not registered', () => {
    const handlers: MessageHandlers = {};
    const router = createMessageRouter(handlers);

    // Should not throw for any event type
    expect(() => router(klineEvent)).not.toThrow();
    expect(() => router(depthEvent)).not.toThrow();
    expect(() => router(tradeEvent)).not.toThrow();
    expect(() => router(miniTickerEvent)).not.toThrow();
  });

  it('dispatches to the correct handler when multiple are registered', () => {
    const onKline = vi.fn();
    const onDepth = vi.fn();
    const onTrade = vi.fn();
    const onMiniTicker = vi.fn();

    const router = createMessageRouter({ onKline, onDepth, onTrade, onMiniTicker });

    router(tradeEvent);

    expect(onTrade).toHaveBeenCalledOnce();
    expect(onKline).not.toHaveBeenCalled();
    expect(onDepth).not.toHaveBeenCalled();
    expect(onMiniTicker).not.toHaveBeenCalled();
  });
});

describe('parseCombinedStreamMessage', () => {
  it('extracts the data field from a valid combined stream message', () => {
    const raw = JSON.stringify({
      stream: 'btcusdt@trade',
      data: {
        e: 'trade',
        E: 123,
        s: 'BTCUSDT',
        t: 1,
        p: '50000',
        q: '1',
        T: 123,
        m: false,
        b: 1,
        a: 2,
      },
    });

    const result = parseCombinedStreamMessage(raw);
    expect(result).not.toBeNull();
    expect(result?.e).toBe('trade');
  });

  it('returns null for invalid JSON', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = parseCombinedStreamMessage('{invalid json');
    expect(result).toBeNull();

    vi.restoreAllMocks();
  });

  it('returns null when data field is missing', () => {
    const raw = JSON.stringify({ stream: 'btcusdt@trade' });

    const result = parseCombinedStreamMessage(raw);
    expect(result).toBeNull();
  });

  it('returns the data for a kline message', () => {
    const raw = JSON.stringify({
      stream: 'btcusdt@kline_1m',
      data: {
        e: 'kline',
        E: 123,
        s: 'BTCUSDT',
        k: {
          t: 100,
          T: 200,
          s: 'BTCUSDT',
          i: '1m',
          f: 0,
          L: 0,
          o: '1',
          c: '2',
          h: '3',
          l: '0',
          v: '10',
          n: 5,
          x: true,
          q: '100',
          V: '5',
          Q: '50',
        },
      },
    });

    const result = parseCombinedStreamMessage(raw);
    expect(result?.e).toBe('kline');
  });
});
