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
import type { CanvasRenderer } from '@/hooks/useCanvasRenderer';
import { formatPrice } from '@/utils/formatPrice';
import {
  TRADE_FIELD_PRICE,
  TRADE_FIELD_QUANTITY,
  TRADE_FIELD_TIME,
  TRADE_FIELD_IS_BUYER_MAKER,
} from '@/utils/constants';

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
const COLUMN_RATIOS = [0.28, 0.38, 0.34]; // time, price, quantity

const DARK_COLORS: TradesFeedColors = {
  background: '#12161c',
  foreground: '#eaecef',
  foregroundSecondary: '#848e9c',
  headerBg: '#1a1f27',
  buyText: '#00c087',
  sellText: '#f6465d',
  rowHover: 'rgba(255, 255, 255, 0.02)',
  border: '#252930',
};

const LIGHT_COLORS: TradesFeedColors = {
  background: '#ffffff',
  foreground: '#1e2329',
  foregroundSecondary: '#707a8a',
  headerBg: '#f5f5f5',
  buyText: '#0b8f63',
  sellText: '#d9304a',
  rowHover: 'rgba(0, 0, 0, 0.02)',
  border: '#e0e3e8',
};

const DEFAULT_COLORS = DARK_COLORS;

export function getTradesFeedColors(theme: 'dark' | 'light'): TradesFeedColors {
  return theme === 'light' ? LIGHT_COLORS : DARK_COLORS;
}

// -----------------------------------------------------------------------------
// Renderer
// -----------------------------------------------------------------------------

export class TradesFeedRenderer implements CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private colors: TradesFeedColors;
  private lastRenderedTradeId = -1;
  private readonly timezoneOffsetMs = new Date().getTimezoneOffset() * -60_000;

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
    const { lastTradeId, buffer } = useTradeStore.getState();

    if (buffer.length === 0) {
      // No trades yet — clear stale data if previously drawn
      if (this.lastRenderedTradeId !== -1) {
        this.draw();
        this.lastRenderedTradeId = -1;
      }
      return;
    }

    if (lastTradeId === this.lastRenderedTradeId) return;

    this.draw();
    this.lastRenderedTradeId = lastTradeId;
  }

  markDirty(): void {
    this.lastRenderedTradeId = -1;
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
    const { buffer } = useTradeStore.getState();
    const { ctx, width, height, colors } = this;

    if (width === 0 || height === 0) return;

    performance.clearMarks('tradesfeed-draw-start');
    performance.clearMarks('tradesfeed-draw-end');
    performance.clearMeasures('tradesfeed-draw');
    performance.mark('tradesfeed-draw-start');

    // Clear
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    // Column positions
    const col1X = PADDING_X;
    const col2X = width * COLUMN_RATIOS[0];

    // Draw header
    this.drawHeader(col1X, col2X);

    // Draw trade rows — newest first (reverse buffer order)
    const visibleRows = Math.floor((height - HEADER_HEIGHT) / ROW_HEIGHT);
    const count = Math.min(buffer.length, visibleRows);

    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;

    for (let i = 0; i < count; i++) {
      const readIndex = buffer.length - 1 - i;
      const price = buffer.getField(readIndex, TRADE_FIELD_PRICE);
      const quantity = buffer.getField(readIndex, TRADE_FIELD_QUANTITY);
      const time = buffer.getField(readIndex, TRADE_FIELD_TIME);
      const isBuyerMaker = buffer.getField(readIndex, TRADE_FIELD_IS_BUYER_MAKER);

      if (price === null || quantity === null || time === null || isBuyerMaker === null) continue;

      const y = HEADER_HEIGHT + i * ROW_HEIGHT;

      // Alternating row background for readability
      if (i % 2 === 1) {
        ctx.fillStyle = colors.rowHover;
        ctx.fillRect(0, y, width, ROW_HEIGHT);
      }

      this.drawTradeRowFromFields(price, quantity, time, isBuyerMaker === 1, y, col1X, col2X);
    }

    performance.mark('tradesfeed-draw-end');
    performance.measure('tradesfeed-draw', 'tradesfeed-draw-start', 'tradesfeed-draw-end');
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

  private drawTradeRowFromFields(
    price: number,
    quantity: number,
    time: number,
    isBuyerMaker: boolean,
    y: number,
    col1X: number,
    col2X: number,
  ): void {
    const { ctx, width, colors } = this;

    // isBuyerMaker: true = sell aggressor (seller matched passive buy),
    //               false = buy aggressor (buyer matched passive sell)
    const priceColor = isBuyerMaker ? colors.sellText : colors.buyText;
    const textY = y + ROW_HEIGHT / 2;

    ctx.textBaseline = 'middle';

    // Time column
    ctx.textAlign = 'left';
    ctx.fillStyle = colors.foregroundSecondary;
    ctx.fillText(this.formatTime(time), col1X, textY);

    // Price column
    ctx.textAlign = 'left';
    ctx.fillStyle = priceColor;
    ctx.fillText(formatPrice(price), col2X, textY);

    // Quantity column (right-aligned)
    ctx.textAlign = 'right';
    ctx.fillStyle = colors.foreground;
    ctx.fillText(this.formatQuantity(quantity), width - PADDING_X, textY);
  }

  // -- Helpers ----------------------------------------------------------------

  private formatTime(timestamp: number): string {
    const local = (timestamp + this.timezoneOffsetMs) % 86_400_000;
    const totalSeconds = Math.floor(local / 1000);
    const h = Math.floor(totalSeconds / 3600) % 24;
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }

  private formatQuantity(qty: number): string {
    if (qty >= 1000) return qty.toFixed(0);
    if (qty >= 1) return qty.toFixed(3);
    return qty.toFixed(5);
  }
}
