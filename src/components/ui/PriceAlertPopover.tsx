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
        <div className="border-border bg-background-secondary absolute top-full right-0 z-50 mt-2 w-72 rounded-lg border shadow-lg">
          <div className="border-border border-b px-3 py-2">
            <h3 className="text-foreground text-xs font-semibold">Price Alerts</h3>
          </div>

          {/* Add Alert Form */}
          <form onSubmit={handleSubmit} className="border-border border-b p-3">
            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                placeholder="Target price"
                value={form.targetPrice}
                onChange={handlePriceChange}
                className="border-border bg-background text-foreground placeholder:text-foreground-secondary flex-1 rounded border px-2 py-1 text-xs"
              />
              <div className="border-border flex rounded border">
                <button
                  type="button"
                  onClick={() => handleDirectionChange('above')}
                  className={`px-2 py-1 text-xs ${
                    form.direction === 'above' ? 'bg-buy text-white' : 'text-foreground-secondary'
                  }`}
                >
                  Above
                </button>
                <button
                  type="button"
                  onClick={() => handleDirectionChange('below')}
                  className={`px-2 py-1 text-xs ${
                    form.direction === 'below' ? 'bg-sell text-white' : 'text-foreground-secondary'
                  }`}
                >
                  Below
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="bg-accent mt-2 w-full rounded py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
            >
              Add Alert
            </button>
            {permission === 'denied' && (
              <p className="text-sell mt-1 text-[10px]">
                Notifications blocked. Enable in browser settings.
              </p>
            )}
          </form>

          {/* Alert List */}
          <div className="max-h-48 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="text-foreground-secondary p-3 text-center text-xs">
                No alerts configured
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="border-border flex items-center justify-between border-b px-3 py-2 last:border-b-0"
                >
                  <div className="flex flex-col">
                    <span className="text-foreground text-xs font-medium">{alert.symbol}</span>
                    <span className="text-foreground-secondary text-[10px]">
                      {alert.direction === 'above' ? '>' : '<'} {formatPrice(alert.targetPrice)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleAlert(alert.id)}
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        alert.isActive
                          ? 'bg-buy/20 text-buy'
                          : 'bg-foreground-secondary/20 text-foreground-secondary'
                      }`}
                    >
                      {alert.isActive ? 'ON' : 'OFF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAlert(alert.id)}
                      className="text-foreground-secondary hover:text-sell text-xs transition-colors"
                    >
                      x
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
