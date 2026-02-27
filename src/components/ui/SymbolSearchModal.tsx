'use client';

// =============================================================================
// SymbolSearchModal Component
// =============================================================================
// Command-palette style modal for quickly searching and selecting a trading
// symbol. Uses the existing filterSymbols utility for search. Supports
// keyboard navigation (ArrowUp/Down, Enter, Escape).
//
// The outer component conditionally renders the inner content so that all
// state (query, selection) resets naturally on each open via remounting.
// =============================================================================

import { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { filterSymbols } from '@/utils/symbolSearch';
import { formatSymbol, formatUpbitSymbol } from '@/utils/formatSymbol';
import { toUpbitSymbol } from '@/utils/symbolMap';
import { useUiStore } from '@/stores/uiStore';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface SymbolSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// -----------------------------------------------------------------------------
// Inner content (remounts each open → clean state)
// -----------------------------------------------------------------------------

interface SymbolSearchContentProps {
  onClose: () => void;
}

const SymbolSearchContent = memo(function SymbolSearchContent({
  onClose,
}: SymbolSearchContentProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const exchange = useUiStore((state) => state.exchange);
  const setSymbol = useUiStore((state) => state.setSymbol);

  const results = useMemo(() => filterSymbols(query, [], exchange), [query, exchange]);

  // Auto-focus input on mount
  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement | undefined;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (symbol: string) => {
      setSymbol(symbol);
      onClose();
    },
    [setSymbol, onClose],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const selected = results[selectedIndex];
        if (selected) {
          handleSelect(selected);
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    },
    [results, selectedIndex, handleSelect, onClose],
  );

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedIndex(0);
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <div
      className="animate-modal-backdrop fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Symbol search"
    >
      <div
        className="animate-modal-content border-border bg-background-secondary flex w-full max-w-md flex-col overflow-hidden rounded-xl border shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="border-border flex items-center gap-2 border-b px-4 py-3">
          <svg
            className="text-foreground-tertiary h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search symbol…"
            className="text-foreground placeholder:text-foreground-tertiary w-full bg-transparent text-sm outline-none"
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="text-foreground-tertiary border-border hidden rounded border px-1.5 py-0.5 text-[10px] sm:inline">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="max-h-64 overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="text-foreground-tertiary px-4 py-6 text-center text-sm">
              No symbols found
            </div>
          ) : (
            results.map((symbol, index) => {
              const displayName =
                exchange === 'upbit'
                  ? formatUpbitSymbol(toUpbitSymbol(symbol))
                  : formatSymbol(symbol);

              return (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => handleSelect(symbol)}
                  className={`flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                    index === selectedIndex
                      ? 'bg-background-tertiary text-foreground'
                      : 'text-foreground-secondary hover:bg-background-tertiary'
                  }`}
                >
                  <span className="font-mono-num font-medium">{displayName}</span>
                  <span className="text-foreground-tertiary text-xs">{symbol}</span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="border-border text-foreground-tertiary flex items-center gap-3 border-t px-4 py-2 text-[10px]">
          <span>
            <kbd className="border-border rounded border px-1 py-0.5">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="border-border rounded border px-1 py-0.5">↵</kbd> select
          </span>
          <span>
            <kbd className="border-border rounded border px-1 py-0.5">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
});

// -----------------------------------------------------------------------------
// Outer wrapper (conditional render = remount on each open)
// -----------------------------------------------------------------------------

export const SymbolSearchModal = memo(function SymbolSearchModal({
  isOpen,
  onClose,
}: SymbolSearchModalProps) {
  if (!isOpen) return null;
  return <SymbolSearchContent onClose={onClose} />;
});
