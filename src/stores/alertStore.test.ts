import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  useAlertStore,
  MAX_ALERTS,
  ALERTS_STORAGE_KEY,
  ACTIVATION_GRACE_MS,
  isAlertTriggered,
} from './alertStore';
import type { PriceAlert } from './alertStore';

// -----------------------------------------------------------------------------
// Mock localStorage
// -----------------------------------------------------------------------------

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string): string | null => store[key] ?? null),
    setItem: vi.fn((key: string, value: string): void => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string): void => {
      delete store[key];
    }),
    clear: vi.fn((): void => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function createTestAlert(
  overrides: Partial<Omit<PriceAlert, 'id' | 'createdAt' | 'activatedAt'>> = {},
): Omit<PriceAlert, 'id' | 'createdAt' | 'activatedAt'> {
  return {
    symbol: 'BTCUSDT',
    targetPrice: 50000,
    direction: 'above',
    isActive: true,
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('alertStore', () => {
  beforeEach(() => {
    useAlertStore.getState().reset();
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
  });

  // ---------------------------------------------------------------------------
  // addAlert
  // ---------------------------------------------------------------------------

  describe('addAlert', () => {
    it('adds an alert with generated id, createdAt, and activatedAt', () => {
      const success = useAlertStore.getState().addAlert(createTestAlert());

      expect(success).toBe(true);
      const alerts = useAlertStore.getState().alerts;
      expect(alerts).toHaveLength(1);
      expect(alerts[0].symbol).toBe('BTCUSDT');
      expect(alerts[0].targetPrice).toBe(50000);
      expect(alerts[0].direction).toBe('above');
      expect(alerts[0].isActive).toBe(true);
      expect(alerts[0].id).toMatch(/^alert-/);
      expect(alerts[0].createdAt).toBeGreaterThan(0);
      expect(alerts[0].activatedAt).toBeGreaterThan(0);
    });

    it('saves alerts to localStorage after adding', () => {
      useAlertStore.getState().addAlert(createTestAlert());

      expect(localStorageMock.setItem).toHaveBeenCalledWith(ALERTS_STORAGE_KEY, expect.any(String));

      const saved = JSON.parse(localStorageMock.setItem.mock.calls[0][1]) as PriceAlert[];
      expect(saved).toHaveLength(1);
      expect(saved[0].symbol).toBe('BTCUSDT');
    });

    it('returns false when at max capacity', () => {
      // Fill to max
      for (let i = 0; i < MAX_ALERTS; i++) {
        useAlertStore.getState().addAlert(createTestAlert({ targetPrice: 50000 + i }));
      }

      expect(useAlertStore.getState().alerts).toHaveLength(MAX_ALERTS);

      const success = useAlertStore.getState().addAlert(createTestAlert({ targetPrice: 99999 }));
      expect(success).toBe(false);
      expect(useAlertStore.getState().alerts).toHaveLength(MAX_ALERTS);
    });

    it('adds multiple alerts with unique ids', () => {
      useAlertStore.getState().addAlert(createTestAlert({ targetPrice: 50000 }));
      useAlertStore.getState().addAlert(createTestAlert({ targetPrice: 60000 }));

      const alerts = useAlertStore.getState().alerts;
      expect(alerts).toHaveLength(2);
      expect(alerts[0].id).not.toBe(alerts[1].id);
    });
  });

  // ---------------------------------------------------------------------------
  // removeAlert
  // ---------------------------------------------------------------------------

  describe('removeAlert', () => {
    it('removes an alert by id', () => {
      useAlertStore.getState().addAlert(createTestAlert());
      const alertId = useAlertStore.getState().alerts[0].id;

      useAlertStore.getState().removeAlert(alertId);

      expect(useAlertStore.getState().alerts).toHaveLength(0);
    });

    it('saves to localStorage after removing', () => {
      useAlertStore.getState().addAlert(createTestAlert());
      localStorageMock.setItem.mockClear();

      const alertId = useAlertStore.getState().alerts[0].id;
      useAlertStore.getState().removeAlert(alertId);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(ALERTS_STORAGE_KEY, '[]');
    });

    it('does nothing for non-existent id', () => {
      useAlertStore.getState().addAlert(createTestAlert());

      useAlertStore.getState().removeAlert('non-existent-id');

      expect(useAlertStore.getState().alerts).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // toggleAlert
  // ---------------------------------------------------------------------------

  describe('toggleAlert', () => {
    it('toggles an active alert to inactive', () => {
      useAlertStore.getState().addAlert(createTestAlert({ isActive: true }));
      const alertId = useAlertStore.getState().alerts[0].id;

      useAlertStore.getState().toggleAlert(alertId);

      expect(useAlertStore.getState().alerts[0].isActive).toBe(false);
    });

    it('toggles an inactive alert to active', () => {
      useAlertStore.getState().addAlert(createTestAlert({ isActive: false }));
      const alertId = useAlertStore.getState().alerts[0].id;

      useAlertStore.getState().toggleAlert(alertId);

      expect(useAlertStore.getState().alerts[0].isActive).toBe(true);
    });

    it('saves to localStorage after toggling', () => {
      useAlertStore.getState().addAlert(createTestAlert());
      localStorageMock.setItem.mockClear();

      const alertId = useAlertStore.getState().alerts[0].id;
      useAlertStore.getState().toggleAlert(alertId);

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('sets activatedAt when toggling ON', () => {
      useAlertStore.getState().addAlert(createTestAlert({ isActive: false }));
      const alertId = useAlertStore.getState().alerts[0].id;
      const beforeToggle = Date.now();

      useAlertStore.getState().toggleAlert(alertId);

      const alert = useAlertStore.getState().alerts[0];
      expect(alert.isActive).toBe(true);
      expect(alert.activatedAt).toBeGreaterThanOrEqual(beforeToggle);
    });

    it('does not update activatedAt when toggling OFF', () => {
      useAlertStore.getState().addAlert(createTestAlert({ isActive: true }));
      const alertId = useAlertStore.getState().alerts[0].id;
      const originalActivatedAt = useAlertStore.getState().alerts[0].activatedAt;

      useAlertStore.getState().toggleAlert(alertId);

      const alert = useAlertStore.getState().alerts[0];
      expect(alert.isActive).toBe(false);
      expect(alert.activatedAt).toBe(originalActivatedAt);
    });
  });

  // ---------------------------------------------------------------------------
  // checkAlerts
  // ---------------------------------------------------------------------------

  describe('checkAlerts', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('triggers alert when price is above target (direction: above)', () => {
      useAlertStore.getState().addAlert(
        createTestAlert({
          symbol: 'BTCUSDT',
          targetPrice: 50000,
          direction: 'above',
        }),
      );

      vi.advanceTimersByTime(ACTIVATION_GRACE_MS + 1);
      const triggered = useAlertStore.getState().checkAlerts('BTCUSDT', 51000);

      expect(triggered).toHaveLength(1);
      expect(triggered[0].targetPrice).toBe(50000);
    });

    it('triggers alert when price equals target (direction: above)', () => {
      useAlertStore.getState().addAlert(
        createTestAlert({
          targetPrice: 50000,
          direction: 'above',
        }),
      );

      vi.advanceTimersByTime(ACTIVATION_GRACE_MS + 1);
      const triggered = useAlertStore.getState().checkAlerts('BTCUSDT', 50000);
      expect(triggered).toHaveLength(1);
    });

    it('does not trigger when price is below target (direction: above)', () => {
      useAlertStore.getState().addAlert(
        createTestAlert({
          targetPrice: 50000,
          direction: 'above',
        }),
      );

      vi.advanceTimersByTime(ACTIVATION_GRACE_MS + 1);
      const triggered = useAlertStore.getState().checkAlerts('BTCUSDT', 49000);
      expect(triggered).toHaveLength(0);
    });

    it('triggers alert when price is below target (direction: below)', () => {
      useAlertStore.getState().addAlert(
        createTestAlert({
          targetPrice: 50000,
          direction: 'below',
        }),
      );

      vi.advanceTimersByTime(ACTIVATION_GRACE_MS + 1);
      const triggered = useAlertStore.getState().checkAlerts('BTCUSDT', 49000);

      expect(triggered).toHaveLength(1);
      expect(triggered[0].targetPrice).toBe(50000);
    });

    it('triggers alert when price equals target (direction: below)', () => {
      useAlertStore.getState().addAlert(
        createTestAlert({
          targetPrice: 50000,
          direction: 'below',
        }),
      );

      vi.advanceTimersByTime(ACTIVATION_GRACE_MS + 1);
      const triggered = useAlertStore.getState().checkAlerts('BTCUSDT', 50000);
      expect(triggered).toHaveLength(1);
    });

    it('does not trigger when price is above target (direction: below)', () => {
      useAlertStore.getState().addAlert(
        createTestAlert({
          targetPrice: 50000,
          direction: 'below',
        }),
      );

      vi.advanceTimersByTime(ACTIVATION_GRACE_MS + 1);
      const triggered = useAlertStore.getState().checkAlerts('BTCUSDT', 51000);
      expect(triggered).toHaveLength(0);
    });

    it('deactivates triggered alerts', () => {
      useAlertStore.getState().addAlert(
        createTestAlert({
          targetPrice: 50000,
          direction: 'above',
        }),
      );

      vi.advanceTimersByTime(ACTIVATION_GRACE_MS + 1);
      useAlertStore.getState().checkAlerts('BTCUSDT', 51000);

      expect(useAlertStore.getState().alerts[0].isActive).toBe(false);
    });

    it('does not trigger inactive alerts', () => {
      useAlertStore.getState().addAlert(
        createTestAlert({
          targetPrice: 50000,
          direction: 'above',
          isActive: false,
        }),
      );

      vi.advanceTimersByTime(ACTIVATION_GRACE_MS + 1);
      const triggered = useAlertStore.getState().checkAlerts('BTCUSDT', 51000);
      expect(triggered).toHaveLength(0);
    });

    it('only triggers alerts for the matching symbol', () => {
      useAlertStore.getState().addAlert(
        createTestAlert({
          symbol: 'BTCUSDT',
          targetPrice: 50000,
          direction: 'above',
        }),
      );
      useAlertStore.getState().addAlert(
        createTestAlert({
          symbol: 'ETHUSDT',
          targetPrice: 3000,
          direction: 'above',
        }),
      );

      vi.advanceTimersByTime(ACTIVATION_GRACE_MS + 1);
      const triggered = useAlertStore.getState().checkAlerts('BTCUSDT', 51000);

      expect(triggered).toHaveLength(1);
      expect(triggered[0].symbol).toBe('BTCUSDT');
    });

    it('triggers multiple alerts for the same symbol', () => {
      useAlertStore.getState().addAlert(
        createTestAlert({
          targetPrice: 50000,
          direction: 'above',
        }),
      );
      useAlertStore.getState().addAlert(
        createTestAlert({
          targetPrice: 48000,
          direction: 'above',
        }),
      );

      vi.advanceTimersByTime(ACTIVATION_GRACE_MS + 1);
      const triggered = useAlertStore.getState().checkAlerts('BTCUSDT', 51000);
      expect(triggered).toHaveLength(2);
    });

    it('saves to localStorage after triggering', () => {
      useAlertStore.getState().addAlert(
        createTestAlert({
          targetPrice: 50000,
          direction: 'above',
        }),
      );
      localStorageMock.setItem.mockClear();

      vi.advanceTimersByTime(ACTIVATION_GRACE_MS + 1);
      useAlertStore.getState().checkAlerts('BTCUSDT', 51000);

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('does not save when no alerts are triggered', () => {
      useAlertStore.getState().addAlert(
        createTestAlert({
          targetPrice: 50000,
          direction: 'above',
        }),
      );
      localStorageMock.setItem.mockClear();

      vi.advanceTimersByTime(ACTIVATION_GRACE_MS + 1);
      useAlertStore.getState().checkAlerts('BTCUSDT', 49000);

      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    // -- Grace period tests ---------------------------------------------------

    it('does not trigger during activation grace period', () => {
      useAlertStore.getState().addAlert(
        createTestAlert({
          targetPrice: 50000,
          direction: 'above',
        }),
      );

      // Check immediately (within grace period)
      const triggered = useAlertStore.getState().checkAlerts('BTCUSDT', 51000);
      expect(triggered).toHaveLength(0);
      // Alert remains active
      expect(useAlertStore.getState().alerts[0].isActive).toBe(true);
    });

    it('triggers after grace period elapses', () => {
      useAlertStore.getState().addAlert(
        createTestAlert({
          targetPrice: 50000,
          direction: 'above',
        }),
      );

      // Still within grace period
      vi.advanceTimersByTime(ACTIVATION_GRACE_MS - 100);
      const triggeredEarly = useAlertStore.getState().checkAlerts('BTCUSDT', 51000);
      expect(triggeredEarly).toHaveLength(0);

      // Now past grace period
      vi.advanceTimersByTime(200);
      const triggeredLate = useAlertStore.getState().checkAlerts('BTCUSDT', 51000);
      expect(triggeredLate).toHaveLength(1);
    });

    it('resets grace period when alert is toggled back on', () => {
      useAlertStore.getState().addAlert(
        createTestAlert({
          targetPrice: 50000,
          direction: 'above',
        }),
      );

      // Advance past grace period
      vi.advanceTimersByTime(ACTIVATION_GRACE_MS + 1);

      // Toggle off, then back on
      const alertId = useAlertStore.getState().alerts[0].id;
      useAlertStore.getState().toggleAlert(alertId); // OFF
      useAlertStore.getState().toggleAlert(alertId); // ON — new grace period

      // Check immediately after re-activation — should NOT trigger
      const triggered = useAlertStore.getState().checkAlerts('BTCUSDT', 51000);
      expect(triggered).toHaveLength(0);

      // Advance past new grace period — should trigger
      vi.advanceTimersByTime(ACTIVATION_GRACE_MS + 1);
      const triggeredAfter = useAlertStore.getState().checkAlerts('BTCUSDT', 51000);
      expect(triggeredAfter).toHaveLength(1);
    });

    it('allows alerts without activatedAt (backward compatibility)', () => {
      // Simulate loading an alert from localStorage without activatedAt
      const stored: PriceAlert[] = [
        {
          id: 'legacy-alert',
          symbol: 'BTCUSDT',
          targetPrice: 50000,
          direction: 'above',
          isActive: true,
          createdAt: Date.now() - 60_000, // Created 1 minute ago
          // No activatedAt field
        },
      ];
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(stored));
      useAlertStore.getState().loadAlerts();

      // Should trigger immediately (no grace period for legacy alerts)
      const triggered = useAlertStore.getState().checkAlerts('BTCUSDT', 51000);
      expect(triggered).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // loadAlerts
  // ---------------------------------------------------------------------------

  describe('loadAlerts', () => {
    it('loads alerts from localStorage', () => {
      const stored: PriceAlert[] = [
        {
          id: 'alert-1',
          symbol: 'BTCUSDT',
          targetPrice: 50000,
          direction: 'above',
          isActive: true,
          createdAt: Date.now(),
        },
      ];
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(stored));

      useAlertStore.getState().loadAlerts();

      expect(useAlertStore.getState().alerts).toHaveLength(1);
      expect(useAlertStore.getState().alerts[0].id).toBe('alert-1');
    });

    it('returns empty array for invalid JSON', () => {
      localStorageMock.getItem.mockReturnValueOnce('invalid-json');

      useAlertStore.getState().loadAlerts();

      expect(useAlertStore.getState().alerts).toHaveLength(0);
    });

    it('filters out malformed alert entries', () => {
      const stored = [
        {
          id: 'alert-1',
          symbol: 'BTCUSDT',
          targetPrice: 50000,
          direction: 'above',
          isActive: true,
          createdAt: Date.now(),
        },
        { id: 'bad', symbol: 123 }, // malformed
        null,
      ];
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(stored));

      useAlertStore.getState().loadAlerts();

      expect(useAlertStore.getState().alerts).toHaveLength(1);
    });

    it('returns empty array when nothing stored', () => {
      localStorageMock.getItem.mockReturnValueOnce(null);

      useAlertStore.getState().loadAlerts();

      expect(useAlertStore.getState().alerts).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // isAlertTriggered (exported helper)
  // ---------------------------------------------------------------------------

  describe('isAlertTriggered', () => {
    const baseAlert: PriceAlert = {
      id: 'test',
      symbol: 'BTCUSDT',
      targetPrice: 50000,
      direction: 'above',
      isActive: true,
      createdAt: Date.now(),
    };

    it('returns true when price >= target for above direction', () => {
      expect(isAlertTriggered(baseAlert, 50000)).toBe(true);
      expect(isAlertTriggered(baseAlert, 51000)).toBe(true);
    });

    it('returns false when price < target for above direction', () => {
      expect(isAlertTriggered(baseAlert, 49999)).toBe(false);
    });

    it('returns true when price <= target for below direction', () => {
      const belowAlert = { ...baseAlert, direction: 'below' as const };
      expect(isAlertTriggered(belowAlert, 50000)).toBe(true);
      expect(isAlertTriggered(belowAlert, 49000)).toBe(true);
    });

    it('returns false when price > target for below direction', () => {
      const belowAlert = { ...baseAlert, direction: 'below' as const };
      expect(isAlertTriggered(belowAlert, 50001)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // reset
  // ---------------------------------------------------------------------------

  describe('reset', () => {
    it('clears all alerts', () => {
      useAlertStore.getState().addAlert(createTestAlert());
      useAlertStore.getState().addAlert(createTestAlert({ targetPrice: 60000 }));

      useAlertStore.getState().reset();

      expect(useAlertStore.getState().alerts).toHaveLength(0);
    });
  });
});
