'use client';

// =============================================================================
// WatchlistManagePopover Component
// =============================================================================
// Popover for adding symbols to the watchlist. Triggered by a "+" icon button.
// Features a search input that filters popular USDT pairs, excluding symbols
// already in the watchlist.
// =============================================================================

import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { filterSymbols } from '@/utils/symbolSearch';
import { MAX_WATCHLIST_SYMBOLS } from '@/utils/constants';
import { formatSymbol, formatUpbitSymbol } from '@/utils/formatSymbol';
import { toUpbitSymbol } from '@/utils/symbolMap';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const WatchlistManagePopover = memo(function WatchlistManagePopover() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const exchange = useUiStore((state) => state.exchange);
  const symbols = useWatchlistStore((state) => state.symbols);
  const addSymbol = useWatchlistStore((state) => state.addSymbol);

  const atCapacity = symbols.length >= MAX_WATCHLIST_SYMBOLS;

  const results = useMemo(
    () => filterSymbols(query, symbols, exchange),
    [query, symbols, exchange],
  );

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent): void => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure popover is rendered
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
    setQuery('');
  }, []);

  const handleQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  }, []);

  const handleAddSymbol = useCallback(
    (symbol: string) => {
      addSymbol(symbol);
      setQuery('');
    },
    [addSymbol],
  );

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="text-foreground-secondary hover:bg-background hover:text-foreground flex h-5 w-5 cursor-pointer items-center justify-center rounded transition-colors"
        aria-label="Add symbol"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {isOpen && (
        <div className="border-border bg-background-secondary absolute top-full right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border shadow-xl">
          {/* Header */}
          <div className="border-border flex items-center justify-between border-b px-3 py-2">
            <span className="text-foreground text-xs font-semibold">Add Symbol</span>
            <span className="bg-background-tertiary text-foreground-secondary rounded px-1.5 py-0.5 text-[10px] font-medium">
              {symbols.length}/{MAX_WATCHLIST_SYMBOLS}
            </span>
          </div>

          {/* Search Input */}
          <div className="border-border border-b px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search (e.g., DOT, LINK)"
              value={query}
              onChange={handleQueryChange}
              className="border-border bg-background text-foreground placeholder:text-foreground-tertiary focus:border-accent w-full rounded-md border px-2.5 py-1.5 text-xs transition-colors outline-none"
            />
          </div>

          {/* Results */}
          <div className="max-h-52 overflow-y-auto">
            {atCapacity ? (
              <div className="flex flex-col items-center gap-1 py-4">
                <span className="text-foreground-tertiary text-[10px]">
                  Watchlist full ({MAX_WATCHLIST_SYMBOLS} max)
                </span>
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-4">
                <span className="text-foreground-tertiary text-[10px]">No symbols found</span>
              </div>
            ) : (
              results.map((symbol) => (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => handleAddSymbol(symbol)}
                  className="text-foreground hover:bg-background-tertiary flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-xs transition-colors"
                >
                  <span className="font-medium">
                    {exchange === 'upbit'
                      ? formatUpbitSymbol(toUpbitSymbol(symbol))
                      : formatSymbol(symbol)}
                  </span>
                  <svg
                    className="text-accent h-3.5 w-3.5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
});
