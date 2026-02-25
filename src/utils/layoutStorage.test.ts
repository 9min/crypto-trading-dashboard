import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { saveLayout, loadLayout, STORAGE_KEY } from './layoutStorage';

describe('layoutStorage', () => {
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

  describe('saveLayout', () => {
    it('serializes and stores layouts under the correct key', () => {
      const layouts = {
        lg: [{ i: 'chart', x: 0, y: 0, w: 8, h: 14 }],
      };

      saveLayout(layouts);

      expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(layouts));
    });

    it('does not throw when localStorage.setItem throws', () => {
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => saveLayout({ lg: [] })).not.toThrow();
    });
  });

  describe('loadLayout', () => {
    it('returns parsed layouts when valid data exists', () => {
      const layouts = {
        lg: [{ i: 'chart', x: 0, y: 0, w: 8, h: 14 }],
        md: [{ i: 'chart', x: 0, y: 0, w: 10, h: 12 }],
      };

      mockStorage.set(STORAGE_KEY, JSON.stringify(layouts));

      const result = loadLayout();
      expect(result).toEqual(layouts);
    });

    it('returns null when no data exists', () => {
      expect(loadLayout()).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      mockStorage.set(STORAGE_KEY, '{invalid json!!!}');
      expect(loadLayout()).toBeNull();
    });

    it('returns null for non-object values', () => {
      mockStorage.set(STORAGE_KEY, '"just a string"');
      expect(loadLayout()).toBeNull();

      mockStorage.set(STORAGE_KEY, '42');
      expect(loadLayout()).toBeNull();

      mockStorage.set(STORAGE_KEY, 'null');
      expect(loadLayout()).toBeNull();
    });

    it('returns null for array values', () => {
      mockStorage.set(STORAGE_KEY, '[1, 2, 3]');
      expect(loadLayout()).toBeNull();
    });
  });
});
