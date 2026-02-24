// =============================================================================
// WebSocket Manager (Singleton)
// =============================================================================
// Manages a single WebSocket connection to the Binance Combined Stream.
// Provides automatic reconnection with exponential backoff, heartbeat
// detection, and Page Visibility API integration.
//
// Usage:
//   const manager = WebSocketManager.getInstance();
//   manager.connect(buildCombinedStreamUrl('BTCUSDT', '1m'));
//   const unsubscribe = manager.subscribe(handleMessage);
//   // ... later
//   unsubscribe();
//   manager.disconnect();
// =============================================================================

import type { ConnectionState } from '@/types/chart';
import type { WebSocketStreamMessage } from '@/types/binance';
import {
  RECONNECT_MAX_DELAY_MS,
  RECONNECT_BASE_DELAY_MS,
  HEARTBEAT_TIMEOUT_MS,
  WS_MAX_RECONNECT_ATTEMPTS,
} from '@/utils/constants';
import { parseCombinedStreamMessage } from './messageRouter';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Callback signature for WebSocket stream message subscribers. */
type MessageCallback = (message: WebSocketStreamMessage) => void;

/** Callback signature for connection state change subscribers. */
type StateChangeCallback = (state: ConnectionState) => void;

// -----------------------------------------------------------------------------
// WebSocketManager
// -----------------------------------------------------------------------------

/**
 * Singleton WebSocket manager for the Binance Combined Stream.
 *
 * Key features:
 * - Singleton pattern ensures a single WebSocket connection across the app
 * - Exponential backoff reconnection (1s -> 2s -> 4s -> ... -> 30s max)
 * - Heartbeat detection: reconnects if no message received for 30s
 * - Page Visibility API: pauses rendering when tab is hidden
 * - Type-safe message dispatching via subscriber callbacks
 */
export class WebSocketManager {
  // ---------------------------------------------------------------------------
  // Singleton
  // ---------------------------------------------------------------------------

  private static instance: WebSocketManager | null = null;

  /**
   * Returns the singleton WebSocketManager instance.
   * Creates a new instance on the first call.
   */
  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /** Resets the singleton instance. Intended for testing only. */
  static resetInstance(): void {
    if (WebSocketManager.instance) {
      WebSocketManager.instance.disconnect();
      WebSocketManager.instance = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private State
  // ---------------------------------------------------------------------------

  private ws: WebSocket | null = null;
  private currentUrl: string | null = null;
  private state: ConnectionState = { status: 'idle' };
  private reconnectAttempt = 0;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /** Subscribers for incoming WebSocket messages. */
  private messageSubscribers = new Set<MessageCallback>();

  /** Subscribers for connection state changes. */
  private stateSubscribers = new Set<StateChangeCallback>();

  /** Bound handler reference for cleanup. */
  private readonly boundHandleVisibilityChange: () => void;

  // ---------------------------------------------------------------------------
  // Constructor (private — use getInstance())
  // ---------------------------------------------------------------------------

  private constructor() {
    this.boundHandleVisibilityChange = this.handleVisibilityChange.bind(this);

    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', this.boundHandleVisibilityChange);
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Opens a WebSocket connection to the given URL.
   * If already connected to the same URL, this is a no-op.
   * If connected to a different URL, the existing connection is closed first.
   */
  connect(url: string): void {
    if (typeof window === 'undefined') return;

    // Already connected to the same URL — no-op
    if (this.currentUrl === url && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    // Close any existing connection before opening a new one
    this.cleanup();

    this.currentUrl = url;
    this.reconnectAttempt = 0;
    this.setState({ status: 'connecting' });
    this.createWebSocket(url);
  }

  /**
   * Closes the WebSocket connection and stops all reconnection attempts.
   * Resets the connection state to 'idle'.
   */
  disconnect(): void {
    this.cleanup();
    this.currentUrl = null;
    this.reconnectAttempt = 0;
    this.setState({ status: 'idle' });
  }

  /**
   * Subscribes to incoming WebSocket stream messages.
   *
   * @returns An unsubscribe function — call it to stop receiving messages.
   */
  subscribe(callback: MessageCallback): () => void {
    this.messageSubscribers.add(callback);
    return () => {
      this.messageSubscribers.delete(callback);
    };
  }

  /**
   * Subscribes to connection state changes.
   *
   * @returns An unsubscribe function — call it to stop receiving state updates.
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.stateSubscribers.add(callback);
    // Immediately emit current state so the subscriber is in sync
    callback(this.state);
    return () => {
      this.stateSubscribers.delete(callback);
    };
  }

  /** Returns the current connection state. */
  getState(): ConnectionState {
    return this.state;
  }

  // ---------------------------------------------------------------------------
  // WebSocket Lifecycle (Private)
  // ---------------------------------------------------------------------------

  /** Creates a new WebSocket and attaches event handlers. */
  private createWebSocket(url: string): void {
    try {
      this.ws = new WebSocket(url);
      this.ws.addEventListener('open', this.handleOpen);
      this.ws.addEventListener('close', this.handleClose);
      this.ws.addEventListener('error', this.handleError);
      this.ws.addEventListener('message', this.handleMessage);
    } catch (error) {
      console.error('[WebSocketManager] Failed to create WebSocket', {
        url,
        timestamp: Date.now(),
        error,
      });
      this.scheduleReconnect();
    }
  }

  /** Handles the WebSocket `open` event. */
  private handleOpen = (): void => {
    this.reconnectAttempt = 0;
    this.setState({ status: 'connected', connectedAt: Date.now() });
    this.resetHeartbeat();
  };

  /** Handles the WebSocket `close` event. */
  private handleClose = (): void => {
    this.clearHeartbeat();

    // Only attempt reconnect if we still have a URL (i.e., not a manual disconnect)
    if (this.currentUrl) {
      this.scheduleReconnect();
    }
  };

  /** Handles the WebSocket `error` event. */
  private handleError = (event: Event): void => {
    console.error('[WebSocketManager] WebSocket error', {
      url: this.currentUrl,
      timestamp: Date.now(),
      event,
    });
    // The `close` event always fires after `error`, so reconnection
    // is handled in handleClose. No additional action needed here.
  };

  /** Handles incoming WebSocket messages. */
  private handleMessage = (event: MessageEvent): void => {
    this.resetHeartbeat();

    const rawData = event.data;
    if (typeof rawData !== 'string') return;

    const message = parseCombinedStreamMessage(rawData);
    if (!message) return;

    for (const callback of this.messageSubscribers) {
      try {
        callback(message);
      } catch (error) {
        console.error('[WebSocketManager] Subscriber callback error', {
          timestamp: Date.now(),
          error,
        });
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Reconnection Logic (Private)
  // ---------------------------------------------------------------------------

  /**
   * Schedules a reconnection attempt with exponential backoff.
   * If the maximum number of attempts is exceeded, transitions to 'failed'.
   */
  private scheduleReconnect(): void {
    if (!this.currentUrl) return;

    if (this.reconnectAttempt >= WS_MAX_RECONNECT_ATTEMPTS) {
      this.setState({
        status: 'failed',
        error: `Failed to reconnect after ${WS_MAX_RECONNECT_ATTEMPTS} attempts`,
      });
      return;
    }

    this.reconnectAttempt++;
    this.setState({ status: 'reconnecting', attempt: this.reconnectAttempt });

    const delay = this.getReconnectDelay(this.reconnectAttempt);

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      if (this.currentUrl) {
        this.createWebSocket(this.currentUrl);
      }
    }, delay);
  }

  /**
   * Calculates the reconnection delay using exponential backoff.
   * 1s -> 2s -> 4s -> 8s -> 16s -> 30s (capped)
   */
  private getReconnectDelay(attempt: number): number {
    return Math.min(RECONNECT_BASE_DELAY_MS * Math.pow(2, attempt - 1), RECONNECT_MAX_DELAY_MS);
  }

  // ---------------------------------------------------------------------------
  // Heartbeat Detection (Private)
  // ---------------------------------------------------------------------------

  /**
   * Resets the heartbeat timer. If no message is received within
   * HEARTBEAT_TIMEOUT_MS (30s), the connection is considered dead
   * and a reconnection is triggered.
   */
  private resetHeartbeat(): void {
    this.clearHeartbeat();

    this.heartbeatTimeoutId = setTimeout(() => {
      this.heartbeatTimeoutId = null;
      console.error('[WebSocketManager] Heartbeat timeout — no message received', {
        timeout: HEARTBEAT_TIMEOUT_MS,
        timestamp: Date.now(),
      });

      // Force-close the stale connection to trigger reconnection via handleClose
      if (this.ws) {
        this.ws.close();
      }
    }, HEARTBEAT_TIMEOUT_MS);
  }

  /** Clears the heartbeat timeout timer. */
  private clearHeartbeat(): void {
    if (this.heartbeatTimeoutId !== null) {
      clearTimeout(this.heartbeatTimeoutId);
      this.heartbeatTimeoutId = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Page Visibility API (Private)
  // ---------------------------------------------------------------------------

  /**
   * Handles document visibility changes.
   * When the tab becomes hidden, the WebSocket remains open but heartbeat
   * is paused (browsers throttle timers for hidden tabs anyway).
   * When the tab becomes visible again, the heartbeat is restarted and
   * if the connection was lost, a reconnection is triggered immediately.
   */
  private handleVisibilityChange(): void {
    if (typeof document === 'undefined') return;

    if (document.visibilityState === 'hidden') {
      // Pause heartbeat — browsers throttle timers in hidden tabs,
      // which could cause false-positive heartbeat timeouts
      this.clearHeartbeat();
    } else {
      // Tab is visible again
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Connection is still alive — restart heartbeat monitoring
        this.resetHeartbeat();
      } else if (this.currentUrl && this.state.status !== 'connecting') {
        // Connection was lost while tab was hidden — reconnect immediately
        this.reconnectAttempt = 0;
        this.cleanup();
        this.setState({ status: 'connecting' });
        this.createWebSocket(this.currentUrl);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // State Management (Private)
  // ---------------------------------------------------------------------------

  /** Updates the connection state and notifies all state subscribers. */
  private setState(newState: ConnectionState): void {
    this.state = newState;
    for (const callback of this.stateSubscribers) {
      try {
        callback(newState);
      } catch (error) {
        console.error('[WebSocketManager] State subscriber callback error', {
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

  /**
   * Cleans up all active resources:
   * - Closes the WebSocket connection
   * - Cancels pending reconnection timeout
   * - Clears heartbeat timeout
   */
  private cleanup(): void {
    // Cancel pending reconnect
    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    // Clear heartbeat
    this.clearHeartbeat();

    // Close WebSocket
    if (this.ws) {
      // Remove event listeners before closing to prevent handleClose from
      // triggering a reconnection cycle during intentional disconnect
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
