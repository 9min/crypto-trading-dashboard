'use client';

// =============================================================================
// MobileHeaderMenu Component
// =============================================================================
// Slide-down drawer panel that appears below the MobileHeader when the
// hamburger menu is toggled. Contains all dashboard controls that are normally
// visible in the desktop header: exchange selector, interval selector, widget
// selector, price alerts, theme toggle, and user menu.
// =============================================================================

import { memo, useCallback, useEffect } from 'react';
import { ExchangeSelector } from '@/components/ui/ExchangeSelector';
import { IntervalSelector } from './IntervalSelector';
import { WidgetSelector } from '@/components/ui/WidgetSelector';
import { ResetLayoutButton } from '@/components/ui/ResetLayoutButton';
import { PriceAlertPopover } from '@/components/ui/PriceAlertPopover';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { UserMenu } from '@/components/ui/UserMenu';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface MobileHeaderMenuProps {
  onClose: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const MobileHeaderMenu = memo(function MobileHeaderMenu({ onClose }: MobileHeaderMenuProps) {
  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="animate-mobile-menu-backdrop fixed inset-0 z-50 bg-black/40"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />
      {/* Menu panel */}
      <div
        data-testid="mobile-header-menu"
        className="animate-mobile-menu-slide border-border bg-background-secondary fixed inset-x-0 top-11 z-[60] border-b p-3"
        role="menu"
      >
        <div className="flex flex-col gap-3">
          {/* Row 1: Exchange & Interval */}
          <div className="flex items-center gap-2">
            <span className="text-foreground-tertiary w-16 shrink-0 text-[11px]">Exchange</span>
            <ExchangeSelector />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-foreground-tertiary w-16 shrink-0 text-[11px]">Interval</span>
            <IntervalSelector />
          </div>

          {/* Divider */}
          <div className="bg-border h-px" />

          {/* Row 2: Actions */}
          <div className="flex items-center gap-1.5">
            <WidgetSelector />
            <ResetLayoutButton />
            <PriceAlertPopover />
            <ThemeToggle />
            <div className="flex-1" />
            <UserMenu />
          </div>
        </div>
      </div>
    </>
  );
});
