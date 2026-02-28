// =============================================================================
// Portfolio Snapshot — Canvas 2D Share Card Renderer
// =============================================================================
// Generates a PNG share card image from portfolio data using offscreen Canvas.
// Supports both Futures (USDT) and Spot (KRW) portfolios.
// Uses Web Share API on mobile with download fallback on desktop.
// =============================================================================

import { formatPrice } from '@/utils/formatPrice';
import { formatSymbol } from '@/utils/formatSymbol';
import type { FuturesSummary, PositionWithPnl } from '@/types/portfolio';
import type { SpotSummary, HoldingWithPnl } from '@/types/spot';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ThemeColors {
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  foreground: string;
  foregroundSecondary: string;
  foregroundTertiary: string;
  border: string;
  buy: string;
  sell: string;
  accent: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const CARD_WIDTH = 308;
const DPR = 2;
const PADDING_X = 16;
const MAX_SNAPSHOT_ITEMS = 5;

// Font stacks (matches project CSS)
const FONT_SANS = "'Inter', system-ui, -apple-system, sans-serif";
const FONT_MONO = "'JetBrains Mono', 'Fira Code', monospace";

// -----------------------------------------------------------------------------
// Theme Colors
// -----------------------------------------------------------------------------

function getThemeColors(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  const get = (prop: string) => style.getPropertyValue(prop).trim();

  return {
    background: get('--background') || '#0b0e11',
    backgroundSecondary: get('--background-secondary') || '#12161c',
    backgroundTertiary: get('--background-tertiary') || '#1a1f27',
    foreground: get('--foreground') || '#eaecef',
    foregroundSecondary: get('--foreground-secondary') || '#848e9c',
    foregroundTertiary: get('--foreground-tertiary') || '#5e6673',
    border: get('--border') || '#252930',
    buy: get('--color-buy') || '#00c087',
    sell: get('--color-sell') || '#f6465d',
    accent: get('--color-accent') || '#f0b90b',
  };
}

// -----------------------------------------------------------------------------
// Canvas Drawing Helpers
// -----------------------------------------------------------------------------

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawSeparator(ctx: CanvasRenderingContext2D, y: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING_X, y);
  ctx.lineTo(CARD_WIDTH - PADDING_X, y);
  ctx.stroke();
}

function getPnlColor(value: number, colors: ThemeColors): string {
  if (value > 0) return colors.buy;
  if (value < 0) return colors.sell;
  return colors.foregroundSecondary;
}

function formatDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

// -----------------------------------------------------------------------------
// Header Section (shared)
// -----------------------------------------------------------------------------

function drawHeader(ctx: CanvasRenderingContext2D, colors: ThemeColors, title: string): number {
  let y = 20;

  // Accent left bar
  ctx.fillStyle = colors.accent;
  ctx.fillRect(PADDING_X, y, 3, 32);

  // Title
  ctx.fillStyle = colors.foreground;
  ctx.font = `600 12px ${FONT_SANS}`;
  ctx.fillText('Crypto Trading Dashboard', PADDING_X + 12, y + 12);

  // Subtitle + Date
  ctx.fillStyle = colors.foregroundSecondary;
  ctx.font = `400 10px ${FONT_SANS}`;
  ctx.fillText(title, PADDING_X + 12, y + 26);

  ctx.fillStyle = colors.foregroundTertiary;
  ctx.font = `400 9px ${FONT_SANS}`;
  const dateStr = formatDate();
  const dateWidth = ctx.measureText(dateStr).width;
  ctx.fillText(dateStr, CARD_WIDTH - PADDING_X - dateWidth, y + 26);

  y += 44;
  drawSeparator(ctx, y, colors.border);
  return y + 14;
}

// -----------------------------------------------------------------------------
// Footer Section (shared)
// -----------------------------------------------------------------------------

function drawFooter(ctx: CanvasRenderingContext2D, colors: ThemeColors, y: number): number {
  drawSeparator(ctx, y, colors.border);
  y += 14;

  ctx.fillStyle = colors.foregroundTertiary;
  ctx.font = `400 8px ${FONT_SANS}`;
  const disclaimer = 'crypto-trading-dashboard-nine.vercel.app';
  const disclaimerWidth = ctx.measureText(disclaimer).width;
  ctx.fillText(disclaimer, (CARD_WIDTH - disclaimerWidth) / 2, y);

  return y + 14;
}

// -----------------------------------------------------------------------------
// Canvas → Blob
// -----------------------------------------------------------------------------

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob returned null'));
    }, 'image/png');
  });
}

// -----------------------------------------------------------------------------
// Futures Snapshot
// -----------------------------------------------------------------------------

interface FuturesSnapshotData {
  summary: FuturesSummary;
  positions: PositionWithPnl[];
}

async function renderFuturesSnapshot(
  data: FuturesSnapshotData,
  colors: ThemeColors,
): Promise<Blob> {
  await document.fonts.ready;

  const { summary, positions } = data;
  const itemCount = Math.min(positions.length, MAX_SNAPSHOT_ITEMS);
  const hasMore = positions.length > MAX_SNAPSHOT_ITEMS;

  // Estimate canvas height
  const headerH = 60;
  const summaryH = 104;
  const itemH = itemCount * 24;
  const moreH = hasMore ? 22 : 0;
  const footerH = 40;
  const emptyH = positions.length === 0 ? 30 : 0;
  const totalH = headerH + summaryH + itemH + moreH + emptyH + footerH;

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH * DPR;
  canvas.height = totalH * DPR;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2d context');

  ctx.scale(DPR, DPR);

  // Background
  drawRoundedRect(ctx, 0, 0, CARD_WIDTH, totalH, 12);
  ctx.fillStyle = colors.background;
  ctx.fill();

  // Border
  drawRoundedRect(ctx, 0.5, 0.5, CARD_WIDTH - 1, totalH - 1, 12);
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Header
  let y = drawHeader(ctx, colors, 'Futures');

  // Summary rows
  const pnlSign = summary.totalUnrealizedPnl > 0 ? '+' : '';
  const pnlColor = getPnlColor(summary.totalUnrealizedPnl, colors);

  // Total Equity
  ctx.fillStyle = colors.foregroundSecondary;
  ctx.font = `400 9px ${FONT_SANS}`;
  ctx.fillText('Total Equity', PADDING_X, y);
  ctx.fillStyle = colors.foreground;
  ctx.font = `600 11px ${FONT_MONO}`;
  const eqStr = `$${formatPrice(summary.totalEquity)}`;
  const eqWidth = ctx.measureText(eqStr).width;
  ctx.fillText(eqStr, CARD_WIDTH - PADDING_X - eqWidth, y);
  y += 16;

  // Available
  ctx.fillStyle = colors.foregroundSecondary;
  ctx.font = `400 9px ${FONT_SANS}`;
  ctx.fillText('Available', PADDING_X, y);
  ctx.font = `400 10px ${FONT_MONO}`;
  const avStr = `$${formatPrice(summary.availableBalance)}`;
  const avWidth = ctx.measureText(avStr).width;
  ctx.fillText(avStr, CARD_WIDTH - PADDING_X - avWidth, y);
  y += 16;

  // Unrealized PnL
  ctx.fillStyle = colors.foregroundSecondary;
  ctx.font = `400 9px ${FONT_SANS}`;
  ctx.fillText('Unrealized PnL', PADDING_X, y);
  ctx.fillStyle = pnlColor;
  ctx.font = `600 10px ${FONT_MONO}`;
  const pnlStr = `${pnlSign}$${formatPrice(Math.abs(summary.totalUnrealizedPnl))}`;
  const pnlWidth = ctx.measureText(pnlStr).width;
  ctx.fillText(pnlStr, CARD_WIDTH - PADDING_X - pnlWidth, y);
  y += 13;

  // PnL percent
  const pctStr = `(${pnlSign}${summary.totalUnrealizedPnlPercent.toFixed(2)}%)`;
  ctx.font = `400 9px ${FONT_MONO}`;
  const pctWidth = ctx.measureText(pctStr).width;
  ctx.fillText(pctStr, CARD_WIDTH - PADDING_X - pctWidth, y);
  y += 16;

  // Margin Ratio
  ctx.fillStyle = colors.foregroundSecondary;
  ctx.font = `400 9px ${FONT_SANS}`;
  ctx.fillText('Margin Ratio', PADDING_X, y);
  ctx.fillStyle = colors.foreground;
  ctx.font = `400 10px ${FONT_MONO}`;
  const mrStr = `${summary.marginRatio.toFixed(1)}%`;
  const mrWidth = ctx.measureText(mrStr).width;
  ctx.fillText(mrStr, CARD_WIDTH - PADDING_X - mrWidth, y);
  y += 16;

  // Positions count
  ctx.fillStyle = colors.foregroundSecondary;
  ctx.font = `400 9px ${FONT_SANS}`;
  ctx.fillText('Positions', PADDING_X, y);
  ctx.fillStyle = colors.foreground;
  ctx.font = `400 10px ${FONT_MONO}`;
  const pcStr = String(summary.positionCount);
  const pcWidth = ctx.measureText(pcStr).width;
  ctx.fillText(pcStr, CARD_WIDTH - PADDING_X - pcWidth, y);
  y += 10;

  drawSeparator(ctx, y, colors.border);
  y += 12;

  // Position rows
  if (positions.length === 0) {
    ctx.fillStyle = colors.foregroundTertiary;
    ctx.font = `400 9px ${FONT_SANS}`;
    const noPos = 'No open positions';
    const noPosWidth = ctx.measureText(noPos).width;
    ctx.fillText(noPos, (CARD_WIDTH - noPosWidth) / 2, y + 8);
    y += 22;
  } else {
    const displayPositions = positions.slice(0, MAX_SNAPSHOT_ITEMS);
    for (const pos of displayPositions) {
      const sideLabel = pos.side === 'long' ? 'L' : 'S';
      const sideColor = pos.side === 'long' ? colors.buy : colors.sell;
      const posPnlSign = pos.unrealizedPnl > 0 ? '+' : '';
      const posPnlColor = getPnlColor(pos.unrealizedPnl, colors);

      // Side badge
      ctx.fillStyle = sideColor;
      drawRoundedRect(ctx, PADDING_X, y - 8, 13, 13, 3);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 8px ${FONT_SANS}`;
      const badgeTextWidth = ctx.measureText(sideLabel).width;
      ctx.fillText(sideLabel, PADDING_X + (13 - badgeTextWidth) / 2, y + 1);

      // PnL amount + ROE (measure first to know right-side width)
      const posPnlStr = `${posPnlSign}$${formatPrice(Math.abs(pos.unrealizedPnl))}`;
      const roeStr = `${posPnlSign}${pos.roe.toFixed(1)}%`;

      ctx.font = `500 9px ${FONT_MONO}`;
      const roeWidth = ctx.measureText(roeStr).width;
      const pnlAmtWidth = ctx.measureText(posPnlStr).width;
      const rightWidth = roeWidth + pnlAmtWidth + 6;

      // Symbol + leverage (fit within remaining left space)
      const leftStart = PADDING_X + 17;
      const leftMaxWidth = CARD_WIDTH - PADDING_X - rightWidth - leftStart - 4;

      ctx.fillStyle = colors.foreground;
      ctx.font = `500 10px ${FONT_SANS}`;
      const symText = formatSymbol(pos.symbol);
      const symWidth = ctx.measureText(symText).width;
      ctx.fillText(symText, leftStart, y + 1);

      // Draw leverage only if it fits without overlapping PnL
      const levText = `${pos.leverage}x`;
      ctx.font = `400 8px ${FONT_SANS}`;
      const levWidth = ctx.measureText(levText).width;
      if (symWidth + 4 + levWidth <= leftMaxWidth) {
        ctx.fillStyle = colors.foregroundSecondary;
        ctx.fillText(levText, leftStart + symWidth + 4, y + 1);
      }

      // Draw PnL amount + ROE
      ctx.fillStyle = posPnlColor;
      ctx.font = `500 9px ${FONT_MONO}`;
      ctx.fillText(roeStr, CARD_WIDTH - PADDING_X - roeWidth, y + 1);
      ctx.fillText(posPnlStr, CARD_WIDTH - PADDING_X - roeWidth - pnlAmtWidth - 6, y + 1);

      y += 24;
    }

    if (hasMore) {
      ctx.fillStyle = colors.foregroundTertiary;
      ctx.font = `400 9px ${FONT_SANS}`;
      const moreStr = `... and ${positions.length - MAX_SNAPSHOT_ITEMS} more`;
      const moreWidth = ctx.measureText(moreStr).width;
      ctx.fillText(moreStr, (CARD_WIDTH - moreWidth) / 2, y);
      y += 14;
    }
  }

  y = drawFooter(ctx, colors, y);

  // Crop canvas to actual height
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = CARD_WIDTH * DPR;
  croppedCanvas.height = y * DPR;
  const croppedCtx = croppedCanvas.getContext('2d');
  if (!croppedCtx) throw new Error('Failed to get cropped canvas context');
  croppedCtx.drawImage(canvas, 0, 0);

  return canvasToBlob(croppedCanvas);
}

// -----------------------------------------------------------------------------
// Spot Snapshot
// -----------------------------------------------------------------------------

interface SpotSnapshotData {
  summary: SpotSummary;
  holdings: HoldingWithPnl[];
}

async function renderSpotSnapshot(data: SpotSnapshotData, colors: ThemeColors): Promise<Blob> {
  await document.fonts.ready;

  const { summary, holdings } = data;
  const itemCount = Math.min(holdings.length, MAX_SNAPSHOT_ITEMS);
  const hasMore = holdings.length > MAX_SNAPSHOT_ITEMS;

  // Estimate canvas height
  const headerH = 60;
  const summaryH = 80;
  const itemH = itemCount * 24;
  const moreH = hasMore ? 22 : 0;
  const footerH = 40;
  const emptyH = holdings.length === 0 ? 30 : 0;
  const totalH = headerH + summaryH + itemH + moreH + emptyH + footerH;

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH * DPR;
  canvas.height = totalH * DPR;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2d context');

  ctx.scale(DPR, DPR);

  // Background
  drawRoundedRect(ctx, 0, 0, CARD_WIDTH, totalH, 12);
  ctx.fillStyle = colors.background;
  ctx.fill();

  // Border
  drawRoundedRect(ctx, 0.5, 0.5, CARD_WIDTH - 1, totalH - 1, 12);
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Header
  let y = drawHeader(ctx, colors, 'Spot');

  // Summary rows
  const pnlSign = summary.totalUnrealizedPnl > 0 ? '+' : '';
  const pnlColor = getPnlColor(summary.totalUnrealizedPnl, colors);

  // Total Value
  ctx.fillStyle = colors.foregroundSecondary;
  ctx.font = `400 9px ${FONT_SANS}`;
  ctx.fillText('Total Value', PADDING_X, y);
  ctx.fillStyle = colors.foreground;
  ctx.font = `600 11px ${FONT_MONO}`;
  const tvStr = `\u20A9${formatPrice(summary.totalValue, 0)}`;
  const tvWidth = ctx.measureText(tvStr).width;
  ctx.fillText(tvStr, CARD_WIDTH - PADDING_X - tvWidth, y);
  y += 16;

  // KRW Balance
  ctx.fillStyle = colors.foregroundSecondary;
  ctx.font = `400 9px ${FONT_SANS}`;
  ctx.fillText('KRW Balance', PADDING_X, y);
  ctx.font = `400 10px ${FONT_MONO}`;
  const wbStr = `\u20A9${formatPrice(summary.walletBalance, 0)}`;
  const wbWidth = ctx.measureText(wbStr).width;
  ctx.fillText(wbStr, CARD_WIDTH - PADDING_X - wbWidth, y);
  y += 16;

  // Unrealized PnL
  ctx.fillStyle = colors.foregroundSecondary;
  ctx.font = `400 9px ${FONT_SANS}`;
  ctx.fillText('Unrealized PnL', PADDING_X, y);
  ctx.fillStyle = pnlColor;
  ctx.font = `600 10px ${FONT_MONO}`;
  const spotPnlStr = `${pnlSign}\u20A9${formatPrice(Math.abs(summary.totalUnrealizedPnl), 0)}`;
  const spotPnlWidth = ctx.measureText(spotPnlStr).width;
  ctx.fillText(spotPnlStr, CARD_WIDTH - PADDING_X - spotPnlWidth, y);
  y += 13;

  // PnL percent
  const pctStr = `(${pnlSign}${summary.totalUnrealizedPnlPercent.toFixed(2)}%)`;
  ctx.font = `400 9px ${FONT_MONO}`;
  const pctWidth = ctx.measureText(pctStr).width;
  ctx.fillText(pctStr, CARD_WIDTH - PADDING_X - pctWidth, y);
  y += 16;

  // Holdings count
  ctx.fillStyle = colors.foregroundSecondary;
  ctx.font = `400 9px ${FONT_SANS}`;
  ctx.fillText('Holdings', PADDING_X, y);
  ctx.fillStyle = colors.foreground;
  ctx.font = `400 10px ${FONT_MONO}`;
  const hcStr = String(summary.holdingCount);
  const hcWidth = ctx.measureText(hcStr).width;
  ctx.fillText(hcStr, CARD_WIDTH - PADDING_X - hcWidth, y);
  y += 10;

  drawSeparator(ctx, y, colors.border);
  y += 12;

  // Holding rows
  if (holdings.length === 0) {
    ctx.fillStyle = colors.foregroundTertiary;
    ctx.font = `400 9px ${FONT_SANS}`;
    const noHld = 'No holdings';
    const noHldWidth = ctx.measureText(noHld).width;
    ctx.fillText(noHld, (CARD_WIDTH - noHldWidth) / 2, y + 8);
    y += 22;
  } else {
    const displayHoldings = holdings.slice(0, MAX_SNAPSHOT_ITEMS);
    for (const h of displayHoldings) {
      const hPnlSign = h.unrealizedPnl > 0 ? '+' : '';
      const hPnlColor = getPnlColor(h.unrealizedPnl, colors);

      // Symbol
      ctx.fillStyle = colors.foreground;
      ctx.font = `500 10px ${FONT_SANS}`;
      ctx.fillText(formatSymbol(h.symbol), PADDING_X, y + 1);

      // PnL amount + percent
      const hPnlStr = `${hPnlSign}\u20A9${formatPrice(Math.abs(h.unrealizedPnl), 0)}`;
      const hPctStr = `${hPnlSign}${h.pnlPercent.toFixed(1)}%`;

      ctx.fillStyle = hPnlColor;
      ctx.font = `500 9px ${FONT_MONO}`;
      const hPctWidth = ctx.measureText(hPctStr).width;
      ctx.fillText(hPctStr, CARD_WIDTH - PADDING_X - hPctWidth, y + 1);

      ctx.font = `500 9px ${FONT_MONO}`;
      const hPnlAmtWidth = ctx.measureText(hPnlStr).width;
      ctx.fillText(hPnlStr, CARD_WIDTH - PADDING_X - hPctWidth - hPnlAmtWidth - 6, y + 1);

      y += 24;
    }

    if (hasMore) {
      ctx.fillStyle = colors.foregroundTertiary;
      ctx.font = `400 9px ${FONT_SANS}`;
      const moreStr = `... and ${holdings.length - MAX_SNAPSHOT_ITEMS} more`;
      const moreWidth = ctx.measureText(moreStr).width;
      ctx.fillText(moreStr, (CARD_WIDTH - moreWidth) / 2, y);
      y += 14;
    }
  }

  y = drawFooter(ctx, colors, y);

  // Crop canvas to actual height
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = CARD_WIDTH * DPR;
  croppedCanvas.height = y * DPR;
  const croppedCtx = croppedCanvas.getContext('2d');
  if (!croppedCtx) throw new Error('Failed to get cropped canvas context');
  croppedCtx.drawImage(canvas, 0, 0);

  return canvasToBlob(croppedCanvas);
}

// -----------------------------------------------------------------------------
// Download / Clipboard
// -----------------------------------------------------------------------------

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function copyBlobToClipboard(blob: Blob): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export {
  getThemeColors,
  renderFuturesSnapshot,
  renderSpotSnapshot,
  downloadBlob,
  copyBlobToClipboard,
};
export type { ThemeColors, FuturesSnapshotData, SpotSnapshotData };
