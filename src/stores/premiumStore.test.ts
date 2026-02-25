// =============================================================================
// Premium Store Unit Tests
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { usePremiumStore, calculatePremium } from './premiumStore';

describe('premiumStore', () => {
  beforeEach(() => {
    usePremiumStore.getState().reset();
  });

  // ---------------------------------------------------------------------------
  // calculatePremium (pure function)
  // ---------------------------------------------------------------------------

  describe('calculatePremium', () => {
    it('returns positive premium when Upbit price exceeds Binance KRW equivalent', () => {
      // Binance: $60,000 * 1,350 = 81,000,000 KRW
      // Upbit: 82,000,000 KRW
      // Premium: (82M - 81M) / 81M * 100 ≈ 1.23%
      const result = calculatePremium(60000, 82_000_000, 1350);
      expect(result).toBeCloseTo(1.2346, 2);
    });

    it('returns negative premium when Upbit price is below Binance KRW equivalent', () => {
      // Binance: $60,000 * 1,350 = 81,000,000 KRW
      // Upbit: 80,000,000 KRW
      const result = calculatePremium(60000, 80_000_000, 1350);
      expect(result).toBeLessThan(0);
    });

    it('returns 0 when prices are equal in KRW terms', () => {
      const result = calculatePremium(60000, 81_000_000, 1350);
      expect(result).toBeCloseTo(0, 5);
    });

    it('returns 0 when binance price is 0', () => {
      expect(calculatePremium(0, 82_000_000, 1350)).toBe(0);
    });

    it('returns 0 when exchange rate is 0', () => {
      expect(calculatePremium(60000, 82_000_000, 0)).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Store actions
  // ---------------------------------------------------------------------------

  describe('setBinancePrice', () => {
    it('updates binance price and recalculates premium', () => {
      const store = usePremiumStore.getState();
      store.setUsdKrwRate(1350);
      store.setUpbitPrice(82_000_000);
      store.setBinancePrice(60000);

      const state = usePremiumStore.getState();
      expect(state.binancePrice).toBe(60000);
      expect(state.premium).toBeCloseTo(1.2346, 2);
    });
  });

  describe('setUpbitPrice', () => {
    it('updates upbit price and recalculates premium', () => {
      const store = usePremiumStore.getState();
      store.setUsdKrwRate(1350);
      store.setBinancePrice(60000);
      store.setUpbitPrice(82_000_000);

      const state = usePremiumStore.getState();
      expect(state.upbitPrice).toBe(82_000_000);
      expect(state.premium).toBeCloseTo(1.2346, 2);
    });
  });

  describe('setUsdKrwRate', () => {
    it('updates rate and recalculates premium', () => {
      const store = usePremiumStore.getState();
      store.setBinancePrice(60000);
      store.setUpbitPrice(82_000_000);
      store.setUsdKrwRate(1350);

      const state = usePremiumStore.getState();
      expect(state.usdKrwRate).toBe(1350);
      expect(state.premium).toBeCloseTo(1.2346, 2);
    });
  });

  describe('reset', () => {
    it('resets all values to initial state', () => {
      const store = usePremiumStore.getState();
      store.setBinancePrice(60000);
      store.setUpbitPrice(82_000_000);
      store.setUsdKrwRate(1350);

      store.reset();

      const state = usePremiumStore.getState();
      expect(state.binancePrice).toBe(0);
      expect(state.upbitPrice).toBe(0);
      expect(state.usdKrwRate).toBe(0);
      expect(state.premium).toBe(0);
    });
  });
});
