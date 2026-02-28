'use client';

// =============================================================================
// MobileWidgetContainer Component
// =============================================================================
// Renders a single widget at a time based on the active mobile tab.
// Inactive tab widgets are fully unmounted to free Canvas/rAF resources.
// Re-mounting is fast because Zustand store data persists across mount cycles.
// =============================================================================

import { memo } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { CandlestickWidget } from '@/components/widgets/CandlestickWidget';
import { TradesFeedWidget } from '@/components/widgets/TradesFeedWidget';
import { PortfolioWidget } from '@/components/widgets/PortfolioWidget';
import { TradePanelWidget } from '@/components/widgets/TradePanelWidget';
import { PerformanceMonitorWidget } from '@/components/widgets/PerformanceMonitorWidget';
import { MobileMorePanel } from './MobileMorePanel';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const MobileWidgetContainer = memo(function MobileWidgetContainer() {
  const activeMobileTab = useUiStore((state) => state.activeMobileTab);

  switch (activeMobileTab) {
    case 'chart':
      return (
        <ErrorBoundary widgetName="Chart">
          <CandlestickWidget />
        </ErrorBoundary>
      );
    case 'portfolio':
      return (
        <ErrorBoundary widgetName="Portfolio">
          <div className="flex flex-col">
            <PortfolioWidget />
            <TradePanelWidget />
          </div>
        </ErrorBoundary>
      );
    case 'trades':
      return (
        <ErrorBoundary widgetName="Trades">
          <TradesFeedWidget />
        </ErrorBoundary>
      );
    case 'perf':
      return (
        <ErrorBoundary widgetName="Performance">
          <PerformanceMonitorWidget />
        </ErrorBoundary>
      );
    case 'more':
      return <MobileMorePanel />;
    default:
      return null;
  }
});
