import { saveVisibleWidgets, loadVisibleWidgets, clearVisibleWidgets } from './widgetStorage';
import { WIDGET_TYPES } from '@/types/widget';

describe('widgetStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('saveVisibleWidgets', () => {
    it('saves widgets to localStorage', () => {
      saveVisibleWidgets(['candlestick', 'orderbook']);

      const raw = localStorage.getItem('dashboard-visible-widgets');
      expect(raw).toBe(JSON.stringify(['candlestick', 'orderbook']));
    });

    it('saves version alongside widget data', () => {
      saveVisibleWidgets(['candlestick']);

      const version = localStorage.getItem('dashboard-visible-widgets-version');
      expect(version).toBe('1');
    });
  });

  describe('loadVisibleWidgets', () => {
    it('returns null when no data is stored', () => {
      expect(loadVisibleWidgets()).toBeNull();
    });

    it('returns null when version mismatches', () => {
      localStorage.setItem('dashboard-visible-widgets', JSON.stringify(['candlestick']));
      localStorage.setItem('dashboard-visible-widgets-version', '999');

      expect(loadVisibleWidgets()).toBeNull();
    });

    it('returns saved widgets when version matches', () => {
      saveVisibleWidgets(['candlestick', 'orderbook']);

      const result = loadVisibleWidgets();
      expect(result).toEqual(['candlestick', 'orderbook']);
    });

    it('filters out invalid widget types', () => {
      localStorage.setItem(
        'dashboard-visible-widgets',
        JSON.stringify(['candlestick', 'invalidType', 'orderbook']),
      );
      localStorage.setItem('dashboard-visible-widgets-version', '1');

      const result = loadVisibleWidgets();
      expect(result).toEqual(['candlestick', 'orderbook']);
    });

    it('returns null when all stored types are invalid', () => {
      localStorage.setItem('dashboard-visible-widgets', JSON.stringify(['invalidA', 'invalidB']));
      localStorage.setItem('dashboard-visible-widgets-version', '1');

      expect(loadVisibleWidgets()).toBeNull();
    });

    it('returns null for non-array JSON', () => {
      localStorage.setItem('dashboard-visible-widgets', '"not-an-array"');
      localStorage.setItem('dashboard-visible-widgets-version', '1');

      expect(loadVisibleWidgets()).toBeNull();
    });

    it('returns null for malformed JSON', () => {
      localStorage.setItem('dashboard-visible-widgets', '{broken');
      localStorage.setItem('dashboard-visible-widgets-version', '1');

      // Suppress expected console.error from the catch block
      vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(loadVisibleWidgets()).toBeNull();
      vi.restoreAllMocks();
    });

    it('accepts all valid WIDGET_TYPES', () => {
      const allTypes = [...WIDGET_TYPES];
      saveVisibleWidgets(allTypes);

      const result = loadVisibleWidgets();
      expect(result).toEqual(allTypes);
    });
  });

  describe('clearVisibleWidgets', () => {
    it('removes both storage keys', () => {
      saveVisibleWidgets(['candlestick']);

      clearVisibleWidgets();

      expect(localStorage.getItem('dashboard-visible-widgets')).toBeNull();
      expect(localStorage.getItem('dashboard-visible-widgets-version')).toBeNull();
    });
  });
});
