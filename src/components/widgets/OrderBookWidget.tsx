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

import { memo, useRef, useCallback } from 'react';
import { useCanvasRenderer } from '@/hooks/useCanvasRenderer';
import { OrderBookRenderer } from '@/lib/canvas/OrderBookRenderer';
import { WidgetWrapper } from './WidgetWrapper';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const OrderBookWidget = memo(function OrderBookWidget() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const createRenderer = useCallback((ctx: CanvasRenderingContext2D) => {
    return new OrderBookRenderer(ctx);
  }, []);

  useCanvasRenderer({
    canvasRef,
    containerRef,
    createRenderer,
  });

  return (
    <WidgetWrapper title="Order Book">
      <div ref={containerRef} className="h-full w-full">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
    </WidgetWrapper>
  );
});
