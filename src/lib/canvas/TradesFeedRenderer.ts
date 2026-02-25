// =============================================================================
// TradesFeedRenderer — Canvas 2D
// =============================================================================
// Renders the recent trades feed using Canvas 2D API, bypassing React's
// render cycle entirely. Reads data directly from tradeStore via getState().
//
// Layout (3 columns):
//   Time (HH:MM:SS) | Price | Quantity
//   Newest trade at top, scrolls down.
//   Buy aggressor (isBuyerMaker=false) → green, Sell aggressor → red.
//
// Dirty detection: tracks the last rendered trade ID and re-draws only
// when new trades arrive.
// =============================================================================

import { useTradeStore } from '@/stores/tradeStore';
import type { TradeEntry } from '@/types/chart';
import type { CanvasRenderer } from '@/hooks/useCanvasRenderer';
import { formatPrice } from '@/utils/formatPrice';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface TradesFeedColors {
  background: string;
  foreground: string;
  foregroundSecondary: string;
  headerBg: string;
  buyText: string;
  sellText: string;
  rowHover: string;
  border: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const ROW_HEIGHT = 20;
const HEADER_HEIGHT = 24;
const FONT_SIZE = 11;
const FONT_FAMILY = "'JetBrains Mono', 'Fira Code', monospace";
const PADDING_X = 8;
const COLUMN_RATIOS = [0.3, 0.38, 0.32]; // time, price, quantity

const DEFAULT_COLORS: TradesFeedColors = {
  background: '#12161c',
  foreground: '#eaecef',
  foregroundSecondary: '#848e9c',
  headerBg: '#1a1f27',
  buyText: '#00c087',
  sellText: '#f6465d',
  rowHover: 'rgba(255, 255, 255, 0.02)',
  border: '#252930',
};

// -----------------------------------------------------------------------------
// Renderer
// -----------------------------------------------------------------------------

export class TradesFeedRenderer implements CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private colors: TradesFeedColors;
  private lastRenderedTradeId = -1;

  constructor(ctx: CanvasRenderingContext2D, colors?: Partial<TradesFeedColors>) {
    this.ctx = ctx;
    this.colors = { ...DEFAULT_COLORS, ...colors };
  }

  // -- CanvasRenderer interface -----------------------------------------------

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    // Force redraw on resize
    this.lastRenderedTradeId = -1;
    this.draw();
  }

  onFrame(): void {
    const { trades } = useTradeStore.getState();
    if (trades.length === 0) return;

    const latestId = trades[0].id;
    if (latestId === this.lastRenderedTradeId) return;

    this.draw();
    this.lastRenderedTradeId = latestId;
  }

  destroy(): void {
    // No internal resources to release
  }

  // -- Public -----------------------------------------------------------------

  setColors(colors: Partial<TradesFeedColors>): void {
    this.colors = { ...this.colors, ...colors };
    this.lastRenderedTradeId = -1; // Force redraw
  }

  // -- Drawing ----------------------------------------------------------------

  private draw(): void {
    const { trades } = useTradeStore.getState();
    const { ctx, width, height, colors } = this;

    if (width === 0 || height === 0) return;

    // Clear
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    // Column positions
    const col1X = PADDING_X;
    const col2X = width * COLUMN_RATIOS[0];

    // Draw header
    this.drawHeader(col1X, col2X);

    // Draw trade rows
    const visibleRows = Math.floor((height - HEADER_HEIGHT) / ROW_HEIGHT);
    const displayTrades = trades.slice(0, visibleRows);

    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;

    for (let i = 0; i < displayTrades.length; i++) {
      const trade = displayTrades[i];
      const y = HEADER_HEIGHT + i * ROW_HEIGHT;

      // Alternating row background for readability
      if (i % 2 === 1) {
        ctx.fillStyle = colors.rowHover;
        ctx.fillRect(0, y, width, ROW_HEIGHT);
      }

      this.drawTradeRow(trade, y, col1X, col2X);
    }
  }

  private drawHeader(col1X: number, col2X: number): void {
    const { ctx, width, colors } = this;

    // Header background
    ctx.fillStyle = colors.headerBg;
    ctx.fillRect(0, 0, width, HEADER_HEIGHT);

    // Header text
    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.fillStyle = colors.foregroundSecondary;
    ctx.textBaseline = 'middle';
    const headerY = HEADER_HEIGHT / 2;

    ctx.textAlign = 'left';
    ctx.fillText('Time', col1X, headerY);
    ctx.fillText('Price', col2X, headerY);

    ctx.textAlign = 'right';
    ctx.fillText('Qty', width - PADDING_X, headerY);

    // Header bottom border
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HEADER_HEIGHT);
    ctx.lineTo(width, HEADER_HEIGHT);
    ctx.stroke();
  }

  private drawTradeRow(trade: TradeEntry, y: number, col1X: number, col2X: number): void {
    const { ctx, width, colors } = this;

    // isBuyerMaker: true = sell aggressor (seller matched passive buy),
    //               false = buy aggressor (buyer matched passive sell)
    const priceColor = trade.isBuyerMaker ? colors.sellText : colors.buyText;
    const textY = y + ROW_HEIGHT / 2;

    ctx.textBaseline = 'middle';

    // Time column
    ctx.textAlign = 'left';
    ctx.fillStyle = colors.foregroundSecondary;
    ctx.fillText(this.formatTime(trade.time), col1X, textY);

    // Price column
    ctx.textAlign = 'left';
    ctx.fillStyle = priceColor;
    ctx.fillText(formatPrice(trade.price), col2X, textY);

    // Quantity column (right-aligned)
    ctx.textAlign = 'right';
    ctx.fillStyle = colors.foreground;
    ctx.fillText(this.formatQuantity(trade.quantity), width - PADDING_X, textY);
  }

  // -- Helpers ----------------------------------------------------------------

  private formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  private formatQuantity(qty: number): string {
    if (qty >= 1000) return qty.toFixed(0);
    if (qty >= 1) return qty.toFixed(3);
    return qty.toFixed(5);
  }
}
