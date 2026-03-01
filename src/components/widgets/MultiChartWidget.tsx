'use client';

// =============================================================================
// MultiChartWidget Component
// =============================================================================
// Container widget for displaying 2-4 chart panels in a CSS Grid layout.
// Each panel is an independent ChartPanel with its own WebSocket connection
// and chart instance. Crosshair movement can be synchronized across panels.
//
// Layout modes:
//   - '2x1': Two charts side by side
//   - '1x2': Two charts stacked vertically
//   - '2x2': Four charts in a 2x2 grid
// =============================================================================

import { memo, useMemo, useCallback } from 'react';
import { useMultiChartStore } from '@/stores/multiChartStore';
import { ChartSyncHub } from '@/lib/chart/ChartSyncHub';
import { ChartPanel } from './ChartPanel';
import { WidgetWrapper } from './WidgetWrapper';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import type { MultiChartLayout } from '@/types/multiChart';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface LayoutOption {
  value: MultiChartLayout;
  label: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const LAYOUT_OPTIONS: LayoutOption[] = [
  { value: '2x1', label: '2x1' },
  { value: '1x2', label: '1x2' },
  { value: '2x2', label: '2x2' },
];

const GRID_STYLES: Record<MultiChartLayout, React.CSSProperties> = {
  '2x1': {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr',
    gap: '2px',
  },
  '1x2': {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr 1fr',
    gap: '2px',
  },
  '2x2': {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr 1fr',
    gap: '2px',
  },
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const MultiChartWidget = memo(function MultiChartWidget() {
  const layout = useMultiChartStore((state) => state.layout);
  const panels = useMultiChartStore((state) => state.panels);
  const crosshairSync = useMultiChartStore((state) => state.crosshairSync);
  const intervalSync = useMultiChartStore((state) => state.intervalSync);
  const setLayout = useMultiChartStore((state) => state.setLayout);
  const toggleCrosshairSync = useMultiChartStore((state) => state.toggleCrosshairSync);
  const toggleIntervalSync = useMultiChartStore((state) => state.toggleIntervalSync);

  // Single hub instance per widget mount — shared across all panels
  const syncHub = useMemo(() => new ChartSyncHub(), []);

  const gridStyle = useMemo(() => GRID_STYLES[layout], [layout]);

  const handleLayoutChange = useCallback(
    (newLayout: MultiChartLayout) => {
      setLayout(newLayout);
    },
    [setLayout],
  );

  // Header actions
  const headerActions = useMemo(
    () => (
      <div className="flex items-center gap-1.5">
        {/* Layout toggle */}
        <div className="flex items-center gap-0.5">
          {LAYOUT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleLayoutChange(option.value)}
              className={`cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                layout === option.value
                  ? 'bg-accent text-white'
                  : 'text-foreground-tertiary hover:text-foreground-secondary'
              }`}
              aria-label={`Switch to ${option.label} layout`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="bg-border h-3 w-px" />

        {/* Crosshair sync toggle */}
        <button
          type="button"
          onClick={toggleCrosshairSync}
          className={`cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
            crosshairSync
              ? 'bg-accent/20 text-accent'
              : 'text-foreground-tertiary hover:text-foreground-secondary'
          }`}
          aria-label={crosshairSync ? 'Disable crosshair sync' : 'Enable crosshair sync'}
          title="Crosshair Sync"
        >
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>

        {/* Interval sync toggle */}
        <button
          type="button"
          onClick={toggleIntervalSync}
          className={`cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
            intervalSync
              ? 'bg-accent/20 text-accent'
              : 'text-foreground-tertiary hover:text-foreground-secondary'
          }`}
          aria-label={intervalSync ? 'Disable interval sync' : 'Enable interval sync'}
          title="Interval Sync"
        >
          IV
        </button>
      </div>
    ),
    [
      layout,
      crosshairSync,
      intervalSync,
      handleLayoutChange,
      toggleCrosshairSync,
      toggleIntervalSync,
    ],
  );

  return (
    <WidgetWrapper title="Multi Chart" headerActions={headerActions}>
      <div className="h-full w-full" style={gridStyle}>
        {panels.map((panel) => (
          <div key={panel.id} className="border-border min-h-0 overflow-hidden border">
            <ErrorBoundary widgetName={`Chart ${panel.symbol}`}>
              <ChartPanel
                panelId={panel.id}
                symbol={panel.symbol}
                interval={panel.interval}
                syncHub={syncHub}
              />
            </ErrorBoundary>
          </div>
        ))}
      </div>
    </WidgetWrapper>
  );
});
