// =============================================================================
// Alert Store
// =============================================================================
// Manages price alerts with localStorage persistence.
// Alerts trigger browser notifications when price conditions are met.
// =============================================================================

import { create } from 'zustand';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const ALERTS_STORAGE_KEY = 'dashboard-alerts';
const MAX_ALERTS = 20;

/**
 * Grace period (ms) after an alert is created or toggled ON.
 * During this window, checkAlerts() will not trigger the alert.
 * This prevents immediate re-deactivation when the current price
 * already satisfies the condition at the moment of activation.
 */
const ACTIVATION_GRACE_MS = 5_000;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Direction the price must move to trigger the alert */
type AlertDirection = 'above' | 'below';

interface PriceAlert {
  /** Unique alert identifier */
  id: string;
  /** Trading symbol (e.g., "BTCUSDT" or "KRW-BTC") */
  symbol: string;
  /** Target price that triggers the alert */
  targetPrice: number;
  /** Alert triggers when price moves above or below the target */
  direction: AlertDirection;
  /** Whether the alert is currently active */
  isActive: boolean;
  /** Timestamp when the alert was created (ms) */
  createdAt: number;
  /**
   * Timestamp when the alert was last activated (created or toggled ON).
   * Used for grace period — alerts are not checked within ACTIVATION_GRACE_MS
   * of activation to prevent immediate triggering when the current price
   * already satisfies the condition.
   * Optional for backward compatibility with persisted alerts.
   */
  activatedAt?: number;
}

interface AlertStoreState {
  /** All configured price alerts */
  alerts: PriceAlert[];
}

interface AlertStoreActions {
  /** Add a new alert. Returns false if at max capacity. */
  addAlert: (alert: Omit<PriceAlert, 'id' | 'createdAt' | 'activatedAt'>) => boolean;
  /** Remove an alert by ID */
  removeAlert: (id: string) => void;
  /** Toggle an alert's active state */
  toggleAlert: (id: string) => void;
  /**
   * Check if any active alerts are triggered by the given price.
   * Returns triggered alerts and deactivates them.
   */
  checkAlerts: (symbol: string, price: number) => PriceAlert[];
  /** Load alerts from localStorage */
  loadAlerts: () => void;
  /** Reset store to initial state */
  reset: () => void;
}

type AlertStore = AlertStoreState & AlertStoreActions;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function generateAlertId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function saveAlertsToStorage(alerts: PriceAlert[]): void {
  try {
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts));
  } catch (error) {
    console.error('[alertStore] Failed to save alerts', {
      timestamp: Date.now(),
      error,
    });
  }
}

function loadAlertsFromStorage(): PriceAlert[] {
  try {
    const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Validate each alert has required fields
    return parsed.filter(
      (item): item is PriceAlert =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as PriceAlert).id === 'string' &&
        typeof (item as PriceAlert).symbol === 'string' &&
        typeof (item as PriceAlert).targetPrice === 'number' &&
        typeof (item as PriceAlert).direction === 'string' &&
        typeof (item as PriceAlert).isActive === 'boolean' &&
        typeof (item as PriceAlert).createdAt === 'number',
    );
  } catch (error) {
    console.error('[alertStore] Failed to load alerts', {
      timestamp: Date.now(),
      error,
    });
    return [];
  }
}

/**
 * Checks if a price triggers an alert based on its direction.
 */
function isAlertTriggered(alert: PriceAlert, price: number): boolean {
  if (alert.direction === 'above') {
    return price >= alert.targetPrice;
  }
  return price <= alert.targetPrice;
}

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const INITIAL_STATE: AlertStoreState = {
  alerts: [],
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useAlertStore = create<AlertStore>()((set, get) => ({
  ...INITIAL_STATE,

  addAlert: (alertData): boolean => {
    const { alerts } = get();
    if (alerts.length >= MAX_ALERTS) return false;

    const now = Date.now();
    const newAlert: PriceAlert = {
      ...alertData,
      id: generateAlertId(),
      createdAt: now,
      activatedAt: now,
    };

    const newAlerts = [...alerts, newAlert];
    set({ alerts: newAlerts });
    saveAlertsToStorage(newAlerts);
    return true;
  },

  removeAlert: (id): void => {
    const newAlerts = get().alerts.filter((alert) => alert.id !== id);
    set({ alerts: newAlerts });
    saveAlertsToStorage(newAlerts);
  },

  toggleAlert: (id): void => {
    const newAlerts = get().alerts.map((alert) => {
      if (alert.id !== id) return alert;
      const willBeActive = !alert.isActive;
      return {
        ...alert,
        isActive: willBeActive,
        // Reset grace period when toggling ON to prevent immediate triggering
        ...(willBeActive ? { activatedAt: Date.now() } : {}),
      };
    });
    set({ alerts: newAlerts });
    saveAlertsToStorage(newAlerts);
  },

  checkAlerts: (symbol, price): PriceAlert[] => {
    const { alerts } = get();
    const triggered: PriceAlert[] = [];
    const now = Date.now();

    const newAlerts = alerts.map((alert) => {
      if (!alert.isActive || alert.symbol !== symbol) return alert;

      // Grace period: skip recently activated alerts to prevent
      // immediate triggering when the current price already meets the condition
      if (alert.activatedAt && now - alert.activatedAt < ACTIVATION_GRACE_MS) {
        return alert;
      }

      if (isAlertTriggered(alert, price)) {
        triggered.push(alert);
        return { ...alert, isActive: false };
      }
      return alert;
    });

    if (triggered.length > 0) {
      set({ alerts: newAlerts });
      saveAlertsToStorage(newAlerts);
    }

    return triggered;
  },

  loadAlerts: (): void => {
    const alerts = loadAlertsFromStorage();
    set({ alerts });
  },

  reset: (): void => {
    set(INITIAL_STATE);
  },
}));

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export { MAX_ALERTS, ALERTS_STORAGE_KEY, ACTIVATION_GRACE_MS, isAlertTriggered };
export type { PriceAlert, AlertDirection, AlertStoreState, AlertStoreActions, AlertStore };
