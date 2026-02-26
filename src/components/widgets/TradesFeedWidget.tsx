'use client';

// =============================================================================
// TradesFeedWidget Component
// =============================================================================
// Renders the recent trades feed using Canvas 2D via the TradesFeedRenderer.
// The canvas is managed by the useCanvasRenderer hook which handles:
// - devicePixelRatio scaling
// - ResizeObserver-based resizing
// - requestAnimationFrame loop
// - Cleanup on unmount
// =============================================================================

import { memo, useRef, useCallback, useEffect } from 'react';
import { useCanvasRenderer } from '@/hooks/useCanvasRenderer';
import { TradesFeedRenderer, getTradesFeedColors } from '@/lib/canvas/TradesFeedRenderer';
import { useUiStore } from '@/stores/uiStore';
import { WidgetWrapper } from './WidgetWrapper';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const TradesFeedWidget = memo(function TradesFeedWidget() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useUiStore((state) => state.theme);

  const createRenderer = useCallback((ctx: CanvasRenderingContext2D) => {
    return new TradesFeedRenderer(ctx);
  }, []);

  const rendererRef = useCanvasRenderer({
    canvasRef,
    containerRef,
    createRenderer,
  });

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setColors(getTradesFeedColors(theme));
    renderer.markDirty();
  }, [theme, rendererRef]);

  return (
    <WidgetWrapper title="Trades">
      <div ref={containerRef} className="h-full w-full">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
    </WidgetWrapper>
  );
});
