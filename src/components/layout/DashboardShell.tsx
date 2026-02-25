'use client';

// =============================================================================
// DashboardShell Component
// =============================================================================
// Root container for the trading dashboard. Orchestrates:
// - WebSocket connection lifecycle (via useWebSocket hook)
// - Dashboard header with symbol display and connection status
// - Responsive widget grid with drag/resize capabilities
// =============================================================================

import { memo } from 'react';
import { DashboardHeader } from './DashboardHeader';
import { DashboardGrid } from './DashboardGrid';
import { useExchangeWebSocket } from '@/hooks/useExchangeWebSocket';

export const DashboardShell = memo(function DashboardShell() {
  useExchangeWebSocket();

  return (
    <div className="bg-background flex h-screen flex-col">
      <DashboardHeader />
      <main className="flex-1 overflow-auto p-1">
        <DashboardGrid />
      </main>
    </div>
  );
});
