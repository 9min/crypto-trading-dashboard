// =============================================================================
// usePremiumStream Hook
// =============================================================================
// Subscribes to both Binance and Upbit ticker data simultaneously for the
// current symbol, fetches the USD/KRW exchange rate, and updates the
// premium store for kimchi premium calculation.
// =============================================================================

import { useEffect } from 'react';
import { parseCombinedStreamMessage } from '@/lib/websocket/messageRouter';
import { fetchUsdKrwRate } from '@/lib/exchange/exchangeRateService';
import { usePremiumStore } from '@/stores/premiumStore';
import { useUiStore } from '@/stores/uiStore';
import { toUpbitSymbol } from '@/utils/symbolMap';
import { getMiniTickerStream, buildStreamUrl } from '@/lib/binance/streamUrls';
import type { BinanceMiniTickerEvent } from '@/types/binance';
import type { UpbitTickerEvent, UpbitWebSocketMessage } from '@/types/upbit';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Exchange rate polling interval (60 seconds) */
const RATE_POLL_INTERVAL_MS = 60_000;

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function usePremiumStream(): void {
  const symbol = useUiStore((state) => state.symbol);
  const exchange = useUiStore((state) => state.exchange);
  const setBinancePrice = usePremiumStore((state) => state.setBinancePrice);
  const setUpbitPrice = usePremiumStore((state) => state.setUpbitPrice);
  const setUsdKrwRate = usePremiumStore((state) => state.setUsdKrwRate);
  const resetPremium = usePremiumStore((state) => state.reset);

  useEffect(() => {
    let isActive = true;

    // symbol is always Binance format — convert for Upbit API
    const binanceSymbol = symbol;
    const upbitSymbol = toUpbitSymbol(symbol);

    resetPremium();

    // -- Binance: subscribe to miniTicker for USD price --
    const binanceWsUrl = buildStreamUrl([getMiniTickerStream(binanceSymbol)]);
    const binanceWs = new WebSocket(binanceWsUrl);

    const handleBinanceMessage = (event: MessageEvent): void => {
      if (!isActive) return;
      const rawData = event.data;
      if (typeof rawData !== 'string') return;

      const message = parseCombinedStreamMessage(rawData);
      if (!message || message.e !== '24hrMiniTicker') return;

      const ticker = message as BinanceMiniTickerEvent;
      setBinancePrice(parseFloat(ticker.c));
    };

    binanceWs.addEventListener('message', handleBinanceMessage);

    // -- Upbit: subscribe to ticker for KRW price --
    const upbitWs = new WebSocket('wss://api.upbit.com/websocket/v1');

    const handleUpbitOpen = (): void => {
      if (!isActive) return;
      const subMessage = [
        { ticket: `premium-${Date.now()}` },
        { type: 'ticker', codes: [upbitSymbol], isOnlyRealtime: true },
      ];
      upbitWs.send(JSON.stringify(subMessage));
    };

    const handleUpbitMessage = (event: MessageEvent): void => {
      if (!isActive) return;

      const rawData = event.data;
      if (rawData instanceof Blob) {
        rawData
          .text()
          .then((text) => {
            if (!isActive) return;
            try {
              const parsed = JSON.parse(text) as UpbitWebSocketMessage;
              if (parsed.type === 'ticker') {
                const ticker = parsed as UpbitTickerEvent;
                setUpbitPrice(ticker.trade_price);
              }
            } catch {
              // Ignore parse errors
            }
          })
          .catch(() => {
            // Ignore blob read errors
          });
        return;
      }

      if (typeof rawData === 'string') {
        try {
          const parsed = JSON.parse(rawData) as UpbitWebSocketMessage;
          if (parsed.type === 'ticker') {
            const ticker = parsed as UpbitTickerEvent;
            setUpbitPrice(ticker.trade_price);
          }
        } catch {
          // Ignore parse errors
        }
      }
    };

    upbitWs.addEventListener('open', handleUpbitOpen);
    upbitWs.addEventListener('message', handleUpbitMessage);

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

    fetchRate();
    const rateInterval = setInterval(fetchRate, RATE_POLL_INTERVAL_MS);

    // -- Cleanup --
    return () => {
      isActive = false;
      clearInterval(rateInterval);

      binanceWs.removeEventListener('message', handleBinanceMessage);
      if (
        binanceWs.readyState === WebSocket.OPEN ||
        binanceWs.readyState === WebSocket.CONNECTING
      ) {
        binanceWs.close();
      }

      upbitWs.removeEventListener('open', handleUpbitOpen);
      upbitWs.removeEventListener('message', handleUpbitMessage);
      if (upbitWs.readyState === WebSocket.OPEN || upbitWs.readyState === WebSocket.CONNECTING) {
        upbitWs.close();
      }
    };
  }, [symbol, exchange, setBinancePrice, setUpbitPrice, setUsdKrwRate, resetPremium]);
}
