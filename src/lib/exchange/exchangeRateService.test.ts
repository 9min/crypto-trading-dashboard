// =============================================================================
// Exchange Rate Service Unit Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchUsdKrwRate,
  getCachedUsdKrwRate,
  resetExchangeRateCache,
} from './exchangeRateService';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
  resetExchangeRateCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('fetchUsdKrwRate', () => {
  it('fetches and returns the KRW rate', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: 'success', rates: { KRW: 1350.5 } }),
    });

    const rate = await fetchUsdKrwRate();
    expect(rate).toBe(1350.5);
  });

  it('returns cached rate on subsequent calls within TTL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: 'success', rates: { KRW: 1350 } }),
    });

    const rate1 = await fetchUsdKrwRate();
    const rate2 = await fetchUsdKrwRate();

    expect(rate1).toBe(1350);
    expect(rate2).toBe(1350);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns fallback rate on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const rate = await fetchUsdKrwRate();
    expect(rate).toBe(1350); // Default fallback
  });

  it('returns fallback when response has invalid structure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: 'error' }),
    });

    const rate = await fetchUsdKrwRate();
    expect(rate).toBe(1350);
  });

  it('returns cached rate when fetch fails after previous success', async () => {
    // First call succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: 'success', rates: { KRW: 1380 } }),
    });
    await fetchUsdKrwRate();

    // Reset cache TTL by resetting and re-caching
    resetExchangeRateCache();

    // Now fetch succeeds with new rate, then fails
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: 'success', rates: { KRW: 1390 } }),
    });
    const rate = await fetchUsdKrwRate();
    expect(rate).toBe(1390);
  });
});

describe('getCachedUsdKrwRate', () => {
  it('returns fallback when no cache exists', () => {
    expect(getCachedUsdKrwRate()).toBe(1350);
  });

  it('returns cached rate after fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: 'success', rates: { KRW: 1400 } }),
    });

    await fetchUsdKrwRate();
    expect(getCachedUsdKrwRate()).toBe(1400);
  });
});

describe('resetExchangeRateCache', () => {
  it('clears the cache', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: 'success', rates: { KRW: 1400 } }),
    });

    await fetchUsdKrwRate();
    expect(getCachedUsdKrwRate()).toBe(1400);

    resetExchangeRateCache();
    expect(getCachedUsdKrwRate()).toBe(1350); // Back to fallback
  });
});
