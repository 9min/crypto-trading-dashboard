// =============================================================================
// usePriceAlertMonitor Hook
// =============================================================================
// Monitors real-time prices from two sources:
//   1. Watchlist tickers (all watchlist symbols)
//   2. Trade stream lastPrice (active symbol)
//
// When a price crosses an alert threshold, the alert is deactivated and a
// browser notification is sent via the Notification API.
//
// Throttled to CHECK_INTERVAL_MS to avoid excessive store reads on every
// WebSocket tick.
// =============================================================================

import { useEffect, useRef } from 'react';
import { useAlertStore } from '@/stores/alertStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useTradeStore } from '@/stores/tradeStore';
import { useUiStore } from '@/stores/uiStore';
import { useNotification } from '@/hooks/useNotification';
import type { PriceAlert } from '@/stores/alertStore';
import { formatPrice } from '@/utils/formatPrice';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Minimum interval between alert checks (ms) */
const CHECK_INTERVAL_MS = 1_000;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Builds a human-readable notification body for a triggered price alert.
 */
function buildNotificationBody(alert: PriceAlert): string {
  const direction = alert.direction === 'above' ? 'rose above' : 'fell below';
  return `Price ${direction} ${formatPrice(alert.targetPrice)}`;
}

/**
 * Sends browser notifications for each triggered alert.
 */
function notifyTriggered(
  triggered: PriceAlert[],
  sendFn: (title: string, body: string) => void,
): void {
  for (const alert of triggered) {
    sendFn(`Price Alert: ${alert.symbol}`, buildNotificationBody(alert));
  }
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function usePriceAlertMonitor(): void {
  const { sendNotification } = useNotification();
  const hasActiveAlerts = useAlertStore((state) => state.alerts.some((a) => a.isActive));

  // Ref to always access the latest sendNotification in subscription callbacks
  const sendRef = useRef(sendNotification);
  useEffect(() => {
    sendRef.current = sendNotification;
  }, [sendNotification]);

  // Shared throttle timestamp across both subscriptions
  const lastCheckRef = useRef(0);

  // ── Watchlist ticker monitoring ──────────────────────────────────────────
  useEffect(() => {
    if (!hasActiveAlerts) return;

    const unsubscribe = useWatchlistStore.subscribe((state, prevState) => {
      if (state.tickers === prevState.tickers) return;

      const now = Date.now();
      if (now - lastCheckRef.current < CHECK_INTERVAL_MS) return;
      lastCheckRef.current = now;

      const { checkAlerts } = useAlertStore.getState();

      for (const [symbol, ticker] of state.tickers) {
        const triggered = checkAlerts(symbol, ticker.price);
        notifyTriggered(triggered, sendRef.current);
      }
    });

    return unsubscribe;
  }, [hasActiveAlerts]);

  // ── Active symbol trade price monitoring ─────────────────────────────────
  useEffect(() => {
    if (!hasActiveAlerts) return;

    const unsubscribe = useTradeStore.subscribe((state, prevState) => {
      if (state.lastPrice === prevState.lastPrice) return;
      if (state.lastPrice === 0) return;

      const now = Date.now();
      if (now - lastCheckRef.current < CHECK_INTERVAL_MS) return;
      lastCheckRef.current = now;

      const symbol = useUiStore.getState().symbol;
      const { checkAlerts } = useAlertStore.getState();

      const triggered = checkAlerts(symbol, state.lastPrice);
      notifyTriggered(triggered, sendRef.current);
    });

    return unsubscribe;
  }, [hasActiveAlerts]);
}
