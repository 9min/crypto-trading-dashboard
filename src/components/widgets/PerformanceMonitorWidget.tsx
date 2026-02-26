'use client';

// =============================================================================
// PerformanceMonitorWidget Component
// =============================================================================
// Renders real-time performance metrics using Canvas 2D via the
// PerformanceMonitorRenderer. Tracks FPS, JS Heap, Canvas draw times,
// and DOM node count against CLAUDE.md performance targets.
//
// The canvas is managed by the useCanvasRenderer hook which handles:
// - devicePixelRatio scaling
// - ResizeObserver-based resizing
// - requestAnimationFrame loop
// - Cleanup on unmount
// =============================================================================

import { memo, useRef, useCallback, useEffect } from 'react';
import { useCanvasRenderer } from '@/hooks/useCanvasRenderer';
import {
  PerformanceMonitorRenderer,
  getPerformanceMonitorColors,
} from '@/lib/canvas/PerformanceMonitorRenderer';
import { useUiStore } from '@/stores/uiStore';
import { WidgetWrapper } from './WidgetWrapper';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const PerformanceMonitorWidget = memo(function PerformanceMonitorWidget() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useUiStore((state) => state.theme);

  const createRenderer = useCallback((ctx: CanvasRenderingContext2D) => {
    return new PerformanceMonitorRenderer(ctx);
  }, []);

  const rendererRef = useCanvasRenderer({
    canvasRef,
    containerRef,
    createRenderer,
  });

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setColors(getPerformanceMonitorColors(theme));
    renderer.markDirty();
  }, [theme, rendererRef]);

  return (
    <WidgetWrapper title="Performance">
      <div ref={containerRef} className="h-full w-full">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
    </WidgetWrapper>
  );
});
