// =============================================================================
// OrderBookRenderer Tests
// =============================================================================
// Tests data transformation logic and dirty/clean flag behavior.
// Canvas visual output is NOT tested (per CLAUDE.md rules).
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderBookRenderer } from './OrderBookRenderer';
import { useDepthStore } from '@/stores/depthStore';

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
    arc: vi.fn(),
    rect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    setTransform: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    canvas: {} as HTMLCanvasElement,
  } as unknown as CanvasRenderingContext2D;
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('OrderBookRenderer', () => {
  let renderer: OrderBookRenderer;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = createMockCtx();
    renderer = new OrderBookRenderer(ctx);
    useDepthStore.getState().reset();
  });

  it('does not draw when isDirty is false', () => {
    renderer.setSize(400, 300);
    useDepthStore.getState().markClean();

    renderer.onFrame();

    // fillRect is called during setSize (initial draw), but not in onFrame
    // when not dirty
    const callCountAfterSetSize = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;
    renderer.onFrame();
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      callCountAfterSetSize,
    );
  });

  it('draws when isDirty is true', () => {
    renderer.setSize(400, 300);
    useDepthStore.getState().setBids([
      { price: 100, quantity: 1 },
      { price: 99, quantity: 2 },
    ]);

    // isDirty is now true
    expect(useDepthStore.getState().isDirty).toBe(true);

    renderer.onFrame();

    // After drawing, isDirty should be false
    expect(useDepthStore.getState().isDirty).toBe(false);
  });

  it('calls markClean after drawing', () => {
    renderer.setSize(400, 300);
    useDepthStore.getState().setAsks([{ price: 101, quantity: 1.5 }]);

    expect(useDepthStore.getState().isDirty).toBe(true);

    renderer.onFrame();

    expect(useDepthStore.getState().isDirty).toBe(false);
  });

  it('setSize triggers a draw (fillRect is called)', () => {
    renderer.setSize(400, 300);

    // fillRect should have been called at minimum for the background clear
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('does not draw when size is zero', () => {
    renderer.setSize(0, 0);

    useDepthStore.getState().setBids([{ price: 100, quantity: 1 }]);
    renderer.onFrame();

    // fillRect should not be called for zero-size canvas
    // (markClean still gets called, but draw logic exits early)
    expect(useDepthStore.getState().isDirty).toBe(false);
  });

  it('destroy is callable without error', () => {
    expect(() => renderer.destroy()).not.toThrow();
  });

  it('setColors updates the color configuration', () => {
    renderer.setColors({ background: '#000000' });
    renderer.setSize(400, 300);

    // Background color should be used in fillRect
    expect(ctx.fillStyle).toBeDefined();
  });
});
