'use client';

// =============================================================================
// IndicatorToggle Component
// =============================================================================
// Dropdown button for toggling technical indicators on the candlestick chart.
// Renders in the WidgetWrapper header via the headerActions slot.
//
// Indicators are grouped into two categories:
//   - Overlays: SMA, EMA, Bollinger Bands (rendered on the price pane)
//   - Oscillators: RSI, Volume (rendered in sub-plot panes)
// =============================================================================

import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useIndicatorStore } from '@/stores/indicatorStore';
import type { IndicatorConfig } from '@/types/indicator';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getIndicatorLabel(config: IndicatorConfig): string {
  switch (config.type) {
    case 'sma':
      return `SMA (${config.period})`;
    case 'ema':
      return `EMA (${config.period})`;
    case 'bollingerBands':
      return `BB (${config.period})`;
    case 'rsi':
      return `RSI (${config.period})`;
    case 'volume':
      return 'Volume';
  }
}

function getIndicatorColor(config: IndicatorConfig): string {
  switch (config.type) {
    case 'sma':
    case 'ema':
    case 'rsi':
      return config.color;
    case 'bollingerBands':
      return config.middleColor;
    case 'volume':
      return config.maColor;
  }
}

function isOverlay(config: IndicatorConfig): boolean {
  return config.type === 'sma' || config.type === 'ema' || config.type === 'bollingerBands';
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

interface IndicatorRowProps {
  config: IndicatorConfig;
  onToggle: () => void;
}

const IndicatorRow = memo(function IndicatorRow({ config, onToggle }: IndicatorRowProps) {
  const color = getIndicatorColor(config);

  return (
    <button
      type="button"
      onClick={onToggle}
      className="hover:bg-background-tertiary flex w-full cursor-pointer items-center gap-1.5 px-2.5 py-[5px] transition-colors"
    >
      {/* Checkbox */}
      <div
        className="flex shrink-0 items-center justify-center rounded-sm border"
        style={{
          width: 12,
          height: 12,
          ...(config.visible ? { borderColor: color, backgroundColor: color } : {}),
        }}
      >
        {config.visible && (
          <svg
            width="8"
            height="8"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={3}
            stroke="white"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
      </div>

      {/* Color swatch */}
      <span
        className="shrink-0 rounded-full"
        style={{ width: 10, height: 3, backgroundColor: color }}
      />

      {/* Label */}
      <span
        style={{ fontSize: 11, lineHeight: '16px' }}
        className={`flex-1 text-left ${
          config.visible ? 'text-foreground font-medium' : 'text-foreground-secondary'
        }`}
      >
        {getIndicatorLabel(config)}
      </span>
    </button>
  );
});

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const IndicatorToggle = memo(function IndicatorToggle() {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const indicators = useIndicatorStore((state) => state.indicators);
  const indicatorOrder = useIndicatorStore((state) => state.indicatorOrder);
  const toggleIndicator = useIndicatorStore((state) => state.toggleIndicator);

  const { overlays, oscillators } = useMemo(() => {
    const overlayList: IndicatorConfig[] = [];
    const oscillatorList: IndicatorConfig[] = [];
    for (const id of indicatorOrder) {
      const config = indicators[id];
      if (!config) continue;
      if (isOverlay(config)) {
        overlayList.push(config);
      } else {
        oscillatorList.push(config);
      }
    }
    return { overlays: overlayList, oscillators: oscillatorList };
  }, [indicators, indicatorOrder]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent): void => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleToggleIndicator = useCallback(
    (id: string) => () => {
      toggleIndicator(id);
    },
    [toggleIndicator],
  );

  const activeCount = Object.values(indicators).filter((c) => c.visible).length;

  return (
    <div ref={popoverRef} className="relative" style={{ fontSize: 11 }}>
      <button
        type="button"
        onClick={handleToggleOpen}
        className={`flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
          activeCount > 0
            ? 'text-accent hover:text-accent/80'
            : 'text-foreground-secondary hover:text-foreground'
        }`}
        style={{ fontSize: 10 }}
        aria-label="Toggle indicators"
        aria-expanded={isOpen}
      >
        <svg
          width="12"
          height="12"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
          />
        </svg>
        <span>Indicators</span>
        {activeCount > 0 && (
          <span
            className="bg-accent flex items-center justify-center rounded-full font-bold text-white"
            style={{ fontSize: 9, height: 14, minWidth: 14, padding: '0 3px' }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="border-border bg-background-secondary absolute top-full right-0 z-50 mt-1 overflow-hidden rounded-md border shadow-xl"
          style={{ width: 160, fontSize: 11 }}
        >
          {/* Overlays Section */}
          <div className="border-border border-b">
            <div
              className="text-foreground-tertiary px-2.5 pt-1.5 pb-0.5 font-semibold uppercase"
              style={{ fontSize: 9, letterSpacing: '0.05em' }}
            >
              Overlays
            </div>
            {overlays.map((config) => (
              <IndicatorRow
                key={config.id}
                config={config}
                onToggle={handleToggleIndicator(config.id)}
              />
            ))}
          </div>

          {/* Oscillators Section */}
          <div>
            <div
              className="text-foreground-tertiary px-2.5 pt-1.5 pb-0.5 font-semibold uppercase"
              style={{ fontSize: 9, letterSpacing: '0.05em' }}
            >
              Oscillators
            </div>
            {oscillators.map((config) => (
              <IndicatorRow
                key={config.id}
                config={config}
                onToggle={handleToggleIndicator(config.id)}
              />
            ))}
            <div style={{ height: 2 }} />
          </div>
        </div>
      )}
    </div>
  );
});
