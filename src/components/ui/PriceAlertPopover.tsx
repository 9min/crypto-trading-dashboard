'use client';

// =============================================================================
// PriceAlertPopover Component
// =============================================================================
// Bell icon button that opens a popover for managing price alerts.
// Supports adding/removing/toggling alerts and requesting notification permission.
// =============================================================================

import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useAlertStore } from '@/stores/alertStore';
import type { AlertDirection } from '@/stores/alertStore';
import { useUiStore } from '@/stores/uiStore';
import { useNotification } from '@/hooks/useNotification';
import { formatPrice } from '@/utils/formatPrice';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface AlertFormState {
  targetPrice: string;
  direction: AlertDirection;
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
}

const ToggleSwitch = memo(function ToggleSwitch({ checked, onChange }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-buy' : 'bg-foreground-tertiary'
      }`}
      aria-label={checked ? 'Disable alert' : 'Enable alert'}
    >
      <span
        className={`inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-3.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
});

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const PriceAlertPopover = memo(function PriceAlertPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const alerts = useAlertStore((state) => state.alerts);
  const addAlert = useAlertStore((state) => state.addAlert);
  const removeAlert = useAlertStore((state) => state.removeAlert);
  const toggleAlert = useAlertStore((state) => state.toggleAlert);
  const loadAlerts = useAlertStore((state) => state.loadAlerts);

  const symbol = useUiStore((state) => state.symbol);

  const { permission, requestPermission } = useNotification();

  const [form, setForm] = useState<AlertFormState>({
    targetPrice: '',
    direction: 'above',
  });

  // Load alerts from localStorage on mount
  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent): void => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const activeAlertCount = useMemo(() => alerts.filter((a) => a.isActive).length, [alerts]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleSubmit = useCallback(
    (event: React.FormEvent): void => {
      event.preventDefault();
      const price = parseFloat(form.targetPrice);
      if (isNaN(price) || price <= 0) return;

      // Request notification permission on first alert
      if (permission === 'default') {
        requestPermission();
      }

      const success = addAlert({
        symbol,
        targetPrice: price,
        direction: form.direction,
        isActive: true,
      });

      if (success) {
        setForm({ targetPrice: '', direction: 'above' });
      }
    },
    [form, symbol, permission, requestPermission, addAlert],
  );

  const handleDirectionChange = useCallback((direction: AlertDirection) => {
    setForm((prev) => ({ ...prev, direction }));
  }, []);

  const handlePriceChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, targetPrice: event.target.value }));
  }, []);

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="text-foreground-secondary hover:text-foreground relative p-1 transition-colors"
        aria-label="Price alerts"
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
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {activeAlertCount > 0 && (
          <span className="bg-accent absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold text-white">
            {activeAlertCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="border-border bg-background-secondary absolute top-full right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border shadow-xl">
          {/* Header */}
          <div className="border-border flex items-center justify-between border-b px-4 py-2.5">
            <div className="flex items-center gap-2">
              <svg
                className="text-accent h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                />
              </svg>
              <h3 className="text-foreground text-xs font-semibold">Price Alerts</h3>
            </div>
            <span className="bg-background-tertiary text-foreground-secondary rounded px-1.5 py-0.5 text-[10px] font-medium">
              {alerts.length}/20
            </span>
          </div>

          {/* Add Alert Form */}
          <form onSubmit={handleSubmit} className="border-border border-b p-3">
            {/* Current symbol badge */}
            <div className="mb-2 flex items-center gap-1.5">
              <span className="text-foreground-secondary text-[10px]">Symbol</span>
              <span className="font-mono-num bg-background-tertiary text-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
                {symbol}
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                placeholder="Target price"
                value={form.targetPrice}
                onChange={handlePriceChange}
                className="border-border bg-background text-foreground placeholder:text-foreground-tertiary font-mono-num focus:border-accent flex-1 rounded-md border px-2.5 py-1.5 text-xs transition-colors outline-none"
              />
              <div className="border-border flex overflow-hidden rounded-md border">
                <button
                  type="button"
                  onClick={() => handleDirectionChange('above')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${
                    form.direction === 'above'
                      ? 'bg-buy/20 text-buy font-medium'
                      : 'text-foreground-secondary hover:text-foreground'
                  }`}
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 15.75l7.5-7.5 7.5 7.5"
                    />
                  </svg>
                  Above
                </button>
                <div className="bg-border w-px" />
                <button
                  type="button"
                  onClick={() => handleDirectionChange('below')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${
                    form.direction === 'below'
                      ? 'bg-sell/20 text-sell font-medium'
                      : 'text-foreground-secondary hover:text-foreground'
                  }`}
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                    />
                  </svg>
                  Below
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="bg-accent hover:bg-accent-hover mt-2.5 w-full rounded-md py-1.5 text-xs font-semibold text-white transition-colors"
            >
              Add Alert
            </button>
            {permission === 'denied' && (
              <p className="text-sell mt-1.5 text-[10px]">
                Notifications blocked. Enable in browser settings.
              </p>
            )}
          </form>

          {/* Alert List */}
          <div className="max-h-52 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-6">
                <svg
                  className="text-foreground-tertiary h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>
                <span className="text-foreground-tertiary text-[10px]">No alerts configured</span>
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`border-border group flex items-center gap-2.5 border-b px-4 py-2.5 transition-colors last:border-b-0 ${
                    alert.isActive ? '' : 'opacity-50'
                  }`}
                >
                  {/* Direction indicator */}
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                      alert.direction === 'above' ? 'bg-buy/15 text-buy' : 'bg-sell/15 text-sell'
                    }`}
                  >
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2.5}
                      stroke="currentColor"
                    >
                      {alert.direction === 'above' ? (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 15.75l7.5-7.5 7.5 7.5"
                        />
                      ) : (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                        />
                      )}
                    </svg>
                  </div>

                  {/* Alert info */}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-foreground truncate text-xs font-medium">
                      {alert.symbol}
                    </span>
                    <span className="font-mono-num text-foreground-secondary text-[10px]">
                      {alert.direction === 'above' ? '>' : '<'} {formatPrice(alert.targetPrice)}
                    </span>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2">
                    <ToggleSwitch checked={alert.isActive} onChange={() => toggleAlert(alert.id)} />
                    <button
                      type="button"
                      onClick={() => removeAlert(alert.id)}
                      className="text-foreground-tertiary hover:text-sell rounded p-0.5 opacity-0 transition-all group-hover:opacity-100"
                      aria-label="Remove alert"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
});
