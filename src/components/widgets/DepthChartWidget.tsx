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

import { memo, useRef, useCallback, useEffect } from 'react';
import { useCanvasRenderer } from '@/hooks/useCanvasRenderer';
import { DepthChartRenderer, getDepthChartColors } from '@/lib/canvas/DepthChartRenderer';
import { useUiStore } from '@/stores/uiStore';
import { WidgetWrapper } from './WidgetWrapper';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const DepthChartWidget = memo(function DepthChartWidget() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useUiStore((state) => state.theme);

  const createRenderer = useCallback((ctx: CanvasRenderingContext2D) => {
    return new DepthChartRenderer(ctx, ctx.canvas);
  }, []);

  const rendererRef = useCanvasRenderer({
    canvasRef,
    containerRef,
    createRenderer,
  });

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setColors(getDepthChartColors(theme));
    renderer.markDirty();
  }, [theme, rendererRef]);

  return (
    <WidgetWrapper title="Depth Chart">
      <div ref={containerRef} className="h-full w-full">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
    </WidgetWrapper>
  );
});
