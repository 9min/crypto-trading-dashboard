// =============================================================================
// Technical Indicator Calculation Functions
// =============================================================================
// Pure functions that compute technical indicators from candlestick data.
// All functions are O(n) and produce no side effects.
//
// - computeSma: Simple Moving Average (sliding window sum)
// - computeEma: Exponential Moving Average (Wilder-style smoothing)
// - computeBollingerBands: SMA ± stdDev × σ
// - computeRsi: Relative Strength Index (Wilder's smoothing)
// - computeVolumeWithMa: Volume histogram + SMA overlay
// - computeEmaNext / computeRsiNext: Incremental single-candle updates
// =============================================================================

import type { CandleData } from '@/types/chart';
import type {
  IndicatorDataPoint,
  BollingerBandsDataPoint,
  VolumeDataPoint,
} from '@/types/indicator';
import { INDICATOR_COLORS } from '@/utils/constants';

// -----------------------------------------------------------------------------
// SMA — Simple Moving Average
// -----------------------------------------------------------------------------

/**
 * Computes Simple Moving Average using a sliding window sum.
 * Returns one data point for each candle where enough prior data exists.
 */
export function computeSma(candles: CandleData[], period: number): IndicatorDataPoint[] {
  if (period < 1 || candles.length < period) return [];

  const result: IndicatorDataPoint[] = [];
  let sum = 0;

  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;

    if (i >= period) {
      sum -= candles[i - period].close;
    }

    if (i >= period - 1) {
      result.push({
        time: candles[i].time,
        value: sum / period,
      });
    }
  }

  return result;
}

// -----------------------------------------------------------------------------
// EMA — Exponential Moving Average
// -----------------------------------------------------------------------------

/**
 * Computes Exponential Moving Average.
 * The first EMA value is initialized as the SMA over the first `period` candles.
 */
export function computeEma(candles: CandleData[], period: number): IndicatorDataPoint[] {
  if (period < 1 || candles.length < period) return [];

  const result: IndicatorDataPoint[] = [];
  const multiplier = 2 / (period + 1);

  // First value: SMA of the first `period` candles
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  let ema = sum / period;
  result.push({ time: candles[period - 1].time, value: ema });

  // Subsequent values: EMA formula
  for (let i = period; i < candles.length; i++) {
    ema = (candles[i].close - ema) * multiplier + ema;
    result.push({ time: candles[i].time, value: ema });
  }

  return result;
}

/**
 * Computes the next EMA value given the previous EMA and a new close price.
 * Used for incremental updates when a single new candle arrives.
 */
export function computeEmaNext(prevEma: number, close: number, period: number): number {
  const multiplier = 2 / (period + 1);
  return (close - prevEma) * multiplier + prevEma;
}

// -----------------------------------------------------------------------------
// Bollinger Bands
// -----------------------------------------------------------------------------

/**
 * Computes Bollinger Bands: middle (SMA), upper (SMA + stdDev × σ),
 * lower (SMA − stdDev × σ). Uses sliding window for O(n) computation.
 */
export function computeBollingerBands(
  candles: CandleData[],
  period: number,
  stdDev: number,
): BollingerBandsDataPoint[] {
  if (period < 1 || candles.length < period) return [];

  const result: BollingerBandsDataPoint[] = [];
  let sum = 0;
  let sumSq = 0;

  for (let i = 0; i < candles.length; i++) {
    const close = candles[i].close;
    sum += close;
    sumSq += close * close;

    if (i >= period) {
      const removed = candles[i - period].close;
      sum -= removed;
      sumSq -= removed * removed;
    }

    if (i >= period - 1) {
      const mean = sum / period;
      // Population standard deviation (not sample)
      const variance = sumSq / period - mean * mean;
      const sd = Math.sqrt(Math.max(0, variance));

      result.push({
        time: candles[i].time,
        upper: mean + stdDev * sd,
        middle: mean,
        lower: mean - stdDev * sd,
      });
    }
  }

  return result;
}

// -----------------------------------------------------------------------------
// RSI — Relative Strength Index
// -----------------------------------------------------------------------------

/**
 * Computes RSI using Wilder's smoothing method.
 * The first RSI value appears after `period + 1` candles (requires `period`
 * price changes, then one smoothing step).
 */
export function computeRsi(candles: CandleData[], period: number): IndicatorDataPoint[] {
  if (period < 1 || candles.length < period + 1) return [];

  const result: IndicatorDataPoint[] = [];

  // Compute initial average gain/loss over the first `period` changes
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) {
      avgGain += change;
    } else {
      avgLoss += Math.abs(change);
    }
  }

  avgGain /= period;
  avgLoss /= period;

  // First RSI data point
  const firstRsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  result.push({ time: candles[period].time, value: firstRsi });

  // Subsequent values using Wilder's smoothing
  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    result.push({ time: candles[i].time, value: rsi });
  }

  return result;
}

/** State needed for incremental RSI updates */
interface RsiState {
  avgGain: number;
  avgLoss: number;
  period: number;
}

/**
 * Computes the next RSI value given the previous RSI state and a new price change.
 * Returns the new RSI value and updated state.
 */
export function computeRsiNext(
  state: RsiState,
  prevClose: number,
  currentClose: number,
): { value: number; avgGain: number; avgLoss: number } {
  const change = currentClose - prevClose;
  const gain = change > 0 ? change : 0;
  const loss = change < 0 ? Math.abs(change) : 0;

  const avgGain = (state.avgGain * (state.period - 1) + gain) / state.period;
  const avgLoss = (state.avgLoss * (state.period - 1) + loss) / state.period;

  const value = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  return { value, avgGain, avgLoss };
}

// -----------------------------------------------------------------------------
// Volume with MA
// -----------------------------------------------------------------------------

/**
 * Computes volume histogram data with buy/sell color coding and an SMA overlay.
 * Returns volume data points and a separate MA line.
 */
export function computeVolumeWithMa(
  candles: CandleData[],
  maPeriod: number,
): { volumes: VolumeDataPoint[]; ma: IndicatorDataPoint[] } {
  const volumes: VolumeDataPoint[] = [];
  const ma: IndicatorDataPoint[] = [];
  let sum = 0;

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const isBullish = candle.close >= candle.open;

    volumes.push({
      time: candle.time,
      value: candle.volume,
      color: isBullish ? INDICATOR_COLORS.VOLUME_UP : INDICATOR_COLORS.VOLUME_DOWN,
    });

    sum += candle.volume;

    if (i >= maPeriod) {
      sum -= candles[i - maPeriod].volume;
    }

    if (i >= maPeriod - 1) {
      ma.push({
        time: candle.time,
        value: sum / maPeriod,
      });
    }
  }

  return { volumes, ma };
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export type { RsiState };
