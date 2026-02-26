// =============================================================================
// usePriceAlertMonitor Tests
// =============================================================================
// Tests that the hook correctly:
//   - Monitors watchlist ticker prices and sends notifications
//   - Monitors active symbol trade prices and sends notifications
//   - Throttles alert checks to avoid excessive processing
//   - Skips monitoring when no active alerts exist
//   - Cleans up subscriptions on unmount
// =============================================================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePriceAlertMonitor } from './usePriceAlertMonitor';
import { useAlertStore, ACTIVATION_GRACE_MS } from '@/stores/alertStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useTradeStore } from '@/stores/tradeStore';
import { useUiStore } from '@/stores/uiStore';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

const mockSendNotification = vi.fn();

vi.mock('@/hooks/useNotification', () => ({
  useNotification: () => ({
    permission: 'granted' as const,
    requestPermission: vi.fn(),
    sendNotification: mockSendNotification,
  }),
}));

// Mock localStorage for alertStore persistence
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
// Constants
// -----------------------------------------------------------------------------

/** Time to advance past both the activation grace period and the throttle */
const PAST_GRACE = ACTIVATION_GRACE_MS + 100;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function addActiveAlert(
  symbol: string,
  targetPrice: number,
  direction: 'above' | 'below' = 'above',
): void {
  useAlertStore.getState().addAlert({
    symbol,
    targetPrice,
    direction,
    isActive: true,
  });
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('usePriceAlertMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    useAlertStore.getState().reset();
    useWatchlistStore.getState().reset();
    useTradeStore.getState().reset();
    mockSendNotification.mockClear();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Watchlist ticker monitoring
  // ---------------------------------------------------------------------------

  describe('watchlist ticker monitoring', () => {
    it('sends notification when watchlist price triggers an alert', () => {
      addActiveAlert('BTCUSDT', 50000, 'above');

      renderHook(() => usePriceAlertMonitor());

      act(() => {
        // Advance past activation grace period + throttle
        vi.advanceTimersByTime(PAST_GRACE);

        useWatchlistStore.getState().setTickers([
          {
            symbol: 'BTCUSDT',
            price: 51000,
            priceChangePercent: 2.0,
            volume: 1000000,
            lastUpdateTime: Date.now(),
          },
        ]);
      });

      expect(mockSendNotification).toHaveBeenCalledWith(
        'Price Alert: BTCUSDT',
        expect.stringContaining('rose above'),
      );
    });

    it('sends notification for below-direction alert', () => {
      addActiveAlert('ETHUSDT', 3000, 'below');

      renderHook(() => usePriceAlertMonitor());

      act(() => {
        vi.advanceTimersByTime(PAST_GRACE);

        useWatchlistStore.getState().setTickers([
          {
            symbol: 'ETHUSDT',
            price: 2900,
            priceChangePercent: -3.0,
            volume: 500000,
            lastUpdateTime: Date.now(),
          },
        ]);
      });

      expect(mockSendNotification).toHaveBeenCalledWith(
        'Price Alert: ETHUSDT',
        expect.stringContaining('fell below'),
      );
    });

    it('does not send notification when price does not trigger alert', () => {
      addActiveAlert('BTCUSDT', 50000, 'above');

      renderHook(() => usePriceAlertMonitor());

      act(() => {
        vi.advanceTimersByTime(PAST_GRACE);

        useWatchlistStore.getState().setTickers([
          {
            symbol: 'BTCUSDT',
            price: 49000,
            priceChangePercent: -1.0,
            volume: 1000000,
            lastUpdateTime: Date.now(),
          },
        ]);
      });

      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it('deactivates alert after triggering', () => {
      addActiveAlert('BTCUSDT', 50000, 'above');

      renderHook(() => usePriceAlertMonitor());

      act(() => {
        vi.advanceTimersByTime(PAST_GRACE);

        useWatchlistStore.getState().setTickers([
          {
            symbol: 'BTCUSDT',
            price: 51000,
            priceChangePercent: 2.0,
            volume: 1000000,
            lastUpdateTime: Date.now(),
          },
        ]);
      });

      const alerts = useAlertStore.getState().alerts;
      expect(alerts[0].isActive).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Trade price monitoring
  // ---------------------------------------------------------------------------

  describe('trade price monitoring', () => {
    it('sends notification when trade price triggers an alert', () => {
      useUiStore.getState().setSymbol('BTCUSDT');
      addActiveAlert('BTCUSDT', 50000, 'above');

      renderHook(() => usePriceAlertMonitor());

      act(() => {
        vi.advanceTimersByTime(PAST_GRACE);

        useTradeStore.getState().addTrade({
          id: 1,
          price: 51000,
          quantity: 0.5,
          time: Date.now(),
          isBuyerMaker: false,
        });
      });

      expect(mockSendNotification).toHaveBeenCalledWith(
        'Price Alert: BTCUSDT',
        expect.stringContaining('rose above'),
      );
    });

    it('does not trigger for different symbol', () => {
      useUiStore.getState().setSymbol('ETHUSDT');
      addActiveAlert('BTCUSDT', 50000, 'above');

      renderHook(() => usePriceAlertMonitor());

      act(() => {
        vi.advanceTimersByTime(PAST_GRACE);

        useTradeStore.getState().addTrade({
          id: 1,
          price: 51000,
          quantity: 0.5,
          time: Date.now(),
          isBuyerMaker: false,
        });
      });

      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it('skips when lastPrice is zero', () => {
      useUiStore.getState().setSymbol('BTCUSDT');
      addActiveAlert('BTCUSDT', 0, 'below');

      renderHook(() => usePriceAlertMonitor());

      // tradeStore starts with lastPrice === 0, no trade added
      expect(mockSendNotification).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Throttling
  // ---------------------------------------------------------------------------

  describe('throttling', () => {
    it('throttles alert checks within the interval', () => {
      addActiveAlert('BTCUSDT', 50000, 'above');
      addActiveAlert('ETHUSDT', 3000, 'above');

      renderHook(() => usePriceAlertMonitor());

      // Advance past grace period first
      act(() => {
        vi.advanceTimersByTime(PAST_GRACE);
      });

      // First update — triggers check (past grace period, throttle passes)
      act(() => {
        useWatchlistStore.getState().setTickers([
          {
            symbol: 'BTCUSDT',
            price: 51000,
            priceChangePercent: 2.0,
            volume: 1000000,
            lastUpdateTime: Date.now(),
          },
        ]);
      });

      const firstCallCount = mockSendNotification.mock.calls.length;

      // Second update within throttle window — should be skipped
      act(() => {
        vi.advanceTimersByTime(500); // Only 500ms, below 1000ms threshold

        useWatchlistStore.getState().updateTicker('ETHUSDT', {
          price: 3100,
          priceChangePercent: 3.0,
          volume: 200000,
          lastUpdateTime: Date.now(),
        });
      });

      // No additional notification sent because throttled
      expect(mockSendNotification.mock.calls.length).toBe(firstCallCount);
    });

    it('allows check after throttle interval elapses', () => {
      addActiveAlert('BTCUSDT', 50000, 'above');
      addActiveAlert('ETHUSDT', 3000, 'above');

      renderHook(() => usePriceAlertMonitor());

      // Advance past grace period
      act(() => {
        vi.advanceTimersByTime(PAST_GRACE);
      });

      // First update — triggers BTCUSDT alert
      act(() => {
        useWatchlistStore.getState().setTickers([
          {
            symbol: 'BTCUSDT',
            price: 51000,
            priceChangePercent: 2.0,
            volume: 1000000,
            lastUpdateTime: Date.now(),
          },
          {
            symbol: 'ETHUSDT',
            price: 2900, // Below target, won't trigger 'above' alert
            priceChangePercent: -1.0,
            volume: 200000,
            lastUpdateTime: Date.now(),
          },
        ]);
      });

      const firstCallCount = mockSendNotification.mock.calls.length;

      // Advance past throttle interval
      act(() => {
        vi.advanceTimersByTime(1100);

        // Now ETHUSDT crosses above target
        useWatchlistStore.getState().updateTicker('ETHUSDT', {
          price: 3100,
          priceChangePercent: 3.0,
          volume: 200000,
          lastUpdateTime: Date.now(),
        });
      });

      expect(mockSendNotification.mock.calls.length).toBeGreaterThan(firstCallCount);
    });
  });

  // ---------------------------------------------------------------------------
  // No active alerts — skip monitoring
  // ---------------------------------------------------------------------------

  describe('no active alerts', () => {
    it('does not subscribe when no active alerts exist', () => {
      renderHook(() => usePriceAlertMonitor());

      act(() => {
        vi.advanceTimersByTime(PAST_GRACE);

        useWatchlistStore.getState().setTickers([
          {
            symbol: 'BTCUSDT',
            price: 99999,
            priceChangePercent: 100,
            volume: 1000000,
            lastUpdateTime: Date.now(),
          },
        ]);
      });

      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it('does not subscribe when all alerts are inactive', () => {
      useAlertStore.getState().addAlert({
        symbol: 'BTCUSDT',
        targetPrice: 50000,
        direction: 'above',
        isActive: false,
      });

      renderHook(() => usePriceAlertMonitor());

      act(() => {
        vi.advanceTimersByTime(PAST_GRACE);

        useWatchlistStore.getState().setTickers([
          {
            symbol: 'BTCUSDT',
            price: 99999,
            priceChangePercent: 100,
            volume: 1000000,
            lastUpdateTime: Date.now(),
          },
        ]);
      });

      expect(mockSendNotification).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  describe('cleanup', () => {
    it('unsubscribes from stores on unmount', () => {
      addActiveAlert('BTCUSDT', 50000, 'above');

      const { unmount } = renderHook(() => usePriceAlertMonitor());

      unmount();

      // After unmount, store updates should not trigger notifications
      act(() => {
        vi.advanceTimersByTime(PAST_GRACE);

        useWatchlistStore.getState().setTickers([
          {
            symbol: 'BTCUSDT',
            price: 99999,
            priceChangePercent: 100,
            volume: 1000000,
            lastUpdateTime: Date.now(),
          },
        ]);
      });

      expect(mockSendNotification).not.toHaveBeenCalled();
    });
  });
});
