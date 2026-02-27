'use client';

// =============================================================================
// MobileHeader Component
// =============================================================================
// Compact header for mobile viewports (< 768px). Displays the logo, active
// symbol, connection status dot, and a hamburger menu button that toggles
// the MobileHeaderMenu drawer.
// =============================================================================

import { memo, useState, useCallback } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { ConnectionStatus } from './ConnectionStatus';
import { MobileHeaderMenu } from './MobileHeaderMenu';
import { formatSymbol, formatUpbitSymbol } from '@/utils/formatSymbol';
import { toUpbitSymbol } from '@/utils/symbolMap';

// -----------------------------------------------------------------------------
// Icons
// -----------------------------------------------------------------------------

function MenuIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const MobileHeader = memo(function MobileHeader() {
  const symbol = useUiStore((state) => state.symbol);
  const exchange = useUiStore((state) => state.exchange);
  const [menuOpen, setMenuOpen] = useState(false);

  const displaySymbol =
    exchange === 'upbit' ? formatUpbitSymbol(toUpbitSymbol(symbol)) : formatSymbol(symbol);

  const toggleMenu = useCallback(() => {
    setMenuOpen((prev) => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  return (
    <>
      <header
        data-testid="mobile-header"
        className="border-border bg-background-secondary relative z-30 flex h-11 shrink-0 items-center justify-between border-b px-3 shadow-[var(--shadow-header)]"
      >
        <div className="flex items-center gap-2">
          <h1 className="text-accent text-xs font-bold tracking-wide">CryptoDash</h1>
          <div className="bg-border h-4 w-px" />
          <span className="font-mono-num text-foreground text-xs font-semibold">
            {displaySymbol}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionStatus />
          <button
            type="button"
            onClick={toggleMenu}
            className="text-foreground-secondary hover:bg-background-tertiary hover:text-foreground flex h-8 w-8 items-center justify-center rounded-md transition-colors"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </header>
      {menuOpen && <MobileHeaderMenu onClose={closeMenu} />}
    </>
  );
});
