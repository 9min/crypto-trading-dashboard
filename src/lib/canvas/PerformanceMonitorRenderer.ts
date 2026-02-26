// =============================================================================
// PerformanceMonitorRenderer — Canvas 2D
// =============================================================================
// Renders real-time performance metrics using Canvas 2D API, completely
// bypassing React's render cycle. Tracks FPS, JS Heap usage, Canvas draw
// times (via PerformanceObserver), and DOM node count.
//
// Layout: 2x2 grid
//   Top-left     → FPS counter + 60-second mini sparkline
//   Top-right    → JS Heap usage / 200 MB target
//   Bottom-left  → Canvas draw times per renderer
//   Bottom-right → DOM node count / 500 target
//
// Color thresholds follow CLAUDE.md performance targets:
//   Good (green)    → FPS >= 55, Heap < 150MB, Draw < 3ms, DOM < 400
//   Warning (yellow) → FPS 45-54, Heap 150-199MB, Draw 3-4ms, DOM 400-499
//   Critical (red)   → FPS < 45, Heap >= 200MB, Draw > 4ms, DOM >= 500
//
// Performance: all buffers pre-allocated, zero per-frame heap allocations.
// =============================================================================

import type { CanvasRenderer } from '@/hooks/useCanvasRenderer';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PerformanceMonitorColors {
  background: string;
  cardBg: string;
  foreground: string;
  foregroundSecondary: string;
  good: string;
  warning: string;
  critical: string;
  graphLine: string;
  graphFill: string;
  border: string;
}

/** Chrome-only memory API */
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const FONT_FAMILY = "'JetBrains Mono', 'Fira Code', monospace";
const CARD_PADDING = 8;
const CARD_GAP = 6;
const TITLE_FONT_SIZE = 10;
const VALUE_FONT_SIZE = 18;
const LABEL_FONT_SIZE = 9;

const FPS_HISTORY_CAPACITY = 60;
const SLOW_POLL_INTERVAL_MS = 5_000;

const DEFAULT_COLORS: PerformanceMonitorColors = {
  background: '#12161c',
  cardBg: '#1a1f27',
  foreground: '#eaecef',
  foregroundSecondary: '#848e9c',
  good: '#00c087',
  warning: '#f0b90b',
  critical: '#f6465d',
  graphLine: '#00c087',
  graphFill: 'rgba(0, 192, 135, 0.15)',
  border: '#252930',
};

// Known performance.measure entry names from other renderers
const DRAW_MEASURE_NAMES = ['orderbook-draw', 'tradesfeed-draw', 'depth-chart-draw'] as const;

const DRAW_LABELS: Record<string, string> = {
  'orderbook-draw': 'OB',
  'tradesfeed-draw': 'TF',
  'depth-chart-draw': 'DC',
};

// -----------------------------------------------------------------------------
// Renderer
// -----------------------------------------------------------------------------

export class PerformanceMonitorRenderer implements CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private colors: PerformanceMonitorColors;
  private isDirty = true;

  // FPS tracking
  private frameCount = 0;
  private lastFpsCalcTime = 0;
  private currentFps = 0;

  // FPS history — circular buffer (Float64Array for GC-free storage)
  private fpsHistory = new Float64Array(FPS_HISTORY_CAPACITY);
  private fpsHistoryHead = 0;
  private fpsHistoryCount = 0;

  // Draw time tracking (renderer name → latest duration in ms)
  private drawTimes: Map<string, number> = new Map();
  private perfObserver: PerformanceObserver | null = null;

  // Slow-polled metrics
  private heapUsedMB = 0;
  private heapLimitMB = 0;
  private domNodeCount = 0;
  private lastSlowPollTime = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.colors = { ...DEFAULT_COLORS };
    this.lastFpsCalcTime = performance.now();

    this.initPerformanceObserver();
  }

  // -- CanvasRenderer interface -----------------------------------------------

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.isDirty = true;
  }

  onFrame(): void {
    this.frameCount++;

    const now = performance.now();

    // Calculate FPS every second
    const elapsed = now - this.lastFpsCalcTime;
    if (elapsed >= 1_000) {
      this.currentFps = Math.round((this.frameCount / elapsed) * 1_000);
      this.frameCount = 0;
      this.lastFpsCalcTime = now;

      // Push to history ring buffer
      this.fpsHistory[this.fpsHistoryHead] = this.currentFps;
      this.fpsHistoryHead = (this.fpsHistoryHead + 1) % FPS_HISTORY_CAPACITY;
      if (this.fpsHistoryCount < FPS_HISTORY_CAPACITY) {
        this.fpsHistoryCount++;
      }

      this.isDirty = true;
    }

    // Slow poll: heap + DOM count
    if (now - this.lastSlowPollTime >= SLOW_POLL_INTERVAL_MS) {
      this.pollSlowMetrics();
      this.lastSlowPollTime = now;
      this.isDirty = true;
    }

    if (!this.isDirty) return;

    this.draw();
    this.isDirty = false;
  }

  markDirty(): void {
    this.isDirty = true;
  }

  destroy(): void {
    if (this.perfObserver) {
      this.perfObserver.disconnect();
      this.perfObserver = null;
    }
  }

  // -- Internals ---------------------------------------------------------------

  private initPerformanceObserver(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      this.perfObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          if (DRAW_MEASURE_NAMES.includes(entry.name as (typeof DRAW_MEASURE_NAMES)[number])) {
            this.drawTimes.set(entry.name, entry.duration);
            this.isDirty = true;
          }
        }
      });
      this.perfObserver.observe({ type: 'measure', buffered: false });
    } catch {
      // PerformanceObserver may not support 'measure' type in all browsers
      this.perfObserver = null;
    }
  }

  private pollSlowMetrics(): void {
    // JS Heap (Chrome-only)
    const perfWithMemory = performance as PerformanceWithMemory;
    if (perfWithMemory.memory) {
      this.heapUsedMB = perfWithMemory.memory.usedJSHeapSize / (1024 * 1024);
      this.heapLimitMB = perfWithMemory.memory.jsHeapSizeLimit / (1024 * 1024);
    }

    // DOM node count
    if (typeof document !== 'undefined') {
      this.domNodeCount = document.querySelectorAll('*').length;
    }
  }

  // -- Color threshold helpers ------------------------------------------------

  /** Returns status color based on FPS value */
  getStatusColorForFps(fps: number): string {
    if (fps >= 55) return this.colors.good;
    if (fps >= 45) return this.colors.warning;
    return this.colors.critical;
  }

  /** Returns status color based on heap usage in MB */
  getStatusColorForHeap(heapMB: number): string {
    if (heapMB < 150) return this.colors.good;
    if (heapMB < 200) return this.colors.warning;
    return this.colors.critical;
  }

  /** Returns status color based on draw time in ms */
  getStatusColorForDrawTime(ms: number): string {
    if (ms < 3) return this.colors.good;
    if (ms <= 4) return this.colors.warning;
    return this.colors.critical;
  }

  /** Returns status color based on DOM node count */
  getStatusColorForDom(count: number): string {
    if (count < 400) return this.colors.good;
    if (count < 500) return this.colors.warning;
    return this.colors.critical;
  }

  // -- Getters for testing ----------------------------------------------------

  getCurrentFps(): number {
    return this.currentFps;
  }

  getFpsHistoryCount(): number {
    return this.fpsHistoryCount;
  }

  getFpsHistoryEntry(index: number): number {
    if (index < 0 || index >= this.fpsHistoryCount) return 0;
    // Read from ring buffer: oldest entry first
    const startIdx = this.fpsHistoryCount < FPS_HISTORY_CAPACITY ? 0 : this.fpsHistoryHead;
    const actualIdx = (startIdx + index) % FPS_HISTORY_CAPACITY;
    return this.fpsHistory[actualIdx];
  }

  getDrawTimes(): Map<string, number> {
    return this.drawTimes;
  }

  getIsDirty(): boolean {
    return this.isDirty;
  }

  // -- Drawing ----------------------------------------------------------------

  private draw(): void {
    const { ctx, width, height, colors } = this;
    if (width === 0 || height === 0) return;

    // Clear background
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    // Compute card dimensions (2x2 grid)
    const cardW = (width - CARD_GAP * 3) / 2;
    const cardH = (height - CARD_GAP * 3) / 2;

    // Top-left: FPS
    this.drawFpsCard(CARD_GAP, CARD_GAP, cardW, cardH);

    // Top-right: Heap
    this.drawHeapCard(CARD_GAP * 2 + cardW, CARD_GAP, cardW, cardH);

    // Bottom-left: Draw Times
    this.drawDrawTimesCard(CARD_GAP, CARD_GAP * 2 + cardH, cardW, cardH);

    // Bottom-right: DOM Nodes
    this.drawDomCard(CARD_GAP * 2 + cardW, CARD_GAP * 2 + cardH, cardW, cardH);
  }

  private drawCardBackground(x: number, y: number, w: number, h: number): void {
    const { ctx, colors } = this;
    const radius = 4;

    ctx.fillStyle = colors.cardBg;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.arcTo(x + w, y, x + w, y + radius, radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    ctx.lineTo(x + radius, y + h);
    ctx.arcTo(x, y + h, x, y + h - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
    ctx.fill();
  }

  private drawFpsCard(x: number, y: number, w: number, h: number): void {
    const { ctx, colors } = this;
    this.drawCardBackground(x, y, w, h);

    const innerX = x + CARD_PADDING;
    const innerY = y + CARD_PADDING;

    // Title
    ctx.font = `${TITLE_FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = colors.foregroundSecondary;
    ctx.fillText('FPS', innerX, innerY);

    // Value
    const statusColor = this.getStatusColorForFps(this.currentFps);
    ctx.font = `bold ${VALUE_FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.fillStyle = statusColor;
    ctx.fillText(String(this.currentFps), innerX, innerY + TITLE_FONT_SIZE + 4);

    // Target label
    ctx.font = `${LABEL_FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.fillStyle = colors.foregroundSecondary;
    ctx.fillText(
      '/ 60 target',
      innerX + ctx.measureText(String(this.currentFps)).width + 4,
      innerY + TITLE_FONT_SIZE + 4 + (VALUE_FONT_SIZE - LABEL_FONT_SIZE),
    );

    // FPS sparkline graph
    this.drawFpsGraph(
      innerX,
      innerY + TITLE_FONT_SIZE + VALUE_FONT_SIZE + 12,
      w - CARD_PADDING * 2,
      h - CARD_PADDING * 2 - TITLE_FONT_SIZE - VALUE_FONT_SIZE - 12,
    );
  }

  private drawFpsGraph(x: number, y: number, w: number, h: number): void {
    if (this.fpsHistoryCount < 2 || w <= 0 || h <= 0) return;

    const { ctx, colors } = this;
    const count = this.fpsHistoryCount;
    const stepX = w / (FPS_HISTORY_CAPACITY - 1);

    // Find min/max for scaling (clamp to 0-70 range for stable axis)
    const minFps = 0;
    const maxFps = 70;
    const range = maxFps - minFps;

    const startIdx = count < FPS_HISTORY_CAPACITY ? 0 : this.fpsHistoryHead;

    // Draw filled area
    ctx.beginPath();
    ctx.moveTo(x, y + h); // baseline

    for (let i = 0; i < count; i++) {
      const actualIdx = (startIdx + i) % FPS_HISTORY_CAPACITY;
      const fps = this.fpsHistory[actualIdx];
      const px = x + i * stepX;
      const py = y + h - ((fps - minFps) / range) * h;
      if (i === 0) {
        ctx.lineTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }

    ctx.lineTo(x + (count - 1) * stepX, y + h); // back to baseline
    ctx.closePath();

    ctx.fillStyle = colors.graphFill;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const actualIdx = (startIdx + i) % FPS_HISTORY_CAPACITY;
      const fps = this.fpsHistory[actualIdx];
      const px = x + i * stepX;
      const py = y + h - ((fps - minFps) / range) * h;
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }

    ctx.strokeStyle = colors.graphLine;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 55 FPS warning threshold line (dashed)
    const thresholdY = y + h - ((55 - minFps) / range) * h;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = colors.warning;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, thresholdY);
    ctx.lineTo(x + w, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawHeapCard(x: number, y: number, w: number, h: number): void {
    const { ctx, colors } = this;
    this.drawCardBackground(x, y, w, h);

    const innerX = x + CARD_PADDING;
    const innerY = y + CARD_PADDING;

    // Title
    ctx.font = `${TITLE_FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = colors.foregroundSecondary;
    ctx.fillText('JS Heap', innerX, innerY);

    const perfWithMemory = performance as PerformanceWithMemory;
    const hasMemoryApi = !!perfWithMemory.memory;

    if (hasMemoryApi) {
      // Value
      const statusColor = this.getStatusColorForHeap(this.heapUsedMB);
      ctx.font = `bold ${VALUE_FONT_SIZE}px ${FONT_FAMILY}`;
      ctx.fillStyle = statusColor;
      const valueText = `${this.heapUsedMB.toFixed(1)} MB`;
      ctx.fillText(valueText, innerX, innerY + TITLE_FONT_SIZE + 4);

      // Target label
      ctx.font = `${LABEL_FONT_SIZE}px ${FONT_FAMILY}`;
      ctx.fillStyle = colors.foregroundSecondary;
      ctx.fillText('/ 200 MB target', innerX, innerY + TITLE_FONT_SIZE + VALUE_FONT_SIZE + 10);

      // Progress bar
      const barY = innerY + TITLE_FONT_SIZE + VALUE_FONT_SIZE + LABEL_FONT_SIZE + 18;
      const barW = w - CARD_PADDING * 2;
      const barH = 6;
      const fillRatio = Math.min(this.heapUsedMB / 200, 1);

      // Bar background
      ctx.fillStyle = colors.border;
      this.drawRoundedRect(innerX, barY, barW, barH, 3);

      // Bar fill
      ctx.fillStyle = statusColor;
      if (fillRatio > 0) {
        this.drawRoundedRect(innerX, barY, barW * fillRatio, barH, 3);
      }

      // Limit label
      if (this.heapLimitMB > 0) {
        ctx.font = `${LABEL_FONT_SIZE}px ${FONT_FAMILY}`;
        ctx.fillStyle = colors.foregroundSecondary;
        ctx.fillText(`Limit: ${this.heapLimitMB.toFixed(0)} MB`, innerX, barY + barH + 6);
      }
    } else {
      ctx.font = `bold ${VALUE_FONT_SIZE}px ${FONT_FAMILY}`;
      ctx.fillStyle = colors.foregroundSecondary;
      ctx.fillText('N/A', innerX, innerY + TITLE_FONT_SIZE + 4);

      ctx.font = `${LABEL_FONT_SIZE}px ${FONT_FAMILY}`;
      ctx.fillText('Chrome-only API', innerX, innerY + TITLE_FONT_SIZE + VALUE_FONT_SIZE + 10);
    }
  }

  private drawDrawTimesCard(x: number, y: number, w: number, h: number): void {
    const { ctx, colors } = this;
    this.drawCardBackground(x, y, w, h);

    const innerX = x + CARD_PADDING;
    const innerY = y + CARD_PADDING;

    // Title
    ctx.font = `${TITLE_FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = colors.foregroundSecondary;
    ctx.fillText('Draw Times', innerX, innerY);

    const lineHeight = 20;
    let offsetY = innerY + TITLE_FONT_SIZE + 8;

    for (const measureName of DRAW_MEASURE_NAMES) {
      const label = DRAW_LABELS[measureName];
      const duration = this.drawTimes.get(measureName);

      // Label
      ctx.font = `${LABEL_FONT_SIZE}px ${FONT_FAMILY}`;
      ctx.fillStyle = colors.foregroundSecondary;
      ctx.fillText(`${label}:`, innerX, offsetY);

      if (duration !== undefined) {
        const statusColor = this.getStatusColorForDrawTime(duration);
        ctx.font = `bold 12px ${FONT_FAMILY}`;
        ctx.fillStyle = statusColor;
        ctx.fillText(`${duration.toFixed(2)} ms`, innerX + 30, offsetY);

        // Inline bar
        const barX = innerX + 100;
        const barW = w - CARD_PADDING * 2 - 100;
        if (barW > 0) {
          const barH = 4;
          const barY = offsetY + 4;
          const fillRatio = Math.min(duration / 4, 1); // 4ms = 100%

          ctx.fillStyle = colors.border;
          this.drawRoundedRect(barX, barY, barW, barH, 2);

          ctx.fillStyle = statusColor;
          if (fillRatio > 0) {
            this.drawRoundedRect(barX, barY, barW * fillRatio, barH, 2);
          }
        }
      } else {
        ctx.font = `12px ${FONT_FAMILY}`;
        ctx.fillStyle = colors.foregroundSecondary;
        ctx.fillText('--', innerX + 30, offsetY);
      }

      offsetY += lineHeight;
    }

    // < 4ms target
    ctx.font = `${LABEL_FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.fillStyle = colors.foregroundSecondary;
    ctx.fillText('Target: < 4 ms each', innerX, offsetY + 4);
  }

  private drawDomCard(x: number, y: number, w: number, h: number): void {
    const { ctx, colors } = this;
    this.drawCardBackground(x, y, w, h);

    const innerX = x + CARD_PADDING;
    const innerY = y + CARD_PADDING;

    // Title
    ctx.font = `${TITLE_FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = colors.foregroundSecondary;
    ctx.fillText('DOM Nodes', innerX, innerY);

    // Value
    const statusColor = this.getStatusColorForDom(this.domNodeCount);
    ctx.font = `bold ${VALUE_FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.fillStyle = statusColor;
    ctx.fillText(String(this.domNodeCount), innerX, innerY + TITLE_FONT_SIZE + 4);

    // Target
    ctx.font = `${LABEL_FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.fillStyle = colors.foregroundSecondary;
    ctx.fillText('/ 500 target', innerX, innerY + TITLE_FONT_SIZE + VALUE_FONT_SIZE + 10);

    // Progress bar
    const barY = innerY + TITLE_FONT_SIZE + VALUE_FONT_SIZE + LABEL_FONT_SIZE + 18;
    const barW = w - CARD_PADDING * 2;
    const barH = 6;
    const fillRatio = Math.min(this.domNodeCount / 500, 1);

    ctx.fillStyle = colors.border;
    this.drawRoundedRect(innerX, barY, barW, barH, 3);

    ctx.fillStyle = statusColor;
    if (fillRatio > 0) {
      this.drawRoundedRect(innerX, barY, barW * fillRatio, barH, 3);
    }
  }

  // -- Helpers ----------------------------------------------------------------

  private drawRoundedRect(x: number, y: number, w: number, h: number, r: number): void {
    if (w <= 0) return;
    const { ctx } = this;
    const radius = Math.min(r, w / 2, h / 2);

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.arcTo(x + w, y, x + w, y + radius, radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    ctx.lineTo(x + radius, y + h);
    ctx.arcTo(x, y + h, x, y + h - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
    ctx.fill();
  }
}
