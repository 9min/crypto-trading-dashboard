'use client';

// =============================================================================
// KimchiPremiumWidget Component
// =============================================================================
// Displays the real-time kimchi premium: the percentage difference between
// Binance (USD) and Upbit (KRW) prices for the current trading pair.
// =============================================================================

import { memo, useMemo } from 'react';
import { usePremiumStore } from '@/stores/premiumStore';
import { usePremiumStream } from '@/hooks/usePremiumStream';
import { formatPrice } from '@/utils/formatPrice';
import { WidgetWrapper } from './WidgetWrapper';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const KimchiPremiumWidget = memo(function KimchiPremiumWidget() {
  const premium = usePremiumStore((state) => state.premium);
  const binancePrice = usePremiumStore((state) => state.binancePrice);
  const upbitPrice = usePremiumStore((state) => state.upbitPrice);
  const usdKrwRate = usePremiumStore((state) => state.usdKrwRate);

  usePremiumStream();

  const premiumDisplay = useMemo(() => {
    const sign = premium > 0 ? '+' : '';
    const colorClass = premium > 0 ? 'text-buy' : premium < 0 ? 'text-sell' : 'text-foreground';
    return { sign, colorClass };
  }, [premium]);

  const hasData = binancePrice > 0 && upbitPrice > 0 && usdKrwRate > 0;

  return (
    <WidgetWrapper title="Kimchi Premium">
      <div className="flex flex-col items-center justify-center gap-3 p-4">
        {hasData ? (
          <>
            <div className={`text-3xl font-bold ${premiumDisplay.colorClass}`}>
              {premiumDisplay.sign}
              {premium.toFixed(2)}%
            </div>
            <div className="flex w-full flex-col gap-1.5 text-xs">
              <div className="text-foreground-secondary flex justify-between">
                <span>Binance (USD)</span>
                <span className="font-mono-num text-foreground">${formatPrice(binancePrice)}</span>
              </div>
              <div className="text-foreground-secondary flex justify-between">
                <span>Upbit (KRW)</span>
                <span className="font-mono-num text-foreground">{formatPrice(upbitPrice, 0)}</span>
              </div>
              <div className="border-border mt-1 border-t pt-1">
                <div className="text-foreground-secondary flex justify-between">
                  <span>USD/KRW</span>
                  <span className="font-mono-num text-foreground">
                    {formatPrice(usdKrwRate, 2)}
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-foreground-secondary text-xs">Loading premium data...</div>
        )}
      </div>
    </WidgetWrapper>
  );
});
