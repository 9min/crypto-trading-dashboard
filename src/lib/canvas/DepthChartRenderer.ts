// =============================================================================
// DepthChartRenderer — Canvas 2D
// =============================================================================
// Renders a staircase area chart (depth chart) of the order book, showing
// cumulative bid/ask volumes by price level. Uses Canvas 2D API, completely
// bypassing React's render cycle.
//
// Dirty detection: tracks depthStore.lastUpdateId independently (not isDirty)
// to avoid flag conflicts with OrderBookRenderer.
//
// Layout:
//   Left half  → Bids (cumulative volume area, green gradient)
//   Right half → Asks (cumulative volume area, red gradient)
//   X-axis     → Price labels
//   Y-axis     → Cumulative quantity labels
//   Crosshair  → Mouse hover shows price/quantity at cursor position
//
// Performance: uses pre-allocated Float64Array buffers for cumulative quantities
// and caches CanvasGradient objects to avoid per-frame recreation.
// =============================================================================

import { useDepthStore } from '@/stores/depthStore';
import type { PriceLevel } from '@/types/chart';
import type { CanvasRenderer } from '@/hooks/useCanvasRenderer';
import { formatPrice } from '@/utils/formatPrice';
import { MAX_DEPTH_LEVELS } from '@/utils/constants';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface DepthChartColors {
  background: string;
  foreground: string;
  foregroundSecondary: string;
  bidLine: string;
  bidFill: string;
  askLine: string;
  askFill: string;
  crosshair: string;
  labelBg: string;
  gridLine: string;
}

interface MousePosition {
  x: number;
  y: number;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const PADDING_TOP = 16;
const PADDING_BOTTOM = 28;
const PADDING_LEFT = 60;
const PADDING_RIGHT = 60;
const FONT_SIZE = 10;
const FONT_FAMILY = "'JetBrains Mono', 'Fira Code', monospace";
const LABEL_PADDING_X = 4;
const LABEL_HEIGHT = 16;
const LINE_WIDTH = 1.5;
const CROSSHAIR_DASH = [4, 3];
const Y_TICK_COUNT = 5;

const DEFAULT_COLORS: DepthChartColors = {
  background: '#12161c',
  foreground: '#eaecef',
  foregroundSecondary: '#848e9c',
  bidLine: '#00c087',
  bidFill: 'rgba(0, 192, 135, 0.15)',
  askLine: '#f6465d',
  askFill: 'rgba(246, 70, 93, 0.15)',
  crosshair: 'rgba(234, 236, 239, 0.3)',
  labelBg: '#1a1f27',
  gridLine: 'rgba(37, 41, 48, 0.5)',
};

// -----------------------------------------------------------------------------
// Renderer
// -----------------------------------------------------------------------------

export class DepthChartRenderer implements CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private width = 0;
  private height = 0;
  private colors: DepthChartColors;
  private lastRenderedUpdateId = -1;

  // Pre-allocated Float64Array buffers — reused every frame to avoid GC pressure
  private bidPriceBuf = new Float64Array(MAX_DEPTH_LEVELS);
  private askPriceBuf = new Float64Array(MAX_DEPTH_LEVELS);
  private bidCumulativeBuf = new Float64Array(MAX_DEPTH_LEVELS);
  private askCumulativeBuf = new Float64Array(MAX_DEPTH_LEVELS);

  // Cached gradients — rebuilt on setSize() only
  private bidGradient: CanvasGradient | null = null;
  private askGradient: CanvasGradient | null = null;

  // Mouse state
  private mousePos: MousePosition | null = null;
  private needsCrosshairRedraw = false;

  // Bound event handlers (for removeEventListener)
  private readonly handleMouseMove: (e: MouseEvent) => void;
  private readonly handleMouseLeave: () => void;

  constructor(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    this.ctx = ctx;
    this.canvas = canvas;
    this.colors = { ...DEFAULT_COLORS };

    this.handleMouseMove = (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      this.needsCrosshairRedraw = true;
    };

    this.handleMouseLeave = () => {
      this.mousePos = null;
      this.needsCrosshairRedraw = true;
    };

    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
  }

  // -- CanvasRenderer interface -----------------------------------------------

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.rebuildGradients();
    this.draw();
    // Sync lastRenderedUpdateId so onFrame() doesn't redundantly redraw
    this.lastRenderedUpdateId = useDepthStore.getState().lastUpdateId;
  }

  onFrame(): void {
    const { lastUpdateId } = useDepthStore.getState();

    if (lastUpdateId === this.lastRenderedUpdateId && !this.needsCrosshairRedraw) {
      return;
    }

    this.draw();
    this.lastRenderedUpdateId = lastUpdateId;
    this.needsCrosshairRedraw = false;
  }

  markDirty(): void {
    this.lastRenderedUpdateId = -1;
  }

  destroy(): void {
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
  }

  // -- Public -----------------------------------------------------------------

  setColors(colors: Partial<DepthChartColors>): void {
    this.colors = { ...this.colors, ...colors };
    this.rebuildGradients();
    this.lastRenderedUpdateId = -1; // Force redraw
  }

  // -- Chart area helpers -----------------------------------------------------

  private get chartLeft(): number {
    return PADDING_LEFT;
  }

  private get chartRight(): number {
    return this.width - PADDING_RIGHT;
  }

  private get chartTop(): number {
    return PADDING_TOP;
  }

  private get chartBottom(): number {
    return this.height - PADDING_BOTTOM;
  }

  private get chartWidth(): number {
    return this.chartRight - this.chartLeft;
  }

  private get chartHeight(): number {
    return this.chartBottom - this.chartTop;
  }

  // -- Gradient cache ---------------------------------------------------------

  private rebuildGradients(): void {
    const { ctx } = this;
    if (this.chartHeight <= 0 || this.chartWidth <= 0) {
      this.bidGradient = null;
      this.askGradient = null;
      return;
    }

    const bidGrad = ctx.createLinearGradient(0, this.chartTop, 0, this.chartBottom);
    bidGrad.addColorStop(0, this.colors.bidFill);
    bidGrad.addColorStop(1, 'rgba(0, 192, 135, 0.02)');
    this.bidGradient = bidGrad;

    const askGrad = ctx.createLinearGradient(0, this.chartTop, 0, this.chartBottom);
    askGrad.addColorStop(0, this.colors.askFill);
    askGrad.addColorStop(1, 'rgba(246, 70, 93, 0.02)');
    this.askGradient = askGrad;
  }

  // -- Drawing ----------------------------------------------------------------

  private draw(): void {
    if (process.env.NODE_ENV === 'development') {
      performance.mark('depth-chart-draw-start');
    }

    const { bids, asks } = useDepthStore.getState();
    const { ctx, width, height } = this;

    if (width === 0 || height === 0) return;
    if (this.chartWidth <= 0 || this.chartHeight <= 0) return;

    // Clear
    ctx.fillStyle = this.colors.background;
    ctx.fillRect(0, 0, width, height);

    const bidCount = Math.min(bids.length, MAX_DEPTH_LEVELS);
    const askCount = Math.min(asks.length, MAX_DEPTH_LEVELS);

    if (bidCount === 0 && askCount === 0) {
      this.drawEmptyState();
      if (process.env.NODE_ENV === 'development') {
        performance.mark('depth-chart-draw-end');
        performance.measure('depth-chart-draw', 'depth-chart-draw-start', 'depth-chart-draw-end');
      }
      return;
    }

    // Fill price and cumulative buffers
    this.fillBuffers(bids, bidCount, this.bidPriceBuf, this.bidCumulativeBuf);
    this.fillBuffers(asks, askCount, this.askPriceBuf, this.askCumulativeBuf);

    // Compute scales
    const maxCumQty = Math.max(
      bidCount > 0 ? this.bidCumulativeBuf[bidCount - 1] : 0,
      askCount > 0 ? this.askCumulativeBuf[askCount - 1] : 0,
      1,
    );

    // Price range: bids go from highest (index 0) to lowest (index N-1)
    //              asks go from lowest (index 0) to highest (index N-1)
    const minPrice = bidCount > 0 ? this.bidPriceBuf[bidCount - 1] : this.askPriceBuf[0];
    const maxPrice = askCount > 0 ? this.askPriceBuf[askCount - 1] : this.bidPriceBuf[0];

    if (minPrice >= maxPrice) {
      this.drawEmptyState();
      if (process.env.NODE_ENV === 'development') {
        performance.mark('depth-chart-draw-end');
        performance.measure('depth-chart-draw', 'depth-chart-draw-start', 'depth-chart-draw-end');
      }
      return;
    }

    const priceRange = maxPrice - minPrice;

    // Coordinate transform helpers (closures over scale parameters)
    const priceToX = (price: number): number => {
      return this.chartLeft + ((price - minPrice) / priceRange) * this.chartWidth;
    };

    const qtyToY = (qty: number): number => {
      return this.chartBottom - (qty / maxCumQty) * this.chartHeight;
    };

    // Draw grid lines
    this.drawGrid(minPrice, maxPrice, maxCumQty, priceToX, qtyToY);

    // Draw bid area (staircase, right-to-left: highest price first)
    if (bidCount > 0) {
      this.drawStaircase(
        this.bidPriceBuf,
        this.bidCumulativeBuf,
        bidCount,
        priceToX,
        qtyToY,
        this.colors.bidLine,
        this.bidGradient,
      );
    }

    // Draw ask area (staircase, left-to-right: lowest price first)
    if (askCount > 0) {
      this.drawStaircase(
        this.askPriceBuf,
        this.askCumulativeBuf,
        askCount,
        priceToX,
        qtyToY,
        this.colors.askLine,
        this.askGradient,
      );
    }

    // Draw crosshair
    if (this.mousePos) {
      this.drawCrosshair(
        this.mousePos,
        bids,
        asks,
        bidCount,
        askCount,
        minPrice,
        priceRange,
        maxCumQty,
        priceToX,
        qtyToY,
      );
    }

    if (process.env.NODE_ENV === 'development') {
      performance.mark('depth-chart-draw-end');
      performance.measure('depth-chart-draw', 'depth-chart-draw-start', 'depth-chart-draw-end');
    }
  }

  private drawEmptyState(): void {
    const { ctx, width, height, colors } = this;
    ctx.font = `${FONT_SIZE + 2}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colors.foregroundSecondary;
    ctx.fillText('Waiting for depth data...', width / 2, height / 2);
  }

  private drawGrid(
    minPrice: number,
    maxPrice: number,
    maxCumQty: number,
    priceToX: (price: number) => number,
    qtyToY: (qty: number) => number,
  ): void {
    const { ctx, colors } = this;

    ctx.strokeStyle = colors.gridLine;
    ctx.lineWidth = 0.5;
    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.fillStyle = colors.foregroundSecondary;

    // Horizontal grid lines (quantity axis)
    for (let i = 1; i < Y_TICK_COUNT; i++) {
      const qty = (maxCumQty / Y_TICK_COUNT) * i;
      const y = qtyToY(qty);

      ctx.beginPath();
      ctx.moveTo(this.chartLeft, y);
      ctx.lineTo(this.chartRight, y);
      ctx.stroke();

      // Quantity label on left
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.formatQuantity(qty), this.chartLeft - 4, y);
    }

    // Price labels along bottom
    const priceRange = maxPrice - minPrice;
    const priceTicks = 5;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= priceTicks; i++) {
      const price = minPrice + (priceRange / priceTicks) * i;
      const x = priceToX(price);

      ctx.fillText(formatPrice(price), x, this.chartBottom + 4);
    }
  }

  private drawStaircase(
    priceBuf: Float64Array,
    cumulativeBuf: Float64Array,
    count: number,
    priceToX: (price: number) => number,
    qtyToY: (qty: number) => number,
    lineColor: string,
    gradient: CanvasGradient | null,
  ): void {
    const { ctx } = this;

    // Build the staircase path
    ctx.beginPath();
    ctx.moveTo(priceToX(priceBuf[0]), this.chartBottom);
    ctx.lineTo(priceToX(priceBuf[0]), qtyToY(cumulativeBuf[0]));

    for (let i = 1; i < count; i++) {
      // Horizontal step to next price at previous cumulative level
      ctx.lineTo(priceToX(priceBuf[i]), qtyToY(cumulativeBuf[i - 1]));
      // Vertical step up/down to new cumulative level
      ctx.lineTo(priceToX(priceBuf[i]), qtyToY(cumulativeBuf[i]));
    }

    // Close path back to baseline
    ctx.lineTo(priceToX(priceBuf[count - 1]), this.chartBottom);
    ctx.closePath();

    // Fill with gradient
    if (gradient) {
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Stroke the line (re-trace without the baseline)
    ctx.beginPath();
    ctx.moveTo(priceToX(priceBuf[0]), qtyToY(cumulativeBuf[0]));

    for (let i = 1; i < count; i++) {
      ctx.lineTo(priceToX(priceBuf[i]), qtyToY(cumulativeBuf[i - 1]));
      ctx.lineTo(priceToX(priceBuf[i]), qtyToY(cumulativeBuf[i]));
    }

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = LINE_WIDTH;
    ctx.stroke();
  }

  private drawCrosshair(
    pos: MousePosition,
    bids: PriceLevel[],
    asks: PriceLevel[],
    bidCount: number,
    askCount: number,
    minPrice: number,
    priceRange: number,
    maxCumQty: number,
    priceToX: (price: number) => number,
    qtyToY: (qty: number) => number,
  ): void {
    const { ctx, colors } = this;

    // Only draw crosshair within chart area
    if (
      pos.x < this.chartLeft ||
      pos.x > this.chartRight ||
      pos.y < this.chartTop ||
      pos.y > this.chartBottom
    ) {
      return;
    }

    // Reverse-map X position to price
    const price = minPrice + ((pos.x - this.chartLeft) / this.chartWidth) * priceRange;

    // Find cumulative quantity at this price via binary search
    const cumQty = this.findCumulativeAtPrice(price, bids, asks, bidCount, askCount);

    // Vertical crosshair line
    ctx.setLineDash(CROSSHAIR_DASH);
    ctx.strokeStyle = colors.crosshair;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pos.x, this.chartTop);
    ctx.lineTo(pos.x, this.chartBottom);
    ctx.stroke();

    // Horizontal crosshair line (at cumulative qty level)
    if (cumQty > 0) {
      const y = qtyToY(cumQty);
      ctx.beginPath();
      ctx.moveTo(this.chartLeft, y);
      ctx.lineTo(this.chartRight, y);
      ctx.stroke();

      // Quantity label on left axis
      this.drawLabel(this.formatQuantity(cumQty), this.chartLeft - 4, y, 'right');
    }

    ctx.setLineDash([]);

    // Price label on bottom axis
    this.drawLabel(formatPrice(price), priceToX(price), this.chartBottom + 4, 'center');
  }

  private drawLabel(text: string, x: number, y: number, align: CanvasTextAlign): void {
    const { ctx, colors } = this;

    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
    const metrics = ctx.measureText(text);
    const labelWidth = metrics.width + LABEL_PADDING_X * 2;

    let labelX: number;
    if (align === 'center') {
      labelX = x - labelWidth / 2;
    } else if (align === 'right') {
      labelX = x - labelWidth;
    } else {
      labelX = x;
    }

    const labelY = y - LABEL_HEIGHT / 2;

    // Rounded rectangle background
    const radius = 3;
    ctx.fillStyle = colors.labelBg;
    ctx.beginPath();
    ctx.moveTo(labelX + radius, labelY);
    ctx.lineTo(labelX + labelWidth - radius, labelY);
    ctx.arcTo(labelX + labelWidth, labelY, labelX + labelWidth, labelY + radius, radius);
    ctx.lineTo(labelX + labelWidth, labelY + LABEL_HEIGHT - radius);
    ctx.arcTo(
      labelX + labelWidth,
      labelY + LABEL_HEIGHT,
      labelX + labelWidth - radius,
      labelY + LABEL_HEIGHT,
      radius,
    );
    ctx.lineTo(labelX + radius, labelY + LABEL_HEIGHT);
    ctx.arcTo(labelX, labelY + LABEL_HEIGHT, labelX, labelY + LABEL_HEIGHT - radius, radius);
    ctx.lineTo(labelX, labelY + radius);
    ctx.arcTo(labelX, labelY, labelX + radius, labelY, radius);
    ctx.closePath();
    ctx.fill();

    // Text
    ctx.fillStyle = colors.foreground;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, labelX + labelWidth / 2, labelY + LABEL_HEIGHT / 2);
  }

  // -- Helpers ----------------------------------------------------------------

  /**
   * Fills price and cumulative quantity buffers from sorted PriceLevel arrays.
   */
  private fillBuffers(
    levels: PriceLevel[],
    count: number,
    priceBuf: Float64Array,
    cumulativeBuf: Float64Array,
  ): void {
    let sum = 0;
    for (let i = 0; i < count; i++) {
      priceBuf[i] = levels[i].price;
      sum += levels[i].quantity;
      cumulativeBuf[i] = sum;
    }
  }

  /**
   * Binary search to find cumulative quantity at a given price.
   * For bids (descending prices): finds the highest bid <= price.
   * For asks (ascending prices): finds the lowest ask >= price.
   */
  private findCumulativeAtPrice(
    price: number,
    bids: PriceLevel[],
    asks: PriceLevel[],
    bidCount: number,
    askCount: number,
  ): number {
    // Check if price is in the bid range (bids sorted descending)
    if (bidCount > 0 && price <= bids[0].price) {
      // Binary search in bids (descending order)
      let lo = 0;
      let hi = bidCount - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (bids[mid].price > price) {
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      // lo is the index of first bid with price <= our target
      if (lo < bidCount) {
        return this.bidCumulativeBuf[lo];
      }
      return this.bidCumulativeBuf[bidCount - 1];
    }

    // Check if price is in the ask range (asks sorted ascending)
    if (askCount > 0 && price >= asks[0].price) {
      // Binary search in asks (ascending order)
      let lo = 0;
      let hi = askCount - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (asks[mid].price < price) {
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      // hi is the last ask with price < our target
      if (hi >= 0) {
        return this.askCumulativeBuf[hi];
      }
      return 0;
    }

    return 0;
  }

  private formatQuantity(qty: number): string {
    if (qty >= 1_000_000) return `${(qty / 1_000_000).toFixed(1)}M`;
    if (qty >= 1_000) return `${(qty / 1_000).toFixed(1)}K`;
    if (qty >= 1) return qty.toFixed(2);
    return qty.toFixed(4);
  }
}
