'use client';

// =============================================================================
// MobileTabBar Component
// =============================================================================
// Fixed bottom tab bar for mobile viewports. Provides quick navigation between
// the four main mobile views: Chart, Order Book, Trades, and More.
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

function BookIcon() {
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
      {/* Horizontal bars representing order book levels */}
      <line x1="4" y1="5" x2="14" y2="5" />
      <line x1="4" y1="9" x2="18" y2="9" />
      <line x1="4" y1="13" x2="11" y2="13" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function TradesIcon() {
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
      {/* Arrows exchanging — trade activity */}
      <polyline points="7 17 2 12 7 7" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <polyline points="17 7 22 12 17 17" />
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
  { id: 'book', label: 'Book', icon: BookIcon },
  { id: 'trades', label: 'Trades', icon: TradesIcon },
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
