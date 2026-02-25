'use client';

// =============================================================================
// IntervalSelector Component
// =============================================================================
// Pill-style tab buttons for selecting the kline (candlestick) time interval.
// Active tab is highlighted with tertiary background color.
// =============================================================================

import { memo, useCallback } from 'react';
import { KLINE_INTERVALS, type KlineInterval } from '@/types/chart';
import { useKlineStore } from '@/stores/klineStore';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const IntervalSelector = memo(function IntervalSelector() {
  const interval = useKlineStore((state) => state.interval);
  const setInterval = useKlineStore((state) => state.setInterval);

  const handleClick = useCallback(
    (value: KlineInterval) => {
      setInterval(value);
    },
    [setInterval],
  );

  return (
    <div className="flex items-center gap-0.5">
      {KLINE_INTERVALS.map((value) => (
        <IntervalButton
          key={value}
          value={value}
          isActive={value === interval}
          onClick={handleClick}
        />
      ))}
    </div>
  );
});

// -----------------------------------------------------------------------------
// IntervalButton (sub-component)
// -----------------------------------------------------------------------------

interface IntervalButtonProps {
  value: KlineInterval;
  isActive: boolean;
  onClick: (value: KlineInterval) => void;
}

const IntervalButton = memo(function IntervalButton({
  value,
  isActive,
  onClick,
}: IntervalButtonProps) {
  const handleClick = useCallback(() => {
    onClick(value);
  }, [onClick, value]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`rounded px-2.5 py-0.5 text-xs font-medium transition-colors ${
        isActive
          ? 'border-accent bg-background-tertiary text-foreground border-b-2'
          : 'text-foreground-secondary hover:text-foreground'
      }`}
    >
      {value}
    </button>
  );
});
