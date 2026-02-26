'use client';

// =============================================================================
// DepthChartWidget Component
// =============================================================================
// Renders the order book depth chart using Canvas 2D via DepthChartRenderer.
// Shows cumulative bid/ask volumes as a staircase area chart with crosshair
// interaction on mouse hover.
//
// The canvas is managed by the useCanvasRenderer hook which handles:
// - devicePixelRatio scaling
// - ResizeObserver-based resizing
// - requestAnimationFrame loop
// - Cleanup on unmount
// =============================================================================

import { memo, useRef, useCallback } from 'react';
import { useCanvasRenderer } from '@/hooks/useCanvasRenderer';
import { DepthChartRenderer } from '@/lib/canvas/DepthChartRenderer';
import { WidgetWrapper } from './WidgetWrapper';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const DepthChartWidget = memo(function DepthChartWidget() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const createRenderer = useCallback((ctx: CanvasRenderingContext2D) => {
    return new DepthChartRenderer(ctx, ctx.canvas);
  }, []);

  useCanvasRenderer({
    canvasRef,
    containerRef,
    createRenderer,
  });

  return (
    <WidgetWrapper title="Depth Chart">
      <div ref={containerRef} className="h-full w-full">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
    </WidgetWrapper>
  );
});
