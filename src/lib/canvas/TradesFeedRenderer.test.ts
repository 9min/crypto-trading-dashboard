// =============================================================================
// TradesFeedRenderer Tests
// =============================================================================
// Tests dirty detection logic (trade ID tracking) and data transformation.
// Canvas visual output is NOT tested (per CLAUDE.md rules).
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TradesFeedRenderer } from './TradesFeedRenderer';
import { useTradeStore } from '@/stores/tradeStore';

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

describe('TradesFeedRenderer', () => {
  let renderer: TradesFeedRenderer;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = createMockCtx();
    renderer = new TradesFeedRenderer(ctx);
    useTradeStore.getState().reset();
  });

  it('does not draw when there are no trades', () => {
    renderer.setSize(300, 400);

    const callCountAfterSetSize = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;
    renderer.onFrame();

    // No new calls because trades is empty
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      callCountAfterSetSize,
    );
  });

  it('draws when a new trade arrives', () => {
    renderer.setSize(300, 400);

    useTradeStore.getState().addTrade({
      id: 1,
      price: 50000,
      quantity: 0.5,
      time: Date.now(),
      isBuyerMaker: false,
    });

    const callCountBefore = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;
    renderer.onFrame();

    // fillRect should have been called for background + header + rows
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
      callCountBefore,
    );
  });

  it('does not redraw when trade ID has not changed', () => {
    renderer.setSize(300, 400);

    useTradeStore.getState().addTrade({
      id: 42,
      price: 50000,
      quantity: 1.0,
      time: Date.now(),
      isBuyerMaker: true,
    });

    // First frame — should draw
    renderer.onFrame();
    const callCountAfterFirst = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;

    // Second frame — same trade ID, should not draw
    renderer.onFrame();
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCountAfterFirst);
  });

  it('redraws when a newer trade arrives', () => {
    renderer.setSize(300, 400);

    useTradeStore.getState().addTrade({
      id: 1,
      price: 50000,
      quantity: 0.5,
      time: Date.now(),
      isBuyerMaker: false,
    });

    renderer.onFrame();
    const callCountAfterFirst = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;

    useTradeStore.getState().addTrade({
      id: 2,
      price: 50100,
      quantity: 0.3,
      time: Date.now(),
      isBuyerMaker: true,
    });

    renderer.onFrame();
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
      callCountAfterFirst,
    );
  });

  it('setSize resets the last rendered trade ID (forces redraw)', () => {
    renderer.setSize(300, 400);

    useTradeStore.getState().addTrade({
      id: 10,
      price: 50000,
      quantity: 1.0,
      time: Date.now(),
      isBuyerMaker: false,
    });

    renderer.onFrame();
    const callCountAfterDraw = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;

    // Resize should force a redraw even though trade ID hasn't changed
    renderer.setSize(400, 500);
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
      callCountAfterDraw,
    );
  });

  it('destroy is callable without error', () => {
    expect(() => renderer.destroy()).not.toThrow();
  });

  it('setColors forces a redraw on next frame', () => {
    renderer.setSize(300, 400);

    useTradeStore.getState().addTrade({
      id: 5,
      price: 50000,
      quantity: 0.5,
      time: Date.now(),
      isBuyerMaker: false,
    });

    renderer.onFrame();
    const callCountAfterFirst = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;

    renderer.setColors({ background: '#000000' });

    // Same trade ID, but setColors reset lastRenderedTradeId → should redraw
    renderer.onFrame();
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
      callCountAfterFirst,
    );
  });
});
