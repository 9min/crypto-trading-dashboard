import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveLayout,
  loadLayout,
  STORAGE_KEY,
  VERSION_KEY,
  LAYOUT_VERSION,
  REQUIRED_WIDGET_KEYS,
} from './layoutStorage';

describe('layoutStorage', () => {
  const mockStorage = new Map<string, string>();

  /** Helper: creates a valid layout containing all required widget keys. */
  function makeValidLayout() {
    return {
      lg: REQUIRED_WIDGET_KEYS.map((key, i) => ({
        i: key,
        x: i * 3,
        y: 0,
        w: 3,
        h: 10,
      })),
    };
  }

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

  describe('saveLayout', () => {
    it('serializes and stores layouts with version under the correct keys', () => {
      const layouts = makeValidLayout();

      saveLayout(layouts);

      expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(layouts));
      expect(localStorage.setItem).toHaveBeenCalledWith(VERSION_KEY, String(LAYOUT_VERSION));
    });

    it('does not throw when localStorage.setItem throws', () => {
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => saveLayout({ lg: [] })).not.toThrow();
    });
  });

  describe('loadLayout', () => {
    it('returns parsed layouts when valid data exists with matching version', () => {
      const layouts = makeValidLayout();

      mockStorage.set(STORAGE_KEY, JSON.stringify(layouts));
      mockStorage.set(VERSION_KEY, String(LAYOUT_VERSION));

      const result = loadLayout();
      expect(result).toEqual(layouts);
    });

    it('returns null when no data exists', () => {
      mockStorage.set(VERSION_KEY, String(LAYOUT_VERSION));
      expect(loadLayout()).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      mockStorage.set(STORAGE_KEY, '{invalid json!!!}');
      mockStorage.set(VERSION_KEY, String(LAYOUT_VERSION));
      expect(loadLayout()).toBeNull();
    });

    it('returns null for non-object values', () => {
      mockStorage.set(VERSION_KEY, String(LAYOUT_VERSION));

      mockStorage.set(STORAGE_KEY, '"just a string"');
      expect(loadLayout()).toBeNull();

      mockStorage.set(STORAGE_KEY, '42');
      expect(loadLayout()).toBeNull();

      mockStorage.set(STORAGE_KEY, 'null');
      expect(loadLayout()).toBeNull();
    });

    it('returns null for array values', () => {
      mockStorage.set(STORAGE_KEY, '[1, 2, 3]');
      mockStorage.set(VERSION_KEY, String(LAYOUT_VERSION));
      expect(loadLayout()).toBeNull();
    });

    it('returns null when breakpoint value is not an array', () => {
      mockStorage.set(STORAGE_KEY, JSON.stringify({ lg: 'not-an-array' }));
      mockStorage.set(VERSION_KEY, String(LAYOUT_VERSION));
      expect(loadLayout()).toBeNull();
    });

    it('returns null when layout item has missing fields', () => {
      // Missing 'w' and 'h'
      mockStorage.set(STORAGE_KEY, JSON.stringify({ lg: [{ i: 'candlestick', x: 0, y: 0 }] }));
      mockStorage.set(VERSION_KEY, String(LAYOUT_VERSION));
      expect(loadLayout()).toBeNull();
    });

    it('returns null when layout item has wrong field types', () => {
      // 'x' should be number, not string
      mockStorage.set(
        STORAGE_KEY,
        JSON.stringify({ lg: [{ i: 'candlestick', x: '0', y: 0, w: 8, h: 14 }] }),
      );
      mockStorage.set(VERSION_KEY, String(LAYOUT_VERSION));
      expect(loadLayout()).toBeNull();
    });

    it('returns null when version mismatches and removes stale data', () => {
      const layouts = makeValidLayout();

      mockStorage.set(STORAGE_KEY, JSON.stringify(layouts));
      mockStorage.set(VERSION_KEY, '1'); // Old version

      const result = loadLayout();
      expect(result).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
      expect(localStorage.removeItem).toHaveBeenCalledWith(VERSION_KEY);
    });

    it('returns null when no version is saved', () => {
      const layouts = makeValidLayout();

      mockStorage.set(STORAGE_KEY, JSON.stringify(layouts));
      // No VERSION_KEY set

      expect(loadLayout()).toBeNull();
    });

    it('returns null when a required widget key is missing from a breakpoint', () => {
      const layouts = {
        lg: [
          { i: 'candlestick', x: 0, y: 0, w: 8, h: 14 },
          // Missing other required keys
        ],
      };

      mockStorage.set(STORAGE_KEY, JSON.stringify(layouts));
      mockStorage.set(VERSION_KEY, String(LAYOUT_VERSION));

      expect(loadLayout()).toBeNull();
    });
  });
});
