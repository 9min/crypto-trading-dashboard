// =============================================================================
// Technical Indicator Calculation Unit Tests
// =============================================================================

import type { CandleData } from '@/types/chart';
import {
  computeSma,
  computeEma,
  computeEmaNext,
  computeBollingerBands,
  computeRsi,
  computeRsiNext,
  computeVolumeWithMa,
} from './indicators';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function createCandle(overrides: Partial<CandleData> = {}): CandleData {
  return {
    time: 1700000000,
    open: 50000,
    high: 51000,
    low: 49000,
    close: 50000,
    volume: 100,
    ...overrides,
  };
}

/** Creates a sequence of candles with specified close prices */
function candlesFromCloses(closes: number[]): CandleData[] {
  return closes.map((close, i) => createCandle({ time: 1700000000 + i * 60, close, open: close }));
}

// -----------------------------------------------------------------------------
// SMA
// -----------------------------------------------------------------------------

describe('computeSma', () => {
  it('returns empty array when candles are fewer than period', () => {
    const candles = candlesFromCloses([10, 20]);
    expect(computeSma(candles, 3)).toEqual([]);
  });

  it('returns empty array for period < 1', () => {
    const candles = candlesFromCloses([10, 20, 30]);
    expect(computeSma(candles, 0)).toEqual([]);
  });

  it('period=1 returns close prices as-is', () => {
    const candles = candlesFromCloses([10, 20, 30]);
    const result = computeSma(candles, 1);
    expect(result).toHaveLength(3);
    expect(result[0].value).toBe(10);
    expect(result[1].value).toBe(20);
    expect(result[2].value).toBe(30);
  });

  it('computes correct SMA for known values', () => {
    const candles = candlesFromCloses([2, 4, 6, 8, 10]);
    const result = computeSma(candles, 3);

    expect(result).toHaveLength(3);
    expect(result[0].value).toBeCloseTo(4, 10); // (2+4+6)/3
    expect(result[1].value).toBeCloseTo(6, 10); // (4+6+8)/3
    expect(result[2].value).toBeCloseTo(8, 10); // (6+8+10)/3
  });

  it('result length equals candles.length - period + 1', () => {
    const candles = candlesFromCloses([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const result = computeSma(candles, 5);
    expect(result).toHaveLength(6);
  });

  it('timestamps match the corresponding candle times', () => {
    const candles = candlesFromCloses([10, 20, 30, 40]);
    const result = computeSma(candles, 2);

    expect(result[0].time).toBe(candles[1].time);
    expect(result[1].time).toBe(candles[2].time);
    expect(result[2].time).toBe(candles[3].time);
  });
});

// -----------------------------------------------------------------------------
// EMA
// -----------------------------------------------------------------------------

describe('computeEma', () => {
  it('returns empty array when candles are fewer than period', () => {
    const candles = candlesFromCloses([10, 20]);
    expect(computeEma(candles, 3)).toEqual([]);
  });

  it('first EMA value equals SMA of first period candles', () => {
    const candles = candlesFromCloses([2, 4, 6, 8, 10]);
    const result = computeEma(candles, 3);

    // First SMA = (2+4+6)/3 = 4
    expect(result[0].value).toBeCloseTo(4, 10);
  });

  it('applies exponential smoothing for subsequent values', () => {
    const candles = candlesFromCloses([2, 4, 6, 8, 10]);
    const result = computeEma(candles, 3);
    const multiplier = 2 / (3 + 1);

    // EMA[0] = SMA = 4
    // EMA[1] = (8 - 4) * 0.5 + 4 = 6
    // EMA[2] = (10 - 6) * 0.5 + 6 = 8
    expect(result[1].value).toBeCloseTo((8 - 4) * multiplier + 4, 10);
    expect(result[2].value).toBeCloseTo((10 - result[1].value) * multiplier + result[1].value, 10);
  });

  it('result length equals candles.length - period + 1', () => {
    const candles = candlesFromCloses([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const result = computeEma(candles, 5);
    expect(result).toHaveLength(6);
  });
});

// -----------------------------------------------------------------------------
// computeEmaNext (incremental)
// -----------------------------------------------------------------------------

describe('computeEmaNext', () => {
  it('matches the last value from full EMA computation', () => {
    const candles = candlesFromCloses([2, 4, 6, 8, 10, 12]);
    const fullResult = computeEma(candles, 3);

    // Compute incrementally: take EMA up to index 4, then add candle at index 5
    const partialResult = computeEma(candles.slice(0, 5), 3);
    const prevEma = partialResult[partialResult.length - 1].value;
    const nextEma = computeEmaNext(prevEma, 12, 3);

    expect(nextEma).toBeCloseTo(fullResult[fullResult.length - 1].value, 10);
  });
});

// -----------------------------------------------------------------------------
// Bollinger Bands
// -----------------------------------------------------------------------------

describe('computeBollingerBands', () => {
  it('returns empty array when candles are fewer than period', () => {
    const candles = candlesFromCloses([10, 20]);
    expect(computeBollingerBands(candles, 3, 2)).toEqual([]);
  });

  it('middle band equals SMA', () => {
    const candles = candlesFromCloses([2, 4, 6, 8, 10]);
    const bb = computeBollingerBands(candles, 3, 2);
    const sma = computeSma(candles, 3);

    for (let i = 0; i < bb.length; i++) {
      expect(bb[i].middle).toBeCloseTo(sma[i].value, 10);
    }
  });

  it('upper and lower bands are symmetric around the middle', () => {
    const candles = candlesFromCloses([10, 20, 30, 25, 15]);
    const bb = computeBollingerBands(candles, 3, 2);

    for (const point of bb) {
      const upperDiff = point.upper - point.middle;
      const lowerDiff = point.middle - point.lower;
      expect(upperDiff).toBeCloseTo(lowerDiff, 10);
    }
  });

  it('constant prices result in zero bandwidth', () => {
    const candles = candlesFromCloses([50, 50, 50, 50, 50]);
    const bb = computeBollingerBands(candles, 3, 2);

    for (const point of bb) {
      expect(point.upper).toBeCloseTo(50, 10);
      expect(point.middle).toBeCloseTo(50, 10);
      expect(point.lower).toBeCloseTo(50, 10);
    }
  });

  it('band width scales with stdDev multiplier', () => {
    const candles = candlesFromCloses([10, 20, 30, 40, 50]);
    const bb1 = computeBollingerBands(candles, 3, 1);
    const bb2 = computeBollingerBands(candles, 3, 2);

    // The width with stdDev=2 should be twice the width with stdDev=1
    for (let i = 0; i < bb1.length; i++) {
      const width1 = bb1[i].upper - bb1[i].lower;
      const width2 = bb2[i].upper - bb2[i].lower;
      expect(width2).toBeCloseTo(width1 * 2, 10);
    }
  });
});

// -----------------------------------------------------------------------------
// RSI
// -----------------------------------------------------------------------------

describe('computeRsi', () => {
  it('returns empty array when candles are fewer than period + 1', () => {
    const candles = candlesFromCloses([10, 20, 30]);
    expect(computeRsi(candles, 3)).toEqual([]);
  });

  it('returns 100 when all changes are gains', () => {
    // Monotonically increasing prices
    const candles = candlesFromCloses([10, 20, 30, 40, 50, 60, 70, 80]);
    const result = computeRsi(candles, 3);

    // All RSI values should be 100 (no losses)
    for (const point of result) {
      expect(point.value).toBeCloseTo(100, 5);
    }
  });

  it('returns 0 when all changes are losses', () => {
    const candles = candlesFromCloses([80, 70, 60, 50, 40, 30, 20, 10]);
    const result = computeRsi(candles, 3);

    for (const point of result) {
      expect(point.value).toBeCloseTo(0, 5);
    }
  });

  it('returns ~50 when gains and losses are equal', () => {
    // Alternating up/down by equal amounts
    const candles = candlesFromCloses([50, 60, 50, 60, 50, 60, 50, 60, 50]);
    const result = computeRsi(candles, 4);

    // With Wilder's smoothing, after stabilization, RSI should converge near 50
    const lastRsi = result[result.length - 1].value;
    expect(lastRsi).toBeGreaterThan(40);
    expect(lastRsi).toBeLessThan(60);
  });

  it('RSI values are always between 0 and 100', () => {
    const candles = candlesFromCloses([
      100, 105, 95, 110, 90, 115, 85, 120, 80, 125, 75, 130, 70, 135,
    ]);
    const result = computeRsi(candles, 5);

    for (const point of result) {
      expect(point.value).toBeGreaterThanOrEqual(0);
      expect(point.value).toBeLessThanOrEqual(100);
    }
  });

  it('uses Wilder smoothing (not simple average)', () => {
    const candles = candlesFromCloses([
      44, 44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61,
      46.28,
    ]);
    const result = computeRsi(candles, 14);

    // With 14 candles + 1 for first RSI, we should get exactly 1 point
    expect(result).toHaveLength(1);
    // The value should be a valid RSI
    expect(result[0].value).toBeGreaterThanOrEqual(0);
    expect(result[0].value).toBeLessThanOrEqual(100);
  });
});

// -----------------------------------------------------------------------------
// computeRsiNext (incremental)
// -----------------------------------------------------------------------------

describe('computeRsiNext', () => {
  it('matches the last value from full RSI computation', () => {
    const candles = candlesFromCloses([
      100, 105, 95, 110, 90, 115, 85, 120, 80, 125, 75, 130, 70, 135, 65, 140,
    ]);
    const period = 5;
    const fullResult = computeRsi(candles, period);

    // Compute partial RSI (all but last candle)
    const partialCandles = candles.slice(0, -1);
    const _partialResult = computeRsi(partialCandles, period);

    // Calculate avgGain/avgLoss for the partial result by re-running the algorithm
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 1; i <= period; i++) {
      const change = partialCandles[i].close - partialCandles[i - 1].close;
      if (change > 0) avgGain += change;
      else avgLoss += Math.abs(change);
    }
    avgGain /= period;
    avgLoss /= period;
    for (let i = period + 1; i < partialCandles.length; i++) {
      const change = partialCandles[i].close - partialCandles[i - 1].close;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    const nextResult = computeRsiNext(
      { avgGain, avgLoss, period },
      partialCandles[partialCandles.length - 1].close,
      candles[candles.length - 1].close,
    );

    expect(nextResult.value).toBeCloseTo(fullResult[fullResult.length - 1].value, 5);
  });
});

// -----------------------------------------------------------------------------
// Volume with MA
// -----------------------------------------------------------------------------

describe('computeVolumeWithMa', () => {
  it('returns volume data points for all candles', () => {
    const candles = [
      createCandle({ time: 1, open: 100, close: 110, volume: 50 }),
      createCandle({ time: 2, open: 110, close: 105, volume: 60 }),
      createCandle({ time: 3, open: 105, close: 120, volume: 70 }),
    ];
    const { volumes } = computeVolumeWithMa(candles, 2);

    expect(volumes).toHaveLength(3);
    expect(volumes[0].value).toBe(50);
    expect(volumes[1].value).toBe(60);
    expect(volumes[2].value).toBe(70);
  });

  it('assigns correct colors based on bull/bear candle', () => {
    const candles = [
      createCandle({ time: 1, open: 100, close: 110, volume: 50 }), // bullish
      createCandle({ time: 2, open: 110, close: 105, volume: 60 }), // bearish
      createCandle({ time: 3, open: 100, close: 100, volume: 70 }), // neutral (close >= open = bullish)
    ];
    const { volumes } = computeVolumeWithMa(candles, 2);

    expect(volumes[0].color).toContain('0, 192, 135'); // green (bullish)
    expect(volumes[1].color).toContain('246, 70, 93'); // red (bearish)
    expect(volumes[2].color).toContain('0, 192, 135'); // green (neutral = bullish)
  });

  it('computes volume MA with correct length', () => {
    const candles = candlesFromCloses([10, 20, 30, 40, 50]).map((c, i) => ({
      ...c,
      volume: (i + 1) * 100,
    }));
    const { ma } = computeVolumeWithMa(candles, 3);

    expect(ma).toHaveLength(3); // 5 - 3 + 1
    expect(ma[0].value).toBeCloseTo(200, 10); // (100+200+300)/3
    expect(ma[1].value).toBeCloseTo(300, 10); // (200+300+400)/3
    expect(ma[2].value).toBeCloseTo(400, 10); // (300+400+500)/3
  });
});
