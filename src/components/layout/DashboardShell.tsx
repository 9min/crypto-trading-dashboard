'use client';

// =============================================================================
// DashboardShell Component
// =============================================================================
// Root container for the trading dashboard. Orchestrates:
// - WebSocket connection lifecycle (via useWebSocket hook)
// - Price alert monitoring across all streams (via usePriceAlertMonitor)
// - Dashboard header with symbol display and connection status
// - Responsive widget grid with drag/resize capabilities
// =============================================================================

import { memo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { DashboardHeader } from './DashboardHeader';
import { useExchangeWebSocket } from '@/hooks/useExchangeWebSocket';
import { usePriceAlertMonitor } from '@/hooks/usePriceAlertMonitor';
import { useSymbolFromUrl } from '@/hooks/useSymbolFromUrl';
import { useUiStore } from '@/stores/uiStore';
import { useWidgetStore } from '@/stores/widgetStore';

const DashboardGrid = dynamic(() => import('./DashboardGrid').then((m) => m.DashboardGrid), {
  ssr: false,
  loading: () => <DashboardGridSkeleton />,
});

function DashboardGridSkeleton() {
  return (
    <div className="grid h-full grid-cols-12 gap-2 p-2">
      <div
        className="bg-background-secondary col-span-9 animate-pulse rounded-lg"
        style={{ minHeight: 420 }}
      />
      <div
        className="bg-background-secondary col-span-3 animate-pulse rounded-lg"
        style={{ minHeight: 420 }}
      />
      <div
        className="bg-background-secondary col-span-3 animate-pulse rounded-lg"
        style={{ minHeight: 300 }}
      />
      <div
        className="bg-background-secondary col-span-2 animate-pulse rounded-lg"
        style={{ minHeight: 300 }}
      />
      <div
        className="bg-background-secondary col-span-2 animate-pulse rounded-lg"
        style={{ minHeight: 300 }}
      />
      <div
        className="bg-background-secondary col-span-2 animate-pulse rounded-lg"
        style={{ minHeight: 300 }}
      />
      <div
        className="bg-background-secondary col-span-3 animate-pulse rounded-lg"
        style={{ minHeight: 300 }}
      />
    </div>
  );
}

export const DashboardShell = memo(function DashboardShell() {
  const hydrateExchange = useUiStore((state) => state.hydrateExchange);
  const isExchangeHydrated = useUiStore((state) => state.isExchangeHydrated);
  const hydrateWidgets = useWidgetStore((state) => state.hydrateWidgets);

  // Hydrate persisted exchange preference after mount to avoid SSR mismatch
  useEffect(() => {
    hydrateExchange();
    hydrateWidgets();
  }, [hydrateExchange, hydrateWidgets]);

  // Sync ?symbol= URL param ↔ uiStore.symbol after exchange hydration
  useSymbolFromUrl();

  useExchangeWebSocket(isExchangeHydrated);

  // Monitor price alerts across all streams and send browser notifications
  usePriceAlertMonitor();

  return (
    <div className="bg-background flex h-screen flex-col">
      <DashboardHeader />
      <main className="flex-1 overflow-auto p-1.5">
        <DashboardGrid />
      </main>
    </div>
  );
});
