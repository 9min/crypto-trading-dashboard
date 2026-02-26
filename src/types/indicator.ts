// =============================================================================
// Technical Indicator Type Definitions
// =============================================================================
// Discriminated union types for indicator configurations, calculation results,
// and type constants used across the indicator subsystem.
// =============================================================================

// -----------------------------------------------------------------------------
// Indicator Type Constants
// -----------------------------------------------------------------------------

/**
 * All supported technical indicator types.
 * Uses `const` assertion to derive a narrow literal union type.
 */
const INDICATOR_TYPES = ['sma', 'ema', 'bollingerBands', 'rsi', 'volume'] as const;

/**
 * Union type of all valid indicator type identifiers.
 */
type IndicatorType = (typeof INDICATOR_TYPES)[number];

// -----------------------------------------------------------------------------
// Indicator Configurations (Discriminated Union)
// -----------------------------------------------------------------------------

/** Simple Moving Average configuration */
interface SmaConfig {
  type: 'sma';
  id: string;
  period: number;
  color: string;
  visible: boolean;
}

/** Exponential Moving Average configuration */
interface EmaConfig {
  type: 'ema';
  id: string;
  period: number;
  color: string;
  visible: boolean;
}

/** Bollinger Bands configuration */
interface BollingerBandsConfig {
  type: 'bollingerBands';
  id: string;
  period: number;
  stdDev: number;
  upperColor: string;
  middleColor: string;
  lowerColor: string;
  visible: boolean;
}

/** Relative Strength Index configuration */
interface RsiConfig {
  type: 'rsi';
  id: string;
  period: number;
  color: string;
  overbought: number;
  oversold: number;
  visible: boolean;
}

/** Volume histogram with optional MA overlay */
interface VolumeConfig {
  type: 'volume';
  id: string;
  maPeriod: number;
  maColor: string;
  visible: boolean;
}

/**
 * Discriminated union of all indicator configurations.
 * The `type` field serves as the discriminant.
 */
type IndicatorConfig = SmaConfig | EmaConfig | BollingerBandsConfig | RsiConfig | VolumeConfig;

// -----------------------------------------------------------------------------
// Calculation Result Types
// -----------------------------------------------------------------------------

/** Single data point for line-based indicators (SMA, EMA, RSI) */
interface IndicatorDataPoint {
  time: number;
  value: number;
}

/** Data point for Bollinger Bands (three lines) */
interface BollingerBandsDataPoint {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

/** Volume histogram data point with color coding */
interface VolumeDataPoint {
  time: number;
  value: number;
  color: string;
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export { INDICATOR_TYPES };
export type {
  IndicatorType,
  SmaConfig,
  EmaConfig,
  BollingerBandsConfig,
  RsiConfig,
  VolumeConfig,
  IndicatorConfig,
  IndicatorDataPoint,
  BollingerBandsDataPoint,
  VolumeDataPoint,
};
