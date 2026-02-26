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
import { DashboardHeader } from './DashboardHeader';
import { DashboardGrid } from './DashboardGrid';
import { useExchangeWebSocket } from '@/hooks/useExchangeWebSocket';
import { usePriceAlertMonitor } from '@/hooks/usePriceAlertMonitor';
import { useSymbolFromUrl } from '@/hooks/useSymbolFromUrl';
import { useUiStore } from '@/stores/uiStore';
import { useWidgetStore } from '@/stores/widgetStore';

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
