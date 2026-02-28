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
  type LayoutItem as RGLLayoutItem,
  type ResponsiveLayouts,
} from 'react-grid-layout';
import { saveLayout, loadLayout, onCloudLayoutApplied, onLayoutReset } from '@/utils/layoutStorage';
import { useAuthStore } from '@/stores/authStore';
import { upsertPreferences } from '@/lib/supabase/preferencesService';
import { useWidgetStore } from '@/stores/widgetStore';
import { WIDGET_METADATA, type WidgetType } from '@/types/widget';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { CandlestickWidget } from '@/components/widgets/CandlestickWidget';
import { OrderBookWidget } from '@/components/widgets/OrderBookWidget';
import { TradesFeedWidget } from '@/components/widgets/TradesFeedWidget';
import { WatchlistWidget } from '@/components/widgets/WatchlistWidget';
import { KimchiPremiumWidget } from '@/components/widgets/KimchiPremiumWidget';
import { DepthChartWidget } from '@/components/widgets/DepthChartWidget';
import { PerformanceMonitorWidget } from '@/components/widgets/PerformanceMonitorWidget';
import { PortfolioWidget } from '@/components/widgets/PortfolioWidget';
import { TradePanelWidget } from '@/components/widgets/TradePanelWidget';

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

// Default layouts for each breakpoint (exported for reset functionality)
export const DEFAULT_LAYOUTS: ResponsiveLayouts<'lg' | 'md' | 'sm'> = {
  lg: [
    // Row 1: Chart(7) + Portfolio(3) + TradePanel(2)
    { i: 'candlestick', x: 0, y: 0, w: 7, h: 14 },
    { i: 'portfolio', x: 7, y: 0, w: 3, h: 14 },
    { i: 'tradepanel', x: 10, y: 0, w: 2, h: 14 },
    // Row 2: Watchlist(2) + OrderBook(2) + Depth(2) + Trades(2) + Perf(2) + Premium(2)
    { i: 'watchlist', x: 0, y: 14, w: 2, h: 10 },
    { i: 'orderbook', x: 2, y: 14, w: 2, h: 10 },
    { i: 'depth', x: 4, y: 14, w: 2, h: 10 },
    { i: 'trades', x: 6, y: 14, w: 2, h: 10 },
    { i: 'perf', x: 8, y: 14, w: 2, h: 10 },
    { i: 'premium', x: 10, y: 14, w: 2, h: 10 },
  ],
  md: [
    // Row 1: Chart(5) + Portfolio(5)
    { i: 'candlestick', x: 0, y: 0, w: 5, h: 12 },
    { i: 'portfolio', x: 5, y: 0, w: 5, h: 12 },
    // Row 2: TradePanel(4) + Trades(3) + OrderBook(3)
    { i: 'tradepanel', x: 0, y: 12, w: 4, h: 12 },
    { i: 'trades', x: 4, y: 12, w: 3, h: 10 },
    { i: 'orderbook', x: 7, y: 12, w: 3, h: 10 },
    // Row 3: Watchlist(2) + Depth(3) + Premium(2) + Perf(3)
    { i: 'watchlist', x: 0, y: 24, w: 2, h: 10 },
    { i: 'depth', x: 2, y: 24, w: 3, h: 10 },
    { i: 'premium', x: 5, y: 24, w: 2, h: 10 },
    { i: 'perf', x: 7, y: 24, w: 3, h: 10 },
  ],
  sm: [
    // Single column stack — ordered by priority
    { i: 'candlestick', x: 0, y: 0, w: 6, h: 10 },
    { i: 'portfolio', x: 0, y: 10, w: 6, h: 12 },
    { i: 'tradepanel', x: 0, y: 22, w: 6, h: 14 },
    { i: 'trades', x: 0, y: 36, w: 6, h: 8 },
    { i: 'orderbook', x: 0, y: 44, w: 6, h: 10 },
    { i: 'watchlist', x: 0, y: 54, w: 6, h: 8 },
    { i: 'depth', x: 0, y: 62, w: 6, h: 8 },
    { i: 'premium', x: 0, y: 70, w: 6, h: 8 },
    { i: 'perf', x: 0, y: 78, w: 6, h: 8 },
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

/**
 * Creates a default layout item for a widget being re-shown.
 * Places it at the bottom of the grid (y = 100 lets react-grid-layout compact it).
 */
function createDefaultLayoutItem(key: string, breakpointCols: number): RGLLayoutItem {
  const meta = WIDGET_METADATA[key as WidgetType];
  return {
    i: key,
    x: 0,
    y: 100, // Large y value — react-grid-layout will compact upward
    w: Math.min(meta?.defaultW ?? 3, breakpointCols),
    h: meta?.defaultH ?? 10,
  };
}

export const DashboardGrid = memo(function DashboardGrid() {
  const { width, containerRef } = useContainerWidth();

  // Gate grid rendering to client-only. Server snapshot returns false so the
  // server HTML is always an empty <div>, preventing hydration mismatch from
  // react-grid-layout computing positions with a default width vs actual width.
  const isMounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);

  const [layouts, setLayouts] = useState<ResponsiveLayouts<'lg' | 'md' | 'sm'>>(
    () => loadLayout() ?? DEFAULT_LAYOUTS,
  );

  const visibleWidgets = useWidgetStore((state) => state.visibleWidgets);

  const allWidgets: GridWidget[] = useMemo(
    () => [
      { key: 'candlestick', title: 'Chart', component: <CandlestickWidget /> },
      { key: 'orderbook', title: 'Order Book', component: <OrderBookWidget /> },
      { key: 'trades', title: 'Trades', component: <TradesFeedWidget /> },
      { key: 'watchlist', title: 'Watchlist', component: <WatchlistWidget /> },
      { key: 'premium', title: 'Kimchi Premium', component: <KimchiPremiumWidget /> },
      { key: 'depth', title: 'Depth Chart', component: <DepthChartWidget /> },
      { key: 'perf', title: 'Performance', component: <PerformanceMonitorWidget /> },
      { key: 'portfolio', title: 'Portfolio', component: <PortfolioWidget /> },
      { key: 'tradepanel', title: 'Trade Panel', component: <TradePanelWidget /> },
    ],
    [],
  );

  // Filter widgets by visibility
  const widgets = useMemo(
    () => allWidgets.filter((w) => visibleWidgets.has(w.key as WidgetType)),
    [allWidgets, visibleWidgets],
  );

  // Filter layouts to only include visible widget keys, adding defaults for
  // newly shown widgets that don't have a saved position.
  const filteredLayouts = useMemo(() => {
    const result: Record<string, RGLLayoutItem[]> = {};

    for (const bp of ['lg', 'md', 'sm'] as const) {
      const bpLayouts = layouts[bp] ?? [];
      const bpCols = GRID_COLS[bp];
      const filtered: RGLLayoutItem[] = [];
      const existingKeys = new Set<string>();

      // Keep only layout items for visible widgets
      for (const item of bpLayouts) {
        if (visibleWidgets.has(item.i as WidgetType)) {
          filtered.push({ ...item });
          existingKeys.add(item.i);
        }
      }

      // Add default items for visible widgets that don't have a saved layout
      for (const type of visibleWidgets) {
        if (!existingKeys.has(type)) {
          filtered.push(createDefaultLayoutItem(type, bpCols));
        }
      }

      result[bp] = filtered;
    }

    return result as ResponsiveLayouts<'lg' | 'md' | 'sm'>;
  }, [layouts, visibleWidgets]);

  const debouncedCloudSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLayoutChange = useCallback(
    (_layout: Layout, allLayouts: ResponsiveLayouts<'lg' | 'md' | 'sm'>) => {
      // Merge back: keep layout entries for hidden widgets from the previous
      // layouts so they're restored when the widget is shown again.
      setLayouts((prev) => {
        const merged: Record<string, RGLLayoutItem[]> = {};
        for (const bp of ['lg', 'md', 'sm'] as const) {
          const newItems = allLayouts[bp] ?? [];
          const newKeys = new Set(newItems.map((item) => item.i));
          // Bring forward hidden widget positions from previous layouts
          const hiddenItems = (prev[bp] ?? []).filter((item) => !newKeys.has(item.i));
          merged[bp] = [...newItems, ...hiddenItems];
        }
        return merged as ResponsiveLayouts<'lg' | 'md' | 'sm'>;
      });

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

  // Listen for layout reset events (from ResetLayoutButton)
  useEffect(() => {
    return onLayoutReset(() => {
      setLayouts(DEFAULT_LAYOUTS);

      // Sync reset to Supabase if logged in
      const user = useAuthStore.getState().user;
      if (user) {
        void upsertPreferences(user.id, { layout: DEFAULT_LAYOUTS }).catch((error) => {
          console.error('[DashboardGrid] Failed to sync layout reset to cloud', {
            timestamp: Date.now(),
            error,
          });
        });
      }
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
          layouts={filteredLayouts}
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
