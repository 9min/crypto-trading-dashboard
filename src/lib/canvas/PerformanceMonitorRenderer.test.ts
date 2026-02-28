// =============================================================================
// PerformanceMonitorRenderer Tests
// =============================================================================
// Tests data transformation logic, FPS calculation, history buffer behavior,
// color threshold logic, and lifecycle management.
// Canvas visual output is NOT tested (per CLAUDE.md rules).
// =============================================================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PerformanceMonitorRenderer } from './PerformanceMonitorRenderer';

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

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('PerformanceMonitorRenderer', () => {
  let renderer: PerformanceMonitorRenderer;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    vi.useFakeTimers();
    ctx = createMockCtx();
    renderer = new PerformanceMonitorRenderer(ctx);
  });

  afterEach(() => {
    renderer.destroy();
    vi.useRealTimers();
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

  it('setSize marks renderer as dirty', () => {
    // Start with a clean state by drawing once
    renderer.setSize(400, 300);
    renderer.onFrame(); // consumes dirty flag

    // After onFrame the flag should be false
    expect(renderer.getIsDirty()).toBe(false);

    renderer.setSize(500, 400);
    expect(renderer.getIsDirty()).toBe(true);
  });

  it('does not draw when size is zero and preserves dirty flag', () => {
    renderer.setSize(0, 0);
    renderer.markDirty();
    renderer.onFrame();

    // onFrame skips draw when width/height is zero and preserves the dirty flag
    // so the renderer will draw on the next frame after receiving a valid size.
    expect(renderer.getIsDirty()).toBe(true);
  });

  // -- markDirty --------------------------------------------------------------

  it('markDirty sets isDirty flag', () => {
    renderer.setSize(400, 300);
    renderer.onFrame(); // clear dirty
    expect(renderer.getIsDirty()).toBe(false);

    renderer.markDirty();
    expect(renderer.getIsDirty()).toBe(true);
  });

  // -- FPS Calculation --------------------------------------------------------

  it('initial FPS is 0', () => {
    expect(renderer.getCurrentFps()).toBe(0);
  });

  it('FPS history starts empty', () => {
    expect(renderer.getFpsHistoryCount()).toBe(0);
  });

  // -- Color Threshold Logic --------------------------------------------------

  describe('getStatusColorForFps', () => {
    it('returns good color for FPS >= 55', () => {
      const color = renderer.getStatusColorForFps(60);
      expect(color).toBe('#00c087');
    });

    it('returns good color at exactly 55', () => {
      const color = renderer.getStatusColorForFps(55);
      expect(color).toBe('#00c087');
    });

    it('returns warning color for FPS 45-54', () => {
      const color = renderer.getStatusColorForFps(50);
      expect(color).toBe('#f0b90b');
    });

    it('returns warning color at exactly 45', () => {
      const color = renderer.getStatusColorForFps(45);
      expect(color).toBe('#f0b90b');
    });

    it('returns critical color for FPS < 45', () => {
      const color = renderer.getStatusColorForFps(30);
      expect(color).toBe('#f6465d');
    });

    it('returns critical color at 0', () => {
      const color = renderer.getStatusColorForFps(0);
      expect(color).toBe('#f6465d');
    });
  });

  describe('getStatusColorForHeap', () => {
    it('returns good color for heap < 150 MB', () => {
      expect(renderer.getStatusColorForHeap(100)).toBe('#00c087');
    });

    it('returns warning color for heap 150-199 MB', () => {
      expect(renderer.getStatusColorForHeap(175)).toBe('#f0b90b');
    });

    it('returns critical color for heap >= 200 MB', () => {
      expect(renderer.getStatusColorForHeap(200)).toBe('#f6465d');
    });

    it('boundary: 149.9 is good', () => {
      expect(renderer.getStatusColorForHeap(149.9)).toBe('#00c087');
    });

    it('boundary: 150 is warning', () => {
      expect(renderer.getStatusColorForHeap(150)).toBe('#f0b90b');
    });

    it('boundary: 199.9 is warning', () => {
      expect(renderer.getStatusColorForHeap(199.9)).toBe('#f0b90b');
    });
  });

  describe('getStatusColorForDrawTime', () => {
    it('returns good color for draw time < 3ms', () => {
      expect(renderer.getStatusColorForDrawTime(1.5)).toBe('#00c087');
    });

    it('returns warning color for draw time 3-4ms', () => {
      expect(renderer.getStatusColorForDrawTime(3.5)).toBe('#f0b90b');
    });

    it('returns critical color for draw time > 4ms', () => {
      expect(renderer.getStatusColorForDrawTime(5)).toBe('#f6465d');
    });

    it('boundary: exactly 3 is warning', () => {
      expect(renderer.getStatusColorForDrawTime(3)).toBe('#f0b90b');
    });

    it('boundary: exactly 4 is warning', () => {
      expect(renderer.getStatusColorForDrawTime(4)).toBe('#f0b90b');
    });

    it('boundary: 4.01 is critical', () => {
      expect(renderer.getStatusColorForDrawTime(4.01)).toBe('#f6465d');
    });
  });

  describe('getStatusColorForDom', () => {
    it('returns good color for DOM < 500', () => {
      expect(renderer.getStatusColorForDom(400)).toBe('#00c087');
    });

    it('returns warning color for DOM 500-699', () => {
      expect(renderer.getStatusColorForDom(600)).toBe('#f0b90b');
    });

    it('returns critical color for DOM >= 700', () => {
      expect(renderer.getStatusColorForDom(700)).toBe('#f6465d');
    });

    it('boundary: 499 is good', () => {
      expect(renderer.getStatusColorForDom(499)).toBe('#00c087');
    });

    it('boundary: 500 is warning', () => {
      expect(renderer.getStatusColorForDom(500)).toBe('#f0b90b');
    });
  });

  // -- Draw Times (PerformanceObserver) ---------------------------------------

  it('draw times map starts empty', () => {
    expect(renderer.getDrawTimes().size).toBe(0);
  });

  // -- onFrame triggers draw when dirty ---------------------------------------

  it('onFrame draws when dirty and resets flag', () => {
    renderer.setSize(400, 300);
    expect(renderer.getIsDirty()).toBe(true);

    renderer.onFrame();
    expect(renderer.getIsDirty()).toBe(false);
  });

  it('onFrame does not draw when not dirty', () => {
    renderer.setSize(400, 300);
    renderer.onFrame(); // clear dirty

    const callCount = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;
    renderer.onFrame(); // should skip
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount);
  });
});
