// =============================================================================
// Premium Store
// =============================================================================
// Manages kimchi premium calculation state: Binance USD price, Upbit KRW price,
// USD/KRW exchange rate, and the derived premium percentage.
// =============================================================================

import { create } from 'zustand';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PremiumStoreState {
  /** Binance price in USD */
  binancePrice: number;
  /** Upbit price in KRW */
  upbitPrice: number;
  /** USD/KRW exchange rate */
  usdKrwRate: number;
  /** Calculated premium percentage */
  premium: number;
}

interface PremiumStoreActions {
  /** Update Binance price and recalculate premium */
  setBinancePrice: (price: number) => void;
  /** Update Upbit price and recalculate premium */
  setUpbitPrice: (price: number) => void;
  /** Update exchange rate and recalculate premium */
  setUsdKrwRate: (rate: number) => void;
  /** Reset store to initial state */
  reset: () => void;
}

type PremiumStore = PremiumStoreState & PremiumStoreActions;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Calculates the kimchi premium percentage.
 * Formula: ((upbitKrw - binanceUsd * rate) / (binanceUsd * rate)) * 100
 * Returns 0 if inputs are invalid (zero price or rate).
 */
function calculatePremium(binancePrice: number, upbitPrice: number, usdKrwRate: number): number {
  const binanceKrw = binancePrice * usdKrwRate;
  if (binanceKrw === 0) return 0;
  return ((upbitPrice - binanceKrw) / binanceKrw) * 100;
}

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const INITIAL_STATE: PremiumStoreState = {
  binancePrice: 0,
  upbitPrice: 0,
  usdKrwRate: 0,
  premium: 0,
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const usePremiumStore = create<PremiumStore>()((set, get) => ({
  ...INITIAL_STATE,

  setBinancePrice: (binancePrice: number): void => {
    const { upbitPrice, usdKrwRate } = get();
    set({
      binancePrice,
      premium: calculatePremium(binancePrice, upbitPrice, usdKrwRate),
    });
  },

  setUpbitPrice: (upbitPrice: number): void => {
    const { binancePrice, usdKrwRate } = get();
    set({
      upbitPrice,
      premium: calculatePremium(binancePrice, upbitPrice, usdKrwRate),
    });
  },

  setUsdKrwRate: (usdKrwRate: number): void => {
    const { binancePrice, upbitPrice } = get();
    set({
      usdKrwRate,
      premium: calculatePremium(binancePrice, upbitPrice, usdKrwRate),
    });
  },

  reset: (): void => {
    set(INITIAL_STATE);
  },
}));

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export { calculatePremium };
export type { PremiumStoreState, PremiumStoreActions, PremiumStore };
