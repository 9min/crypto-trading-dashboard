// =============================================================================
// WebSocket Message Router
// =============================================================================
// Parses Binance Combined Stream messages and dispatches them to typed
// callback handlers based on the event type discriminant (`e` field).
// =============================================================================

import type {
  BinanceCombinedStreamMessage,
  WebSocketStreamMessage,
  BinanceKlineEvent,
  BinanceDepthEvent,
  BinanceTradeEvent,
  BinanceMiniTickerEvent,
} from '@/types/binance';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Handler callbacks for each Binance WebSocket event type.
 * All handlers are optional — only the events you care about need handlers.
 */
interface MessageHandlers {
  onKline?: (event: BinanceKlineEvent) => void;
  onDepth?: (event: BinanceDepthEvent) => void;
  onTrade?: (event: BinanceTradeEvent) => void;
  onMiniTicker?: (event: BinanceMiniTickerEvent) => void;
}

// -----------------------------------------------------------------------------
// Message Router Factory
// -----------------------------------------------------------------------------

/**
 * Creates a message routing function that dispatches WebSocket stream messages
 * to the appropriate typed handler based on the event type discriminant.
 *
 * @example
 * const router = createMessageRouter({
 *   onKline: (event) => klineStore.update(event),
 *   onDepth: (event) => depthStore.update(event),
 *   onTrade: (event) => tradeStore.update(event),
 * });
 *
 * wsManager.subscribe((message) => router(message));
 */
export function createMessageRouter(handlers: MessageHandlers) {
  return (message: WebSocketStreamMessage): void => {
    switch (message.e) {
      case 'kline':
        handlers.onKline?.(message);
        break;
      case 'depthUpdate':
        handlers.onDepth?.(message);
        break;
      case 'trade':
        handlers.onTrade?.(message);
        break;
      case '24hrMiniTicker':
        handlers.onMiniTicker?.(message);
        break;
    }
  };
}

// -----------------------------------------------------------------------------
// Raw Message Parser
// -----------------------------------------------------------------------------

/**
 * Parses a raw WebSocket message string from the Binance Combined Stream
 * into a typed WebSocketStreamMessage.
 *
 * Combined Stream messages are wrapped in `{ stream: string, data: T }`.
 * This function extracts and returns the `data` payload.
 *
 * @param rawMessage - The raw JSON string received from the WebSocket
 * @returns The parsed event data, or null if parsing fails
 */
export function parseCombinedStreamMessage(rawMessage: string): WebSocketStreamMessage | null {
  try {
    const parsed = JSON.parse(rawMessage) as BinanceCombinedStreamMessage<WebSocketStreamMessage>;
    return parsed.data ?? null;
  } catch (error) {
    console.error('[messageRouter] Failed to parse WebSocket message', error);
    return null;
  }
}

export type { MessageHandlers };
