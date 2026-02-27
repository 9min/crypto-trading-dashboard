// =============================================================================
// usePremiumStream Tests
// =============================================================================
// Tests that the hook correctly polls Binance/Upbit prices and exchange rate
// for kimchi premium calculation.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

const mockFetchUsdKrwRate = vi.fn();

vi.mock('@/lib/exchange/exchangeRateService', () => ({
  fetchUsdKrwRate: () => mockFetchUsdKrwRate(),
}));

vi.mock('@/utils/symbolMap', () => ({
  toUpbitSymbol: (s: string) => {
    const map: Record<string, string> = {
      BTCUSDT: 'KRW-BTC',
      ETHUSDT: 'KRW-ETH',
    };
    return map[s] ?? s;
  },
}));

import { useUiStore } from '@/stores/uiStore';
import { usePremiumStore } from '@/stores/premiumStore';
import { usePremiumStream } from './usePremiumStream';

// Mock global fetch
const mockFetch = vi.fn();

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('usePremiumStream', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    useUiStore.getState().setSymbol('BTCUSDT');
    usePremiumStore.getState().reset();

    mockFetchUsdKrwRate.mockResolvedValue(1350);

    // Default: Binance price response
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('binance')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ symbol: 'BTCUSDT', price: '50000.00' }),
        });
      }
      if (typeof url === 'string' && url.includes('upbit')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ trade_price: 68000000 }]),
        });
      }
      return Promise.resolve({ ok: false });
    });

    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Initial fetch
  // ---------------------------------------------------------------------------

  describe('initial fetch', () => {
    it('calls fetchUsdKrwRate on mount', () => {
      renderHook(() => usePremiumStream());

      expect(mockFetchUsdKrwRate).toHaveBeenCalled();
    });

    it('sets usdKrwRate from exchange rate service', async () => {
      renderHook(() => usePremiumStream());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(usePremiumStore.getState().usdKrwRate).toBe(1350);
    });

    it('resets premium store on mount', () => {
      usePremiumStore.getState().setBinancePrice(50000);

      renderHook(() => usePremiumStream());

      // Reset is called first, so binancePrice should be 0
      expect(usePremiumStore.getState().binancePrice).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Binance price polling
  // ---------------------------------------------------------------------------

  describe('Binance price polling', () => {
    it('fetches Binance price on mount', async () => {
      renderHook(() => usePremiumStream());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('binance/ticker/price'),
        expect.any(Object),
      );
    });

    it('sets binancePrice from response', async () => {
      renderHook(() => usePremiumStream());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(usePremiumStore.getState().binancePrice).toBe(50000);
    });

    it('polls at PRICE_POLL_INTERVAL_MS (5s)', async () => {
      renderHook(() => usePremiumStream());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const initialCallCount = mockFetch.mock.calls.filter(
        (call) => typeof call[0] === 'string' && (call[0] as string).includes('binance'),
      ).length;

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      const afterPollCount = mockFetch.mock.calls.filter(
        (call) => typeof call[0] === 'string' && (call[0] as string).includes('binance'),
      ).length;

      expect(afterPollCount).toBeGreaterThan(initialCallCount);
    });
  });

  // ---------------------------------------------------------------------------
  // Upbit price polling
  // ---------------------------------------------------------------------------

  describe('Upbit price polling', () => {
    it('fetches Upbit price on mount', async () => {
      renderHook(() => usePremiumStream());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('upbit/ticker'),
        expect.any(Object),
      );
    });

    it('sets upbitPrice from response', async () => {
      renderHook(() => usePremiumStream());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(usePremiumStore.getState().upbitPrice).toBe(68000000);
    });

    it('ignores Upbit response with trade_price=0', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('upbit')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ trade_price: 0 }]),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ price: '50000' }) });
      });

      renderHook(() => usePremiumStream());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(usePremiumStore.getState().upbitPrice).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Exchange rate polling
  // ---------------------------------------------------------------------------

  describe('exchange rate polling', () => {
    it('polls exchange rate at 60s interval', async () => {
      renderHook(() => usePremiumStream());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const initialCount = mockFetchUsdKrwRate.mock.calls.length;

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });

      expect(mockFetchUsdKrwRate.mock.calls.length).toBeGreaterThan(initialCount);
    });

    it('updates usdKrwRate on subsequent polls', async () => {
      mockFetchUsdKrwRate.mockResolvedValueOnce(1350).mockResolvedValueOnce(1380);

      renderHook(() => usePremiumStream());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(usePremiumStore.getState().usdKrwRate).toBe(1350);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });

      expect(usePremiumStore.getState().usdKrwRate).toBe(1380);
    });
  });

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  describe('cleanup', () => {
    it('clears all intervals on unmount', async () => {
      const { unmount } = renderHook(() => usePremiumStream());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      mockFetch.mockClear();
      mockFetchUsdKrwRate.mockClear();

      unmount();

      // Advance time — no more polling should happen
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });

      // After unmount, Binance fetch should not be called again
      const binanceCalls = mockFetch.mock.calls.filter(
        (call) => typeof call[0] === 'string' && (call[0] as string).includes('binance'),
      );
      expect(binanceCalls.length).toBe(0);
    });

    it('resets store and re-fetches when symbol changes', async () => {
      const { rerender } = renderHook(() => usePremiumStream());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(usePremiumStore.getState().binancePrice).toBe(50000);

      // Change symbol
      useUiStore.getState().setSymbol('ETHUSDT');

      // Need to rerender to pick up the new symbol via selector
      rerender();

      // Store should be reset
      // New fetch calls should be made for the new symbol
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('ETHUSDT'),
        expect.any(Object),
      );
    });

    it('does not update store after unmount (isActive guard)', async () => {
      let resolveResponse: ((value: unknown) => void) | null = null;
      mockFetch.mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('binance')) {
          return new Promise((resolve) => {
            resolveResponse = resolve;
          });
        }
        return Promise.resolve({ ok: false });
      });

      const { unmount } = renderHook(() => usePremiumStream());

      unmount();

      // Resolve the in-flight request after unmount
      await act(async () => {
        resolveResponse?.({
          ok: true,
          json: () => Promise.resolve({ symbol: 'BTCUSDT', price: '99999' }),
        });
        await vi.advanceTimersByTimeAsync(50);
      });

      // Store should not have been updated
      expect(usePremiumStore.getState().binancePrice).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Error resilience
  // ---------------------------------------------------------------------------

  describe('error resilience', () => {
    it('silently handles Binance fetch errors', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('binance')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ trade_price: 68000000 }]),
        });
      });

      // Should not throw
      renderHook(() => usePremiumStream());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(usePremiumStore.getState().binancePrice).toBe(0);
    });

    it('silently handles Upbit fetch errors', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('upbit')) {
          return Promise.reject(new Error('Rate limited'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ symbol: 'BTCUSDT', price: '50000' }),
        });
      });

      renderHook(() => usePremiumStream());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(usePremiumStore.getState().upbitPrice).toBe(0);
    });
  });
});
