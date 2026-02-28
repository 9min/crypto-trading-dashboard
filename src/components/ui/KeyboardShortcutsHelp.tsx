'use client';

// =============================================================================
// KeyboardShortcutsHelp Component
// =============================================================================
// Modal overlay displaying available keyboard shortcuts. Closeable via
// Escape key or backdrop click.
// =============================================================================

import { memo, useCallback, useEffect } from 'react';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

// -----------------------------------------------------------------------------
// Shortcut data
// -----------------------------------------------------------------------------

interface ShortcutEntry {
  id: string;
  keys: string[];
  description: string;
}

const SHORTCUTS: readonly ShortcutEntry[] = [
  {
    id: 'timeframe',
    keys: ['1', '–', '6'],
    description: 'Switch timeframe (1m, 5m, 15m, 1h, 4h, 1d)',
  },
  { id: 'search-slash', keys: ['/'], description: 'Open symbol search' },
  { id: 'search-ctrl-k', keys: ['Ctrl', 'K'], description: 'Open symbol search' },
  { id: 'exchange', keys: ['E'], description: 'Toggle exchange (Binance / Upbit)' },
  { id: 'theme', keys: ['T'], description: 'Toggle theme (dark / light)' },
  { id: 'settings', keys: ['S'], description: 'Open settings' },
  { id: 'help', keys: ['?'], description: 'Show this help' },
  { id: 'close', keys: ['Esc'], description: 'Close modal' },
] as const;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const KeyboardShortcutsHelp = memo(function KeyboardShortcutsHelp({
  isOpen,
  onClose,
}: KeyboardShortcutsHelpProps) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      className="animate-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div className="animate-modal-content border-border bg-background-secondary w-full max-w-sm overflow-hidden rounded-xl border shadow-2xl">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-foreground text-sm font-semibold">Keyboard Shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-foreground-tertiary hover:text-foreground cursor-pointer rounded p-1 transition-colors"
            aria-label="Close"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Shortcut list */}
        <div className="space-y-0.5 px-4 py-3">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.id} className="flex items-center justify-between py-1.5">
              <span className="text-foreground-secondary text-sm">{shortcut.description}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key) =>
                  key === '–' || key === '+' ? (
                    <span
                      key={`${shortcut.id}-sep-${key}`}
                      className="text-foreground-tertiary text-xs"
                    >
                      {key}
                    </span>
                  ) : (
                    <kbd
                      key={`${shortcut.id}-${key}`}
                      className="border-border bg-background-tertiary text-foreground-secondary inline-flex min-w-[1.5rem] items-center justify-center rounded border px-1.5 py-0.5 text-[11px] font-medium"
                    >
                      {key}
                    </kbd>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
