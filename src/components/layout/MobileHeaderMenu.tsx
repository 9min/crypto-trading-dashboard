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
import { useUiStore } from '@/stores/uiStore';

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
  const setSettingsOpen = useUiStore((state) => state.setSettingsOpen);

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

  const handleOpenSettings = useCallback(() => {
    onClose();
    setSettingsOpen(true);
  }, [onClose, setSettingsOpen]);

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
            <span className="text-foreground-tertiary w-16 shrink-0 text-xs">Exchange</span>
            <ExchangeSelector />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-foreground-tertiary w-16 shrink-0 text-xs">Interval</span>
            <IntervalSelector />
          </div>

          {/* Divider */}
          <div className="bg-border h-px" />

          {/* Row 2: Actions */}
          <div className="flex items-center gap-2">
            <WidgetSelector />
            <ResetLayoutButton />
            <PriceAlertPopover />
            <ThemeToggle />
            <button
              type="button"
              onClick={handleOpenSettings}
              className="text-foreground-secondary hover:text-foreground hover:bg-background-tertiary cursor-pointer rounded p-2 transition-colors"
              aria-label="Open settings"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
              </svg>
            </button>
            <div className="flex-1" />
            <UserMenu />
          </div>
        </div>
      </div>
    </>
  );
});
