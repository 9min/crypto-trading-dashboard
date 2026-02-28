// =============================================================================
// useKeyboardShortcuts Hook
// =============================================================================
// Registers a single document-level keydown listener for global keyboard
// shortcuts. Automatically skips events when an input, textarea, or
// contenteditable element is focused.
//
// Shortcut map:
//   1-6       → Switch kline interval (1m, 5m, 15m, 1h, 4h, 1d)
//   / | Ctrl+K → Open symbol search modal
//   E         → Toggle exchange (Binance ↔ Upbit)
//   T         → Toggle theme (dark ↔ light)
//   Escape    → Close all overlay modals
//   ?         → Open keyboard shortcuts help
// =============================================================================

import { useEffect } from 'react';
import { KLINE_INTERVALS } from '@/types/chart';
import { useUiStore } from '@/stores/uiStore';
import { useKlineStore } from '@/stores/klineStore';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UseKeyboardShortcutsOptions {
  /** When false, the keydown listener is not registered (e.g., on mobile) */
  enabled: boolean;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Tags whose focus should suppress keyboard shortcuts */
const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useKeyboardShortcuts({ enabled }: UseKeyboardShortcutsOptions): void {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent): void {
      // Skip when focus is inside a text-entry element
      const target = event.target;
      if (target instanceof HTMLElement) {
        if (INPUT_TAGS.has(target.tagName) || target.isContentEditable) return;
      }

      const { key, ctrlKey, metaKey } = event;

      // Ctrl+K / Cmd+K → Symbol search
      if (key === 'k' && (ctrlKey || metaKey)) {
        event.preventDefault();
        useUiStore.getState().setSymbolSearchOpen(true);
        return;
      }

      // Ignore shortcuts when Ctrl/Meta is held (except Ctrl+K above)
      if (ctrlKey || metaKey) return;

      // 1-6 → Interval switch
      const numKey = Number(key);
      if (numKey >= 1 && numKey <= 6) {
        const interval = KLINE_INTERVALS[numKey - 1];
        if (interval) {
          useKlineStore.getState().setInterval(interval);
        }
        return;
      }

      // / → Symbol search
      if (key === '/') {
        event.preventDefault();
        useUiStore.getState().setSymbolSearchOpen(true);
        return;
      }

      // ? → Shortcuts help (Shift+/)
      if (key === '?') {
        useUiStore.getState().setShortcutsHelpOpen(true);
        return;
      }

      // E → Toggle exchange
      if (key === 'e' || key === 'E') {
        const ui = useUiStore.getState();
        ui.setExchange(ui.exchange === 'binance' ? 'upbit' : 'binance');
        return;
      }

      // T → Toggle theme
      if (key === 't' || key === 'T') {
        useUiStore.getState().toggleTheme();
        return;
      }

      // S → Open settings
      if (key === 's' || key === 'S') {
        useUiStore.getState().setSettingsOpen(true);
        return;
      }

      // Escape → Close all overlays
      if (key === 'Escape') {
        useUiStore.getState().closeAllOverlays();
        return;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled]);
}
