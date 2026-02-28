import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveTheme,
  loadTheme,
  saveInterval,
  loadInterval,
  saveWatchlistSymbols,
  loadWatchlistSymbols,
  saveWhaleThreshold,
  loadWhaleThreshold,
  saveWhaleAlertEnabled,
  loadWhaleAlertEnabled,
  THEME_KEY,
  INTERVAL_KEY,
  WATCHLIST_KEY,
  WHALE_THRESHOLD_KEY,
  WHALE_ALERT_ENABLED_KEY,
} from './localPreferences';
import { DEFAULT_WATCHLIST_SYMBOLS, DEFAULT_WHALE_THRESHOLD } from '@/utils/constants';

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

  // ---------------------------------------------------------------------------
  // Whale Threshold
  // ---------------------------------------------------------------------------
  describe('saveWhaleThreshold', () => {
    it('stores the threshold string under the correct key', () => {
      saveWhaleThreshold(100000);
      expect(localStorage.setItem).toHaveBeenCalledWith(WHALE_THRESHOLD_KEY, '100000');
    });

    it('does not throw when localStorage.setItem throws', () => {
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      expect(() => saveWhaleThreshold(50000)).not.toThrow();
    });
  });

  describe('loadWhaleThreshold', () => {
    it('returns the stored threshold when valid', () => {
      mockStorage.set(WHALE_THRESHOLD_KEY, '100000');
      expect(loadWhaleThreshold()).toBe(100000);
    });

    it('returns default threshold when no value is stored', () => {
      expect(loadWhaleThreshold()).toBe(DEFAULT_WHALE_THRESHOLD);
    });

    it('returns default threshold for non-numeric value', () => {
      mockStorage.set(WHALE_THRESHOLD_KEY, 'abc');
      expect(loadWhaleThreshold()).toBe(DEFAULT_WHALE_THRESHOLD);
    });

    it('returns default threshold for zero', () => {
      mockStorage.set(WHALE_THRESHOLD_KEY, '0');
      expect(loadWhaleThreshold()).toBe(DEFAULT_WHALE_THRESHOLD);
    });

    it('returns default threshold for negative values', () => {
      mockStorage.set(WHALE_THRESHOLD_KEY, '-100');
      expect(loadWhaleThreshold()).toBe(DEFAULT_WHALE_THRESHOLD);
    });

    it('returns default threshold when localStorage.getItem throws', () => {
      vi.mocked(localStorage.getItem).mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(loadWhaleThreshold()).toBe(DEFAULT_WHALE_THRESHOLD);
    });
  });

  // ---------------------------------------------------------------------------
  // Whale Alert Enabled
  // ---------------------------------------------------------------------------
  describe('saveWhaleAlertEnabled', () => {
    it('stores the boolean string under the correct key', () => {
      saveWhaleAlertEnabled(false);
      expect(localStorage.setItem).toHaveBeenCalledWith(WHALE_ALERT_ENABLED_KEY, 'false');
    });

    it('stores true under the correct key', () => {
      saveWhaleAlertEnabled(true);
      expect(localStorage.setItem).toHaveBeenCalledWith(WHALE_ALERT_ENABLED_KEY, 'true');
    });

    it('does not throw when localStorage.setItem throws', () => {
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      expect(() => saveWhaleAlertEnabled(true)).not.toThrow();
    });
  });

  describe('loadWhaleAlertEnabled', () => {
    it('returns true when stored value is "true"', () => {
      mockStorage.set(WHALE_ALERT_ENABLED_KEY, 'true');
      expect(loadWhaleAlertEnabled()).toBe(true);
    });

    it('returns false when stored value is "false"', () => {
      mockStorage.set(WHALE_ALERT_ENABLED_KEY, 'false');
      expect(loadWhaleAlertEnabled()).toBe(false);
    });

    it('returns false when no value is stored', () => {
      expect(loadWhaleAlertEnabled()).toBe(false);
    });

    it('returns false for an invalid string', () => {
      mockStorage.set(WHALE_ALERT_ENABLED_KEY, 'maybe');
      expect(loadWhaleAlertEnabled()).toBe(false);
    });

    it('returns false when localStorage.getItem throws', () => {
      vi.mocked(localStorage.getItem).mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(loadWhaleAlertEnabled()).toBe(false);
    });
  });
});
