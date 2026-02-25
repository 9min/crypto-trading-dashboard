import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveTheme,
  loadTheme,
  saveInterval,
  loadInterval,
  saveWatchlistSymbols,
  loadWatchlistSymbols,
  THEME_KEY,
  INTERVAL_KEY,
  WATCHLIST_KEY,
} from './localPreferences';
import { DEFAULT_WATCHLIST_SYMBOLS } from '@/utils/constants';

describe('localPreferences', () => {
  const mockStorage = new Map<string, string>();

  beforeEach(() => {
    mockStorage.clear();

    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        mockStorage.delete(key);
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------------
  describe('saveTheme', () => {
    it('stores the theme string under the correct key', () => {
      saveTheme('light');
      expect(localStorage.setItem).toHaveBeenCalledWith(THEME_KEY, 'light');
    });

    it('does not throw when localStorage.setItem throws', () => {
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      expect(() => saveTheme('dark')).not.toThrow();
    });
  });

  describe('loadTheme', () => {
    it('returns the stored theme when valid', () => {
      mockStorage.set(THEME_KEY, 'light');
      expect(loadTheme()).toBe('light');
    });

    it('returns "dark" when no value is stored', () => {
      expect(loadTheme()).toBe('dark');
    });

    it('returns "dark" for an invalid theme string', () => {
      mockStorage.set(THEME_KEY, 'sepia');
      expect(loadTheme()).toBe('dark');
    });

    it('returns "dark" when localStorage.getItem throws', () => {
      vi.mocked(localStorage.getItem).mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(loadTheme()).toBe('dark');
    });
  });

  // ---------------------------------------------------------------------------
  // Interval
  // ---------------------------------------------------------------------------
  describe('saveInterval', () => {
    it('stores the interval string under the correct key', () => {
      saveInterval('15m');
      expect(localStorage.setItem).toHaveBeenCalledWith(INTERVAL_KEY, '15m');
    });

    it('does not throw when localStorage.setItem throws', () => {
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      expect(() => saveInterval('1h')).not.toThrow();
    });
  });

  describe('loadInterval', () => {
    it('returns the stored interval when valid', () => {
      mockStorage.set(INTERVAL_KEY, '4h');
      expect(loadInterval()).toBe('4h');
    });

    it('returns "1m" when no value is stored', () => {
      expect(loadInterval()).toBe('1m');
    });

    it('returns "1m" for an invalid interval string', () => {
      mockStorage.set(INTERVAL_KEY, '2w');
      expect(loadInterval()).toBe('1m');
    });

    it('returns "1m" when localStorage.getItem throws', () => {
      vi.mocked(localStorage.getItem).mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(loadInterval()).toBe('1m');
    });
  });

  // ---------------------------------------------------------------------------
  // Watchlist Symbols
  // ---------------------------------------------------------------------------
  describe('saveWatchlistSymbols', () => {
    it('serializes and stores the symbol array under the correct key', () => {
      const symbols = ['BTCUSDT', 'ETHUSDT'];
      saveWatchlistSymbols(symbols);
      expect(localStorage.setItem).toHaveBeenCalledWith(WATCHLIST_KEY, JSON.stringify(symbols));
    });

    it('does not throw when localStorage.setItem throws', () => {
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      expect(() => saveWatchlistSymbols(['BTCUSDT'])).not.toThrow();
    });
  });

  describe('loadWatchlistSymbols', () => {
    it('returns the stored symbol array when valid', () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
      mockStorage.set(WATCHLIST_KEY, JSON.stringify(symbols));
      expect(loadWatchlistSymbols()).toEqual(symbols);
    });

    it('returns default symbols when no value is stored', () => {
      expect(loadWatchlistSymbols()).toEqual([...DEFAULT_WATCHLIST_SYMBOLS]);
    });

    it('returns default symbols for invalid JSON', () => {
      mockStorage.set(WATCHLIST_KEY, '{broken!!}');
      expect(loadWatchlistSymbols()).toEqual([...DEFAULT_WATCHLIST_SYMBOLS]);
    });

    it('returns default symbols when value is not an array', () => {
      mockStorage.set(WATCHLIST_KEY, '"just a string"');
      expect(loadWatchlistSymbols()).toEqual([...DEFAULT_WATCHLIST_SYMBOLS]);
    });

    it('returns default symbols when array contains non-strings', () => {
      mockStorage.set(WATCHLIST_KEY, '[1, 2, 3]');
      expect(loadWatchlistSymbols()).toEqual([...DEFAULT_WATCHLIST_SYMBOLS]);
    });

    it('returns default symbols when localStorage.getItem throws', () => {
      vi.mocked(localStorage.getItem).mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(loadWatchlistSymbols()).toEqual([...DEFAULT_WATCHLIST_SYMBOLS]);
    });
  });
});
