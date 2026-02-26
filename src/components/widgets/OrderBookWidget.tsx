'use client';

// =============================================================================
// OrderBookWidget Component
// =============================================================================
// Renders the order book using Canvas 2D via the OrderBookRenderer.
// The canvas is managed by the useCanvasRenderer hook which handles:
// - devicePixelRatio scaling
// - ResizeObserver-based resizing
// - requestAnimationFrame loop
// - Cleanup on unmount
// =============================================================================

import { memo, useRef, useCallback, useEffect } from 'react';
import { useCanvasRenderer } from '@/hooks/useCanvasRenderer';
import { OrderBookRenderer, getOrderBookColors } from '@/lib/canvas/OrderBookRenderer';
import { useUiStore } from '@/stores/uiStore';
import { WidgetWrapper } from './WidgetWrapper';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const OrderBookWidget = memo(function OrderBookWidget() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useUiStore((state) => state.theme);

  const createRenderer = useCallback((ctx: CanvasRenderingContext2D) => {
    return new OrderBookRenderer(ctx);
  }, []);

  const rendererRef = useCanvasRenderer({
    canvasRef,
    containerRef,
    createRenderer,
  });

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setColors(getOrderBookColors(theme));
    renderer.markDirty();
  }, [theme, rendererRef]);

  return (
    <WidgetWrapper title="Order Book">
      <div ref={containerRef} className="h-full w-full">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
    </WidgetWrapper>
  );
});
