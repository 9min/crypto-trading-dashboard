// =============================================================================
// usePremiumStream Hook
// =============================================================================
// Polls Binance and Upbit REST APIs for the current symbol's price and fetches
// the USD/KRW exchange rate to compute the kimchi premium.
// Uses REST polling instead of WebSocket for reliable operation on Vercel.
// =============================================================================

import { useEffect } from 'react';
import { fetchUsdKrwRate } from '@/lib/exchange/exchangeRateService';
import { usePremiumStore } from '@/stores/premiumStore';
import { useUiStore } from '@/stores/uiStore';
import { useKlineStore } from '@/stores/klineStore';
import { toUpbitSymbol } from '@/utils/symbolMap';
import type { BinanceTickerPriceResponse } from '@/types/binance';
import type { UpbitTickerResponse } from '@/types/upbit';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Price polling interval (5 seconds) */
const PRICE_POLL_INTERVAL_MS = 5_000;

/** Exchange rate polling interval (60 seconds) */
const RATE_POLL_INTERVAL_MS = 60_000;

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function usePremiumStream(): void {
  const symbol = useUiStore((state) => state.symbol);
  const setBinancePrice = usePremiumStore((state) => state.setBinancePrice);
  const setUpbitPrice = usePremiumStore((state) => state.setUpbitPrice);
  const setUsdKrwRate = usePremiumStore((state) => state.setUsdKrwRate);
  const resetPremium = usePremiumStore((state) => state.reset);

  useEffect(() => {
    let isActive = true;

    const binanceSymbol = symbol;
    const upbitSymbol = toUpbitSymbol(symbol);

    resetPremium();

    // -- Binance price polling (via proxy to avoid CORS) --
    const fetchBinancePrice = async (): Promise<void> => {
      try {
        const response = await fetch(
          `/api/binance/ticker/price?symbol=${encodeURIComponent(binanceSymbol)}`,
          { signal: AbortSignal.timeout(10_000) },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = (await response.json()) as BinanceTickerPriceResponse;
        if (isActive && data.price) {
          setBinancePrice(parseFloat(data.price));
        }
      } catch {
        // REST API may be geo-restricted (e.g., 403 from South Korea).
        // Fallback: use the latest kline close price when on Binance exchange
        // (klineStore receives data via WebSocket which uses a different endpoint).
        if (!isActive) return;
        const exchange = useUiStore.getState().exchange;
        if (exchange === 'binance') {
          const candles = useKlineStore.getState().candles;
          if (candles.length > 0) {
            const lastClose = candles[candles.length - 1].close;
            if (lastClose > 0) {
              setBinancePrice(lastClose);
            }
          }
        }
      }
    };

    // -- Upbit price polling (via existing proxy) --
    const fetchUpbitPrice = async (): Promise<void> => {
      try {
        const response = await fetch(
          `/api/upbit/ticker?markets=${encodeURIComponent(upbitSymbol)}`,
          { signal: AbortSignal.timeout(10_000) },
        );
        if (!response.ok) return;

        const data = (await response.json()) as UpbitTickerResponse[];
        if (isActive && data.length > 0 && data[0].trade_price > 0) {
          setUpbitPrice(data[0].trade_price);
        }
      } catch {
        // Silently ignore — will retry on next interval
      }
    };

    // -- Exchange rate polling --
    const fetchRate = (): void => {
      fetchUsdKrwRate()
        .then((rate) => {
          if (isActive) {
            setUsdKrwRate(rate);
          }
        })
        .catch(() => {
          // Error already logged in exchangeRateService
        });
    };

    // Initial fetch — all three in parallel
    void fetchBinancePrice();
    void fetchUpbitPrice();
    fetchRate();

    // Periodic polling
    const priceInterval = setInterval(() => {
      void fetchBinancePrice();
      void fetchUpbitPrice();
    }, PRICE_POLL_INTERVAL_MS);

    const rateInterval = setInterval(fetchRate, RATE_POLL_INTERVAL_MS);

    // -- Cleanup --
    return () => {
      isActive = false;
      clearInterval(priceInterval);
      clearInterval(rateInterval);
    };
  }, [symbol, setBinancePrice, setUpbitPrice, setUsdKrwRate, resetPremium]);
}
