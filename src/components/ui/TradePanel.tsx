'use client';

// =============================================================================
// TradePanel Component — Futures Trading
// =============================================================================
// Long/Short tabbed order panel for futures paper trading. Provides:
// - Long/Short tab toggle (green/red)
// - Leverage preset buttons (1x, 5x, 10x, 25x, 50x, 100x)
// - Margin type toggle (Cross / Isolated)
// - Quantity input with % quick buttons
// - Required margin display
// - Open Long / Open Short button (open mode)
// - Close Position button (close mode, when position exists)
// =============================================================================

import { memo, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { formatPrice } from '@/utils/formatPrice';
import { formatSymbol } from '@/utils/formatSymbol';
import { calculateMargin } from '@/utils/portfolioCalc';
import type {
  PositionSide,
  MarginType,
  FuturesPosition,
  OpenPositionParams,
} from '@/types/portfolio';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface TradePanelProps {
  /** Current trading symbol (e.g., 'BTCUSDT') */
  symbol: string;
  /** Current market price of the symbol */
  currentPrice: number;
  /** Available balance (walletBalance - totalMarginUsed) */
  availableBalance: number;
  /** Default leverage setting from store */
  defaultLeverage: number;
  /** Default margin type from store */
  defaultMarginType: MarginType;
  /** Existing position on this symbol (null if none) */
  existingPosition: FuturesPosition | null;
  /** Open position callback — returns true on success */
  onOpenPosition: (params: OpenPositionParams) => boolean;
  /** Close position callback — returns true on success */
  onClosePosition: (symbol: string, price: number, quantity: number) => boolean;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const QUICK_PERCENT_OPTIONS = [25, 50, 75, 100] as const;
const LEVERAGE_PRESETS = [1, 5, 10, 25, 50, 100] as const;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const TradePanel = memo(function TradePanel({
  symbol,
  currentPrice,
  availableBalance,
  defaultLeverage,
  defaultMarginType,
  existingPosition,
  onOpenPosition,
  onClosePosition,
}: TradePanelProps) {
  const [activeSide, setActiveSide] = useState<PositionSide>('long');
  const [leverage, setLeverage] = useState(defaultLeverage);
  const [marginType, setMarginType] = useState<MarginType>(defaultMarginType);
  const [quantity, setQuantity] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync leverage/marginType when defaults change
  useEffect(() => {
    setLeverage(defaultLeverage);
  }, [defaultLeverage]);

  useEffect(() => {
    setMarginType(defaultMarginType);
  }, [defaultMarginType]);

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

  const baseAsset = useMemo(() => formatSymbol(symbol).replace(/\/.*$/, ''), [symbol]);

  const requiredMargin = useMemo(
    () => (parsedQuantity > 0 ? calculateMargin(currentPrice, parsedQuantity, leverage) : 0),
    [currentPrice, parsedQuantity, leverage],
  );

  // Max quantity user can open with available balance and leverage
  const maxOpenQuantity = useMemo(
    () => (currentPrice > 0 ? (availableBalance * leverage) / currentPrice : 0),
    [availableBalance, currentPrice, leverage],
  );

  const isCloseMode = existingPosition !== null;

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
      if (isCloseMode && existingPosition) {
        const qty = existingPosition.quantity * (percent / 100);
        setQuantity(qty > 0 ? parseFloat(qty.toFixed(8)).toString() : '');
      } else {
        if (currentPrice <= 0) return;
        const qty = maxOpenQuantity * (percent / 100);
        setQuantity(qty > 0 ? parseFloat(qty.toFixed(8)).toString() : '');
      }
      setFeedback(null);
    },
    [isCloseMode, existingPosition, currentPrice, maxOpenQuantity],
  );

  const handleOpenPosition = useCallback(() => {
    if (parsedQuantity <= 0 || currentPrice <= 0) return;

    const success = onOpenPosition({
      symbol,
      side: activeSide,
      price: currentPrice,
      quantity: parsedQuantity,
      leverage,
      marginType,
    });

    if (success) {
      setQuantity('');
      const sideLabel = activeSide === 'long' ? 'Long' : 'Short';
      showFeedback({
        type: 'success',
        message: `Opened ${sideLabel} ${parsedQuantity} ${baseAsset} @ ${leverage}x`,
      });
    } else {
      showFeedback({ type: 'error', message: 'Insufficient balance or position exists' });
    }
  }, [
    activeSide,
    parsedQuantity,
    currentPrice,
    symbol,
    leverage,
    marginType,
    onOpenPosition,
    baseAsset,
    showFeedback,
  ]);

  const handleClosePosition = useCallback(() => {
    if (parsedQuantity <= 0 || currentPrice <= 0) return;

    const success = onClosePosition(symbol, currentPrice, parsedQuantity);

    if (success) {
      setQuantity('');
      showFeedback({
        type: 'success',
        message: `Closed ${parsedQuantity} ${baseAsset}`,
      });
    } else {
      showFeedback({ type: 'error', message: 'Close failed' });
    }
  }, [parsedQuantity, currentPrice, symbol, onClosePosition, baseAsset, showFeedback]);

  const handleTabLong = useCallback(() => {
    setActiveSide('long');
    setQuantity('');
    setFeedback(null);
  }, []);

  const handleTabShort = useCallback(() => {
    setActiveSide('short');
    setQuantity('');
    setFeedback(null);
  }, []);

  const handleLeverageSelect = useCallback((lev: number) => {
    setLeverage(lev);
    setQuantity('');
  }, []);

  const handleMarginTypeToggle = useCallback(() => {
    setMarginType((prev) => (prev === 'isolated' ? 'cross' : 'isolated'));
  }, []);

  const canOpen = useMemo(() => {
    if (parsedQuantity <= 0 || currentPrice <= 0) return false;
    return requiredMargin <= availableBalance;
  }, [parsedQuantity, currentPrice, requiredMargin, availableBalance]);

  const canClose = useMemo(() => {
    if (!existingPosition) return false;
    if (parsedQuantity <= 0 || currentPrice <= 0) return false;
    return parsedQuantity <= existingPosition.quantity;
  }, [existingPosition, parsedQuantity, currentPrice]);

  const isLong = activeSide === 'long';

  // ----- Close Mode UI -----
  if (isCloseMode && existingPosition) {
    const positionSideLabel = existingPosition.side === 'long' ? 'LONG' : 'SHORT';
    const positionSideColor = existingPosition.side === 'long' ? 'text-buy' : 'text-sell';

    return (
      <div className="border-border flex flex-col gap-2 border-t p-3">
        {/* Position info header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold ${positionSideColor}`}>
              {positionSideLabel}
            </span>
            <span className="text-foreground text-xs font-medium">{baseAsset}</span>
            <span className="text-foreground-secondary text-[10px]">
              {existingPosition.leverage}x
            </span>
          </div>
          <span className="font-mono-num text-foreground-secondary text-[10px]">
            Entry: {formatPrice(existingPosition.entryPrice)}
          </span>
        </div>

        {/* Quantity input */}
        <div className="flex flex-col gap-1">
          <label className="text-foreground-secondary text-xs" htmlFor="close-quantity">
            Close Qty ({baseAsset})
          </label>
          <input
            id="close-quantity"
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
              className="bg-background-tertiary text-foreground-secondary hover:text-sell flex-1 cursor-pointer rounded px-1 py-0.5 text-[10px] transition-colors"
            >
              {pct}%
            </button>
          ))}
        </div>

        {/* Position quantity info */}
        <div className="text-foreground-secondary flex items-center justify-between text-[10px]">
          <span>Position Qty</span>
          <span className="font-mono-num">
            {parseFloat(existingPosition.quantity.toFixed(8))} {baseAsset}
          </span>
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={handleClosePosition}
          disabled={!canClose}
          className="bg-sell hover:bg-sell/90 cursor-pointer rounded py-1.5 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          Close Position
        </button>

        {/* Feedback */}
        {feedback && (
          <div
            className={`text-center text-[10px] ${feedback.type === 'success' ? 'text-buy' : 'text-sell'}`}
          >
            {feedback.message}
          </div>
        )}
      </div>
    );
  }

  // ----- Open Mode UI -----
  return (
    <div className="border-border flex flex-col gap-2 border-t p-3">
      {/* Long / Short tab buttons */}
      <div className="flex">
        <button
          type="button"
          onClick={handleTabLong}
          className={`flex-1 cursor-pointer py-1 text-xs font-medium transition-colors ${
            isLong
              ? 'border-buy text-buy border-b-2'
              : 'text-foreground-secondary hover:text-foreground border-b border-transparent'
          }`}
        >
          Long
        </button>
        <button
          type="button"
          onClick={handleTabShort}
          className={`flex-1 cursor-pointer py-1 text-xs font-medium transition-colors ${
            !isLong
              ? 'border-sell text-sell border-b-2'
              : 'text-foreground-secondary hover:text-foreground border-b border-transparent'
          }`}
        >
          Short
        </button>
      </div>

      {/* Market price */}
      <div className="text-foreground-secondary flex items-center justify-between text-xs">
        <span>Market Price</span>
        <span className="font-mono-num text-foreground font-medium">
          {currentPrice > 0 ? formatPrice(currentPrice) : '\u2014'}
        </span>
      </div>

      {/* Leverage presets */}
      <div className="flex flex-col gap-1">
        <span className="text-foreground-secondary text-[10px]">Leverage</span>
        <div className="flex gap-1">
          {LEVERAGE_PRESETS.map((lev) => (
            <button
              key={lev}
              type="button"
              onClick={() => handleLeverageSelect(lev)}
              className={`flex-1 cursor-pointer rounded px-1 py-0.5 text-[10px] font-medium transition-colors ${
                leverage === lev
                  ? 'bg-accent text-white'
                  : 'bg-background-tertiary text-foreground-secondary hover:text-foreground'
              }`}
            >
              {lev}x
            </button>
          ))}
        </div>
      </div>

      {/* Margin type toggle */}
      <div className="flex items-center justify-between">
        <span className="text-foreground-secondary text-[10px]">Margin</span>
        <button
          type="button"
          onClick={handleMarginTypeToggle}
          className="text-foreground-secondary bg-background-tertiary hover:text-foreground cursor-pointer rounded px-2 py-0.5 text-[10px] transition-colors"
        >
          {marginType === 'isolated' ? 'Isolated' : 'Cross'}
        </button>
      </div>

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
              isLong ? 'hover:text-buy' : 'hover:text-sell'
            }`}
          >
            {pct}%
          </button>
        ))}
      </div>

      {/* Margin info */}
      <div className="text-foreground-secondary flex items-center justify-between text-[10px]">
        <span>Required Margin</span>
        <span className="font-mono-num">
          {requiredMargin > 0 ? `$${formatPrice(requiredMargin)}` : '\u2014'}
        </span>
      </div>
      <div className="text-foreground-secondary flex items-center justify-between text-[10px]">
        <span>Available</span>
        <span className="font-mono-num">${formatPrice(availableBalance)}</span>
      </div>

      {/* Open button */}
      <button
        type="button"
        onClick={handleOpenPosition}
        disabled={!canOpen}
        className={`cursor-pointer rounded py-1.5 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          isLong ? 'bg-buy hover:bg-buy/90' : 'bg-sell hover:bg-sell/90'
        }`}
      >
        Open {isLong ? 'Long' : 'Short'} {baseAsset}
      </button>

      {/* Feedback message */}
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
