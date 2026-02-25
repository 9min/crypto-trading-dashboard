'use client';

// =============================================================================
// Sparkline Component
// =============================================================================
// Lightweight SVG-based mini chart for displaying 24-hour price trends.
// Uses <polyline> for efficient rendering of small datasets (~24 points).
// =============================================================================

import { memo, useMemo } from 'react';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface SparklineProps {
  /** Array of numeric data points to plot */
  data: number[];
  /** SVG width in pixels */
  width: number;
  /** SVG height in pixels */
  height: number;
  /** Stroke color (defaults to trend-based color) */
  color?: string;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Converts an array of numbers into SVG polyline points string.
 * Applies min-max normalization to fit data within the SVG viewport.
 */
function buildPolylinePoints(data: number[], width: number, height: number): string {
  if (data.length === 0) return '';

  const padding = 1;
  const drawHeight = height - padding * 2;
  const drawWidth = width - padding * 2;

  let min = data[0];
  let max = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i] < min) min = data[i];
    if (data[i] > max) max = data[i];
  }

  const range = max - min;
  // Avoid division by zero for flat lines
  const scale = range === 0 ? 0 : drawHeight / range;
  const stepX = data.length > 1 ? drawWidth / (data.length - 1) : 0;

  const points: string[] = [];
  for (let i = 0; i < data.length; i++) {
    const x = padding + i * stepX;
    // Invert Y axis: SVG y=0 is top, we want higher values at top
    const y =
      range === 0 ? padding + drawHeight / 2 : padding + drawHeight - (data[i] - min) * scale;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  return points.join(' ');
}

/**
 * Determines sparkline color based on trend direction.
 * Green (#00C087) for upward, red (#F6465D) for downward, gray for flat.
 */
function getTrendColor(data: number[]): string {
  if (data.length < 2) return '#6B7280'; // gray
  const first = data[0];
  const last = data[data.length - 1];
  if (last > first) return '#00C087'; // buy/green
  if (last < first) return '#F6465D'; // sell/red
  return '#6B7280'; // neutral gray
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const Sparkline = memo(function Sparkline({ data, width, height, color }: SparklineProps) {
  const polylinePoints = useMemo(
    () => buildPolylinePoints(data, width, height),
    [data, width, height],
  );

  const strokeColor = color ?? getTrendColor(data);

  if (data.length < 2) return null;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});

// -----------------------------------------------------------------------------
// Exports (for testing)
// -----------------------------------------------------------------------------

export { buildPolylinePoints, getTrendColor };
export type { SparklineProps };
