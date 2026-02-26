'use client';

// =============================================================================
// DashboardShell Component
// =============================================================================
// Root container for the trading dashboard. Orchestrates:
// - WebSocket connection lifecycle (via useWebSocket hook)
// - Dashboard header with symbol display and connection status
// - Responsive widget grid with drag/resize capabilities
// =============================================================================

import { memo, useEffect } from 'react';
import { DashboardHeader } from './DashboardHeader';
import { DashboardGrid } from './DashboardGrid';
import { useExchangeWebSocket } from '@/hooks/useExchangeWebSocket';
import { useUiStore } from '@/stores/uiStore';

export const DashboardShell = memo(function DashboardShell() {
  const hydrateExchange = useUiStore((state) => state.hydrateExchange);
  const isExchangeHydrated = useUiStore((state) => state.isExchangeHydrated);

  // Hydrate persisted exchange preference after mount to avoid SSR mismatch
  useEffect(() => {
    hydrateExchange();
  }, [hydrateExchange]);

  useExchangeWebSocket(isExchangeHydrated);

  return (
    <div className="bg-background flex h-screen flex-col">
      <DashboardHeader />
      <main className="flex-1 overflow-auto p-1.5">
        <DashboardGrid />
      </main>
    </div>
  );
});
