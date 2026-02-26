// =============================================================================
// DepthChartRenderer Tests
// =============================================================================
// Tests dirty detection (lastUpdateId-based), draw gating, resize behavior,
// color updates, and resource cleanup. Canvas visual output is NOT tested
// (per CLAUDE.md rules).
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DepthChartRenderer } from './DepthChartRenderer';
import { useDepthStore } from '@/stores/depthStore';

// -----------------------------------------------------------------------------
// Mock CanvasRenderingContext2D
// -----------------------------------------------------------------------------

function createMockCanvas(): HTMLCanvasElement {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getBoundingClientRect: vi.fn(() => ({
      left: 0,
      top: 0,
      width: 400,
      height: 300,
      right: 400,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON: vi.fn(),
    })),
  } as unknown as HTMLCanvasElement;
}

function createMockCtx(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
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
    fill: vi.fn(),
    closePath: vi.fn(),
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
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    canvas,
  } as unknown as CanvasRenderingContext2D;
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('DepthChartRenderer', () => {
  let renderer: DepthChartRenderer;
  let ctx: CanvasRenderingContext2D;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = createMockCanvas();
    ctx = createMockCtx(canvas);
    renderer = new DepthChartRenderer(ctx, canvas);
    useDepthStore.getState().reset();
  });

  it('attaches mousemove and mouseleave listeners on construction', () => {
    expect(canvas.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(canvas.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
  });

  it('does not draw when lastUpdateId has not changed', () => {
    renderer.setSize(400, 300);

    const callCountAfterSetSize = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;

    // onFrame with no store change
    renderer.onFrame();

    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      callCountAfterSetSize,
    );
  });

  it('draws when lastUpdateId changes (depth store updated)', () => {
    renderer.setSize(400, 300);

    const callCountAfterSetSize = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;

    // Update depth store with new data
    useDepthStore.getState().setSnapshot(
      [
        { price: 100, quantity: 10 },
        { price: 99, quantity: 20 },
      ],
      [
        { price: 101, quantity: 15 },
        { price: 102, quantity: 25 },
      ],
      42,
    );

    renderer.onFrame();

    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
      callCountAfterSetSize,
    );
  });

  it('is independent of isDirty/markClean (OrderBookRenderer does not affect it)', () => {
    renderer.setSize(400, 300);

    // Set data with a known lastUpdateId
    useDepthStore
      .getState()
      .setSnapshot([{ price: 100, quantity: 10 }], [{ price: 101, quantity: 15 }], 1);

    renderer.onFrame();

    // OrderBookRenderer calls markClean — should not affect DepthChartRenderer
    useDepthStore.getState().markClean();
    expect(useDepthStore.getState().isDirty).toBe(false);

    const callCountAfterFirstDraw = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;

    // onFrame again — lastUpdateId hasn't changed, so should NOT draw
    renderer.onFrame();

    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      callCountAfterFirstDraw,
    );
  });

  it('setSize triggers a draw (fillRect is called)', () => {
    renderer.setSize(400, 300);

    // fillRect should have been called at minimum for the background clear
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('handles empty bids and asks without crashing', () => {
    renderer.setSize(400, 300);

    // No data set — store is empty
    expect(() => renderer.onFrame()).not.toThrow();
  });

  it('destroy removes event listeners without error', () => {
    expect(() => renderer.destroy()).not.toThrow();

    expect(canvas.removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(canvas.removeEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
  });

  it('setColors marks dirty for next frame redraw', () => {
    renderer.setSize(400, 300);

    // Set data so draw() produces output
    useDepthStore
      .getState()
      .setSnapshot([{ price: 100, quantity: 10 }], [{ price: 101, quantity: 15 }], 1);
    renderer.onFrame();

    const callCountBefore = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;

    // Change colors — should force redraw on next onFrame
    renderer.setColors({ background: '#000000' });
    renderer.onFrame();

    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
      callCountBefore,
    );
  });

  it('does not draw when canvas size is zero', () => {
    renderer.setSize(0, 0);

    useDepthStore
      .getState()
      .setSnapshot([{ price: 100, quantity: 10 }], [{ price: 101, quantity: 15 }], 1);

    renderer.onFrame();

    // fillRect should NOT be called (zero-size guard)
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('markDirty forces a redraw on the next onFrame', () => {
    renderer.setSize(400, 300);

    useDepthStore
      .getState()
      .setSnapshot([{ price: 100, quantity: 10 }], [{ price: 101, quantity: 15 }], 1);
    renderer.onFrame();

    const callCountBefore = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;

    // markDirty resets lastRenderedUpdateId to -1
    renderer.markDirty();
    renderer.onFrame();

    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
      callCountBefore,
    );
  });

  it('rebuilds gradients on setSize', () => {
    renderer.setSize(400, 300);

    expect(ctx.createLinearGradient).toHaveBeenCalled();
  });
});
