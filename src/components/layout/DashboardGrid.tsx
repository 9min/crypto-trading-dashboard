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

import {
  memo,
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  ResponsiveGridLayout,
  useContainerWidth,
  type Layout,
  type ResponsiveLayouts,
} from 'react-grid-layout';
import { saveLayout, loadLayout, onCloudLayoutApplied } from '@/utils/layoutStorage';
import { useAuthStore } from '@/stores/authStore';
import { upsertPreferences } from '@/lib/supabase/preferencesService';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { CandlestickWidget } from '@/components/widgets/CandlestickWidget';
import { OrderBookWidget } from '@/components/widgets/OrderBookWidget';
import { TradesFeedWidget } from '@/components/widgets/TradesFeedWidget';
import { WatchlistWidget } from '@/components/widgets/WatchlistWidget';
import { KimchiPremiumWidget } from '@/components/widgets/KimchiPremiumWidget';
import { DepthChartWidget } from '@/components/widgets/DepthChartWidget';
import { PerformanceMonitorWidget } from '@/components/widgets/PerformanceMonitorWidget';

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
    // Row 1: Chart(9) + OrderBook(3) — primary data
    { i: 'candlestick', x: 0, y: 0, w: 9, h: 14 },
    { i: 'orderbook', x: 9, y: 0, w: 3, h: 14 },
    // Row 2: Watchlist(3) Trades(2) Depth(2) Premium(2) Perf(3) = 12
    { i: 'watchlist', x: 0, y: 14, w: 3, h: 10 },
    { i: 'trades', x: 3, y: 14, w: 2, h: 10 },
    { i: 'depth', x: 5, y: 14, w: 2, h: 10 },
    { i: 'premium', x: 7, y: 14, w: 2, h: 10 },
    { i: 'perf', x: 9, y: 14, w: 3, h: 10 },
  ],
  md: [
    // Row 1: Chart full-width
    { i: 'candlestick', x: 0, y: 0, w: 10, h: 12 },
    // Row 2: OrderBook + Depth side by side
    { i: 'orderbook', x: 0, y: 12, w: 5, h: 12 },
    { i: 'depth', x: 5, y: 12, w: 5, h: 12 },
    // Row 3: Watchlist + Trades + Premium + Perf
    { i: 'watchlist', x: 0, y: 24, w: 2, h: 10 },
    { i: 'trades', x: 2, y: 24, w: 3, h: 10 },
    { i: 'premium', x: 5, y: 24, w: 2, h: 10 },
    { i: 'perf', x: 7, y: 24, w: 3, h: 10 },
  ],
  sm: [
    // Single column stack — ordered by priority
    { i: 'candlestick', x: 0, y: 0, w: 6, h: 10 },
    { i: 'orderbook', x: 0, y: 10, w: 6, h: 10 },
    { i: 'watchlist', x: 0, y: 20, w: 6, h: 8 },
    { i: 'trades', x: 0, y: 28, w: 6, h: 8 },
    { i: 'depth', x: 0, y: 36, w: 6, h: 8 },
    { i: 'premium', x: 0, y: 44, w: 6, h: 8 },
    { i: 'perf', x: 0, y: 52, w: 6, h: 8 },
  ],
};

// -----------------------------------------------------------------------------
// useSyncExternalStore helpers (stable references to avoid re-subscriptions)
// -----------------------------------------------------------------------------

const emptySubscribe = (): (() => void) => () => {};
const getClientSnapshot = (): boolean => true;
const getServerSnapshot = (): boolean => false;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const DashboardGrid = memo(function DashboardGrid() {
  const { width, containerRef } = useContainerWidth();

  // Gate grid rendering to client-only. Server snapshot returns false so the
  // server HTML is always an empty <div>, preventing hydration mismatch from
  // react-grid-layout computing positions with a default width vs actual width.
  const isMounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);

  const [layouts, setLayouts] = useState<ResponsiveLayouts<'lg' | 'md' | 'sm'>>(
    () => loadLayout() ?? DEFAULT_LAYOUTS,
  );

  const widgets: GridWidget[] = useMemo(
    () => [
      { key: 'candlestick', title: 'Chart', component: <CandlestickWidget /> },
      { key: 'orderbook', title: 'Order Book', component: <OrderBookWidget /> },
      { key: 'trades', title: 'Trades', component: <TradesFeedWidget /> },
      { key: 'watchlist', title: 'Watchlist', component: <WatchlistWidget /> },
      { key: 'premium', title: 'Kimchi Premium', component: <KimchiPremiumWidget /> },
      { key: 'depth', title: 'Depth Chart', component: <DepthChartWidget /> },
      { key: 'perf', title: 'Performance', component: <PerformanceMonitorWidget /> },
    ],
    [],
  );

  const debouncedCloudSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLayoutChange = useCallback(
    (_layout: Layout, allLayouts: ResponsiveLayouts<'lg' | 'md' | 'sm'>) => {
      saveLayout(allLayouts);

      // Sync to Supabase if user is logged in (debounced)
      if (debouncedCloudSaveRef.current) {
        clearTimeout(debouncedCloudSaveRef.current);
      }
      debouncedCloudSaveRef.current = setTimeout(() => {
        const user = useAuthStore.getState().user;
        if (user) {
          void upsertPreferences(user.id, { layout: allLayouts }).catch((error) => {
            console.error('[DashboardGrid] Failed to sync layout to cloud', {
              timestamp: Date.now(),
              error,
            });
          });
        }
      }, 500);
    },
    [],
  );

  // Listen for cloud-loaded layout changes (e.g., on login)
  useEffect(() => {
    return onCloudLayoutApplied((cloudLayouts) => {
      setLayouts(cloudLayouts as ResponsiveLayouts<'lg' | 'md' | 'sm'>);
    });
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debouncedCloudSaveRef.current) {
        clearTimeout(debouncedCloudSaveRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef}>
      {isMounted && width > 0 && (
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
