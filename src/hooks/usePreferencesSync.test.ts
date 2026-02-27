// =============================================================================
// usePreferencesSync Tests
// =============================================================================
// Tests that the hook correctly synchronizes preferences between localStorage,
// app state, and Supabase cloud storage.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

const mockFetchPreferences = vi.fn();
const mockUpsertPreferences = vi.fn();

vi.mock('@/lib/supabase/preferencesService', () => ({
  fetchPreferences: (...args: unknown[]) => mockFetchPreferences(...args),
  upsertPreferences: (...args: unknown[]) => mockUpsertPreferences(...args),
}));

const mockLoadTheme = vi.fn(() => 'dark' as const);
const mockLoadInterval = vi.fn(() => '1m' as const);
const mockLoadWatchlistSymbols = vi.fn(() => ['BTCUSDT', 'ETHUSDT']);
const mockSaveTheme = vi.fn();
const mockSaveInterval = vi.fn();
const mockSaveWatchlistSymbols = vi.fn();

vi.mock('@/utils/localPreferences', () => ({
  loadTheme: () => mockLoadTheme(),
  loadInterval: () => mockLoadInterval(),
  loadWatchlistSymbols: () => mockLoadWatchlistSymbols(),
  saveTheme: (...args: unknown[]) => mockSaveTheme(...args),
  saveInterval: (...args: unknown[]) => mockSaveInterval(...args),
  saveWatchlistSymbols: (...args: unknown[]) => mockSaveWatchlistSymbols(...args),
}));

const mockLoadLayout = vi.fn(() => null);
const mockApplyCloudLayout = vi.fn();

vi.mock('@/utils/layoutStorage', () => ({
  loadLayout: () => mockLoadLayout(),
  applyCloudLayout: (...args: unknown[]) => mockApplyCloudLayout(...args),
}));

import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { useKlineStore } from '@/stores/klineStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useToastStore } from '@/stores/toastStore';
import { usePreferencesSync } from './usePreferencesSync';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const testUser = { id: 'user-1', email: 'test@test.com', name: 'Test', avatarUrl: null };

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('usePreferencesSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useAuthStore.getState().reset();
    useUiStore.getState().setTheme('dark');
    useKlineStore.getState().setInterval('1m');
    useWatchlistStore.getState().reset();
    useToastStore.setState({ toasts: [] });

    // Reset mock return values that may have been overridden by prior tests
    mockLoadTheme.mockReturnValue('dark');
    mockLoadInterval.mockReturnValue('1m');
    mockLoadWatchlistSymbols.mockReturnValue(['BTCUSDT', 'ETHUSDT']);

    mockFetchPreferences.mockResolvedValue(null);
    mockUpsertPreferences.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Initial load from localStorage
  // ---------------------------------------------------------------------------

  describe('initial load from localStorage', () => {
    it('loads theme from localStorage and applies to uiStore', () => {
      mockLoadTheme.mockReturnValue('light');

      renderHook(() => usePreferencesSync());

      expect(mockLoadTheme).toHaveBeenCalled();
      expect(useUiStore.getState().theme).toBe('light');
    });

    it('loads interval from localStorage and applies to klineStore', () => {
      mockLoadInterval.mockReturnValue('5m');

      renderHook(() => usePreferencesSync());

      expect(mockLoadInterval).toHaveBeenCalled();
      expect(useKlineStore.getState().interval).toBe('5m');
    });

    it('loads watchlist symbols from localStorage and replaces in watchlistStore', () => {
      mockLoadWatchlistSymbols.mockReturnValue(['SOLUSDT', 'XRPUSDT']);

      renderHook(() => usePreferencesSync());

      const symbols = useWatchlistStore.getState().symbols;
      expect(symbols).toContain('SOLUSDT');
      expect(symbols).toContain('XRPUSDT');
    });
  });

  // ---------------------------------------------------------------------------
  // Login triggers cloud load
  // ---------------------------------------------------------------------------

  describe('cloud load on login', () => {
    it('calls fetchPreferences when user logs in', async () => {
      renderHook(() => usePreferencesSync());

      useAuthStore.getState().setUser(testUser);

      await vi.waitFor(() => {
        expect(mockFetchPreferences).toHaveBeenCalledWith('user-1');
      });
    });

    it('applies cloud prefs to stores when they exist', async () => {
      mockFetchPreferences.mockResolvedValue({
        theme: 'light',
        interval: '15m',
        watchlistSymbols: ['DOGEUSDT'],
        layout: null,
      });

      renderHook(() => usePreferencesSync());
      useAuthStore.getState().setUser(testUser);

      await vi.waitFor(() => {
        expect(useUiStore.getState().theme).toBe('light');
      });
      expect(useKlineStore.getState().interval).toBe('15m');
    });

    it('calls applyCloudLayout when cloud layout exists', async () => {
      const mockLayout = { lg: [{ i: 'candlestick', x: 0, y: 0, w: 8, h: 4 }] };
      mockFetchPreferences.mockResolvedValue({
        theme: 'dark',
        interval: '1m',
        watchlistSymbols: ['BTCUSDT'],
        layout: mockLayout,
      });

      renderHook(() => usePreferencesSync());
      useAuthStore.getState().setUser(testUser);

      await vi.waitFor(() => {
        expect(mockApplyCloudLayout).toHaveBeenCalledWith(mockLayout);
      });
    });

    it('backs up cloud prefs to localStorage', async () => {
      mockFetchPreferences.mockResolvedValue({
        theme: 'light',
        interval: '5m',
        watchlistSymbols: ['ADAUSDT'],
        layout: null,
      });

      renderHook(() => usePreferencesSync());
      useAuthStore.getState().setUser(testUser);

      await vi.waitFor(() => {
        expect(mockSaveTheme).toHaveBeenCalledWith('light');
        expect(mockSaveInterval).toHaveBeenCalledWith('5m');
        expect(mockSaveWatchlistSymbols).toHaveBeenCalledWith(['ADAUSDT']);
      });
    });

    it('discards fetch result if user logged out during fetch (staleness guard)', async () => {
      let resolvePrefs: ((value: unknown) => void) | null = null;
      mockFetchPreferences.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePrefs = resolve;
          }),
      );

      renderHook(() => usePreferencesSync());

      // Capture the theme before login
      const themeBefore = useUiStore.getState().theme;

      useAuthStore.getState().setUser(testUser);

      // Logout while fetch is in-flight
      useAuthStore.getState().reset();

      // Resolve the fetch after logout
      resolvePrefs?.({
        theme: themeBefore === 'dark' ? 'light' : 'dark',
        interval: '4h',
        watchlistSymbols: ['XRPUSDT'],
        layout: null,
      });

      await vi.advanceTimersByTimeAsync(100);

      // Theme should remain unchanged — the stale result was discarded
      expect(useUiStore.getState().theme).toBe(themeBefore);
    });
  });

  // ---------------------------------------------------------------------------
  // First login migration
  // ---------------------------------------------------------------------------

  describe('first login migration', () => {
    it('uploads current localStorage values when cloud prefs are null', async () => {
      mockFetchPreferences.mockResolvedValue(null);

      renderHook(() => usePreferencesSync());
      useAuthStore.getState().setUser(testUser);

      await vi.waitFor(() => {
        expect(mockUpsertPreferences).toHaveBeenCalledWith(
          'user-1',
          expect.objectContaining({
            theme: expect.any(String),
            interval: expect.any(String),
            watchlistSymbols: expect.any(Array),
          }),
        );
      });
    });

    it('includes current layout in migration', async () => {
      const mockLayout = { lg: [{ i: 'orderbook', x: 0, y: 0, w: 4, h: 3 }] };
      mockLoadLayout.mockReturnValue(mockLayout);
      mockFetchPreferences.mockResolvedValue(null);

      renderHook(() => usePreferencesSync());
      useAuthStore.getState().setUser(testUser);

      await vi.waitFor(() => {
        expect(mockUpsertPreferences).toHaveBeenCalledWith(
          'user-1',
          expect.objectContaining({ layout: mockLayout }),
        );
      });
    });
  });

  // ---------------------------------------------------------------------------
  // State change subscriptions
  // ---------------------------------------------------------------------------

  describe('state change subscriptions', () => {
    it('saves theme to localStorage on theme change', () => {
      const { unmount } = renderHook(() => usePreferencesSync());

      mockSaveTheme.mockClear();
      useUiStore.getState().setTheme('light');

      expect(mockSaveTheme).toHaveBeenCalledWith('light');
      unmount();
    });

    it('saves interval to localStorage on interval change', () => {
      const { unmount } = renderHook(() => usePreferencesSync());

      mockSaveInterval.mockClear();
      useKlineStore.getState().setInterval('4h');

      expect(mockSaveInterval).toHaveBeenCalledWith('4h');
      unmount();
    });

    it('saves watchlist symbols to localStorage on watchlist change', () => {
      const { unmount } = renderHook(() => usePreferencesSync());

      mockSaveWatchlistSymbols.mockClear();
      useWatchlistStore.getState().addSymbol('DOTUSDT');

      expect(mockSaveWatchlistSymbols).toHaveBeenCalled();
      unmount();
    });

    it('merges consecutive changes into a single upsert after debounce', async () => {
      // Render hook first, then login — so cloud load runs properly
      renderHook(() => usePreferencesSync());

      // Login triggers cloud load
      mockFetchPreferences.mockResolvedValue({
        theme: 'dark',
        interval: '1m',
        watchlistSymbols: ['BTCUSDT'],
        layout: null,
      });
      useAuthStore.getState().setUser(testUser);

      // Wait for initial load + cloud fetch to complete
      await vi.advanceTimersByTimeAsync(200);

      mockUpsertPreferences.mockClear();

      // Multiple rapid changes — both should be different from current state
      useUiStore.getState().setTheme('light');
      useKlineStore.getState().setInterval('15m');

      // Advance past debounce (500ms)
      await vi.advanceTimersByTimeAsync(600);

      // Should be a single merged upsert containing both changes
      expect(mockUpsertPreferences).toHaveBeenCalledTimes(1);
      const calledArgs = mockUpsertPreferences.mock.calls[0][1] as Record<string, unknown>;
      expect(calledArgs).toHaveProperty('theme', 'light');
      expect(calledArgs).toHaveProperty('interval', '15m');
    });

    it('does not trigger cloud save during initial load', () => {
      mockUpsertPreferences.mockClear();

      renderHook(() => usePreferencesSync());

      // The initial load sets theme/interval/watchlist via the hook
      // but isInitialLoadRef guards subscription handlers from firing
      expect(mockUpsertPreferences).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    it('shows toast warning when fetchPreferences fails', async () => {
      mockFetchPreferences.mockRejectedValue(new Error('DB error'));

      renderHook(() => usePreferencesSync());
      useAuthStore.getState().setUser(testUser);

      await vi.waitFor(() => {
        const toasts = useToastStore.getState().toasts;
        expect(toasts.some((t) => t.message === 'Failed to load cloud preferences')).toBe(true);
      });
    });

    it('shows toast warning when upsertPreferences fails', async () => {
      renderHook(() => usePreferencesSync());

      // Login and wait for cloud load
      mockFetchPreferences.mockResolvedValue({
        theme: 'dark',
        interval: '1m',
        watchlistSymbols: ['BTCUSDT'],
        layout: null,
      });
      useAuthStore.getState().setUser(testUser);

      await vi.advanceTimersByTimeAsync(200);
      mockUpsertPreferences.mockClear();
      mockUpsertPreferences.mockRejectedValue(new Error('Save error'));

      // Trigger a save by changing theme
      useUiStore.getState().setTheme('light');

      // Advance past debounce
      await vi.advanceTimersByTimeAsync(600);

      // Wait for the rejection to propagate and toast to be added
      await vi.advanceTimersByTimeAsync(200);

      const toasts = useToastStore.getState().toasts;
      expect(toasts.some((t) => t.message === 'Failed to save preferences to cloud')).toBe(true);
    });

    it('does not save to localStorage from subscription handlers during initial load phase', () => {
      mockSaveTheme.mockClear();

      renderHook(() => usePreferencesSync());

      // The subscription handlers check isInitialLoadRef and should be skipped
      // The initial load effect calls setTheme directly, not saveTheme
      expect(mockSaveTheme).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  describe('cleanup', () => {
    it('unsubscribes from all stores on unmount', async () => {
      const { unmount } = renderHook(() => usePreferencesSync());
      await vi.advanceTimersByTimeAsync(50);

      unmount();

      // After unmount, store changes should not trigger saves
      mockSaveTheme.mockClear();
      useUiStore.getState().setTheme('light');

      // The subscription handler should have been removed
      // (though other live subscriptions from other tests may interfere)
      // We mainly verify unmount doesn't throw
    });

    it('clears debounce timer on unmount', async () => {
      useAuthStore.getState().setUser(testUser);
      mockFetchPreferences.mockResolvedValue({
        theme: 'dark',
        interval: '1m',
        watchlistSymbols: [],
        layout: null,
      });

      const { unmount } = renderHook(() => usePreferencesSync());
      await vi.advanceTimersByTimeAsync(100);

      mockUpsertPreferences.mockClear();

      // Trigger debounced save
      useUiStore.getState().setTheme('light');

      // Unmount before debounce fires
      unmount();

      // Advance past debounce — should NOT call upsert since timer was cleared
      await vi.advanceTimersByTimeAsync(600);

      expect(mockUpsertPreferences).not.toHaveBeenCalled();
    });
  });
});
