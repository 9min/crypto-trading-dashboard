// =============================================================================
// Upbit Message Router
// =============================================================================
// Routes Upbit WebSocket messages to typed callback handlers based on
// the event type discriminant (`type` field).
// =============================================================================

import type {
  UpbitWebSocketMessage,
  UpbitTickerEvent,
  UpbitTradeEvent,
  UpbitOrderBookEvent,
} from '@/types/upbit';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Handler callbacks for each Upbit WebSocket event type.
 * All handlers are optional — only the events you care about need handlers.
 */
interface UpbitMessageHandlers {
  onTicker?: (event: UpbitTickerEvent) => void;
  onTrade?: (event: UpbitTradeEvent) => void;
  onOrderBook?: (event: UpbitOrderBookEvent) => void;
}

// -----------------------------------------------------------------------------
// Message Router Factory
// -----------------------------------------------------------------------------

/**
 * Creates a message routing function that dispatches Upbit WebSocket messages
 * to the appropriate typed handler based on the event type discriminant.
 */
export function createUpbitMessageRouter(handlers: UpbitMessageHandlers) {
  return (message: UpbitWebSocketMessage): void => {
    switch (message.type) {
      case 'ticker':
        handlers.onTicker?.(message);
        break;
      case 'trade':
        handlers.onTrade?.(message);
        break;
      case 'orderbook':
        handlers.onOrderBook?.(message);
        break;
    }
  };
}

export type { UpbitMessageHandlers };
