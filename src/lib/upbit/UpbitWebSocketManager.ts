// =============================================================================
// Upbit WebSocket Manager (Singleton)
// =============================================================================
// Manages a single WebSocket connection to the Upbit WebSocket API.
// Provides automatic reconnection with exponential backoff and
// PING keepalive. Separate from the Binance WebSocketManager since
// Upbit uses a different protocol (binary Blob responses, JSON array
// subscription format, PING/PONG keepalive).
// =============================================================================

import type { ConnectionState } from '@/types/chart';
import type { UpbitWebSocketMessage, UpbitSubscriptionType } from '@/types/upbit';
import { EXCHANGES } from '@/types/exchange';
import {
  RECONNECT_MAX_DELAY_MS,
  RECONNECT_BASE_DELAY_MS,
  UPBIT_WS_MAX_RECONNECT_ATTEMPTS,
} from '@/utils/constants';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Upbit recommends sending PING every 120 seconds to keep connection alive */
const UPBIT_PING_INTERVAL_MS = 110_000;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Callback signature for Upbit WebSocket message subscribers. */
type UpbitMessageCallback = (message: UpbitWebSocketMessage) => void;

/** Callback signature for connection state change subscribers. */
type UpbitStateChangeCallback = (state: ConnectionState) => void;

// -----------------------------------------------------------------------------
// UpbitWebSocketManager
// -----------------------------------------------------------------------------

export class UpbitWebSocketManager {
  // ---------------------------------------------------------------------------
  // Singleton
  // ---------------------------------------------------------------------------

  private static instance: UpbitWebSocketManager | null = null;

  static getInstance(): UpbitWebSocketManager {
    if (!UpbitWebSocketManager.instance) {
      UpbitWebSocketManager.instance = new UpbitWebSocketManager();
    }
    return UpbitWebSocketManager.instance;
  }

  /** Resets the singleton instance. Intended for testing only. */
  static resetInstance(): void {
    if (UpbitWebSocketManager.instance) {
      UpbitWebSocketManager.instance.disconnect();
      UpbitWebSocketManager.instance = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private State
  // ---------------------------------------------------------------------------

  private ws: WebSocket | null = null;
  private state: ConnectionState = { status: 'idle' };
  private reconnectAttempt = 0;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private pingIntervalId: ReturnType<typeof setInterval> | null = null;
  private currentSubscriptions: UpbitSubscriptionType[] = [];

  private messageSubscribers = new Set<UpbitMessageCallback>();
  private stateSubscribers = new Set<UpbitStateChangeCallback>();

  private constructor() {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Opens a WebSocket connection to Upbit and subscribes to the given types.
   * If already connected with the same subscriptions, this is a no-op.
   */
  connect(subscriptions: UpbitSubscriptionType[]): void {
    if (typeof window === 'undefined') return;
    if (subscriptions.length === 0) {
      this.disconnect();
      return;
    }

    // Check if already connected with identical subscriptions
    if (this.isSameSubscriptions(subscriptions) && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.cleanup();
    this.currentSubscriptions = subscriptions;
    this.reconnectAttempt = 0;
    this.setState({ status: 'connecting' });
    this.createWebSocket();
  }

  /**
   * Closes connection when no message subscribers remain.
   * Always call this in cleanup functions after unsubscribe().
   */
  disconnect(): void {
    if (this.messageSubscribers.size > 0) return;

    this.cleanup();
    this.currentSubscriptions = [];
    this.reconnectAttempt = 0;
    this.setState({ status: 'idle' });
  }

  /**
   * Subscribes to incoming WebSocket messages.
   * @returns An unsubscribe function that removes the callback.
   */
  subscribe(callback: UpbitMessageCallback): () => void {
    this.messageSubscribers.add(callback);
    return () => {
      this.messageSubscribers.delete(callback);
    };
  }

  /**
   * Subscribes to connection state changes.
   * @returns An unsubscribe function.
   */
  onStateChange(callback: UpbitStateChangeCallback): () => void {
    this.stateSubscribers.add(callback);
    callback(this.state);
    return () => {
      this.stateSubscribers.delete(callback);
    };
  }

  /** Returns the current connection state. */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Manually triggers a reconnection attempt.
   */
  reconnect(): void {
    if (this.currentSubscriptions.length === 0) return;
    this.reconnectAttempt = 0;
    this.cleanup();
    this.setState({ status: 'connecting' });
    this.createWebSocket();
  }

  // ---------------------------------------------------------------------------
  // WebSocket Lifecycle (Private)
  // ---------------------------------------------------------------------------

  private createWebSocket(): void {
    try {
      this.ws = new WebSocket(EXCHANGES.upbit.wsUrl);
      this.ws.addEventListener('open', this.handleOpen);
      this.ws.addEventListener('close', this.handleClose);
      this.ws.addEventListener('error', this.handleError);
      this.ws.addEventListener('message', this.handleMessage);
    } catch (error) {
      console.error('[UpbitWebSocketManager] Failed to create WebSocket', {
        timestamp: Date.now(),
        error,
      });
      this.scheduleReconnect();
    }
  }

  private handleOpen = (): void => {
    this.reconnectAttempt = 0;
    this.setState({ status: 'connected', connectedAt: Date.now() });
    this.sendSubscription();
    this.startPing();
  };

  private handleClose = (): void => {
    this.stopPing();
    if (this.currentSubscriptions.length > 0) {
      this.scheduleReconnect();
    }
  };

  private handleError = (event: Event): void => {
    console.error('[UpbitWebSocketManager] WebSocket error', {
      timestamp: Date.now(),
      event,
    });
  };

  private handleMessage = (event: MessageEvent): void => {
    // Upbit sends binary (Blob) data, needs conversion
    const rawData = event.data;

    if (rawData instanceof Blob) {
      rawData
        .text()
        .then((text) => {
          this.parseAndDispatch(text);
        })
        .catch((error: unknown) => {
          console.error('[UpbitWebSocketManager] Failed to read Blob', {
            timestamp: Date.now(),
            error,
          });
        });
      return;
    }

    if (typeof rawData === 'string') {
      this.parseAndDispatch(rawData);
    }
  };

  // ---------------------------------------------------------------------------
  // Message Parsing & Dispatch (Private)
  // ---------------------------------------------------------------------------

  private parseAndDispatch(text: string): void {
    try {
      const parsed = JSON.parse(text) as UpbitWebSocketMessage;

      // Ignore status/error messages that don't have a type
      if (!parsed.type) return;

      for (const callback of this.messageSubscribers) {
        try {
          callback(parsed);
        } catch (error) {
          console.error('[UpbitWebSocketManager] Subscriber callback error', {
            timestamp: Date.now(),
            error,
          });
        }
      }
    } catch (error) {
      console.error('[UpbitWebSocketManager] Failed to parse message', {
        timestamp: Date.now(),
        text: text.slice(0, 200),
        error,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Subscription (Private)
  // ---------------------------------------------------------------------------

  /**
   * Sends the subscription message to Upbit WebSocket.
   * Format: [{ ticket }, { type, codes }, ...]
   */
  private sendSubscription(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const message = [{ ticket: `dashboard-${Date.now()}` }, ...this.currentSubscriptions];

    this.ws.send(JSON.stringify(message));
  }

  // ---------------------------------------------------------------------------
  // PING Keepalive (Private)
  // ---------------------------------------------------------------------------

  private startPing(): void {
    this.stopPing();
    this.pingIntervalId = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send('PING');
      }
    }, UPBIT_PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingIntervalId !== null) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Reconnection Logic (Private)
  // ---------------------------------------------------------------------------

  private scheduleReconnect(): void {
    if (this.currentSubscriptions.length === 0) return;

    if (this.reconnectAttempt >= UPBIT_WS_MAX_RECONNECT_ATTEMPTS) {
      this.setState({
        status: 'failed',
        error: `Failed to reconnect after ${UPBIT_WS_MAX_RECONNECT_ATTEMPTS} attempts`,
      });
      return;
    }

    this.reconnectAttempt++;
    this.setState({ status: 'reconnecting', attempt: this.reconnectAttempt });

    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempt - 1),
      RECONNECT_MAX_DELAY_MS,
    );

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      if (this.currentSubscriptions.length > 0) {
        this.createWebSocket();
      }
    }, delay);
  }

  // ---------------------------------------------------------------------------
  // Helpers (Private)
  // ---------------------------------------------------------------------------

  private isSameSubscriptions(subscriptions: UpbitSubscriptionType[]): boolean {
    if (subscriptions.length !== this.currentSubscriptions.length) return false;
    return subscriptions.every((sub, i) => {
      const current = this.currentSubscriptions[i];
      if (sub.type !== current.type) return false;
      if (sub.codes.length !== current.codes.length) return false;
      return sub.codes.every((code, j) => code === current.codes[j]);
    });
  }

  // ---------------------------------------------------------------------------
  // State Management (Private)
  // ---------------------------------------------------------------------------

  private setState(newState: ConnectionState): void {
    this.state = newState;
    for (const callback of this.stateSubscribers) {
      try {
        callback(newState);
      } catch (error) {
        console.error('[UpbitWebSocketManager] State subscriber callback error', {
          state: newState.status,
          timestamp: Date.now(),
          error,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup (Private)
  // ---------------------------------------------------------------------------

  private cleanup(): void {
    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    this.stopPing();

    if (this.ws) {
      this.ws.removeEventListener('open', this.handleOpen);
      this.ws.removeEventListener('close', this.handleClose);
      this.ws.removeEventListener('error', this.handleError);
      this.ws.removeEventListener('message', this.handleMessage);

      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }

      this.ws = null;
    }
  }
}
