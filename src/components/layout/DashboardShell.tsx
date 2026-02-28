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

import { memo, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { DashboardHeader } from './DashboardHeader';
import { MobileHeader } from './MobileHeader';
import { MobileTabBar } from './MobileTabBar';
import { MobileWidgetContainer } from './MobileWidgetContainer';
import { SymbolSearchModal } from '@/components/ui/SymbolSearchModal';
import { KeyboardShortcutsHelp } from '@/components/ui/KeyboardShortcutsHelp';
import { SettingsPanel } from '@/components/ui/SettingsPanel';
import { useExchangeWebSocket } from '@/hooks/useExchangeWebSocket';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useMobileBreakpoint } from '@/hooks/useMobileBreakpoint';
import { usePriceAlertMonitor } from '@/hooks/usePriceAlertMonitor';
import { useSymbolFromUrl } from '@/hooks/useSymbolFromUrl';
import { useUiStore } from '@/stores/uiStore';
import { useTradeStore } from '@/stores/tradeStore';
import { useWidgetStore } from '@/stores/widgetStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { loadWhaleThreshold, loadWhaleAlertEnabled } from '@/utils/localPreferences';

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
  const isSymbolSearchOpen = useUiStore((state) => state.isSymbolSearchOpen);
  const isShortcutsHelpOpen = useUiStore((state) => state.isShortcutsHelpOpen);
  const isSettingsOpen = useUiStore((state) => state.isSettingsOpen);
  const setSymbolSearchOpen = useUiStore((state) => state.setSymbolSearchOpen);
  const setShortcutsHelpOpen = useUiStore((state) => state.setShortcutsHelpOpen);
  const setSettingsOpen = useUiStore((state) => state.setSettingsOpen);
  const hydrateWidgets = useWidgetStore((state) => state.hydrateWidgets);
  const hydratePortfolio = usePortfolioStore((state) => state.hydratePortfolio);
  const isMobile = useMobileBreakpoint();

  // Hydrate persisted exchange preference after mount to avoid SSR mismatch
  useEffect(() => {
    hydrateExchange();
    hydrateWidgets();
    hydratePortfolio();

    // Hydrate whale threshold and alert enabled from localStorage
    const threshold = loadWhaleThreshold();
    useTradeStore.getState().setWhaleThreshold(threshold);
    const whaleAlertEnabled = loadWhaleAlertEnabled();
    useTradeStore.getState().setWhaleAlertEnabled(whaleAlertEnabled);
  }, [hydrateExchange, hydrateWidgets, hydratePortfolio]);

  // Sync ?symbol= URL param ↔ uiStore.symbol after exchange hydration
  useSymbolFromUrl();

  useExchangeWebSocket(isExchangeHydrated);

  // Monitor price alerts across all streams and send browser notifications
  usePriceAlertMonitor();

  // Global keyboard shortcuts (disabled on mobile)
  useKeyboardShortcuts({ enabled: !isMobile });

  const handleCloseSymbolSearch = useCallback(() => {
    setSymbolSearchOpen(false);
  }, [setSymbolSearchOpen]);

  const handleCloseShortcutsHelp = useCallback(() => {
    setShortcutsHelpOpen(false);
  }, [setShortcutsHelpOpen]);

  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false);
  }, [setSettingsOpen]);

  if (isMobile) {
    return (
      <div className="bg-background flex h-[100dvh] flex-col">
        <MobileHeader />
        <main className="flex-1 overflow-hidden pb-[calc(3.5rem+var(--safe-area-bottom))]">
          <MobileWidgetContainer />
        </main>
        <MobileTabBar />
        <SymbolSearchModal isOpen={isSymbolSearchOpen} onClose={handleCloseSymbolSearch} />
        <KeyboardShortcutsHelp isOpen={isShortcutsHelpOpen} onClose={handleCloseShortcutsHelp} />
        <SettingsPanel isOpen={isSettingsOpen} onClose={handleCloseSettings} />
      </div>
    );
  }

  return (
    <div className="bg-background flex h-screen flex-col">
      <DashboardHeader />
      <main className="flex-1 overflow-auto p-1.5">
        <DashboardGrid />
      </main>
      <SymbolSearchModal isOpen={isSymbolSearchOpen} onClose={handleCloseSymbolSearch} />
      <KeyboardShortcutsHelp isOpen={isShortcutsHelpOpen} onClose={handleCloseShortcutsHelp} />
      <SettingsPanel isOpen={isSettingsOpen} onClose={handleCloseSettings} />
    </div>
  );
});
