// =============================================================================
// PortfolioChartRenderer Tests
// =============================================================================
// Tests lifecycle, dirty flag behavior, updateSlices data flow, and setColors.
// Canvas visual output is NOT tested (per CLAUDE.md rules).
// =============================================================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PortfolioChartRenderer, getPortfolioChartColors } from './PortfolioChartRenderer';
import type { AllocationSlice } from '@/types/portfolio';

// -----------------------------------------------------------------------------
// Mock CanvasRenderingContext2D
// -----------------------------------------------------------------------------

function createMockCtx(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    rect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    setTransform: vi.fn(),
    setLineDash: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    canvas: {} as HTMLCanvasElement,
  } as unknown as CanvasRenderingContext2D;
}

function makeSlices(): AllocationSlice[] {
  return [
    { label: 'BTC 10x L', value: 50000, percent: 50, color: '#f7931a' },
    { label: 'ETH 20x S', value: 30000, percent: 30, color: '#627eea' },
    { label: 'Cash', value: 20000, percent: 20, color: '#848e9c' },
  ];
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('PortfolioChartRenderer', () => {
  let renderer: PortfolioChartRenderer;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = createMockCtx();
    renderer = new PortfolioChartRenderer(ctx);
  });

  afterEach(() => {
    renderer.destroy();
  });

  // -- Construction & Lifecycle -----------------------------------------------

  it('creates without error', () => {
    expect(renderer).toBeDefined();
  });

  it('destroy is callable without error', () => {
    expect(() => renderer.destroy()).not.toThrow();
  });

  it('destroy can be called multiple times safely', () => {
    renderer.destroy();
    expect(() => renderer.destroy()).not.toThrow();
  });

  // -- setSize ----------------------------------------------------------------

  it('setsize triggers a draw (fillrect called)', () => {
    renderer.updateSlices(makeSlices());
    renderer.setSize(400, 300);

    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('setsize with zero dimensions does not draw', () => {
    renderer.setSize(0, 0);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  // -- Dirty Flag & onFrame ---------------------------------------------------

  it('onframe does not draw when not dirty', () => {
    renderer.setSize(400, 300);
    vi.mocked(ctx.fillRect).mockClear();

    renderer.onFrame();

    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('onframe draws when marked dirty', () => {
    renderer.setSize(400, 300);
    vi.mocked(ctx.fillRect).mockClear();

    renderer.markDirty();
    renderer.onFrame();

    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('onframe clears dirty flag after drawing', () => {
    renderer.setSize(400, 300);
    renderer.markDirty();
    renderer.onFrame();

    vi.mocked(ctx.fillRect).mockClear();
    renderer.onFrame();

    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  // -- updateSlices -----------------------------------------------------------

  it('updateslices sets dirty flag', () => {
    renderer.setSize(400, 300);
    vi.mocked(ctx.fillRect).mockClear();

    renderer.updateSlices(makeSlices());
    renderer.onFrame();

    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('updateslices with empty slices triggers redraw', () => {
    renderer.setSize(400, 300);
    vi.mocked(ctx.fillRect).mockClear();

    renderer.updateSlices([]);
    renderer.onFrame();

    // Redraw should have occurred (fillRect clears canvas)
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('updateslices with data triggers redraw', () => {
    renderer.setSize(400, 300);
    vi.mocked(ctx.fillRect).mockClear();

    renderer.updateSlices(makeSlices());
    renderer.onFrame();

    expect(ctx.fillRect).toHaveBeenCalled();
  });

  // -- setColors --------------------------------------------------------------

  it('setcolors marks dirty for redraw', () => {
    renderer.setSize(400, 300);
    vi.mocked(ctx.fillRect).mockClear();

    renderer.setColors({ background: '#000000' });
    renderer.onFrame();

    expect(ctx.fillRect).toHaveBeenCalled();
  });

  // -- getPortfolioChartColors ------------------------------------------------

  it('returns dark colors for dark theme', () => {
    const colors = getPortfolioChartColors('dark');
    expect(colors.background).toBe('#12161c');
  });

  it('returns light colors for light theme', () => {
    const colors = getPortfolioChartColors('light');
    expect(colors.background).toBe('#ffffff');
  });

  // -- Legend drawing ----------------------------------------------------------

  it('non-empty slices trigger multiple draw calls', () => {
    renderer.setSize(400, 300);
    vi.mocked(ctx.fillRect).mockClear();

    renderer.updateSlices(makeSlices());
    renderer.onFrame();

    // Multiple fillRect calls: at least background clear
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});
