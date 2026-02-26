'use client';

// =============================================================================
// DashboardGrid Component
// =============================================================================
// Responsive grid layout for dashboard widgets using react-grid-layout v2.
// Each widget is wrapped in an ErrorBoundary for fault isolation — a single
// widget crash never takes down the entire dashboard.
//
// Uses the hooks-based API: useContainerWidth for responsive width measurement
// and ResponsiveGridLayout for responsive breakpoint handling.
// =============================================================================

import { memo, useMemo, useState, useCallback, type ReactNode } from 'react';
import {
  ResponsiveGridLayout,
  useContainerWidth,
  type Layout,
  type ResponsiveLayouts,
} from 'react-grid-layout';
import { saveLayout, loadLayout } from '@/utils/layoutStorage';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { CandlestickWidget } from '@/components/widgets/CandlestickWidget';
import { OrderBookWidget } from '@/components/widgets/OrderBookWidget';
import { TradesFeedWidget } from '@/components/widgets/TradesFeedWidget';
import { WatchlistWidget } from '@/components/widgets/WatchlistWidget';
import { KimchiPremiumWidget } from '@/components/widgets/KimchiPremiumWidget';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface GridWidget {
  key: string;
  title: string;
  component: ReactNode;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const GRID_BREAKPOINTS = { lg: 1200, md: 768, sm: 480 } as const;
const GRID_COLS = { lg: 12, md: 10, sm: 6 } as const;
const GRID_ROW_HEIGHT = 30;
const GRID_MARGIN: [number, number] = [8, 8];

// Default layouts for each breakpoint
const DEFAULT_LAYOUTS: ResponsiveLayouts<'lg' | 'md' | 'sm'> = {
  lg: [
    { i: 'candlestick', x: 0, y: 0, w: 8, h: 14 },
    { i: 'orderbook', x: 8, y: 0, w: 4, h: 14 },
    { i: 'watchlist', x: 0, y: 14, w: 3, h: 11 },
    { i: 'trades', x: 3, y: 14, w: 6, h: 11 },
    { i: 'premium', x: 9, y: 14, w: 3, h: 11 },
  ],
  md: [
    { i: 'candlestick', x: 0, y: 0, w: 10, h: 12 },
    { i: 'orderbook', x: 0, y: 12, w: 5, h: 12 },
    { i: 'trades', x: 5, y: 12, w: 5, h: 12 },
    { i: 'watchlist', x: 0, y: 24, w: 5, h: 8 },
    { i: 'premium', x: 5, y: 24, w: 5, h: 8 },
  ],
  sm: [
    { i: 'candlestick', x: 0, y: 0, w: 6, h: 10 },
    { i: 'orderbook', x: 0, y: 10, w: 6, h: 10 },
    { i: 'trades', x: 0, y: 20, w: 6, h: 10 },
    { i: 'watchlist', x: 0, y: 30, w: 6, h: 8 },
    { i: 'premium', x: 0, y: 38, w: 6, h: 8 },
  ],
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const DashboardGrid = memo(function DashboardGrid() {
  const { width, containerRef, mounted } = useContainerWidth();

  const [layouts] = useState<ResponsiveLayouts<'lg' | 'md' | 'sm'>>(
    () => loadLayout() ?? DEFAULT_LAYOUTS,
  );

  const widgets: GridWidget[] = useMemo(
    () => [
      { key: 'candlestick', title: 'Chart', component: <CandlestickWidget /> },
      { key: 'orderbook', title: 'Order Book', component: <OrderBookWidget /> },
      { key: 'trades', title: 'Trades', component: <TradesFeedWidget /> },
      { key: 'watchlist', title: 'Watchlist', component: <WatchlistWidget /> },
      { key: 'premium', title: 'Kimchi Premium', component: <KimchiPremiumWidget /> },
    ],
    [],
  );

  const handleLayoutChange = useCallback(
    (_layout: Layout, allLayouts: ResponsiveLayouts<'lg' | 'md' | 'sm'>) => {
      saveLayout(allLayouts);
    },
    [],
  );

  return (
    <div ref={containerRef}>
      {mounted && (
        <ResponsiveGridLayout
          className="layout"
          width={width}
          layouts={layouts}
          breakpoints={GRID_BREAKPOINTS}
          cols={GRID_COLS}
          rowHeight={GRID_ROW_HEIGHT}
          margin={GRID_MARGIN}
          dragConfig={{ enabled: true, handle: '.widget-drag-handle' }}
          resizeConfig={{ enabled: true }}
          onLayoutChange={handleLayoutChange}
        >
          {widgets.map((widget) => (
            <div key={widget.key}>
              <ErrorBoundary widgetName={widget.title}>{widget.component}</ErrorBoundary>
            </div>
          ))}
        </ResponsiveGridLayout>
      )}
    </div>
  );
});
