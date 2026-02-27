// =============================================================================
// useKeyboardShortcuts Hook Unit Tests
// =============================================================================

import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useUiStore } from '@/stores/uiStore';
import { useKlineStore } from '@/stores/klineStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fireKeyDown(key: string, options: Partial<KeyboardEventInit> = {}): void {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  document.dispatchEvent(event);
}

function fireKeyDownOnInput(key: string): void {
  const input = document.createElement('input');
  document.body.appendChild(input);
  input.focus();

  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  // Override event.target by dispatching on the input element
  input.dispatchEvent(event);

  document.body.removeChild(input);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    useUiStore.setState({
      theme: 'dark',
      exchange: 'binance',
      isSymbolSearchOpen: false,
      isShortcutsHelpOpen: false,
    });
    useKlineStore.setState({ interval: '1m' });
  });

  it('does not register listener when disabled', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const { unmount } = renderHook(() => useKeyboardShortcuts({ enabled: false }));

    expect(addSpy).not.toHaveBeenCalledWith('keydown', expect.anything());
    unmount();
    addSpy.mockRestore();
  });

  it('registers and cleans up keydown listener when enabled', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useKeyboardShortcuts({ enabled: true }));

    expect(addSpy).toHaveBeenCalledWith('keydown', expect.anything());

    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.anything());

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // Interval switching (1-6)
  // ---------------------------------------------------------------------------

  describe('interval switching', () => {
    it.each([
      ['1', '1m'],
      ['2', '5m'],
      ['3', '15m'],
      ['4', '1h'],
      ['5', '4h'],
      ['6', '1d'],
    ] as const)('key "%s" sets interval to %s', (key, expectedInterval) => {
      renderHook(() => useKeyboardShortcuts({ enabled: true }));

      fireKeyDown(key);
      expect(useKlineStore.getState().interval).toBe(expectedInterval);
    });
  });

  // ---------------------------------------------------------------------------
  // Symbol search modal
  // ---------------------------------------------------------------------------

  describe('symbol search', () => {
    it('opens symbol search on "/" key', () => {
      renderHook(() => useKeyboardShortcuts({ enabled: true }));

      fireKeyDown('/');
      expect(useUiStore.getState().isSymbolSearchOpen).toBe(true);
    });

    it('opens symbol search on Ctrl+K', () => {
      renderHook(() => useKeyboardShortcuts({ enabled: true }));

      fireKeyDown('k', { ctrlKey: true });
      expect(useUiStore.getState().isSymbolSearchOpen).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Exchange toggle
  // ---------------------------------------------------------------------------

  describe('exchange toggle', () => {
    it('toggles from binance to upbit on "E"', () => {
      renderHook(() => useKeyboardShortcuts({ enabled: true }));

      fireKeyDown('E');
      expect(useUiStore.getState().exchange).toBe('upbit');
    });

    it('toggles from upbit to binance on "e"', () => {
      useUiStore.setState({ exchange: 'upbit' });
      renderHook(() => useKeyboardShortcuts({ enabled: true }));

      fireKeyDown('e');
      expect(useUiStore.getState().exchange).toBe('binance');
    });
  });

  // ---------------------------------------------------------------------------
  // Theme toggle
  // ---------------------------------------------------------------------------

  describe('theme toggle', () => {
    it('toggles theme from dark to light on "T"', () => {
      renderHook(() => useKeyboardShortcuts({ enabled: true }));

      fireKeyDown('T');
      expect(useUiStore.getState().theme).toBe('light');
    });

    it('toggles theme from light to dark on "t"', () => {
      useUiStore.setState({ theme: 'light' });
      renderHook(() => useKeyboardShortcuts({ enabled: true }));

      fireKeyDown('t');
      expect(useUiStore.getState().theme).toBe('dark');
    });
  });

  // ---------------------------------------------------------------------------
  // Shortcuts help
  // ---------------------------------------------------------------------------

  describe('shortcuts help', () => {
    it('opens shortcuts help on "?" key', () => {
      renderHook(() => useKeyboardShortcuts({ enabled: true }));

      fireKeyDown('?');
      expect(useUiStore.getState().isShortcutsHelpOpen).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Escape
  // ---------------------------------------------------------------------------

  describe('escape', () => {
    it('closes all overlays on Escape', () => {
      useUiStore.setState({
        isSymbolSearchOpen: true,
        isShortcutsHelpOpen: true,
      });
      renderHook(() => useKeyboardShortcuts({ enabled: true }));

      fireKeyDown('Escape');
      expect(useUiStore.getState().isSymbolSearchOpen).toBe(false);
      expect(useUiStore.getState().isShortcutsHelpOpen).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Input guard
  // ---------------------------------------------------------------------------

  describe('input guard', () => {
    it('does not fire shortcuts when input is focused', () => {
      renderHook(() => useKeyboardShortcuts({ enabled: true }));

      fireKeyDownOnInput('E');
      // Exchange should remain unchanged
      expect(useUiStore.getState().exchange).toBe('binance');
    });
  });

  // ---------------------------------------------------------------------------
  // Ctrl/Meta guard
  // ---------------------------------------------------------------------------

  describe('modifier guard', () => {
    it('ignores shortcuts with ctrlKey (except Ctrl+K)', () => {
      renderHook(() => useKeyboardShortcuts({ enabled: true }));

      fireKeyDown('E', { ctrlKey: true });
      expect(useUiStore.getState().exchange).toBe('binance');
    });

    it('ignores shortcuts with metaKey (except Cmd+K)', () => {
      renderHook(() => useKeyboardShortcuts({ enabled: true }));

      fireKeyDown('T', { metaKey: true });
      expect(useUiStore.getState().theme).toBe('dark');
    });
  });
});
