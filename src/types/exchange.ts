// =============================================================================
// Exchange Type Definitions
// =============================================================================
// Common types and constants for multi-exchange support.
// Currently supports Binance and Upbit.
// =============================================================================

// -----------------------------------------------------------------------------
// Exchange ID
// -----------------------------------------------------------------------------

/**
 * All supported exchange identifiers.
 * Uses `const` assertion to derive a narrow literal union type.
 */
const EXCHANGE_IDS = ['binance', 'upbit'] as const;

/**
 * Union type of all valid exchange identifiers.
 */
type ExchangeId = (typeof EXCHANGE_IDS)[number];

// -----------------------------------------------------------------------------
// Exchange Configuration
// -----------------------------------------------------------------------------

/**
 * Configuration for a single exchange.
 * Describes the exchange's identity, API endpoints, and symbol format.
 */
interface ExchangeConfig {
  /** Unique exchange identifier */
  id: ExchangeId;
  /** Human-readable display name */
  name: string;
  /** WebSocket API base URL */
  wsUrl: string;
  /** REST API base URL */
  restBaseUrl: string;
  /** Symbol format description for display */
  symbolFormat: string;
}

// -----------------------------------------------------------------------------
// Exchange Constants
// -----------------------------------------------------------------------------

/**
 * Configuration map for all supported exchanges.
 * Provides API endpoints and metadata for each exchange.
 */
const EXCHANGES: Record<ExchangeId, ExchangeConfig> = {
  binance: {
    id: 'binance',
    name: 'Binance',
    wsUrl: 'wss://stream.binance.com:9443/stream',
    restBaseUrl: 'https://api.binance.com/api/v3',
    symbolFormat: 'BTCUSDT',
  },
  upbit: {
    id: 'upbit',
    name: 'Upbit',
    wsUrl: 'wss://api.upbit.com/websocket/v1',
    restBaseUrl: 'https://api.upbit.com/v1',
    symbolFormat: 'KRW-BTC',
  },
} as const;

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export { EXCHANGE_IDS, EXCHANGES };
export type { ExchangeId, ExchangeConfig };
