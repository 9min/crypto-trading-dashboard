'use client';

// =============================================================================
// SpotTradePanel Component — KRW Spot Trading
// =============================================================================
// Buy/Sell tabbed order panel for KRW spot paper trading. Simplified version
// of TradePanel without leverage, margin type, TP/SL, or funding rate.
// =============================================================================

import { memo, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { formatPrice } from '@/utils/formatPrice';
import { formatSymbol } from '@/utils/formatSymbol';
import { calculateSpotFee } from '@/utils/spotCalc';
import { SPOT_FEE_RATE } from '@/types/spot';
import type { SpotHolding, SpotBuyParams, SpotSellParams, SpotTradeAction } from '@/types/spot';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface SpotTradePanelProps {
  /** Current trading symbol (e.g., 'BTCUSDT') */
  symbol: string;
  /** Current market price in KRW */
  currentPrice: number;
  /** KRW cash balance */
  walletBalance: number;
  /** Existing holding for this symbol (null if none) */
  existingHolding: SpotHolding | null;
  /** Buy callback — returns true on success */
  onBuy: (params: SpotBuyParams) => boolean;
  /** Sell callback — returns true on success */
  onSell: (params: SpotSellParams) => boolean;
}

/** Input mode for quantity field */
type InputMode = 'base' | 'krw';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const QUICK_PERCENT_OPTIONS = [25, 50, 75, 100] as const;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const SpotTradePanel = memo(function SpotTradePanel({
  symbol,
  currentPrice,
  walletBalance,
  existingHolding,
  onBuy,
  onSell,
}: SpotTradePanelProps) {
  const [activeAction, setActiveAction] = useState<SpotTradeAction>('buy');
  const [quantity, setQuantity] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('base');
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

  const isBuyMode = activeAction === 'buy';

  // Parse quantity to base asset amount
  const parsedQuantity = useMemo(() => {
    const val = parseFloat(quantity);
    if (isNaN(val) || val <= 0) return 0;
    if (isBuyMode && inputMode === 'krw' && currentPrice > 0) {
      return val / currentPrice;
    }
    // In sell mode, always base asset
    if (!isBuyMode) return val;
    return val;
  }, [quantity, inputMode, currentPrice, isBuyMode]);

  const baseAsset = useMemo(() => formatSymbol(symbol).replace(/\/.*$/, ''), [symbol]);

  // Order cost for buy mode
  const orderCost = useMemo(() => {
    if (parsedQuantity <= 0 || currentPrice <= 0) return 0;
    return currentPrice * parsedQuantity;
  }, [parsedQuantity, currentPrice]);

  const fee = useMemo(
    () => (parsedQuantity > 0 ? calculateSpotFee(currentPrice, parsedQuantity) : 0),
    [parsedQuantity, currentPrice],
  );

  // Max quantity user can buy with wallet balance
  const maxBuyQuantity = useMemo(() => {
    if (currentPrice <= 0) return 0;
    // cost + fee = cost * (1 + feeRate) <= walletBalance
    const maxCost = walletBalance / (1 + SPOT_FEE_RATE);
    return maxCost / currentPrice;
  }, [walletBalance, currentPrice]);

  const canBuy = useMemo(() => {
    if (parsedQuantity <= 0 || currentPrice <= 0) return false;
    return orderCost + fee <= walletBalance;
  }, [parsedQuantity, currentPrice, orderCost, fee, walletBalance]);

  const canSell = useMemo(() => {
    if (!existingHolding) return false;
    if (parsedQuantity <= 0 || currentPrice <= 0) return false;
    return parsedQuantity <= existingHolding.quantity;
  }, [existingHolding, parsedQuantity, currentPrice]);

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
      if (isBuyMode) {
        if (currentPrice <= 0) return;
        const qty = maxBuyQuantity * (percent / 100);
        if (inputMode === 'krw') {
          const krwVal = qty * currentPrice;
          setQuantity(krwVal > 0 ? Math.floor(krwVal).toString() : '');
        } else {
          setQuantity(qty > 0 ? parseFloat(qty.toFixed(8)).toString() : '');
        }
      } else {
        if (!existingHolding) return;
        const qty = existingHolding.quantity * (percent / 100);
        setQuantity(qty > 0 ? parseFloat(qty.toFixed(8)).toString() : '');
      }
      setFeedback(null);
    },
    [isBuyMode, currentPrice, maxBuyQuantity, inputMode, existingHolding],
  );

  const handleBuy = useCallback(() => {
    if (parsedQuantity <= 0 || currentPrice <= 0) return;

    const success = onBuy({ symbol, price: currentPrice, quantity: parsedQuantity });

    if (success) {
      setQuantity('');
      showFeedback({
        type: 'success',
        message: `Bought ${parsedQuantity.toFixed(6)} ${baseAsset}`,
      });
    } else {
      showFeedback({ type: 'error', message: 'Insufficient balance or max holdings reached' });
    }
  }, [parsedQuantity, currentPrice, symbol, onBuy, baseAsset, showFeedback]);

  const handleSell = useCallback(() => {
    if (parsedQuantity <= 0 || currentPrice <= 0) return;

    const success = onSell({ symbol, price: currentPrice, quantity: parsedQuantity });

    if (success) {
      setQuantity('');
      showFeedback({
        type: 'success',
        message: `Sold ${parsedQuantity.toFixed(6)} ${baseAsset}`,
      });
    } else {
      showFeedback({ type: 'error', message: 'Sell failed — check quantity' });
    }
  }, [parsedQuantity, currentPrice, symbol, onSell, baseAsset, showFeedback]);

  const handleTabBuy = useCallback(() => {
    setActiveAction('buy');
    setQuantity('');
    setFeedback(null);
  }, []);

  const handleTabSell = useCallback(() => {
    setActiveAction('sell');
    setQuantity('');
    setFeedback(null);
    setInputMode('base');
  }, []);

  const handleInputModeToggle = useCallback(() => {
    setInputMode((prev) => (prev === 'base' ? 'krw' : 'base'));
    setQuantity('');
  }, []);

  const formatKrw = useCallback((price: number, decimals = 0): string => {
    return '\u20A9' + formatPrice(price, decimals);
  }, []);

  return (
    <div className="border-border flex h-full flex-col border-t">
      {/* Scrollable form area */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-0">
        <div className="flex flex-col gap-2.5">
          {/* Buy / Sell tab buttons */}
          <div className="bg-background-tertiary flex gap-1 rounded-md p-1">
            <button
              type="button"
              onClick={handleTabBuy}
              className={`flex-1 cursor-pointer rounded py-1.5 text-xs font-medium transition-all ${
                isBuyMode
                  ? 'bg-buy text-white shadow-sm'
                  : 'text-foreground-secondary hover:text-foreground hover:bg-background'
              }`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={handleTabSell}
              className={`flex-1 cursor-pointer rounded py-1.5 text-xs font-medium transition-all ${
                !isBuyMode
                  ? 'bg-sell text-white shadow-sm'
                  : 'text-foreground-secondary hover:text-foreground hover:bg-background'
              }`}
            >
              Sell
            </button>
          </div>

          {/* Market price */}
          <div className="text-foreground-secondary flex items-center justify-between text-xs">
            <span>Market Price</span>
            <span className="font-mono-num text-foreground font-medium">
              {currentPrice > 0 ? formatKrw(currentPrice) : '\u2014'}
            </span>
          </div>

          {/* Quantity input with mode toggle (buy only) */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-foreground-secondary text-xs" htmlFor="spot-quantity">
                {isBuyMode ? 'Quantity' : `Sell Qty (${baseAsset})`}
              </label>
              {isBuyMode && (
                <button
                  type="button"
                  onClick={handleInputModeToggle}
                  className="text-foreground bg-background-tertiary hover:bg-background-tertiary/80 cursor-pointer rounded px-2 py-0.5 text-[10px] font-medium transition-colors"
                >
                  {inputMode === 'base' ? baseAsset : 'KRW'}
                </button>
              )}
            </div>
            <input
              id="spot-quantity"
              type="text"
              inputMode="decimal"
              value={quantity}
              onChange={handleQuantityChange}
              placeholder={isBuyMode && inputMode === 'krw' ? '0 KRW' : '0.00'}
              className="bg-background border-border text-foreground font-mono-num focus:border-accent rounded border px-2.5 py-2 text-xs transition-colors outline-none"
            />
          </div>

          {/* Quick percent buttons */}
          <div className="flex gap-1">
            {QUICK_PERCENT_OPTIONS.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handleQuickPercent(pct)}
                className={`bg-background-tertiary text-foreground-secondary flex-1 cursor-pointer rounded px-1 py-1 text-[10px] font-medium transition-all ${
                  isBuyMode ? 'hover:bg-buy/10 hover:text-buy' : 'hover:bg-sell/10 hover:text-sell'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* Holding info (sell mode) */}
          {!isBuyMode && existingHolding && (
            <div className="text-foreground-secondary flex items-center justify-between text-[10px]">
              <span>Holding Qty</span>
              <span className="font-mono-num">
                {parseFloat(existingHolding.quantity.toFixed(8))} {baseAsset}
              </span>
            </div>
          )}

          {/* Order preview */}
          {parsedQuantity > 0 && currentPrice > 0 && (
            <div className="border-border/50 bg-background-secondary flex flex-col gap-1 rounded-md border p-2.5">
              <span className="text-foreground-secondary mb-0.5 text-[9px] font-medium tracking-wider uppercase">
                Order Summary
              </span>
              <div className="text-foreground-secondary flex items-center justify-between text-[10px]">
                <span>{isBuyMode ? 'Order Amount' : 'Sell Proceeds'}</span>
                <span className="font-mono-num text-foreground">{formatKrw(orderCost)}</span>
              </div>
              <div className="text-foreground-secondary flex items-center justify-between text-[10px]">
                <span>Fee ({(SPOT_FEE_RATE * 100).toFixed(2)}%)</span>
                <span className="font-mono-num">{formatKrw(fee)}</span>
              </div>
              {isBuyMode && (
                <div className="border-border/30 border-t pt-1 text-[10px]">
                  <div className="text-foreground-secondary flex items-center justify-between">
                    <span>Total Cost</span>
                    <span className="font-mono-num text-foreground font-medium">
                      {formatKrw(orderCost + fee)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Balance / Holding info */}
          <div className="text-foreground-secondary flex items-center justify-between text-[10px]">
            <span>KRW Balance</span>
            <span className="font-mono-num">{formatKrw(walletBalance)}</span>
          </div>
        </div>
      </div>

      {/* Fixed bottom: Action button + Feedback */}
      <div className="shrink-0 px-3 pt-2.5 pb-3">
        {isBuyMode ? (
          <button
            type="button"
            onClick={handleBuy}
            disabled={!canBuy}
            className="bg-buy hover:bg-buy/90 active:bg-buy/80 w-full cursor-pointer rounded-md py-2 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
          >
            Buy {baseAsset}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSell}
            disabled={!canSell}
            className="bg-sell hover:bg-sell/90 active:bg-sell/80 w-full cursor-pointer rounded-md py-2 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
          >
            Sell {baseAsset}
          </button>
        )}
        {feedback && (
          <div
            className={`mt-2 text-center text-[10px] font-medium ${feedback.type === 'success' ? 'text-buy' : 'text-sell'}`}
          >
            {feedback.message}
          </div>
        )}
      </div>
    </div>
  );
});
