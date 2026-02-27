// =============================================================================
// UpbitWebSocketManager Unit Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UpbitWebSocketManager } from './UpbitWebSocketManager';
import type { UpbitSubscriptionType } from '@/types/upbit';

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

  simulateMessage(data: string | Blob): void {
    this.emit('message', { data } as MessageEvent);
  }

  simulateError(): void {
    this.emit('error', new Event('error'));
  }
}

// -----------------------------------------------------------------------------
// Setup / Teardown
// -----------------------------------------------------------------------------

beforeEach(() => {
  mockWsInstances = [];
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', MockWebSocket);
  UpbitWebSocketManager.resetInstance();
});

afterEach(() => {
  UpbitWebSocketManager.resetInstance();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function tickerSub(codes: string[]): UpbitSubscriptionType {
  return { type: 'ticker', codes, isOnlyRealtime: true };
}

function tradeSub(codes: string[]): UpbitSubscriptionType {
  return { type: 'trade', codes, isOnlyRealtime: true };
}

function latestWs(): MockWebSocket {
  return mockWsInstances[mockWsInstances.length - 1];
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('UpbitWebSocketManager', () => {
  // ---------------------------------------------------------------------------
  // Singleton
  // ---------------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = UpbitWebSocketManager.getInstance();
      const b = UpbitWebSocketManager.getInstance();
      expect(a).toBe(b);
    });

    it('creates a new instance after resetInstance()', () => {
      const a = UpbitWebSocketManager.getInstance();
      UpbitWebSocketManager.resetInstance();
      const b = UpbitWebSocketManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // ---------------------------------------------------------------------------
  // connect (group-based)
  // ---------------------------------------------------------------------------

  describe('connect', () => {
    it('creates a WebSocket with merged subscriptions', () => {
      const manager = UpbitWebSocketManager.getInstance();
      manager.connect('stream', [tickerSub(['KRW-BTC'])]);

      expect(mockWsInstances).toHaveLength(1);
      expect(latestWs().url).toBe('wss://api.upbit.com/websocket/v1');
    });

    it('calls disconnectGroup when subscriptions are empty', () => {
      const manager = UpbitWebSocketManager.getInstance();
      manager.connect('stream', [tickerSub(['KRW-BTC'])]);
      latestWs().simulateOpen();

      // Remove the subscriber first so disconnect() actually runs
      manager.connect('stream', []);

      // After empty subscriptions + disconnect, state should be idle
      expect(manager.getState().status).toBe('idle');
    });

    it('is no-op when same merged subscriptions and WS is OPEN', () => {
      const manager = UpbitWebSocketManager.getInstance();
      manager.connect('stream', [tickerSub(['KRW-BTC'])]);
      latestWs().simulateOpen();

      const countBefore = mockWsInstances.length;
      manager.connect('stream', [tickerSub(['KRW-BTC'])]);
      expect(mockWsInstances).toHaveLength(countBefore);
    });

    it('updates pending subscriptions without restarting when connecting', () => {
      const manager = UpbitWebSocketManager.getInstance();
      manager.connect('stream', [tickerSub(['KRW-BTC'])]);

      // WS is still CONNECTING — adding another group should not create new WS
      const countBefore = mockWsInstances.length;
      manager.connect('watchlist', [tickerSub(['KRW-ETH'])]);
      expect(mockWsInstances).toHaveLength(countBefore);
    });

    it('re-sends subscription when WS is already OPEN and subs differ', () => {
      const manager = UpbitWebSocketManager.getInstance();
      manager.connect('stream', [tickerSub(['KRW-BTC'])]);
      latestWs().simulateOpen();

      // Now add another group while still open
      manager.connect('watchlist', [tickerSub(['KRW-ETH'])]);

      // send should be called: once on open, once for re-subscribe
      expect(latestWs().send).toHaveBeenCalledTimes(2);
    });

    it('sends subscription on WS open with merged subscriptions', () => {
      const manager = UpbitWebSocketManager.getInstance();
      manager.connect('stream', [tickerSub(['KRW-BTC']), tradeSub(['KRW-BTC'])]);
      latestWs().simulateOpen();

      expect(latestWs().send).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(latestWs().send.mock.calls[0][0] as string) as unknown[];
      // First element is ticket, rest are subscriptions
      expect(sent).toHaveLength(3); // ticket + 2 subscription types
      expect(sent[0]).toHaveProperty('ticket');
    });
  });

  // ---------------------------------------------------------------------------
  // disconnectGroup
  // ---------------------------------------------------------------------------

  describe('disconnectGroup', () => {
    it('re-subscribes with remaining groups after removing one', () => {
      const manager = UpbitWebSocketManager.getInstance();
      manager.connect('stream', [tickerSub(['KRW-BTC'])]);
      manager.connect('watchlist', [tickerSub(['KRW-ETH'])]);
      latestWs().simulateOpen();

      const sendCountBefore = latestWs().send.mock.calls.length;
      manager.disconnectGroup('watchlist');

      // Should re-send subscription with only stream group
      expect(latestWs().send.mock.calls.length).toBe(sendCountBefore + 1);
    });

    it('fully disconnects when all groups removed and no subscribers', () => {
      const manager = UpbitWebSocketManager.getInstance();
      manager.connect('stream', [tickerSub(['KRW-BTC'])]);
      latestWs().simulateOpen();

      manager.disconnectGroup('stream');
      expect(manager.getState().status).toBe('idle');
    });
  });

  // ---------------------------------------------------------------------------
  // disconnect / forceDisconnect
  // ---------------------------------------------------------------------------

  describe('disconnect', () => {
    it('is no-op when message subscribers exist', () => {
      const manager = UpbitWebSocketManager.getInstance();
      manager.connect('stream', [tickerSub(['KRW-BTC'])]);
      latestWs().simulateOpen();

      manager.subscribe(() => {});
      manager.disconnect();

      // State should NOT be idle since subscriber exists
      expect(manager.getState().status).toBe('connected');
    });
  });

  describe('forceDisconnect', () => {
    it('disconnects unconditionally regardless of subscribers', () => {
      const manager = UpbitWebSocketManager.getInstance();
      manager.connect('stream', [tickerSub(['KRW-BTC'])]);
      latestWs().simulateOpen();

      manager.subscribe(() => {});
      manager.forceDisconnect();

      expect(manager.getState().status).toBe('idle');
    });
  });

  // ---------------------------------------------------------------------------
  // subscribe
  // ---------------------------------------------------------------------------

  describe('subscribe', () => {
    it('receives parsed messages from WebSocket (string data)', () => {
      const manager = UpbitWebSocketManager.getInstance();
      const messages: unknown[] = [];
      manager.subscribe((msg) => messages.push(msg));

      manager.connect('stream', [tickerSub(['KRW-BTC'])]);
      latestWs().simulateOpen();

      const tickerMsg = {
        type: 'ticker',
        code: 'KRW-BTC',
        trade_price: 95000000,
        opening_price: 94000000,
        high_price: 96000000,
        low_price: 93000000,
        prev_closing_price: 94500000,
        signed_change_rate: 0.005,
        signed_change_price: 500000,
        acc_trade_volume_24h: 1234.5,
        acc_trade_price_24h: 117000000000,
        trade_timestamp: Date.now(),
        change: 'RISE',
      };

      latestWs().simulateMessage(JSON.stringify(tickerMsg));

      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({ type: 'ticker', code: 'KRW-BTC' });
    });

    it('stops receiving after unsubscribe', () => {
      const manager = UpbitWebSocketManager.getInstance();
      const messages: unknown[] = [];
      const unsub = manager.subscribe((msg) => messages.push(msg));

      manager.connect('stream', [tickerSub(['KRW-BTC'])]);
      latestWs().simulateOpen();

      unsub();
      latestWs().simulateMessage(
        JSON.stringify({ type: 'ticker', code: 'KRW-BTC', trade_price: 1 }),
      );

      expect(messages).toHaveLength(0);
    });

    it('subscriber error does not affect other subscribers', () => {
      const manager = UpbitWebSocketManager.getInstance();
      const messages: unknown[] = [];
      manager.subscribe(() => {
        throw new Error('boom');
      });
      manager.subscribe((msg) => messages.push(msg));

      manager.connect('stream', [tickerSub(['KRW-BTC'])]);
      latestWs().simulateOpen();

      latestWs().simulateMessage(
        JSON.stringify({ type: 'ticker', code: 'KRW-BTC', trade_price: 1 }),
      );
      expect(messages).toHaveLength(1);
    });

    it('ignores messages without a type field', () => {
      const manager = UpbitWebSocketManager.getInstance();
      const messages: unknown[] = [];
      manager.subscribe((msg) => messages.push(msg));

      manager.connect('stream', [tickerSub(['KRW-BTC'])]);
      latestWs().simulateOpen();

      // Status message from Upbit (no type)
      latestWs().simulateMessage(JSON.stringify({ status: 'UP' }));
      expect(messages).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // onStateChange
  // ---------------------------------------------------------------------------

  describe('onStateChange', () => {
    it('immediately emits current state', () => {
      const manager = UpbitWebSocketManager.getInstance();
      const states: string[] = [];
      manager.onStateChange((s) => states.push(s.status));
      expect(states).toEqual(['idle']);
    });

    it('stops emitting after unsubscribe', () => {
      const manager = UpbitWebSocketManager.getInstance();
      const states: string[] = [];
      const unsub = manager.onStateChange((s) => states.push(s.status));
      unsub();

      manager.connect('stream', [tickerSub(['KRW-BTC'])]);
      expect(states).toEqual(['idle']);
    });
  });

  // ---------------------------------------------------------------------------
  // reconnect
  // ---------------------------------------------------------------------------

  describe('reconnect', () => {
    it('creates fresh connection with merged subscriptions', () => {
      const manager = UpbitWebSocketManager.getInstance();
      manager.connect('stream', [tickerSub(['KRW-BTC'])]);
      latestWs().simulateOpen();

      manager.reconnect();

      expect(mockWsInstances.length).toBeGreaterThanOrEqual(2);
      expect(manager.getState().status).toBe('connecting');
    });

    it('is no-op when no subscriptions exist', () => {
      const manager = UpbitWebSocketManager.getInstance();
      manager.reconnect();

      expect(mockWsInstances).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // scheduleReconnect
  // ---------------------------------------------------------------------------

  describe('scheduleReconnect', () => {
    it('transitions to failed after UPBIT_WS_MAX_RECONNECT_ATTEMPTS (3)', () => {
      const manager = UpbitWebSocketManager.getInstance();
      manager.connect('stream', [tickerSub(['KRW-BTC'])]);

      for (let i = 0; i < 3; i++) {
        latestWs().simulateClose();
        vi.advanceTimersByTime(30000);
      }

      // 4th close should yield failed
      latestWs().simulateClose();

      const state = manager.getState();
      expect(state.status).toBe('failed');
      if (state.status === 'failed') {
        expect(state.error).toContain('3');
      }
    });

    it('applies exponential backoff delay', () => {
      const manager = UpbitWebSocketManager.getInstance();
      manager.connect('stream', [tickerSub(['KRW-BTC'])]);

      // Close → attempt 1, delay 1s
      latestWs().simulateClose();
      expect(manager.getState().status).toBe('reconnecting');

      vi.advanceTimersByTime(999);
      const countBefore = mockWsInstances.length;
      vi.advanceTimersByTime(1);
      expect(mockWsInstances.length).toBe(countBefore + 1);
    });

    it('does not reconnect when no subscriptions remain', () => {
      const manager = UpbitWebSocketManager.getInstance();
      manager.connect('stream', [tickerSub(['KRW-BTC'])]);
      latestWs().simulateOpen();

      // Remove subscriptions, force close
      manager.forceDisconnect();
      const countAfter = mockWsInstances.length;

      vi.advanceTimersByTime(30000);
      expect(mockWsInstances).toHaveLength(countAfter);
    });
  });

  // ---------------------------------------------------------------------------
  // PING keepalive
  // ---------------------------------------------------------------------------

  describe('PING keepalive', () => {
    it('starts sending PING at 110s intervals on open', () => {
      const manager = UpbitWebSocketManager.getInstance();
      manager.connect('stream', [tickerSub(['KRW-BTC'])]);
      latestWs().simulateOpen();

      // 1st send is subscription
      expect(latestWs().send).toHaveBeenCalledTimes(1);

      // After 110s, PING should be sent
      vi.advanceTimersByTime(110_000);
      expect(latestWs().send).toHaveBeenCalledTimes(2);
      expect(latestWs().send.mock.calls[1][0]).toBe('PING');

      // After another 110s, another PING
      vi.advanceTimersByTime(110_000);
      expect(latestWs().send).toHaveBeenCalledTimes(3);
    });

    it('stops PING on close', () => {
      const manager = UpbitWebSocketManager.getInstance();
      manager.connect('stream', [tickerSub(['KRW-BTC'])]);
      latestWs().simulateOpen();

      const ws = latestWs();
      ws.simulateClose();

      // Advance time — no more PINGs should be sent
      const sendCount = ws.send.mock.calls.length;
      vi.advanceTimersByTime(220_000);
      // send count should not increase (PING is stopped)
      // Note: close event may trigger reconnect, but PING should be stopped on original ws
      expect(ws.send.mock.calls.length).toBe(sendCount);
    });

    it('stops PING on cleanup (forceDisconnect)', () => {
      const manager = UpbitWebSocketManager.getInstance();
      manager.connect('stream', [tickerSub(['KRW-BTC'])]);
      latestWs().simulateOpen();

      const ws = latestWs();
      manager.forceDisconnect();

      const sendCount = ws.send.mock.calls.length;
      vi.advanceTimersByTime(220_000);
      expect(ws.send.mock.calls.length).toBe(sendCount);
    });
  });

  // ---------------------------------------------------------------------------
  // getMergedSubscriptions (tested via behavior)
  // ---------------------------------------------------------------------------

  describe('getMergedSubscriptions', () => {
    it('merges codes from multiple groups with same type and deduplicates', () => {
      const manager = UpbitWebSocketManager.getInstance();
      manager.connect('stream', [tickerSub(['KRW-BTC', 'KRW-ETH'])]);
      manager.connect('watchlist', [tickerSub(['KRW-ETH', 'KRW-SOL'])]);
      latestWs().simulateOpen();

      // The last send call contains the merged subscription
      const lastSendCall = latestWs().send.mock.calls[latestWs().send.mock.calls.length - 1];
      const sent = JSON.parse(lastSendCall[0] as string) as Array<{
        type?: string;
        codes?: string[];
      }>;

      // Find ticker subscription
      const tickerEntry = sent.find((entry) => entry.type === 'ticker');
      expect(tickerEntry).toBeDefined();
      // Codes should be merged, deduplicated, and sorted
      expect(tickerEntry!.codes).toEqual(['KRW-BTC', 'KRW-ETH', 'KRW-SOL']);
    });

    it('produces sorted codes', () => {
      const manager = UpbitWebSocketManager.getInstance();
      manager.connect('stream', [tickerSub(['KRW-SOL', 'KRW-BTC', 'KRW-ETH'])]);
      latestWs().simulateOpen();

      const sent = JSON.parse(latestWs().send.mock.calls[0][0] as string) as Array<{
        type?: string;
        codes?: string[];
      }>;
      const tickerEntry = sent.find((entry) => entry.type === 'ticker');
      expect(tickerEntry!.codes).toEqual(['KRW-BTC', 'KRW-ETH', 'KRW-SOL']);
    });
  });

  // ---------------------------------------------------------------------------
  // isSameSubscriptions (tested via behavior)
  // ---------------------------------------------------------------------------

  describe('isSameSubscriptions', () => {
    it('detects same subscriptions regardless of code order', () => {
      const manager = UpbitWebSocketManager.getInstance();
      manager.connect('stream', [tickerSub(['KRW-BTC', 'KRW-ETH'])]);
      latestWs().simulateOpen();

      const sendCountBefore = latestWs().send.mock.calls.length;

      // Same codes in different order — should be no-op
      manager.connect('stream', [tickerSub(['KRW-ETH', 'KRW-BTC'])]);
      expect(latestWs().send.mock.calls.length).toBe(sendCountBefore);
    });

    it('detects different subscriptions when codes differ', () => {
      const manager = UpbitWebSocketManager.getInstance();
      manager.connect('stream', [tickerSub(['KRW-BTC'])]);
      latestWs().simulateOpen();

      const sendCountBefore = latestWs().send.mock.calls.length;

      // Different codes — should re-send
      manager.connect('stream', [tickerSub(['KRW-ETH'])]);
      expect(latestWs().send.mock.calls.length).toBe(sendCountBefore + 1);
    });
  });
});
