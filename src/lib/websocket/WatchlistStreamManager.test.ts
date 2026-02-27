// =============================================================================
// WatchlistStreamManager Unit Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WatchlistStreamManager } from './WatchlistStreamManager';

// -----------------------------------------------------------------------------
// Mock WebSocket
// -----------------------------------------------------------------------------

type EventListener = (...args: never[]) => void;

let mockWsInstances: MockWebSocket[] = [];

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;

  private listeners = new Map<string, Set<EventListener>>();

  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', {} as Event);
  });

  send = vi.fn();

  constructor(url: string) {
    this.url = url;
    mockWsInstances.push(this);
  }

  addEventListener(type: string, cb: EventListener): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(cb);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, cb: EventListener): void {
    this.listeners.get(type)?.delete(cb);
  }

  private emit(type: string, event: Event | MessageEvent): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const cb of set) {
      cb(event as never);
    }
  }

  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.emit('open', new Event('open'));
  }

  simulateClose(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', new Event('close'));
  }

  simulateMessage(data: string): void {
    this.emit('message', { data } as MessageEvent);
  }

  simulateError(): void {
    this.emit('error', new Event('error'));
  }
}

// -----------------------------------------------------------------------------
// Mock dependencies
// -----------------------------------------------------------------------------

vi.mock('./messageRouter', () => ({
  parseCombinedStreamMessage: vi.fn((raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      return parsed.data ?? null;
    } catch {
      return null;
    }
  }),
}));

vi.mock('@/lib/binance/streamUrls', () => ({
  getMiniTickerStream: (symbol: string) => `${symbol.toLowerCase()}@miniTicker`,
  buildStreamUrl: (streams: string[]) =>
    `wss://stream.binance.com:9443/stream?streams=${streams.join('/')}`,
}));

// -----------------------------------------------------------------------------
// Setup / Teardown
// -----------------------------------------------------------------------------

beforeEach(() => {
  mockWsInstances = [];
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', MockWebSocket);
  WatchlistStreamManager.resetInstance();
});

afterEach(() => {
  WatchlistStreamManager.resetInstance();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function latestWs(): MockWebSocket {
  return mockWsInstances[mockWsInstances.length - 1];
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('WatchlistStreamManager', () => {
  // ---------------------------------------------------------------------------
  // Singleton
  // ---------------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = WatchlistStreamManager.getInstance();
      const b = WatchlistStreamManager.getInstance();
      expect(a).toBe(b);
    });

    it('creates a new instance after resetInstance()', () => {
      const a = WatchlistStreamManager.getInstance();
      WatchlistStreamManager.resetInstance();
      const b = WatchlistStreamManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // ---------------------------------------------------------------------------
  // connect
  // ---------------------------------------------------------------------------

  describe('connect', () => {
    it('builds miniTicker stream URL from symbols', () => {
      const manager = WatchlistStreamManager.getInstance();
      manager.connect(['BTCUSDT', 'ETHUSDT']);

      expect(mockWsInstances).toHaveLength(1);
      expect(latestWs().url).toContain('btcusdt@miniTicker');
      expect(latestWs().url).toContain('ethusdt@miniTicker');
    });

    it('disconnects when symbols are empty', () => {
      const manager = WatchlistStreamManager.getInstance();
      manager.connect(['BTCUSDT']);
      latestWs().simulateOpen();

      manager.connect([]);

      // Should have closed the WS
      expect(latestWs().close).toHaveBeenCalled();
    });

    it('is no-op when same symbols and WS is OPEN', () => {
      const manager = WatchlistStreamManager.getInstance();
      manager.connect(['BTCUSDT', 'ETHUSDT']);
      latestWs().simulateOpen();

      const countBefore = mockWsInstances.length;
      manager.connect(['BTCUSDT', 'ETHUSDT']);
      expect(mockWsInstances).toHaveLength(countBefore);
    });

    it('closes existing and opens new WS for different symbols', () => {
      const manager = WatchlistStreamManager.getInstance();
      manager.connect(['BTCUSDT']);
      const firstWs = latestWs();
      firstWs.simulateOpen();

      manager.connect(['ETHUSDT']);

      expect(firstWs.close).toHaveBeenCalled();
      expect(mockWsInstances).toHaveLength(2);
      expect(latestWs().url).toContain('ethusdt@miniTicker');
    });
  });

  // ---------------------------------------------------------------------------
  // updateSymbols
  // ---------------------------------------------------------------------------

  describe('updateSymbols', () => {
    it('is no-op when symbols are identical', () => {
      const manager = WatchlistStreamManager.getInstance();
      manager.connect(['BTCUSDT']);
      latestWs().simulateOpen();

      const countBefore = mockWsInstances.length;
      manager.updateSymbols(['BTCUSDT']);
      expect(mockWsInstances).toHaveLength(countBefore);
    });

    it('reconnects when symbols differ', () => {
      const manager = WatchlistStreamManager.getInstance();
      manager.connect(['BTCUSDT']);
      latestWs().simulateOpen();

      manager.updateSymbols(['ETHUSDT']);

      expect(mockWsInstances).toHaveLength(2);
      expect(latestWs().url).toContain('ethusdt@miniTicker');
    });
  });

  // ---------------------------------------------------------------------------
  // subscribe
  // ---------------------------------------------------------------------------

  describe('subscribe', () => {
    it('receives 24hrMiniTicker events', () => {
      const manager = WatchlistStreamManager.getInstance();
      const events: unknown[] = [];
      manager.subscribe((evt) => events.push(evt));

      manager.connect(['BTCUSDT']);
      latestWs().simulateOpen();

      latestWs().simulateMessage(
        JSON.stringify({
          stream: 'btcusdt@miniTicker',
          data: {
            e: '24hrMiniTicker',
            E: Date.now(),
            s: 'BTCUSDT',
            c: '42000',
            o: '41000',
            h: '43000',
            l: '40000',
            v: '1000',
            q: '42000000',
          },
        }),
      );

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ e: '24hrMiniTicker', s: 'BTCUSDT' });
    });

    it('ignores non-24hrMiniTicker events', () => {
      const manager = WatchlistStreamManager.getInstance();
      const events: unknown[] = [];
      manager.subscribe((evt) => events.push(evt));

      manager.connect(['BTCUSDT']);
      latestWs().simulateOpen();

      // Kline event — should be ignored
      latestWs().simulateMessage(
        JSON.stringify({
          stream: 'btcusdt@kline_1m',
          data: { e: 'kline', s: 'BTCUSDT', k: {} },
        }),
      );

      expect(events).toHaveLength(0);
    });

    it('stops receiving after unsubscribe', () => {
      const manager = WatchlistStreamManager.getInstance();
      const events: unknown[] = [];
      const unsub = manager.subscribe((evt) => events.push(evt));

      manager.connect(['BTCUSDT']);
      latestWs().simulateOpen();

      unsub();
      latestWs().simulateMessage(
        JSON.stringify({
          stream: 'btcusdt@miniTicker',
          data: {
            e: '24hrMiniTicker',
            s: 'BTCUSDT',
            c: '42000',
            o: '41000',
            h: '43000',
            l: '40000',
            v: '1000',
            q: '42000000',
          },
        }),
      );

      expect(events).toHaveLength(0);
    });

    it('isolates subscriber errors', () => {
      const manager = WatchlistStreamManager.getInstance();
      const events: unknown[] = [];
      manager.subscribe(() => {
        throw new Error('boom');
      });
      manager.subscribe((evt) => events.push(evt));

      manager.connect(['BTCUSDT']);
      latestWs().simulateOpen();

      latestWs().simulateMessage(
        JSON.stringify({
          stream: 'btcusdt@miniTicker',
          data: {
            e: '24hrMiniTicker',
            s: 'BTCUSDT',
            c: '42000',
            o: '41000',
            h: '43000',
            l: '40000',
            v: '1000',
            q: '42000000',
          },
        }),
      );

      expect(events).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // disconnect
  // ---------------------------------------------------------------------------

  describe('disconnect', () => {
    it('cleans up WebSocket and resets symbols', () => {
      const manager = WatchlistStreamManager.getInstance();
      manager.connect(['BTCUSDT']);
      const ws = latestWs();
      ws.simulateOpen();

      manager.disconnect();

      expect(ws.close).toHaveBeenCalled();
    });

    it('subsequent connect with same symbols creates new WS', () => {
      const manager = WatchlistStreamManager.getInstance();
      manager.connect(['BTCUSDT']);
      latestWs().simulateOpen();
      manager.disconnect();

      manager.connect(['BTCUSDT']);
      expect(mockWsInstances).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // scheduleReconnect
  // ---------------------------------------------------------------------------

  describe('scheduleReconnect', () => {
    it('stops reconnecting after WS_MAX_RECONNECT_ATTEMPTS (10)', () => {
      const manager = WatchlistStreamManager.getInstance();
      manager.connect(['BTCUSDT']);

      for (let i = 0; i < 10; i++) {
        latestWs().simulateClose();
        vi.advanceTimersByTime(30000);
      }

      // 11th close — no more reconnects
      const countBefore = mockWsInstances.length;
      latestWs().simulateClose();
      vi.advanceTimersByTime(30000);
      expect(mockWsInstances).toHaveLength(countBefore);
    });

    it('applies exponential backoff', () => {
      const manager = WatchlistStreamManager.getInstance();
      manager.connect(['BTCUSDT']);

      // Close → attempt 1, delay 1s
      latestWs().simulateClose();

      vi.advanceTimersByTime(999);
      const countBefore = mockWsInstances.length;
      vi.advanceTimersByTime(1);
      expect(mockWsInstances.length).toBe(countBefore + 1);
    });

    it('does not reconnect when symbols are empty', () => {
      const manager = WatchlistStreamManager.getInstance();
      manager.connect(['BTCUSDT']);
      latestWs().simulateOpen();

      manager.disconnect();
      const countAfter = mockWsInstances.length;

      vi.advanceTimersByTime(30000);
      expect(mockWsInstances).toHaveLength(countAfter);
    });
  });

  // ---------------------------------------------------------------------------
  // isSameSymbols (order-sensitive)
  // ---------------------------------------------------------------------------

  describe('isSameSymbols', () => {
    it('considers same symbols in same order as equal', () => {
      const manager = WatchlistStreamManager.getInstance();
      manager.connect(['BTCUSDT', 'ETHUSDT']);
      latestWs().simulateOpen();

      const countBefore = mockWsInstances.length;
      manager.connect(['BTCUSDT', 'ETHUSDT']);
      expect(mockWsInstances).toHaveLength(countBefore);
    });

    it('considers same symbols in different order as different', () => {
      const manager = WatchlistStreamManager.getInstance();
      manager.connect(['BTCUSDT', 'ETHUSDT']);
      latestWs().simulateOpen();

      manager.connect(['ETHUSDT', 'BTCUSDT']);
      expect(mockWsInstances).toHaveLength(2);
    });
  });
});
