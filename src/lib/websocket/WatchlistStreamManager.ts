// =============================================================================
// Watchlist Stream Manager (Singleton)
// =============================================================================
// Manages a dedicated WebSocket connection for watchlist miniTicker streams.
// Separate from the main WebSocketManager to avoid interference with the
// primary kline/depth/trade streams.
//
// Features:
// - Singleton pattern consistent with WebSocketManager
// - Exponential backoff reconnection (1s -> 2s -> 4s -> ... -> 30s max, 10 attempts)
// - Symbol list diffing to avoid unnecessary reconnections
// - Subscriber callback pattern for miniTicker events
//
// Unlike the main WebSocketManager, this does NOT include heartbeat or
// Page Visibility integration since miniTicker data is non-critical.
// =============================================================================

import type { BinanceMiniTickerEvent } from '@/types/binance';
import { buildStreamUrl, getMiniTickerStream } from '@/lib/binance/streamUrls';
import { parseCombinedStreamMessage } from './messageRouter';
import {
  RECONNECT_MAX_DELAY_MS,
  RECONNECT_BASE_DELAY_MS,
  WS_MAX_RECONNECT_ATTEMPTS,
} from '@/utils/constants';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Callback signature for miniTicker event subscribers. */
type MiniTickerCallback = (event: BinanceMiniTickerEvent) => void;

// -----------------------------------------------------------------------------
// WatchlistStreamManager
// -----------------------------------------------------------------------------

export class WatchlistStreamManager {
  // ---------------------------------------------------------------------------
  // Singleton
  // ---------------------------------------------------------------------------

  private static instance: WatchlistStreamManager | null = null;

  static getInstance(): WatchlistStreamManager {
    if (!WatchlistStreamManager.instance) {
      WatchlistStreamManager.instance = new WatchlistStreamManager();
    }
    return WatchlistStreamManager.instance;
  }

  /** Resets the singleton instance. Intended for testing only. */
  static resetInstance(): void {
    if (WatchlistStreamManager.instance) {
      WatchlistStreamManager.instance.disconnect();
      WatchlistStreamManager.instance = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private State
  // ---------------------------------------------------------------------------

  private ws: WebSocket | null = null;
  private currentSymbols: string[] = [];
  private reconnectAttempt = 0;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private subscribers = new Set<MiniTickerCallback>();

  private constructor() {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Opens a WebSocket connection for the given symbols' miniTicker streams.
   * If already connected with the same symbols, this is a no-op.
   * If symbols differ, the existing connection is closed and a new one opened.
   */
  connect(symbols: string[]): void {
    if (typeof window === 'undefined') return;
    if (symbols.length === 0) {
      this.disconnect();
      return;
    }

    // Check if already connected with identical symbols
    if (this.isSameSymbols(symbols) && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.cleanup();
    this.currentSymbols = [...symbols];
    this.reconnectAttempt = 0;

    const streams = symbols.map(getMiniTickerStream);
    const url = buildStreamUrl(streams);
    this.createWebSocket(url);
  }

  /**
   * Updates the symbol list and reconnects if symbols have changed.
   */
  updateSymbols(symbols: string[]): void {
    if (this.isSameSymbols(symbols)) return;
    this.connect(symbols);
  }

  /**
   * Subscribes to miniTicker events.
   * @returns An unsubscribe function.
   */
  subscribe(callback: MiniTickerCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Closes the WebSocket connection and stops all reconnection attempts.
   */
  disconnect(): void {
    this.cleanup();
    this.currentSymbols = [];
    this.reconnectAttempt = 0;
  }

  // ---------------------------------------------------------------------------
  // WebSocket Lifecycle (Private)
  // ---------------------------------------------------------------------------

  private createWebSocket(url: string): void {
    try {
      this.ws = new WebSocket(url);
      this.ws.addEventListener('open', this.handleOpen);
      this.ws.addEventListener('close', this.handleClose);
      this.ws.addEventListener('error', this.handleError);
      this.ws.addEventListener('message', this.handleMessage);
    } catch (error) {
      console.error('[WatchlistStreamManager] Failed to create WebSocket', {
        url,
        timestamp: Date.now(),
        error,
      });
      this.scheduleReconnect();
    }
  }

  private handleOpen = (): void => {
    this.reconnectAttempt = 0;
  };

  private handleClose = (): void => {
    if (this.currentSymbols.length > 0) {
      this.scheduleReconnect();
    }
  };

  private handleError = (event: Event): void => {
    console.error('[WatchlistStreamManager] WebSocket error', {
      timestamp: Date.now(),
      event,
    });
  };

  private handleMessage = (event: MessageEvent): void => {
    const rawData = event.data;
    if (typeof rawData !== 'string') return;

    const message = parseCombinedStreamMessage(rawData);
    if (!message || message.e !== '24hrMiniTicker') return;

    for (const callback of this.subscribers) {
      try {
        callback(message);
      } catch (error) {
        console.error('[WatchlistStreamManager] Subscriber callback error', {
          timestamp: Date.now(),
          error,
        });
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Reconnection Logic (Private)
  // ---------------------------------------------------------------------------

  private scheduleReconnect(): void {
    if (this.currentSymbols.length === 0) return;

    if (this.reconnectAttempt >= WS_MAX_RECONNECT_ATTEMPTS) {
      console.error('[WatchlistStreamManager] Max reconnect attempts reached', {
        attempts: WS_MAX_RECONNECT_ATTEMPTS,
        timestamp: Date.now(),
      });
      return;
    }

    this.reconnectAttempt++;
    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempt - 1),
      RECONNECT_MAX_DELAY_MS,
    );

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      if (this.currentSymbols.length > 0) {
        const streams = this.currentSymbols.map(getMiniTickerStream);
        const url = buildStreamUrl(streams);
        this.createWebSocket(url);
      }
    }, delay);
  }

  // ---------------------------------------------------------------------------
  // Helpers (Private)
  // ---------------------------------------------------------------------------

  /**
   * Checks if the given symbols match the currently connected symbols.
   * Order-sensitive comparison since symbol order matters for display.
   */
  private isSameSymbols(symbols: string[]): boolean {
    if (symbols.length !== this.currentSymbols.length) return false;
    return symbols.every((s, i) => s === this.currentSymbols[i]);
  }

  // ---------------------------------------------------------------------------
  // Cleanup (Private)
  // ---------------------------------------------------------------------------

  private cleanup(): void {
    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

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
