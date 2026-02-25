// =============================================================================
// OrderBookRenderer — Canvas 2D
// =============================================================================
// Renders the order book (bids/asks) using Canvas 2D API, completely bypassing
// React's render cycle. Reads data directly from depthStore via getState()
// and uses the dirty flag pattern for efficient rAF-based rendering.
//
// Layout:
//   Left half  → Bids (buy orders) with green bars, highest price at top center
//   Right half → Asks (sell orders) with red bars, lowest price at top center
//   Center     → Spread display
//
// Each level shows: cumulative quantity bar + price + quantity text overlay.
//
// Performance: uses pre-allocated Float64Array buffers for cumulative quantities
// to eliminate per-frame heap allocations and GC pressure.
// =============================================================================

import { useDepthStore } from '@/stores/depthStore';
import type { PriceLevel } from '@/types/chart';
import type { CanvasRenderer } from '@/hooks/useCanvasRenderer';
import { formatPrice } from '@/utils/formatPrice';
import { MAX_DEPTH_LEVELS } from '@/utils/constants';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface OrderBookColors {
  background: string;
  foreground: string;
  foregroundSecondary: string;
  buyBar: string;
  sellBar: string;
  buyText: string;
  sellText: string;
  border: string;
  spreadBg: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const ROW_HEIGHT = 20;
const FONT_SIZE = 11;
const FONT_FAMILY = "'JetBrains Mono', 'Fira Code', monospace";
const PADDING_X = 8;
const SPREAD_HEIGHT = 24;
const BAR_OPACITY = 0.25;

const DEFAULT_COLORS: OrderBookColors = {
  background: '#12161c',
  foreground: '#eaecef',
  foregroundSecondary: '#848e9c',
  buyBar: '#00c087',
  sellBar: '#f6465d',
  buyText: '#00c087',
  sellText: '#f6465d',
  border: '#252930',
  spreadBg: '#1a1f27',
};

// -----------------------------------------------------------------------------
// Renderer
// -----------------------------------------------------------------------------

export class OrderBookRenderer implements CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private colors: OrderBookColors;

  // Pre-allocated Float64Array buffers — reused every frame to avoid GC pressure
  private bidCumulativeBuf = new Float64Array(MAX_DEPTH_LEVELS);
  private askCumulativeBuf = new Float64Array(MAX_DEPTH_LEVELS);

  constructor(ctx: CanvasRenderingContext2D, colors?: Partial<OrderBookColors>) {
    this.ctx = ctx;
    this.colors = { ...DEFAULT_COLORS, ...colors };
  }

  // -- CanvasRenderer interface -----------------------------------------------

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    // Force a redraw on resize
    this.draw();
  }

  onFrame(): void {
    const state = useDepthStore.getState();
    if (!state.isDirty) return;

    this.draw();
    state.markClean();
  }

  destroy(): void {
    // No internal resources to release — rAF is managed by the hook
  }

  // -- Public -----------------------------------------------------------------

  setColors(colors: Partial<OrderBookColors>): void {
    this.colors = { ...this.colors, ...colors };
  }

  // -- Drawing ----------------------------------------------------------------

  private draw(): void {
    const { bids, asks } = useDepthStore.getState();
    const { ctx, width, height, colors } = this;

    if (width === 0 || height === 0) return;

    // Clear
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    const halfWidth = width / 2;
    const visibleRows = Math.floor((height - SPREAD_HEIGHT) / ROW_HEIGHT);

    const bidCount = Math.min(bids.length, visibleRows);
    const askCount = Math.min(asks.length, visibleRows);

    // Compute cumulative quantities into pre-allocated buffers
    this.computeCumulative(bids, bidCount, this.bidCumulativeBuf);
    this.computeCumulative(asks, askCount, this.askCumulativeBuf);

    const maxCumQty = Math.max(
      bidCount > 0 ? this.bidCumulativeBuf[bidCount - 1] : 0,
      askCount > 0 ? this.askCumulativeBuf[askCount - 1] : 0,
      1, // Prevent division by zero
    );

    // Draw spread bar
    this.drawSpread(bids, asks);

    // Draw bids (left side, top-to-bottom, best bid at top)
    this.drawLevels(
      bids,
      bidCount,
      this.bidCumulativeBuf,
      maxCumQty,
      0,
      halfWidth,
      SPREAD_HEIGHT,
      'bid',
    );

    // Draw asks (right side, top-to-bottom, best ask at top)
    this.drawLevels(
      asks,
      askCount,
      this.askCumulativeBuf,
      maxCumQty,
      halfWidth,
      halfWidth,
      SPREAD_HEIGHT,
      'ask',
    );

    // Draw center divider
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(halfWidth, SPREAD_HEIGHT);
    ctx.lineTo(halfWidth, height);
    ctx.stroke();
  }

  private drawSpread(bids: PriceLevel[], asks: PriceLevel[]): void {
    const { ctx, width, colors } = this;

    ctx.fillStyle = colors.spreadBg;
    ctx.fillRect(0, 0, width, SPREAD_HEIGHT);

    if (bids.length === 0 || asks.length === 0) return;

    const bestBid = bids[0].price;
    const bestAsk = asks[0].price;
    const spread = bestAsk - bestBid;
    const spreadPercent = bestBid > 0 ? (spread / bestBid) * 100 : 0;

    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colors.foregroundSecondary;
    ctx.fillText(
      `Spread: ${formatPrice(spread)} (${spreadPercent.toFixed(3)}%)`,
      width / 2,
      SPREAD_HEIGHT / 2,
    );
  }

  private drawLevels(
    levels: PriceLevel[],
    count: number,
    cumulative: Float64Array,
    maxCumQty: number,
    startX: number,
    sectionWidth: number,
    startY: number,
    side: 'bid' | 'ask',
  ): void {
    const { ctx, colors } = this;
    const isBid = side === 'bid';
    const barColor = isBid ? colors.buyBar : colors.sellBar;
    const textColor = isBid ? colors.buyText : colors.sellText;

    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;

    for (let i = 0; i < count; i++) {
      const level = levels[i];
      const y = startY + i * ROW_HEIGHT;

      // Cumulative quantity bar
      const barWidth = (cumulative[i] / maxCumQty) * (sectionWidth - PADDING_X * 2);
      ctx.globalAlpha = BAR_OPACITY;
      ctx.fillStyle = barColor;

      if (isBid) {
        // Bids: bars grow from right to left
        ctx.fillRect(startX + sectionWidth - PADDING_X - barWidth, y, barWidth, ROW_HEIGHT);
      } else {
        // Asks: bars grow from left to right
        ctx.fillRect(startX + PADDING_X, y, barWidth, ROW_HEIGHT);
      }
      ctx.globalAlpha = 1;

      // Price text
      const priceStr = formatPrice(level.price);
      ctx.textBaseline = 'middle';
      const textY = y + ROW_HEIGHT / 2;

      if (isBid) {
        // Bids: price on right (near center), quantity on left
        ctx.textAlign = 'right';
        ctx.fillStyle = textColor;
        ctx.fillText(priceStr, startX + sectionWidth - PADDING_X, textY);

        ctx.textAlign = 'left';
        ctx.fillStyle = colors.foreground;
        ctx.fillText(this.formatQuantity(level.quantity), startX + PADDING_X, textY);
      } else {
        // Asks: price on left (near center), quantity on right
        ctx.textAlign = 'left';
        ctx.fillStyle = textColor;
        ctx.fillText(priceStr, startX + PADDING_X, textY);

        ctx.textAlign = 'right';
        ctx.fillStyle = colors.foreground;
        ctx.fillText(this.formatQuantity(level.quantity), startX + sectionWidth - PADDING_X, textY);
      }
    }
  }

  // -- Helpers ----------------------------------------------------------------

  /**
   * Computes cumulative quantities into a pre-allocated Float64Array buffer.
   * Returns the count of levels written (same as input count).
   */
  private computeCumulative(levels: PriceLevel[], count: number, buf: Float64Array): void {
    let sum = 0;
    for (let i = 0; i < count; i++) {
      sum += levels[i].quantity;
      buf[i] = sum;
    }
  }

  private formatQuantity(qty: number): string {
    if (qty >= 1000) return qty.toFixed(0);
    if (qty >= 1) return qty.toFixed(3);
    return qty.toFixed(5);
  }
}
