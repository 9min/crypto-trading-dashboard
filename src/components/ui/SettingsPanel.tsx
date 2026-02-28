'use client';

// =============================================================================
// SettingsPanel Component
// =============================================================================
// Right-sliding panel (desktop: 320px, mobile: full-screen) containing all
// dashboard settings organized into four sections:
// 1. Notifications & Alerts — whale alert toggle, threshold, browser permission
// 2. Display — theme toggle
// 3. Trading Defaults — leverage, margin type
// 4. Data Management — reset layout, wallet, all data
// =============================================================================

import { memo, useCallback, useEffect, useState } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { useTradeStore } from '@/stores/tradeStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useNotification } from '@/hooks/useNotification';
import { useMobileBreakpoint } from '@/hooks/useMobileBreakpoint';
import { dispatchLayoutReset } from '@/utils/layoutStorage';
import { WHALE_THRESHOLD_OPTIONS } from '@/utils/constants';
import { MAX_LEVERAGE, INITIAL_CASH_BALANCE } from '@/types/portfolio';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type ConfirmAction = 'reset-layout' | 'reset-wallet' | 'clear-all' | null;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const CONFIRM_LABELS: Record<Exclude<ConfirmAction, null>, string> = {
  'reset-layout': 'Reset layout to default?',
  'reset-wallet': 'Reset wallet to $100,000 USDT?',
  'clear-all': 'Delete all local data and reload?',
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function formatThreshold(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const SettingsPanel = memo(function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const isMobile = useMobileBreakpoint();
  const { permission, requestPermission } = useNotification();

  // UI store
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);

  // Trade store
  const whaleThreshold = useTradeStore((state) => state.whaleThreshold);
  const isWhaleAlertEnabled = useTradeStore((state) => state.isWhaleAlertEnabled);
  const setWhaleThreshold = useTradeStore((state) => state.setWhaleThreshold);
  const setWhaleAlertEnabled = useTradeStore((state) => state.setWhaleAlertEnabled);

  // Portfolio store
  const defaultLeverage = usePortfolioStore((state) => state.defaultLeverage);
  const defaultMarginType = usePortfolioStore((state) => state.defaultMarginType);
  const setDefaultLeverage = usePortfolioStore((state) => state.setDefaultLeverage);
  const setDefaultMarginType = usePortfolioStore((state) => state.setDefaultMarginType);
  const resetPortfolio = usePortfolioStore((state) => state.resetPortfolio);

  // Confirm dialog state
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const handleClose = useCallback(() => {
    setConfirmAction(null);
    onClose();
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.stopPropagation();
        handleClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose],
  );

  const handleWhaleAlertToggle = useCallback(() => {
    setWhaleAlertEnabled(!isWhaleAlertEnabled);
  }, [isWhaleAlertEnabled, setWhaleAlertEnabled]);

  const handleThresholdSelect = useCallback(
    (value: number) => {
      setWhaleThreshold(value);
    },
    [setWhaleThreshold],
  );

  const handleLeverageSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDefaultLeverage(parseInt(e.target.value, 10));
    },
    [setDefaultLeverage],
  );

  const handleMarginTypeToggle = useCallback(() => {
    setDefaultMarginType(defaultMarginType === 'isolated' ? 'cross' : 'isolated');
  }, [defaultMarginType, setDefaultMarginType]);

  const handleConfirm = useCallback(() => {
    if (confirmAction === 'reset-layout') {
      dispatchLayoutReset();
    } else if (confirmAction === 'reset-wallet') {
      resetPortfolio();
    } else if (confirmAction === 'clear-all') {
      try {
        localStorage.clear();
      } catch {
        // best-effort
      }
      window.location.reload();
      return;
    }
    setConfirmAction(null);
  }, [confirmAction, resetPortfolio]);

  const handleCancelConfirm = useCallback(() => {
    setConfirmAction(null);
  }, []);

  const handleResetLayout = useCallback(() => {
    setConfirmAction('reset-layout');
  }, []);

  const handleResetWallet = useCallback(() => {
    setConfirmAction('reset-wallet');
  }, []);

  const handleClearAll = useCallback(() => {
    setConfirmAction('clear-all');
  }, []);

  if (!isOpen) return null;

  const panelClass = isMobile
    ? 'animate-settings-slide-up fixed inset-0 z-50 flex flex-col bg-background'
    : 'animate-settings-slide-right fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-border bg-background shadow-2xl';

  return (
    <>
      {/* Backdrop (desktop only) */}
      {!isMobile && (
        <div
          className="animate-modal-backdrop fixed inset-0 z-40 bg-black/30"
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div className={panelClass} role="dialog" aria-modal="true" aria-label="Settings">
        {/* Header */}
        <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-3">
          <h2 className="text-foreground text-sm font-semibold">Settings</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-foreground-tertiary hover:text-foreground cursor-pointer rounded p-1 transition-colors"
            aria-label="Close settings"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-0">
            {/* ========== Section 1: Notifications & Alerts ========== */}
            <section className="border-border border-b px-4 py-4">
              <h3 className="text-foreground-secondary mb-3 text-[11px] font-semibold tracking-wider uppercase">
                Notifications &amp; Alerts
              </h3>

              {/* Whale alert toggle */}
              <div className="flex items-center justify-between py-1.5">
                <span className="text-foreground text-xs">Whale Alerts</span>
                <button
                  type="button"
                  onClick={handleWhaleAlertToggle}
                  className={`relative h-5 w-9 cursor-pointer rounded-full transition-colors ${
                    isWhaleAlertEnabled ? 'bg-accent' : 'bg-foreground-tertiary'
                  }`}
                  role="switch"
                  aria-checked={isWhaleAlertEnabled}
                  aria-label="Toggle whale alerts"
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      isWhaleAlertEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Whale threshold options */}
              <div className="mt-2 flex flex-col gap-1.5">
                <span className="text-foreground-secondary text-[10px]">Alert Threshold</span>
                <div className="flex gap-1">
                  {WHALE_THRESHOLD_OPTIONS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleThresholdSelect(value)}
                      disabled={!isWhaleAlertEnabled}
                      className={`flex-1 cursor-pointer rounded px-1.5 py-1.5 text-[10px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                        whaleThreshold === value
                          ? 'bg-accent text-white shadow-sm'
                          : 'bg-background-tertiary text-foreground-secondary hover:text-foreground'
                      }`}
                    >
                      {formatThreshold(value)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Browser notification permission */}
              <div className="mt-3 flex items-center justify-between py-1.5">
                <div className="flex flex-col">
                  <span className="text-foreground text-xs">Browser Notifications</span>
                  <span className="text-foreground-tertiary text-[10px]">
                    {permission === 'granted'
                      ? 'Enabled'
                      : permission === 'denied'
                        ? 'Blocked by browser'
                        : 'Not enabled'}
                  </span>
                </div>
                {permission === 'default' && (
                  <button
                    type="button"
                    onClick={requestPermission}
                    className="bg-background-tertiary text-foreground hover:bg-background-tertiary/80 cursor-pointer rounded px-2.5 py-1 text-[10px] font-medium transition-colors"
                  >
                    Enable
                  </button>
                )}
                {permission === 'granted' && (
                  <span className="text-buy text-[10px] font-medium">Active</span>
                )}
                {permission === 'denied' && (
                  <span className="text-sell text-[10px] font-medium">Denied</span>
                )}
              </div>
            </section>

            {/* ========== Section 2: Display ========== */}
            <section className="border-border border-b px-4 py-4">
              <h3 className="text-foreground-secondary mb-3 text-[11px] font-semibold tracking-wider uppercase">
                Display
              </h3>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-foreground text-xs">Theme</span>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="bg-background-tertiary text-foreground hover:bg-background-tertiary/80 cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors"
                >
                  {theme === 'dark' ? 'Dark' : 'Light'}
                </button>
              </div>
            </section>

            {/* ========== Section 3: Trading Defaults ========== */}
            <section className="border-border border-b px-4 py-4">
              <h3 className="text-foreground-secondary mb-3 text-[11px] font-semibold tracking-wider uppercase">
                Trading Defaults
              </h3>

              {/* Default leverage */}
              <div className="flex flex-col gap-1.5 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-xs">Default Leverage</span>
                  <span className="font-mono-num text-accent text-xs font-semibold">
                    {defaultLeverage}x
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={MAX_LEVERAGE}
                  step={1}
                  value={defaultLeverage}
                  onChange={handleLeverageSlider}
                  aria-label="Default leverage slider"
                  className="leverage-slider h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
                />
              </div>

              {/* Default margin type */}
              <div className="mt-2 flex items-center justify-between py-1.5">
                <span className="text-foreground text-xs">Default Margin Type</span>
                <button
                  type="button"
                  onClick={handleMarginTypeToggle}
                  className="bg-background-tertiary text-foreground hover:bg-background-tertiary/80 cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors"
                >
                  {defaultMarginType === 'isolated' ? 'Isolated' : 'Cross'}
                </button>
              </div>
            </section>

            {/* ========== Section 4: Data Management ========== */}
            <section className="px-4 py-4">
              <h3 className="text-foreground-secondary mb-3 text-[11px] font-semibold tracking-wider uppercase">
                Data Management
              </h3>

              {/* Confirm dialog */}
              {confirmAction !== null && (
                <div className="bg-sell/10 border-sell/30 mb-3 rounded-md border px-3 py-2.5">
                  <p className="text-foreground text-xs font-medium">
                    {CONFIRM_LABELS[confirmAction]}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={handleConfirm}
                      className="bg-sell hover:bg-sell/90 cursor-pointer rounded px-3 py-1 text-xs font-medium text-white transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelConfirm}
                      className="bg-background-tertiary text-foreground-secondary hover:text-foreground cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleResetLayout}
                  disabled={confirmAction !== null}
                  className="bg-background-tertiary text-foreground-secondary hover:text-foreground w-full cursor-pointer rounded px-3 py-2 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Reset Layout
                </button>
                <button
                  type="button"
                  onClick={handleResetWallet}
                  disabled={confirmAction !== null}
                  className="bg-background-tertiary text-foreground-secondary hover:text-foreground w-full cursor-pointer rounded px-3 py-2 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Reset Futures Wallet ({formatThreshold(INITIAL_CASH_BALANCE)})
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={confirmAction !== null}
                  className="bg-background-tertiary text-sell/80 hover:text-sell w-full cursor-pointer rounded px-3 py-2 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Clear All Data &amp; Reload
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
});
