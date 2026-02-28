'use client';

// =============================================================================
// MobileTabBar Component
// =============================================================================
// Fixed bottom tab bar for mobile viewports. Provides quick navigation between
// five main mobile views: Chart, Order Book, Trade, Futures, and More.
// Respects safe-area-inset-bottom for devices with home indicators.
// =============================================================================

import { memo, useCallback } from 'react';
import { useUiStore } from '@/stores/uiStore';
import type { MobileTab } from '@/stores/uiStore';

// -----------------------------------------------------------------------------
// Icons (inline SVG, 20x20)
// -----------------------------------------------------------------------------

function ChartIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Candlestick-style icon */}
      <line x1="6" y1="4" x2="6" y2="20" />
      <rect x="4" y="8" width="4" height="6" rx="0.5" fill="currentColor" stroke="none" />
      <line x1="18" y1="4" x2="18" y2="20" />
      <rect x="16" y="10" width="4" height="6" rx="0.5" fill="currentColor" stroke="none" />
      <line x1="12" y1="6" x2="12" y2="18" />
      <rect x="10" y="9" width="4" height="4" rx="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function OrderBookIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Stacked rows — order book levels */}
      <rect x="3" y="3" width="18" height="4" rx="1" />
      <rect x="3" y="10" width="18" height="4" rx="1" />
      <rect x="3" y="17" width="18" height="4" rx="1" />
    </svg>
  );
}

function TradeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Up/down arrows — long/short */}
      <line x1="12" y1="3" x2="12" y2="21" />
      <polyline points="8 7 12 3 16 7" />
      <polyline points="8 17 12 21 16 17" />
    </svg>
  );
}

function PortfolioIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Pie chart / portfolio icon */}
      <path d="M21 12c0-4.97-4.03-9-9-9v9h9z" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      {/* Three dots horizontal */}
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface TabConfig {
  id: MobileTab;
  label: string;
  icon: React.ComponentType;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const TABS: readonly TabConfig[] = [
  { id: 'chart', label: 'Chart', icon: ChartIcon },
  { id: 'orderbook', label: 'Book', icon: OrderBookIcon },
  { id: 'trade', label: 'Trade', icon: TradeIcon },
  { id: 'portfolio', label: 'Futures', icon: PortfolioIcon },
  { id: 'more', label: 'More', icon: MoreIcon },
] as const;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const MobileTabBar = memo(function MobileTabBar() {
  const activeMobileTab = useUiStore((state) => state.activeMobileTab);
  const setActiveMobileTab = useUiStore((state) => state.setActiveMobileTab);

  const handleTabClick = useCallback(
    (tab: MobileTab) => {
      setActiveMobileTab(tab);
    },
    [setActiveMobileTab],
  );

  return (
    <nav
      data-testid="mobile-tab-bar"
      className="border-border bg-background-secondary fixed inset-x-0 bottom-0 z-40 border-t"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex h-14">
        {TABS.map((tab) => {
          const isActive = activeMobileTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive
                  ? 'text-accent'
                  : 'text-foreground-tertiary hover:text-foreground-secondary'
              }`}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});
