'use client';

// =============================================================================
// TradePanel Component — Futures Trading
// =============================================================================
// Long/Short tabbed order panel for futures paper trading. Provides:
// - Long/Short tab toggle (green/red)
// - Leverage slider + preset buttons (1x ~ 125x)
// - Margin type toggle (Cross / Isolated)
// - Quantity input with base/USDT mode toggle + % quick buttons
// - TP/SL collapsible inputs
// - Order cost preview (notional, fee, est. liq. price)
// - Funding rate display
// - Open Long / Open Short button (open mode)
// - Close Position button (close mode, when position exists)
// =============================================================================

import { memo, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { formatPrice } from '@/utils/formatPrice';
import { formatSymbol } from '@/utils/formatSymbol';
import {
  calculateMargin,
  calculateFee,
  calculateLiquidationPrice,
  calculateNotionalValue,
} from '@/utils/portfolioCalc';
import type {
  PositionSide,
  MarginType,
  FuturesPosition,
  OpenPositionParams,
} from '@/types/portfolio';
import { TAKER_FEE_RATE } from '@/types/portfolio';

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
  /** Current funding rate (null if unavailable) */
  fundingRate: number | null;
}

/** Input mode for quantity field */
type InputMode = 'base' | 'usdt';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const QUICK_PERCENT_OPTIONS = [25, 50, 75, 100] as const;
const LEVERAGE_PRESETS = [1, 2, 5, 10, 25, 50, 75, 100, 125] as const;

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
  fundingRate,
}: TradePanelProps) {
  const [activeSide, setActiveSide] = useState<PositionSide>('long');
  const [leverage, setLeverage] = useState(defaultLeverage);
  const [marginType, setMarginType] = useState<MarginType>(defaultMarginType);
  const [quantity, setQuantity] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('base');
  const [showTpSl, setShowTpSl] = useState(false);
  const [tpInput, setTpInput] = useState('');
  const [slInput, setSlInput] = useState('');
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

  // Parse quantity to base asset amount
  const parsedQuantity = useMemo(() => {
    const val = parseFloat(quantity);
    if (isNaN(val) || val <= 0) return 0;
    if (inputMode === 'usdt' && currentPrice > 0) {
      return val / currentPrice;
    }
    return val;
  }, [quantity, inputMode, currentPrice]);

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

  const isCloseMode = existingPosition !== null && existingPosition.side === activeSide;
  const hasOppositePosition = existingPosition !== null && existingPosition.side !== activeSide;

  // Parse TP/SL
  const parsedTp = useMemo(() => {
    const val = parseFloat(tpInput);
    return isNaN(val) || val <= 0 ? null : val;
  }, [tpInput]);

  const parsedSl = useMemo(() => {
    const val = parseFloat(slInput);
    return isNaN(val) || val <= 0 ? null : val;
  }, [slInput]);

  // Order cost preview
  const orderPreview = useMemo(() => {
    if (parsedQuantity <= 0 || currentPrice <= 0) return null;
    const notional = calculateNotionalValue(currentPrice, parsedQuantity);
    const fee = calculateFee(currentPrice, parsedQuantity);
    const estLiqPrice = calculateLiquidationPrice(currentPrice, leverage, activeSide, marginType);
    const maxLoss = requiredMargin;
    return { notional, fee, estLiqPrice, maxLoss };
  }, [parsedQuantity, currentPrice, leverage, activeSide, marginType, requiredMargin]);

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
        if (inputMode === 'usdt') {
          const usdtVal = qty * currentPrice;
          setQuantity(usdtVal > 0 ? parseFloat(usdtVal.toFixed(2)).toString() : '');
        } else {
          setQuantity(qty > 0 ? parseFloat(qty.toFixed(8)).toString() : '');
        }
      }
      setFeedback(null);
    },
    [isCloseMode, existingPosition, currentPrice, maxOpenQuantity, inputMode],
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
      takeProfitPrice: parsedTp,
      stopLossPrice: parsedSl,
    });

    if (success) {
      setQuantity('');
      setTpInput('');
      setSlInput('');
      const sideLabel = activeSide === 'long' ? 'Long' : 'Short';
      showFeedback({
        type: 'success',
        message: `Opened ${sideLabel} ${parsedQuantity.toFixed(6)} ${baseAsset} @ ${leverage}x`,
      });
    } else {
      showFeedback({ type: 'error', message: 'Insufficient balance or opposite position exists' });
    }
  }, [
    activeSide,
    parsedQuantity,
    currentPrice,
    symbol,
    leverage,
    marginType,
    parsedTp,
    parsedSl,
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
        message: `Closed ${parsedQuantity.toFixed(6)} ${baseAsset}`,
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

  const handleLeverageSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLeverage(parseInt(e.target.value, 10));
    setQuantity('');
  }, []);

  const handleMarginTypeToggle = useCallback(() => {
    setMarginType((prev) => (prev === 'isolated' ? 'cross' : 'isolated'));
  }, []);

  const handleInputModeToggle = useCallback(() => {
    setInputMode((prev) => (prev === 'base' ? 'usdt' : 'base'));
    setQuantity('');
  }, []);

  const handleTpSlToggle = useCallback(() => {
    setShowTpSl((prev) => !prev);
  }, []);

  const handleTpChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d*$/.test(val)) setTpInput(val);
  }, []);

  const handleSlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d*$/.test(val)) setSlInput(val);
  }, []);

  const canOpen = useMemo(() => {
    if (parsedQuantity <= 0 || currentPrice <= 0) return false;
    if (hasOppositePosition) return false;
    return requiredMargin <= availableBalance;
  }, [parsedQuantity, currentPrice, requiredMargin, availableBalance, hasOppositePosition]);

  const canClose = useMemo(() => {
    if (!existingPosition) return false;
    if (parsedQuantity <= 0 || currentPrice <= 0) return false;
    return parsedQuantity <= existingPosition.quantity;
  }, [existingPosition, parsedQuantity, currentPrice]);

  const isLong = activeSide === 'long';

  // ----- Close Mode UI -----
  if (isCloseMode && existingPosition) {
    const positionSideLabel = existingPosition.side === 'long' ? 'LONG' : 'SHORT';

    // Close cost preview
    const closeFee = parsedQuantity > 0 ? calculateFee(currentPrice, parsedQuantity) : 0;
    const closeNotional =
      parsedQuantity > 0 ? calculateNotionalValue(currentPrice, parsedQuantity) : 0;

    return (
      <div className="border-border flex flex-col gap-2.5 border-t p-3">
        {/* Position info header */}
        <div className="bg-background-tertiary flex items-center justify-between rounded-md px-2.5 py-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${existingPosition.side === 'long' ? 'bg-buy' : 'bg-sell'}`}
            >
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
              className="bg-background-tertiary text-foreground-secondary hover:bg-sell/10 hover:text-sell flex-1 cursor-pointer rounded px-1 py-1 text-[10px] font-medium transition-all"
            >
              {pct}%
            </button>
          ))}
        </div>

        {/* Position quantity + close cost info */}
        <div className="text-foreground-secondary flex items-center justify-between text-[10px]">
          <span>Position Qty</span>
          <span className="font-mono-num">
            {parseFloat(existingPosition.quantity.toFixed(8))} {baseAsset}
          </span>
        </div>
        {parsedQuantity > 0 && (
          <>
            <div className="text-foreground-secondary flex items-center justify-between text-[10px]">
              <span>Notional Value</span>
              <span className="font-mono-num">${formatPrice(closeNotional)}</span>
            </div>
            <div className="text-foreground-secondary flex items-center justify-between text-[10px]">
              <span>Est. Fee ({(TAKER_FEE_RATE * 100).toFixed(2)}%)</span>
              <span className="font-mono-num">${formatPrice(closeFee)}</span>
            </div>
          </>
        )}

        {/* Close button */}
        <button
          type="button"
          onClick={handleClosePosition}
          disabled={!canClose}
          className="bg-sell hover:bg-sell/90 active:bg-sell/80 cursor-pointer rounded-md py-2 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
        >
          Close Position
        </button>

        {/* Feedback */}
        {feedback && (
          <div
            className={`text-center text-[10px] font-medium ${feedback.type === 'success' ? 'text-buy' : 'text-sell'}`}
          >
            {feedback.message}
          </div>
        )}
      </div>
    );
  }

  // ----- Open Mode UI -----
  return (
    <div className="border-border flex flex-col gap-2.5 border-t p-3">
      {/* Long / Short tab buttons */}
      <div className="bg-background-tertiary flex gap-1 rounded-md p-1">
        <button
          type="button"
          onClick={handleTabLong}
          className={`flex-1 cursor-pointer rounded py-1.5 text-xs font-medium transition-all ${
            isLong
              ? 'bg-buy text-white shadow-sm'
              : 'text-foreground-secondary hover:text-foreground hover:bg-background'
          }`}
        >
          Long
        </button>
        <button
          type="button"
          onClick={handleTabShort}
          className={`flex-1 cursor-pointer rounded py-1.5 text-xs font-medium transition-all ${
            !isLong
              ? 'bg-sell text-white shadow-sm'
              : 'text-foreground-secondary hover:text-foreground hover:bg-background'
          }`}
        >
          Short
        </button>
      </div>

      {/* Market price + Funding rate */}
      <div className="text-foreground-secondary flex items-center justify-between text-xs">
        <span>Market Price</span>
        <span className="font-mono-num text-foreground font-medium">
          {currentPrice > 0 ? formatPrice(currentPrice) : '\u2014'}
        </span>
      </div>
      {fundingRate !== null && (
        <div className="text-foreground-secondary flex items-center justify-between text-[10px]">
          <span>Funding Rate</span>
          <span className={`font-mono-num ${fundingRate >= 0 ? 'text-buy' : 'text-sell'}`}>
            {fundingRate >= 0 ? '+' : ''}
            {(fundingRate * 100).toFixed(4)}%
          </span>
        </div>
      )}

      {/* Leverage presets + slider */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-foreground-secondary text-[10px]">Leverage</span>
          <span className="font-mono-num text-accent text-xs font-semibold">{leverage}x</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {LEVERAGE_PRESETS.map((lev) => (
            <button
              key={lev}
              type="button"
              onClick={() => handleLeverageSelect(lev)}
              className={`cursor-pointer rounded px-2 py-1 text-[10px] font-medium transition-all ${
                leverage === lev
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-background-tertiary text-foreground-secondary hover:bg-background-tertiary/80 hover:text-foreground'
              }`}
            >
              {lev}x
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={125}
            step={1}
            value={leverage}
            onChange={handleLeverageSlider}
            aria-label="Leverage slider"
            className="leverage-slider h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
          />
        </div>
      </div>

      {/* Margin type toggle */}
      <div className="flex items-center justify-between">
        <span className="text-foreground-secondary text-[10px]">Margin</span>
        <button
          type="button"
          onClick={handleMarginTypeToggle}
          className="text-foreground bg-background-tertiary hover:bg-background-tertiary/80 cursor-pointer rounded px-2.5 py-1 text-[10px] font-medium transition-colors"
        >
          {marginType === 'isolated' ? 'Isolated' : 'Cross'}
        </button>
      </div>

      {/* Quantity input with mode toggle */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-foreground-secondary text-xs" htmlFor="trade-quantity">
            Quantity
          </label>
          <button
            type="button"
            onClick={handleInputModeToggle}
            className="text-foreground bg-background-tertiary hover:bg-background-tertiary/80 cursor-pointer rounded px-2 py-0.5 text-[10px] font-medium transition-colors"
          >
            {inputMode === 'base' ? baseAsset : 'USDT'}
          </button>
        </div>
        <input
          id="trade-quantity"
          type="text"
          inputMode="decimal"
          value={quantity}
          onChange={handleQuantityChange}
          placeholder={inputMode === 'base' ? '0.00' : '0.00 USDT'}
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
              isLong ? 'hover:bg-buy/10 hover:text-buy' : 'hover:bg-sell/10 hover:text-sell'
            }`}
          >
            {pct}%
          </button>
        ))}
      </div>

      {/* TP/SL collapsible section */}
      <button
        type="button"
        onClick={handleTpSlToggle}
        className="bg-background-tertiary hover:bg-background-tertiary/80 text-foreground-secondary hover:text-foreground flex cursor-pointer items-center justify-between rounded px-2.5 py-1.5 text-[10px] transition-all"
      >
        <span className="font-medium">TP / SL</span>
        <svg
          className={`h-3 w-3 transition-transform ${showTpSl ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {showTpSl && (
        <div className="bg-background-secondary flex flex-col gap-2 rounded-md p-2.5">
          <div className="flex items-center gap-2">
            <label className="text-buy w-10 text-[10px] font-medium" htmlFor="tp-input">
              TP
            </label>
            <input
              id="tp-input"
              type="text"
              inputMode="decimal"
              value={tpInput}
              onChange={handleTpChange}
              placeholder="Take Profit Price"
              className="bg-background border-border text-foreground font-mono-num focus:border-buy min-w-0 flex-1 rounded border px-2 py-1.5 text-[10px] transition-colors outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sell w-10 text-[10px] font-medium" htmlFor="sl-input">
              SL
            </label>
            <input
              id="sl-input"
              type="text"
              inputMode="decimal"
              value={slInput}
              onChange={handleSlChange}
              placeholder="Stop Loss Price"
              className="bg-background border-border text-foreground font-mono-num focus:border-sell min-w-0 flex-1 rounded border px-2 py-1.5 text-[10px] transition-colors outline-none"
            />
          </div>
        </div>
      )}

      {/* Order cost preview */}
      {orderPreview && (
        <div className="border-border/50 bg-background-secondary flex flex-col gap-1 rounded-md border p-2.5">
          <span className="text-foreground-secondary mb-0.5 text-[9px] font-medium tracking-wider uppercase">
            Order Summary
          </span>
          <div className="text-foreground-secondary flex items-center justify-between text-[10px]">
            <span>Notional Value</span>
            <span className="font-mono-num text-foreground">
              ${formatPrice(orderPreview.notional)}
            </span>
          </div>
          <div className="text-foreground-secondary flex items-center justify-between text-[10px]">
            <span>Est. Fee ({(TAKER_FEE_RATE * 100).toFixed(2)}%)</span>
            <span className="font-mono-num">${formatPrice(orderPreview.fee)}</span>
          </div>
          <div className="text-foreground-secondary flex items-center justify-between text-[10px]">
            <span>Est. Liq. Price</span>
            <span className="font-mono-num text-foreground">
              {orderPreview.estLiqPrice === 0 || orderPreview.estLiqPrice === Infinity
                ? '\u2014'
                : `$${formatPrice(orderPreview.estLiqPrice)}`}
            </span>
          </div>
          <div className="border-border/30 border-t pt-1 text-[10px]">
            <div className="text-foreground-secondary flex items-center justify-between">
              <span>Max Loss (if liq&apos;d)</span>
              <span className="font-mono-num text-sell font-medium">
                -${formatPrice(orderPreview.maxLoss)}
              </span>
            </div>
          </div>
        </div>
      )}

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
        className={`cursor-pointer rounded-md py-2 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
          isLong
            ? 'bg-buy hover:bg-buy/90 active:bg-buy/80'
            : 'bg-sell hover:bg-sell/90 active:bg-sell/80'
        }`}
      >
        {existingPosition ? 'Add to' : 'Open'} {isLong ? 'Long' : 'Short'} {baseAsset}
      </button>

      {/* Feedback message */}
      {feedback && (
        <div
          className={`text-center text-[10px] font-medium ${feedback.type === 'success' ? 'text-buy' : 'text-sell'}`}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
});
