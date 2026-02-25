// =============================================================================
// Exchange Rate Service
// =============================================================================
// Fetches and caches USD/KRW exchange rate for kimchi premium calculation.
// Uses a stale-while-revalidate pattern with 60-second cache TTL.
// Falls back to a reasonable default on failure.
// =============================================================================

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Cache TTL in milliseconds (60 seconds) */
const CACHE_TTL_MS = 60_000;

/** Fallback rate when all API calls fail */
const FALLBACK_RATE = 1350;

/** Exchange rate API endpoint (free, no API key required) */
const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest/USD';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ExchangeRateApiResponse {
  result: string;
  rates: Record<string, number>;
}

interface CachedRate {
  rate: number;
  fetchedAt: number;
}

// -----------------------------------------------------------------------------
// Cache State
// -----------------------------------------------------------------------------

let cachedRate: CachedRate | null = null;
let fetchPromise: Promise<number> | null = null;

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Returns the current USD/KRW exchange rate.
 * Uses a 60-second cache. Returns cached value immediately if fresh.
 * Falls back to a reasonable default on failure.
 */
export async function fetchUsdKrwRate(): Promise<number> {
  // Return cached rate if still fresh
  if (cachedRate && Date.now() - cachedRate.fetchedAt < CACHE_TTL_MS) {
    return cachedRate.rate;
  }

  // Deduplicate concurrent requests
  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = fetchRate();

  try {
    const rate = await fetchPromise;
    return rate;
  } finally {
    fetchPromise = null;
  }
}

/**
 * Returns the cached rate synchronously, or the fallback if no cache exists.
 * Useful for immediate rendering without await.
 */
export function getCachedUsdKrwRate(): number {
  return cachedRate?.rate ?? FALLBACK_RATE;
}

/**
 * Resets the cache. Intended for testing only.
 */
export function resetExchangeRateCache(): void {
  cachedRate = null;
  fetchPromise = null;
}

// -----------------------------------------------------------------------------
// Internal
// -----------------------------------------------------------------------------

async function fetchRate(): Promise<number> {
  try {
    const response = await fetch(EXCHANGE_RATE_API_URL, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as ExchangeRateApiResponse;

    if (data.result !== 'success' || typeof data.rates?.KRW !== 'number') {
      throw new Error('Invalid exchange rate API response');
    }

    const rate = data.rates.KRW;
    cachedRate = { rate, fetchedAt: Date.now() };
    return rate;
  } catch (error) {
    console.error('[exchangeRateService] Failed to fetch USD/KRW rate', {
      timestamp: Date.now(),
      error,
    });

    // Return cached rate if available, otherwise fallback
    return cachedRate?.rate ?? FALLBACK_RATE;
  }
}
