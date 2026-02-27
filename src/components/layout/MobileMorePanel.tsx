'use client';

// =============================================================================
// MobileMorePanel Component
// =============================================================================
// Scrollable panel for the "More" tab in mobile view. Renders the secondary
// widgets (Order Book, Watchlist, Kimchi Premium, Depth Chart) in a vertical
// stack, each wrapped in an ErrorBoundary for fault isolation.
// =============================================================================

import { memo } from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { OrderBookWidget } from '@/components/widgets/OrderBookWidget';
import { WatchlistWidget } from '@/components/widgets/WatchlistWidget';
import { KimchiPremiumWidget } from '@/components/widgets/KimchiPremiumWidget';
import { DepthChartWidget } from '@/components/widgets/DepthChartWidget';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const MobileMorePanel = memo(function MobileMorePanel() {
  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-2">
      <div style={{ height: 300, minHeight: 300 }}>
        <ErrorBoundary widgetName="Order Book">
          <OrderBookWidget />
        </ErrorBoundary>
      </div>
      <div style={{ height: 280, minHeight: 280 }}>
        <ErrorBoundary widgetName="Watchlist">
          <WatchlistWidget />
        </ErrorBoundary>
      </div>
      <div style={{ height: 200, minHeight: 200 }}>
        <ErrorBoundary widgetName="Kimchi Premium">
          <KimchiPremiumWidget />
        </ErrorBoundary>
      </div>
      <div style={{ height: 250, minHeight: 250 }}>
        <ErrorBoundary widgetName="Depth Chart">
          <DepthChartWidget />
        </ErrorBoundary>
      </div>
    </div>
  );
});
