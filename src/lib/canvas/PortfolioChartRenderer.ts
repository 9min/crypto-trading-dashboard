// =============================================================================
// PortfolioChartRenderer — Canvas 2D Donut Chart
// =============================================================================
// Renders a donut chart showing portfolio allocation by asset. Completely
// bypasses React's render cycle — data is pushed via updateSlices().
//
// Unlike other renderers that pull data from stores, this renderer receives
// slices from the PortfolioWidget which computes them via useMemo.
//
// Layout:
//   Left side  → Donut chart (center at 35% width, 50% height)
//   Right side → Legend with labels, percentages, and values
// =============================================================================

import type { CanvasRenderer } from '@/hooks/useCanvasRenderer';
import type { AllocationSlice } from '@/types/portfolio';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PortfolioChartColors {
  background: string;
  foreground: string;
  foregroundSecondary: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const FONT_FAMILY = "'JetBrains Mono', 'Fira Code', monospace";
const FONT_SIZE_LABEL = 11;
const FONT_SIZE_VALUE = 10;
const FONT_SIZE_CENTER = 13;
const FONT_SIZE_CENTER_VALUE = 18;
const MIN_INNER_RADIUS_RATIO = 0.55;
const LEGEND_START_X_RATIO = 0.62;
const LEGEND_ITEM_HEIGHT = 22;
const LEGEND_COLOR_BOX_SIZE = 8;

const DARK_COLORS: PortfolioChartColors = {
  background: '#12161c',
  foreground: '#eaecef',
  foregroundSecondary: '#848e9c',
};

const LIGHT_COLORS: PortfolioChartColors = {
  background: '#ffffff',
  foreground: '#1e2329',
  foregroundSecondary: '#707a8a',
};

export function getPortfolioChartColors(theme: 'dark' | 'light'): PortfolioChartColors {
  return theme === 'light' ? LIGHT_COLORS : DARK_COLORS;
}

// -----------------------------------------------------------------------------
// Renderer
// -----------------------------------------------------------------------------

export class PortfolioChartRenderer implements CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private colors: PortfolioChartColors;
  private slices: AllocationSlice[] = [];
  private isDirty = false;
  private totalValue = 0;
  private currencyPrefix = '$';
  private currencyDecimals = 2;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.colors = { ...DARK_COLORS };
  }

  // -- CanvasRenderer interface -----------------------------------------------

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.isDirty = true;
  }

  onFrame(): void {
    if (!this.isDirty) return;
    this.draw();
    this.isDirty = false;
  }

  markDirty(): void {
    this.isDirty = true;
  }

  destroy(): void {
    // No event listeners to clean up
  }

  // -- Public API -------------------------------------------------------------

  /**
   * Update the allocation slices. Called by the widget when data changes.
   */
  updateSlices(slices: AllocationSlice[]): void {
    this.slices = slices;
    this.totalValue = slices.reduce((sum, s) => sum + s.value, 0);
    this.isDirty = true;
  }

  /**
   * Update theme colors.
   */
  setColors(colors: Partial<PortfolioChartColors>): void {
    this.colors = { ...this.colors, ...colors };
    this.isDirty = true;
  }

  /**
   * Set currency prefix and decimal places for value formatting.
   * KRW: setCurrencyPrefix('\u20A9', 0)
   * USDT: setCurrencyPrefix('$', 2) (default)
   */
  setCurrencyPrefix(prefix: string, decimals = 2): void {
    this.currencyPrefix = prefix;
    this.currencyDecimals = decimals;
    this.isDirty = true;
  }

  // -- Drawing ----------------------------------------------------------------

  private draw(): void {
    const { ctx, width, height } = this;
    if (width === 0 || height === 0) return;

    const startMark = 'PortfolioChartRenderer.draw:start';
    const endMark = 'PortfolioChartRenderer.draw:end';
    const measureName = 'PortfolioChartRenderer.draw';
    performance.mark(startMark);

    try {
      // Clear
      ctx.fillStyle = this.colors.background;
      ctx.fillRect(0, 0, width, height);

      if (this.slices.length === 0 || this.totalValue === 0) {
        this.drawEmptyState();
        return;
      }

      this.drawDonut();
      this.drawCenterText();
      this.drawLegend();
    } finally {
      performance.mark(endMark);
      const entry = performance.measure(measureName, startMark, endMark);
      if (entry.duration > 4) {
        console.error('[PortfolioChartRenderer] redraw exceeded 4ms budget', {
          action: 'draw',
          timestamp: Date.now(),
          durationMs: entry.duration,
          width,
          height,
          sliceCount: this.slices.length,
        });
      }
      performance.clearMarks(startMark);
      performance.clearMarks(endMark);
      performance.clearMeasures(measureName);
    }
  }

  private drawEmptyState(): void {
    const { ctx, width, height, colors } = this;
    ctx.font = `${FONT_SIZE_LABEL + 1}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colors.foregroundSecondary;
    ctx.fillText('No portfolio data', width / 2, height / 2);
  }

  private drawDonut(): void {
    const { ctx, slices, totalValue } = this;

    const centerX = this.width * 0.35;
    const centerY = this.height / 2;
    const outerRadius = Math.min(centerX - 8, centerY - 8, 80);
    const innerRadius = outerRadius * MIN_INNER_RADIUS_RATIO;

    if (outerRadius <= 0) return;

    let startAngle = -Math.PI / 2; // Start from top

    for (const slice of slices) {
      if (slice.value <= 0) continue;

      const sweepAngle = (slice.value / totalValue) * Math.PI * 2;
      const endAngle = startAngle + sweepAngle;

      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
      ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = slice.color;
      ctx.fill();

      startAngle = endAngle;
    }
  }

  private drawCenterText(): void {
    const { ctx, colors } = this;

    const centerX = this.width * 0.35;
    const centerY = this.height / 2;

    // "Total" label
    ctx.font = `${FONT_SIZE_CENTER}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = colors.foregroundSecondary;
    ctx.fillText('Equity', centerX, centerY - 2);

    // Total value
    ctx.font = `bold ${FONT_SIZE_CENTER_VALUE}px ${FONT_FAMILY}`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = colors.foreground;
    ctx.fillText(this.formatValue(this.totalValue), centerX, centerY + 2);
  }

  private drawLegend(): void {
    const { ctx, slices, colors, height } = this;

    const legendX = this.width * LEGEND_START_X_RATIO;
    const maxItems = Math.min(slices.length, Math.floor(height / LEGEND_ITEM_HEIGHT));
    const totalLegendHeight = maxItems * LEGEND_ITEM_HEIGHT;
    let y = (height - totalLegendHeight) / 2 + LEGEND_ITEM_HEIGHT / 2;

    for (let i = 0; i < maxItems; i++) {
      const slice = slices[i];

      // Color box
      ctx.fillStyle = slice.color;
      ctx.fillRect(
        legendX,
        y - LEGEND_COLOR_BOX_SIZE / 2,
        LEGEND_COLOR_BOX_SIZE,
        LEGEND_COLOR_BOX_SIZE,
      );

      // Label
      ctx.font = `${FONT_SIZE_LABEL}px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = colors.foreground;
      ctx.fillText(slice.label, legendX + LEGEND_COLOR_BOX_SIZE + 6, y);

      // Percentage
      ctx.font = `${FONT_SIZE_VALUE}px ${FONT_FAMILY}`;
      ctx.fillStyle = colors.foregroundSecondary;
      const percentText = `${slice.percent.toFixed(1)}%`;
      const labelWidth = ctx.measureText(slice.label).width;
      ctx.fillText(percentText, legendX + LEGEND_COLOR_BOX_SIZE + 6 + labelWidth + 8, y);

      y += LEGEND_ITEM_HEIGHT;
    }
  }

  // -- Helpers ----------------------------------------------------------------

  private formatValue(value: number): string {
    const p = this.currencyPrefix;
    const d = this.currencyDecimals;
    if (value >= 1_000_000_000) return `${p}${(value / 1_000_000_000).toFixed(d > 0 ? 1 : 0)}B`;
    if (value >= 1_000_000) return `${p}${(value / 1_000_000).toFixed(d > 0 ? 2 : 0)}M`;
    if (value >= 1_000) return `${p}${(value / 1_000).toFixed(d > 0 ? 1 : 0)}K`;
    return `${p}${value.toFixed(d)}`;
  }
}
