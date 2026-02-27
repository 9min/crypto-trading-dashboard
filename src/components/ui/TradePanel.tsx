'use client';

// =============================================================================
// TradePanel Component
// =============================================================================
// Binance-style Buy/Sell tabbed order panel for paper trading. Provides:
// - Buy/Sell tab toggle (green/red)
// - Quantity input with % quick buttons (cash-based for Buy, holding-based for Sell)
// - Estimated cost / max info
// - Single execute button that changes color/label per active side
// - Auto-dismiss feedback messages (3s)
// =============================================================================

import { memo, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { formatPrice } from '@/utils/formatPrice';
import { formatSymbol } from '@/utils/formatSymbol';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type TradeSide = 'buy' | 'sell';

interface TradePanelProps {
  /** Current trading symbol (e.g., 'BTCUSDT') */
  symbol: string;
  /** Current market price of the symbol */
  currentPrice: number;
  /** Available cash balance in USDT */
  cashBalance: number;
  /** Current quantity held for this symbol (0 if none) */
  holdingQuantity: number;
  /** Buy callback — returns true on success */
  onBuy: (symbol: string, price: number, quantity: number) => boolean;
  /** Sell callback — returns true on success */
  onSell: (symbol: string, price: number, quantity: number) => boolean;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const QUICK_PERCENT_OPTIONS = [25, 50, 75, 100] as const;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const TradePanel = memo(function TradePanel({
  symbol,
  currentPrice,
  cashBalance,
  holdingQuantity,
  onBuy,
  onSell,
}: TradePanelProps) {
  const [activeSide, setActiveSide] = useState<TradeSide>('buy');
  const [quantity, setQuantity] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear feedback timer on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const parsedQuantity = useMemo(() => {
    const val = parseFloat(quantity);
    return isNaN(val) || val <= 0 ? 0 : val;
  }, [quantity]);

  const estimatedCost = useMemo(
    () => parsedQuantity * currentPrice,
    [parsedQuantity, currentPrice],
  );

  const baseAsset = useMemo(() => formatSymbol(symbol).replace(/\/.*$/, ''), [symbol]);

  const maxBuyQuantity = useMemo(
    () => (currentPrice > 0 ? cashBalance / currentPrice : 0),
    [cashBalance, currentPrice],
  );

  // Auto-dismiss feedback after 3 seconds
  const showFeedback = useCallback((fb: { type: 'success' | 'error'; message: string }) => {
    if (feedbackTimerRef.current !== null) {
      clearTimeout(feedbackTimerRef.current);
    }
    setFeedback(fb);
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback(null);
      feedbackTimerRef.current = null;
    }, 3000);
  }, []);

  const handleQuantityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setQuantity(val);
      setFeedback(null);
    }
  }, []);

  const handleQuickPercent = useCallback(
    (percent: number) => {
      if (activeSide === 'buy') {
        if (currentPrice <= 0) return;
        const qty = (cashBalance * (percent / 100)) / currentPrice;
        setQuantity(qty > 0 ? parseFloat(qty.toFixed(8)).toString() : '');
      } else {
        const qty = holdingQuantity * (percent / 100);
        setQuantity(qty > 0 ? parseFloat(qty.toFixed(8)).toString() : '');
      }
      setFeedback(null);
    },
    [activeSide, cashBalance, currentPrice, holdingQuantity],
  );

  const handleExecute = useCallback(() => {
    if (parsedQuantity <= 0 || currentPrice <= 0) return;
    if (activeSide === 'buy') {
      const success = onBuy(symbol, currentPrice, parsedQuantity);
      if (success) {
        setQuantity('');
        showFeedback({ type: 'success', message: `Bought ${parsedQuantity} ${baseAsset}` });
      } else {
        showFeedback({ type: 'error', message: 'Insufficient cash' });
      }
    } else {
      const success = onSell(symbol, currentPrice, parsedQuantity);
      if (success) {
        setQuantity('');
        showFeedback({ type: 'success', message: `Sold ${parsedQuantity} ${baseAsset}` });
      } else {
        showFeedback({ type: 'error', message: 'Insufficient holdings' });
      }
    }
  }, [activeSide, parsedQuantity, currentPrice, symbol, onBuy, onSell, baseAsset, showFeedback]);

  const handleTabBuy = useCallback(() => {
    setActiveSide('buy');
    setQuantity('');
    setFeedback(null);
  }, []);

  const handleTabSell = useCallback(() => {
    setActiveSide('sell');
    setQuantity('');
    setFeedback(null);
  }, []);

  const canExecute = useMemo(() => {
    if (parsedQuantity <= 0 || currentPrice <= 0) return false;
    if (activeSide === 'buy') return estimatedCost <= cashBalance;
    return parsedQuantity <= holdingQuantity;
  }, [activeSide, parsedQuantity, currentPrice, estimatedCost, cashBalance, holdingQuantity]);

  const isBuy = activeSide === 'buy';

  return (
    <div className="border-border flex flex-col gap-2 border-t p-3">
      {/* Buy / Sell tab buttons */}
      <div className="flex">
        <button
          type="button"
          onClick={handleTabBuy}
          className={`flex-1 cursor-pointer py-1 text-xs font-medium transition-colors ${
            isBuy
              ? 'border-buy text-buy border-b-2'
              : 'text-foreground-secondary hover:text-foreground border-b border-transparent'
          }`}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={handleTabSell}
          className={`flex-1 cursor-pointer py-1 text-xs font-medium transition-colors ${
            !isBuy
              ? 'border-sell text-sell border-b-2'
              : 'text-foreground-secondary hover:text-foreground border-b border-transparent'
          }`}
        >
          Sell
        </button>
      </div>

      {/* Market price */}
      <div className="text-foreground-secondary flex items-center justify-between text-xs">
        <span>Market Price</span>
        <span className="font-mono-num text-foreground font-medium">
          {currentPrice > 0 ? formatPrice(currentPrice) : '\u2014'}
        </span>
      </div>

      {/* Sell tab: show holding info or "no holdings" */}
      {!isBuy && (
        <div className="text-foreground-secondary flex items-center justify-between text-[10px]">
          <span>Holding</span>
          <span className="font-mono-num">
            {holdingQuantity > 0
              ? `${parseFloat(holdingQuantity.toFixed(8))} ${baseAsset}`
              : `0 ${baseAsset}`}
          </span>
        </div>
      )}

      {/* No holdings message for sell tab */}
      {!isBuy && holdingQuantity === 0 ? (
        <div className="text-foreground-secondary bg-background-tertiary rounded py-3 text-center text-xs">
          No {baseAsset} holdings to sell
        </div>
      ) : (
        <>
          {/* Quantity input */}
          <div className="flex flex-col gap-1">
            <label className="text-foreground-secondary text-xs" htmlFor="trade-quantity">
              Quantity ({baseAsset})
            </label>
            <input
              id="trade-quantity"
              type="text"
              inputMode="decimal"
              value={quantity}
              onChange={handleQuantityChange}
              placeholder="0.00"
              className="bg-background border-border text-foreground font-mono-num focus:border-accent rounded border px-2 py-1.5 text-xs outline-none"
            />
          </div>

          {/* Quick percent buttons */}
          <div className="flex gap-1">
            {QUICK_PERCENT_OPTIONS.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handleQuickPercent(pct)}
                className={`bg-background-tertiary text-foreground-secondary flex-1 cursor-pointer rounded px-1 py-0.5 text-[10px] transition-colors ${
                  isBuy ? 'hover:text-buy' : 'hover:text-sell'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* Context info: Est. Cost (buy) or Max Sell (sell) */}
          {isBuy ? (
            <>
              <div className="text-foreground-secondary flex items-center justify-between text-[10px]">
                <span>Est. Cost</span>
                <span className="font-mono-num">
                  {estimatedCost > 0 ? `$${formatPrice(estimatedCost)}` : '\u2014'}
                </span>
              </div>
              <div className="text-foreground-secondary flex items-center justify-between text-[10px]">
                <span>Max Buy</span>
                <span className="font-mono-num">
                  {maxBuyQuantity > 0 ? parseFloat(maxBuyQuantity.toFixed(8)).toString() : '0'}{' '}
                  {baseAsset}
                </span>
              </div>
            </>
          ) : (
            <div className="text-foreground-secondary flex items-center justify-between text-[10px]">
              <span>Est. Proceeds</span>
              <span className="font-mono-num">
                {estimatedCost > 0 ? `$${formatPrice(estimatedCost)}` : '\u2014'}
              </span>
            </div>
          )}

          {/* Execute button */}
          <button
            type="button"
            onClick={handleExecute}
            disabled={!canExecute}
            className={`cursor-pointer rounded py-1.5 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              isBuy ? 'bg-buy hover:bg-buy/90' : 'bg-sell hover:bg-sell/90'
            }`}
          >
            {isBuy ? 'Buy' : 'Sell'} {baseAsset}
          </button>
        </>
      )}

      {/* Feedback message (auto-dismiss after 3s) */}
      {feedback && (
        <div
          className={`text-center text-[10px] ${feedback.type === 'success' ? 'text-buy' : 'text-sell'}`}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
});
