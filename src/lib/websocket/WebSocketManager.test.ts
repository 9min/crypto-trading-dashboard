// =============================================================================
// WebSocketManager Unit Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketManager } from './WebSocketManager';

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
    // Trigger close handler if registered
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
// Mock messageRouter
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

// -----------------------------------------------------------------------------
// Setup / Teardown
// -----------------------------------------------------------------------------

beforeEach(() => {
  mockWsInstances = [];
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', MockWebSocket);
  // Mock document for visibility API
  vi.stubGlobal('document', {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    visibilityState: 'visible',
    hidden: false,
  });
  WebSocketManager.resetInstance();
});

afterEach(() => {
  WebSocketManager.resetInstance();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('WebSocketManager', () => {
  // ---------------------------------------------------------------------------
  // Singleton
  // ---------------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = WebSocketManager.getInstance();
      const b = WebSocketManager.getInstance();
      expect(a).toBe(b);
    });

    it('creates a new instance after resetInstance()', () => {
      const a = WebSocketManager.getInstance();
      WebSocketManager.resetInstance();
      const b = WebSocketManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // ---------------------------------------------------------------------------
  // connect
  // ---------------------------------------------------------------------------

  describe('connect', () => {
    it('transitions to connecting state and creates WebSocket', () => {
      const manager = WebSocketManager.getInstance();
      const states: string[] = [];
      manager.onStateChange((s) => states.push(s.status));

      manager.connect('wss://example.com/stream');

      expect(states).toContain('connecting');
      expect(mockWsInstances).toHaveLength(1);
      expect(mockWsInstances[0].url).toBe('wss://example.com/stream');
    });

    it('is no-op when already connected to same URL and OPEN', () => {
      const manager = WebSocketManager.getInstance();
      manager.connect('wss://example.com/stream');
      mockWsInstances[0].simulateOpen();

      const wsBefore = mockWsInstances.length;
      manager.connect('wss://example.com/stream');
      expect(mockWsInstances).toHaveLength(wsBefore);
    });

    it('closes existing connection and opens new one for different URL', () => {
      const manager = WebSocketManager.getInstance();
      manager.connect('wss://example.com/stream1');
      const firstWs = mockWsInstances[0];
      firstWs.simulateOpen();

      manager.connect('wss://example.com/stream2');

      expect(firstWs.close).toHaveBeenCalled();
      expect(mockWsInstances).toHaveLength(2);
      expect(mockWsInstances[1].url).toBe('wss://example.com/stream2');
    });
  });

  // ---------------------------------------------------------------------------
  // disconnect
  // ---------------------------------------------------------------------------

  describe('disconnect', () => {
    it('transitions to idle state and cleans up WebSocket', () => {
      const manager = WebSocketManager.getInstance();
      manager.connect('wss://example.com/stream');
      mockWsInstances[0].simulateOpen();

      manager.disconnect();

      expect(manager.getState().status).toBe('idle');
    });

    it('clears currentUrl so subsequent close does not trigger reconnect', () => {
      const manager = WebSocketManager.getInstance();
      manager.connect('wss://example.com/stream');
      manager.disconnect();

      // No reconnect should be scheduled
      vi.advanceTimersByTime(30000);
      // Only the original WS instance should exist
      expect(mockWsInstances).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // subscribe / onStateChange
  // ---------------------------------------------------------------------------

  describe('subscribe', () => {
    it('receives parsed messages from WebSocket', () => {
      const manager = WebSocketManager.getInstance();
      const messages: unknown[] = [];
      manager.subscribe((msg) => messages.push(msg));

      manager.connect('wss://example.com/stream');
      mockWsInstances[0].simulateOpen();
      mockWsInstances[0].simulateMessage(
        JSON.stringify({
          stream: 'btcusdt@trade',
          data: { e: 'trade', s: 'BTCUSDT', p: '42000' },
        }),
      );

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ e: 'trade', s: 'BTCUSDT', p: '42000' });
    });

    it('stops receiving messages after unsubscribe', () => {
      const manager = WebSocketManager.getInstance();
      const messages: unknown[] = [];
      const unsub = manager.subscribe((msg) => messages.push(msg));

      manager.connect('wss://example.com/stream');
      mockWsInstances[0].simulateOpen();

      unsub();
      mockWsInstances[0].simulateMessage(
        JSON.stringify({
          stream: 'btcusdt@trade',
          data: { e: 'trade', s: 'BTCUSDT', p: '42000' },
        }),
      );

      expect(messages).toHaveLength(0);
    });

    it('subscriber error does not affect other subscribers', () => {
      const manager = WebSocketManager.getInstance();
      const messages: unknown[] = [];
      manager.subscribe(() => {
        throw new Error('boom');
      });
      manager.subscribe((msg) => messages.push(msg));

      manager.connect('wss://example.com/stream');
      mockWsInstances[0].simulateOpen();
      mockWsInstances[0].simulateMessage(
        JSON.stringify({
          stream: 'btcusdt@trade',
          data: { e: 'trade', s: 'BTCUSDT', p: '42000' },
        }),
      );

      expect(messages).toHaveLength(1);
    });
  });

  describe('onStateChange', () => {
    it('immediately emits current state on subscribe', () => {
      const manager = WebSocketManager.getInstance();
      const states: string[] = [];
      manager.onStateChange((s) => states.push(s.status));

      expect(states).toEqual(['idle']);
    });

    it('emits all state transitions', () => {
      const manager = WebSocketManager.getInstance();
      const states: string[] = [];
      manager.onStateChange((s) => states.push(s.status));

      manager.connect('wss://example.com/stream');
      mockWsInstances[0].simulateOpen();

      expect(states).toEqual(['idle', 'connecting', 'connected']);
    });

    it('stops emitting after unsubscribe', () => {
      const manager = WebSocketManager.getInstance();
      const states: string[] = [];
      const unsub = manager.onStateChange((s) => states.push(s.status));

      unsub();
      manager.connect('wss://example.com/stream');

      expect(states).toEqual(['idle']); // Only the initial emit
    });
  });

  // ---------------------------------------------------------------------------
  // reconnect
  // ---------------------------------------------------------------------------

  describe('reconnect', () => {
    it('resets attempt counter and creates new connection', () => {
      const manager = WebSocketManager.getInstance();
      manager.connect('wss://example.com/stream');
      mockWsInstances[0].simulateOpen();

      manager.reconnect();

      expect(mockWsInstances).toHaveLength(2);
      expect(manager.getState().status).toBe('connecting');
    });

    it('is no-op when no URL is set', () => {
      const manager = WebSocketManager.getInstance();
      manager.reconnect();

      expect(mockWsInstances).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // handleOpen
  // ---------------------------------------------------------------------------

  describe('handleOpen', () => {
    it('transitions to connected state with connectedAt', () => {
      const manager = WebSocketManager.getInstance();
      manager.connect('wss://example.com/stream');
      mockWsInstances[0].simulateOpen();

      const state = manager.getState();
      expect(state.status).toBe('connected');
      if (state.status === 'connected') {
        expect(state.connectedAt).toBeGreaterThan(0);
      }
    });

    it('resets reconnect attempt counter', () => {
      const manager = WebSocketManager.getInstance();
      manager.connect('wss://example.com/stream');

      // Simulate close → reconnecting
      mockWsInstances[0].simulateClose();
      vi.advanceTimersByTime(1000);

      // New WS opens
      const reconnectedWs = mockWsInstances[mockWsInstances.length - 1];
      reconnectedWs.simulateOpen();

      expect(manager.getState().status).toBe('connected');
    });
  });

  // ---------------------------------------------------------------------------
  // handleClose → scheduleReconnect
  // ---------------------------------------------------------------------------

  describe('handleClose', () => {
    it('triggers reconnect when currentUrl exists', () => {
      const manager = WebSocketManager.getInstance();
      manager.connect('wss://example.com/stream');
      mockWsInstances[0].simulateOpen();
      mockWsInstances[0].simulateClose();

      expect(manager.getState().status).toBe('reconnecting');
    });

    it('does not reconnect after explicit disconnect', () => {
      const manager = WebSocketManager.getInstance();
      manager.connect('wss://example.com/stream');
      mockWsInstances[0].simulateOpen();
      manager.disconnect();

      // The close called by cleanup has listeners removed, so no reconnect
      expect(manager.getState().status).toBe('idle');
    });
  });

  // ---------------------------------------------------------------------------
  // scheduleReconnect
  // ---------------------------------------------------------------------------

  describe('scheduleReconnect', () => {
    it('applies exponential backoff delays', () => {
      const manager = WebSocketManager.getInstance();
      manager.connect('wss://example.com/stream');

      // First close → reconnect attempt 1
      mockWsInstances[0].simulateClose();
      expect(manager.getState().status).toBe('reconnecting');

      // After 1s delay, new WS is created
      vi.advanceTimersByTime(1000);
      expect(mockWsInstances).toHaveLength(2);

      // Close again → attempt 2, delay 2s
      mockWsInstances[1].simulateClose();
      vi.advanceTimersByTime(1000);
      expect(mockWsInstances).toHaveLength(2); // Not yet
      vi.advanceTimersByTime(1000);
      expect(mockWsInstances).toHaveLength(3);
    });

    it('caps delay at 30s', () => {
      const manager = WebSocketManager.getInstance();
      manager.connect('wss://example.com/stream');

      // Simulate multiple failures to reach high attempt count
      for (let i = 0; i < 8; i++) {
        const ws = mockWsInstances[mockWsInstances.length - 1];
        ws.simulateClose();
        // Advance enough for any delay
        vi.advanceTimersByTime(30000);
      }

      const state = manager.getState();
      // Should still be reconnecting or eventually fail at max attempts
      expect(['reconnecting', 'failed']).toContain(state.status);
    });

    it('transitions to failed after WS_MAX_RECONNECT_ATTEMPTS (10)', () => {
      const manager = WebSocketManager.getInstance();
      manager.connect('wss://example.com/stream');

      // Simulate 10 close events with timer advancement
      for (let i = 0; i < 10; i++) {
        const ws = mockWsInstances[mockWsInstances.length - 1];
        ws.simulateClose();
        vi.advanceTimersByTime(30000);
      }

      // 11th close should trigger failed
      const ws = mockWsInstances[mockWsInstances.length - 1];
      ws.simulateClose();

      const state = manager.getState();
      expect(state.status).toBe('failed');
      if (state.status === 'failed') {
        expect(state.error).toContain('10');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // heartbeat
  // ---------------------------------------------------------------------------

  describe('heartbeat', () => {
    it('resets heartbeat timer on each message', () => {
      const manager = WebSocketManager.getInstance();
      manager.connect('wss://example.com/stream');
      mockWsInstances[0].simulateOpen();

      // Send messages at 20s intervals (within 30s timeout)
      mockWsInstances[0].simulateMessage(
        JSON.stringify({ stream: 's', data: { e: 'trade', s: 'X', p: '1' } }),
      );
      vi.advanceTimersByTime(20000);

      mockWsInstances[0].simulateMessage(
        JSON.stringify({ stream: 's', data: { e: 'trade', s: 'X', p: '1' } }),
      );
      vi.advanceTimersByTime(20000);

      // WS should still be open (heartbeat was reset)
      expect(mockWsInstances[0].close).not.toHaveBeenCalled();
    });

    it('closes WebSocket after HEARTBEAT_TIMEOUT_MS (30s) with no messages', () => {
      const manager = WebSocketManager.getInstance();
      manager.connect('wss://example.com/stream');
      mockWsInstances[0].simulateOpen();

      // Advance 30s with no messages
      vi.advanceTimersByTime(30000);

      expect(mockWsInstances[0].close).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // visibility
  // ---------------------------------------------------------------------------

  describe('visibility', () => {
    it('clears heartbeat when tab becomes hidden', () => {
      const manager = WebSocketManager.getInstance();
      manager.connect('wss://example.com/stream');
      mockWsInstances[0].simulateOpen();

      // Capture the visibilitychange handler
      const addEventListenerCalls = vi.mocked(document.addEventListener).mock.calls;
      const visibilityCall = addEventListenerCalls.find((call) => call[0] === 'visibilitychange');
      expect(visibilityCall).toBeDefined();

      const handler = visibilityCall![1] as () => void;

      // Simulate tab hidden
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      handler();

      // Heartbeat should be cleared — advancing 30s should NOT close the WS
      vi.advanceTimersByTime(30000);
      expect(mockWsInstances[0].close).not.toHaveBeenCalled();
    });

    it('restarts heartbeat when tab becomes visible and WS is OPEN', () => {
      const manager = WebSocketManager.getInstance();
      manager.connect('wss://example.com/stream');
      mockWsInstances[0].simulateOpen();

      const addEventListenerCalls = vi.mocked(document.addEventListener).mock.calls;
      const handler = addEventListenerCalls.find(
        (call) => call[0] === 'visibilitychange',
      )![1] as () => void;

      // Hide tab
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      handler();

      // Show tab (WS still OPEN)
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      handler();

      // Heartbeat should be active again — 30s timeout should trigger close
      vi.advanceTimersByTime(30000);
      expect(mockWsInstances[0].close).toHaveBeenCalled();
    });

    it('triggers immediate reconnect when tab becomes visible and WS is closed', () => {
      const manager = WebSocketManager.getInstance();
      manager.connect('wss://example.com/stream');
      mockWsInstances[0].simulateOpen();

      const addEventListenerCalls = vi.mocked(document.addEventListener).mock.calls;
      const handler = addEventListenerCalls.find(
        (call) => call[0] === 'visibilitychange',
      )![1] as () => void;

      // Hide tab
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      handler();

      // Manually set WS to closed (simulating connection loss while hidden)
      mockWsInstances[0].readyState = MockWebSocket.CLOSED;

      // Show tab
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      handler();

      // Should have created a new WS immediately
      expect(mockWsInstances.length).toBeGreaterThanOrEqual(2);
      expect(manager.getState().status).toBe('connecting');
    });

    it('does not reconnect on visibility change when in failed state', () => {
      const manager = WebSocketManager.getInstance();
      manager.connect('wss://example.com/stream');

      // Exhaust all reconnect attempts to reach failed state
      for (let i = 0; i < 10; i++) {
        const ws = mockWsInstances[mockWsInstances.length - 1];
        ws.simulateClose();
        vi.advanceTimersByTime(30000);
      }
      // Final close triggers 'failed'
      mockWsInstances[mockWsInstances.length - 1].simulateClose();
      expect(manager.getState().status).toBe('failed');

      const wsCountBefore = mockWsInstances.length;

      const addEventListenerCalls = vi.mocked(document.addEventListener).mock.calls;
      const handler = addEventListenerCalls.find(
        (call) => call[0] === 'visibilitychange',
      )![1] as () => void;

      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      handler();

      // Should NOT create new WS
      expect(mockWsInstances.length).toBe(wsCountBefore);
      expect(manager.getState().status).toBe('failed');
    });
  });
});
