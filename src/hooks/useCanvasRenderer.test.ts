// =============================================================================
// useCanvasRenderer Tests
// =============================================================================
// Tests that the hook correctly manages the full lifecycle of a Canvas 2D
// renderer: initialization, rAF loop, visibility handling, resize, and cleanup.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { RefObject } from 'react';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

vi.mock('./useResizeObserver', () => ({
  useResizeObserver: vi.fn(() => ({ width: 800, height: 600 })),
}));

import { useCanvasRenderer, type CanvasRenderer } from './useCanvasRenderer';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function createMockRenderer(): CanvasRenderer {
  return {
    setSize: vi.fn(),
    onFrame: vi.fn(),
    markDirty: vi.fn(),
    destroy: vi.fn(),
  };
}

function createMockCanvas(): HTMLCanvasElement {
  const mockCtx = {
    setTransform: vi.fn(),
    scale: vi.fn(),
  } as unknown as CanvasRenderingContext2D;

  return {
    getContext: vi.fn(() => mockCtx),
    width: 0,
    height: 0,
    style: { width: '', height: '' },
  } as unknown as HTMLCanvasElement;
}

function createMockContainer(): HTMLElement {
  return document.createElement('div');
}

// Track requestAnimationFrame and cancelAnimationFrame calls
let rafCallbacks: Array<{ id: number; callback: FrameRequestCallback }> = [];
let nextRafId = 1;
let originalRAF: typeof requestAnimationFrame;
let originalCAF: typeof cancelAnimationFrame;
let originalDPR: number;

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('useCanvasRenderer', () => {
  let mockRenderer: CanvasRenderer;
  let mockCanvas: HTMLCanvasElement;
  let mockContainer: HTMLElement;
  let canvasRef: RefObject<HTMLCanvasElement | null>;
  let containerRef: RefObject<HTMLElement | null>;
  let createRendererFn: (ctx: CanvasRenderingContext2D) => CanvasRenderer;

  beforeEach(() => {
    rafCallbacks = [];
    nextRafId = 1;

    originalRAF = globalThis.requestAnimationFrame;
    originalCAF = globalThis.cancelAnimationFrame;
    originalDPR = window.devicePixelRatio;

    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = nextRafId++;
      rafCallbacks.push({ id, callback });
      return id;
    });

    globalThis.cancelAnimationFrame = vi.fn((id: number) => {
      rafCallbacks = rafCallbacks.filter((entry) => entry.id !== id);
    });

    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });

    mockRenderer = createMockRenderer();
    mockCanvas = createMockCanvas();
    mockContainer = createMockContainer();

    canvasRef = { current: mockCanvas };
    containerRef = { current: mockContainer };
    createRendererFn = vi.fn(() => mockRenderer);
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRAF;
    globalThis.cancelAnimationFrame = originalCAF;
    Object.defineProperty(window, 'devicePixelRatio', { value: originalDPR, configurable: true });
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Renderer initialization
  // ---------------------------------------------------------------------------

  describe('renderer initialization', () => {
    it('calls createRenderer when canvas ref is available', () => {
      renderHook(() =>
        useCanvasRenderer({ canvasRef, containerRef, createRenderer: createRendererFn }),
      );

      expect(createRendererFn).toHaveBeenCalledWith(expect.any(Object));
    });

    it('stores renderer instance in returned ref', () => {
      const { result } = renderHook(() =>
        useCanvasRenderer({ canvasRef, containerRef, createRenderer: createRendererFn }),
      );

      expect(result.current.current).toBe(mockRenderer);
    });

    it('does not create renderer when canvas is null', () => {
      const nullCanvasRef = { current: null } as RefObject<HTMLCanvasElement | null>;

      renderHook(() =>
        useCanvasRenderer({
          canvasRef: nullCanvasRef,
          containerRef,
          createRenderer: createRendererFn,
        }),
      );

      expect(createRendererFn).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // rAF loop
  // ---------------------------------------------------------------------------

  describe('rAF loop', () => {
    it('starts rAF loop after renderer creation', () => {
      renderHook(() =>
        useCanvasRenderer({ canvasRef, containerRef, createRenderer: createRendererFn }),
      );

      expect(globalThis.requestAnimationFrame).toHaveBeenCalled();
    });

    it('calls renderer.onFrame on each rAF tick', () => {
      renderHook(() =>
        useCanvasRenderer({ canvasRef, containerRef, createRenderer: createRendererFn }),
      );

      // Execute the first rAF callback
      const entry = rafCallbacks[0];
      if (entry) {
        entry.callback(performance.now());
      }

      expect(mockRenderer.onFrame).toHaveBeenCalled();
    });

    it('cancels rAF on unmount', () => {
      const { unmount } = renderHook(() =>
        useCanvasRenderer({ canvasRef, containerRef, createRenderer: createRendererFn }),
      );

      unmount();

      expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Visibility
  // ---------------------------------------------------------------------------

  describe('visibility', () => {
    it('registers visibilitychange listener', () => {
      const addEventSpy = vi.spyOn(document, 'addEventListener');

      renderHook(() =>
        useCanvasRenderer({ canvasRef, containerRef, createRenderer: createRendererFn }),
      );

      expect(addEventSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });

    it('stops rAF loop when tab is hidden', () => {
      renderHook(() =>
        useCanvasRenderer({ canvasRef, containerRef, createRenderer: createRendererFn }),
      );

      // Simulate tab hidden
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
    });

    it('restarts rAF loop and marks dirty when tab becomes visible', () => {
      renderHook(() =>
        useCanvasRenderer({ canvasRef, containerRef, createRenderer: createRendererFn }),
      );

      // Hide
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      // Show
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(mockRenderer.markDirty).toHaveBeenCalled();
      // rAF should have been called again after visibility restore
      expect(
        (globalThis.requestAnimationFrame as ReturnType<typeof vi.fn>).mock.calls.length,
      ).toBeGreaterThan(1);
    });

    it('removes visibilitychange listener on unmount', () => {
      const removeEventSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useCanvasRenderer({ canvasRef, containerRef, createRenderer: createRendererFn }),
      );

      unmount();

      expect(removeEventSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });
  });

  // ---------------------------------------------------------------------------
  // Canvas resize
  // ---------------------------------------------------------------------------

  describe('canvas resize', () => {
    it('scales canvas dimensions by devicePixelRatio', () => {
      renderHook(() =>
        useCanvasRenderer({ canvasRef, containerRef, createRenderer: createRendererFn }),
      );

      expect(mockCanvas.width).toBe(Math.round(800 * 2));
      expect(mockCanvas.height).toBe(Math.round(600 * 2));
    });

    it('sets CSS display size to logical pixels', () => {
      renderHook(() =>
        useCanvasRenderer({ canvasRef, containerRef, createRenderer: createRendererFn }),
      );

      expect(mockCanvas.style.width).toBe('800px');
      expect(mockCanvas.style.height).toBe('600px');
    });

    it('calls renderer.setSize with logical dimensions', () => {
      renderHook(() =>
        useCanvasRenderer({ canvasRef, containerRef, createRenderer: createRendererFn }),
      );

      expect(mockRenderer.setSize).toHaveBeenCalledWith(800, 600);
    });
  });

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  describe('cleanup', () => {
    it('calls renderer.destroy on unmount', () => {
      const { unmount } = renderHook(() =>
        useCanvasRenderer({ canvasRef, containerRef, createRenderer: createRendererFn }),
      );

      unmount();

      expect(mockRenderer.destroy).toHaveBeenCalled();
    });

    it('sets rendererRef to null on unmount', () => {
      const { result, unmount } = renderHook(() =>
        useCanvasRenderer({ canvasRef, containerRef, createRenderer: createRendererFn }),
      );

      unmount();

      expect(result.current.current).toBeNull();
    });

    it('cancels rAF and removes listener on unmount', () => {
      const removeEventSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useCanvasRenderer({ canvasRef, containerRef, createRenderer: createRendererFn }),
      );

      unmount();

      expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
      expect(removeEventSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });
  });
});
