// =============================================================================
// useCanvasRenderer Hook
// =============================================================================
// Generic hook that manages the full lifecycle of a Canvas 2D renderer:
// - Acquires and scales the canvas context (devicePixelRatio)
// - Starts/stops a requestAnimationFrame render loop
// - Resizes the canvas when its container changes dimensions
// - Cleans up all resources on unmount
//
// The renderer instance is created once via `createRenderer` and destroyed
// on unmount. The rAF loop calls `onFrame` every frame — the renderer
// decides internally whether to draw (dirty flag pattern).
// =============================================================================

import { useEffect, useRef, type RefObject } from 'react';
import { useResizeObserver } from './useResizeObserver';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Minimal interface a canvas renderer must implement. */
interface CanvasRenderer {
  /** Called when the canvas is resized. Renderer should update its internal dimensions. */
  setSize: (width: number, height: number) => void;
  /** Called once per rAF frame. Renderer decides whether to draw (dirty flag). */
  onFrame: () => void;
  /** Force the renderer to draw on the next frame (e.g., after tab visibility change). */
  markDirty: () => void;
  /** Tear down all internal resources. */
  destroy: () => void;
}

/** Configuration for the useCanvasRenderer hook. */
interface UseCanvasRendererOptions<T extends CanvasRenderer> {
  /** Ref to the <canvas> element */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Ref to the container element that determines the canvas size */
  containerRef: RefObject<HTMLElement | null>;
  /** Factory function to create the renderer instance given a 2D context */
  createRenderer: (ctx: CanvasRenderingContext2D) => T;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Manages the full lifecycle of a Canvas 2D renderer.
 *
 * @returns A ref to the renderer instance (null until canvas is ready).
 *          Useful for imperative calls like updating renderer config.
 */
export function useCanvasRenderer<T extends CanvasRenderer>({
  canvasRef,
  containerRef,
  createRenderer,
}: UseCanvasRendererOptions<T>): RefObject<T | null> {
  const rendererRef = useRef<T | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const size = useResizeObserver(containerRef);

  // -- Initialize renderer and start rAF loop --------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderer = createRenderer(ctx);
    rendererRef.current = renderer;

    let isRunning = true;

    // rAF loop — paused when tab is hidden (CLAUDE.md requirement)
    const loop = (): void => {
      if (!isRunning) return;
      renderer.onFrame();
      rafIdRef.current = requestAnimationFrame(loop);
    };
    rafIdRef.current = requestAnimationFrame(loop);

    const startLoop = (): void => {
      if (isRunning) return;
      isRunning = true;
      // Force draw on next frame after visibility restore
      renderer.markDirty();
      rafIdRef.current = requestAnimationFrame(loop);
    };

    const stopLoop = (): void => {
      isRunning = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };

    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        stopLoop();
      } else {
        startLoop();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isRunning = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      renderer.destroy();
      rendererRef.current = null;
    };
    // createRenderer is intentionally omitted — it should be a stable reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef]);

  // -- Resize canvas and notify renderer --------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer || size.width === 0 || size.height === 0) return;

    const dpr = window.devicePixelRatio || 1;

    // Set physical pixel dimensions
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);

    // Set CSS display size
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    // Scale context so draw operations use CSS pixels
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    renderer.setSize(size.width, size.height);
  }, [canvasRef, size]);

  return rendererRef;
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export type { CanvasRenderer, UseCanvasRendererOptions };
