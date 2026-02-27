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

import { memo, useRef, useCallback, useEffect, useMemo } from 'react';
import { useCanvasRenderer } from '@/hooks/useCanvasRenderer';
import { TradesFeedRenderer, getTradesFeedColors } from '@/lib/canvas/TradesFeedRenderer';
import { useUiStore } from '@/stores/uiStore';
import { useTradeStore } from '@/stores/tradeStore';
import { WHALE_THRESHOLD_OPTIONS } from '@/utils/constants';
import { WidgetWrapper } from './WidgetWrapper';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// WhaleThresholdSelector (sub-component)
// -----------------------------------------------------------------------------

interface ThresholdButtonProps {
  value: number;
  label: string;
  isActive: boolean;
  onClick: (value: number) => void;
}

const ThresholdButton = memo(function ThresholdButton({
  value,
  label,
  isActive,
  onClick,
}: ThresholdButtonProps) {
  const handleClick = useCallback(() => {
    onClick(value);
  }, [onClick, value]);

  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={handleClick}
      className={`cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
        isActive
          ? 'bg-background-tertiary text-accent'
          : 'text-foreground-tertiary hover:text-foreground-secondary'
      }`}
    >
      {label}
    </button>
  );
});

const WhaleThresholdSelector = memo(function WhaleThresholdSelector() {
  const whaleThreshold = useTradeStore((state) => state.whaleThreshold);
  const setWhaleThreshold = useTradeStore((state) => state.setWhaleThreshold);

  const thresholdLabels = useMemo(
    () =>
      WHALE_THRESHOLD_OPTIONS.map((value) => ({
        value,
        label: value >= 1_000_000 ? `$${value / 1_000_000}M` : `$${value / 1_000}K`,
      })),
    [],
  );

  return (
    <div className="flex items-center gap-0.5">
      <svg
        className="text-foreground-tertiary mr-0.5 h-3 w-3"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
        />
      </svg>
      {thresholdLabels.map(({ value, label }) => (
        <ThresholdButton
          key={value}
          value={value}
          label={label}
          isActive={value === whaleThreshold}
          onClick={setWhaleThreshold}
        />
      ))}
    </div>
  );
});

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

  const headerActions = useMemo(() => <WhaleThresholdSelector />, []);

  return (
    <WidgetWrapper title="Trades" headerActions={headerActions}>
      <div ref={containerRef} className="h-full w-full">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
    </WidgetWrapper>
  );
});
