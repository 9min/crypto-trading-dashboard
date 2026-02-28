'use client';

// =============================================================================
// MobileWidgetContainer Component
// =============================================================================
// Renders widgets based on the active mobile tab. Each tab displays one or two
// widgets in a vertical split layout. Inactive tab widgets are fully unmounted
// to free Canvas/rAF resources. Re-mounting is fast because Zustand store data
// persists across mount cycles.
// =============================================================================

import { memo } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { CandlestickWidget } from '@/components/widgets/CandlestickWidget';
import { OrderBookWidget } from '@/components/widgets/OrderBookWidget';
import { WatchlistWidget } from '@/components/widgets/WatchlistWidget';
import { KimchiPremiumWidget } from '@/components/widgets/KimchiPremiumWidget';
import { DepthChartWidget } from '@/components/widgets/DepthChartWidget';
import { TradesFeedWidget } from '@/components/widgets/TradesFeedWidget';
import { PortfolioWidget } from '@/components/widgets/PortfolioWidget';
import { TradePanelWidget } from '@/components/widgets/TradePanelWidget';
import { PerformanceMonitorWidget } from '@/components/widgets/PerformanceMonitorWidget';

// -----------------------------------------------------------------------------
// Style Constants — stable references to avoid inline object creation per render
// -----------------------------------------------------------------------------

const MARKET_WATCHLIST_STYLE = { flex: '0 0 65%', minHeight: 0, overflow: 'hidden' } as const;
const MARKET_PREMIUM_STYLE = { flex: '0 0 35%', minHeight: 0, overflow: 'hidden' } as const;
const CHART_MAIN_STYLE = { flex: '0 0 60%', minHeight: 0, overflow: 'hidden' } as const;
const CHART_ORDERBOOK_STYLE = { flex: '0 0 40%', minHeight: 0, overflow: 'hidden' } as const;
const TRADE_PANEL_STYLE = { flex: '0 0 65%', minHeight: 0, overflow: 'hidden' } as const;
const TRADE_DEPTH_STYLE = { flex: '0 0 35%', minHeight: 0, overflow: 'hidden' } as const;
const MORE_TRADES_STYLE = { flex: '0 0 55%', minHeight: 0, overflow: 'hidden' } as const;
const MORE_PERF_STYLE = { flex: '0 0 45%', minHeight: 0, overflow: 'hidden' } as const;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const MobileWidgetContainer = memo(function MobileWidgetContainer() {
  const activeMobileTab = useUiStore((state) => state.activeMobileTab);

  switch (activeMobileTab) {
    case 'market':
      return (
        <div className="flex h-full flex-col">
          <div style={MARKET_WATCHLIST_STYLE}>
            <ErrorBoundary widgetName="Watchlist">
              <WatchlistWidget />
            </ErrorBoundary>
          </div>
          <div style={MARKET_PREMIUM_STYLE}>
            <ErrorBoundary widgetName="Kimchi Premium">
              <KimchiPremiumWidget />
            </ErrorBoundary>
          </div>
        </div>
      );
    case 'chart':
      return (
        <div className="flex h-full flex-col">
          <div style={CHART_MAIN_STYLE}>
            <ErrorBoundary widgetName="Chart">
              <CandlestickWidget />
            </ErrorBoundary>
          </div>
          <div style={CHART_ORDERBOOK_STYLE}>
            <ErrorBoundary widgetName="Order Book">
              <OrderBookWidget />
            </ErrorBoundary>
          </div>
        </div>
      );
    case 'trade':
      return (
        <div className="flex h-full flex-col">
          <div style={TRADE_PANEL_STYLE}>
            <ErrorBoundary widgetName="Trade Panel">
              <TradePanelWidget />
            </ErrorBoundary>
          </div>
          <div style={TRADE_DEPTH_STYLE}>
            <ErrorBoundary widgetName="Depth Chart">
              <DepthChartWidget />
            </ErrorBoundary>
          </div>
        </div>
      );
    case 'portfolio':
      return (
        <ErrorBoundary widgetName="Futures">
          <PortfolioWidget />
        </ErrorBoundary>
      );
    case 'more':
      return (
        <div className="flex h-full flex-col">
          <div style={MORE_TRADES_STYLE}>
            <ErrorBoundary widgetName="Trades">
              <TradesFeedWidget />
            </ErrorBoundary>
          </div>
          <div style={MORE_PERF_STYLE}>
            <ErrorBoundary widgetName="Performance">
              <PerformanceMonitorWidget />
            </ErrorBoundary>
          </div>
        </div>
      );
    default:
      return null;
  }
});
