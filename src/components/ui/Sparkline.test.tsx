import { describe, it, expect } from 'vitest';
import { buildPolylinePoints, getTrendColor } from './Sparkline';

// -----------------------------------------------------------------------------
// buildPolylinePoints
// -----------------------------------------------------------------------------

describe('buildPolylinePoints', () => {
  it('returns empty string for empty data', () => {
    expect(buildPolylinePoints([], 60, 20)).toBe('');
  });

  it('returns a single point for single data element', () => {
    const result = buildPolylinePoints([100], 60, 20);
    // Single point should be centered vertically
    expect(result).toContain(',');
    const parts = result.split(',');
    expect(parts).toHaveLength(2);
  });

  it('generates correct number of points', () => {
    const data = [10, 20, 30, 40, 50];
    const result = buildPolylinePoints(data, 60, 20);
    const points = result.split(' ');
    expect(points).toHaveLength(5);
  });

  it('normalizes data to fit within height', () => {
    const data = [0, 100];
    const result = buildPolylinePoints(data, 60, 20);
    const points = result.split(' ');

    // First point (min=0) should be near bottom (high y), second (max=100) near top (low y)
    const [, y1] = points[0].split(',').map(Number);
    const [, y2] = points[1].split(',').map(Number);

    expect(y1).toBeGreaterThan(y2);
  });

  it('handles flat data (all same values)', () => {
    const data = [50, 50, 50];
    const result = buildPolylinePoints(data, 60, 20);
    const points = result.split(' ');
    expect(points).toHaveLength(3);

    // All Y values should be the same (centered)
    const yValues = points.map((p) => parseFloat(p.split(',')[1]));
    expect(yValues[0]).toBe(yValues[1]);
    expect(yValues[1]).toBe(yValues[2]);
  });

  it('spreads points evenly across width', () => {
    const data = [10, 20, 30];
    const result = buildPolylinePoints(data, 60, 20);
    const points = result.split(' ');

    const xValues = points.map((p) => parseFloat(p.split(',')[0]));

    // First point at padding (1), last point at width - padding (59)
    expect(xValues[0]).toBeCloseTo(1, 0);
    expect(xValues[2]).toBeCloseTo(59, 0);

    // Middle point should be centered
    const midX = (xValues[0] + xValues[2]) / 2;
    expect(xValues[1]).toBeCloseTo(midX, 0);
  });
});

// -----------------------------------------------------------------------------
// getTrendColor
// -----------------------------------------------------------------------------

describe('getTrendColor', () => {
  it('returns green for upward trend', () => {
    expect(getTrendColor([10, 20, 30])).toBe('#00C087');
  });

  it('returns red for downward trend', () => {
    expect(getTrendColor([30, 20, 10])).toBe('#F6465D');
  });

  it('returns gray for flat trend', () => {
    expect(getTrendColor([50, 50])).toBe('#6B7280');
  });

  it('returns gray for single data point', () => {
    expect(getTrendColor([100])).toBe('#6B7280');
  });

  it('returns gray for empty data', () => {
    expect(getTrendColor([])).toBe('#6B7280');
  });

  it('determines trend from first and last values only', () => {
    // Dips in between, but last > first = green
    expect(getTrendColor([10, 5, 3, 20])).toBe('#00C087');
  });
});
