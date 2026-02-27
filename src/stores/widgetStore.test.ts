vi.mock('@/utils/widgetStorage', () => ({
  saveVisibleWidgets: vi.fn(),
  loadVisibleWidgets: vi.fn(),
  clearVisibleWidgets: vi.fn(),
}));

import { useWidgetStore } from './widgetStore';
import { WIDGET_TYPES } from '@/types/widget';
import { saveVisibleWidgets, loadVisibleWidgets, clearVisibleWidgets } from '@/utils/widgetStorage';

const mockedLoadVisibleWidgets = vi.mocked(loadVisibleWidgets);

describe('widgetStore', () => {
  beforeEach(() => {
    // Reset store: all widgets visible, not hydrated
    useWidgetStore.setState({
      visibleWidgets: new Set(WIDGET_TYPES),
      isHydrated: false,
    });
    vi.clearAllMocks();
  });

  it('has all widgets visible initially', () => {
    const { visibleWidgets } = useWidgetStore.getState();
    for (const type of WIDGET_TYPES) {
      expect(visibleWidgets.has(type)).toBe(true);
    }
  });

  describe('hideWidget', () => {
    it('removes a widget from the visible set', () => {
      useWidgetStore.getState().hideWidget('perf');
      expect(useWidgetStore.getState().visibleWidgets.has('perf')).toBe(false);
    });

    it('persists the change via saveVisibleWidgets', () => {
      useWidgetStore.getState().hideWidget('depth');
      expect(saveVisibleWidgets).toHaveBeenCalled();
    });

    it('does not remove when only one widget remains', () => {
      // Hide all except one
      const allTypes = [...WIDGET_TYPES];
      const keep = allTypes[0];
      for (const t of allTypes.slice(1)) {
        useWidgetStore.getState().hideWidget(t);
      }
      // Try to hide the last one
      useWidgetStore.getState().hideWidget(keep);
      expect(useWidgetStore.getState().visibleWidgets.has(keep)).toBe(true);
      expect(useWidgetStore.getState().visibleWidgets.size).toBe(1);
    });

    it('is a no-op for an already hidden widget', () => {
      useWidgetStore.getState().hideWidget('perf');
      vi.clearAllMocks();

      useWidgetStore.getState().hideWidget('perf');
      // saveVisibleWidgets should NOT be called again
      expect(saveVisibleWidgets).not.toHaveBeenCalled();
    });
  });

  describe('showWidget', () => {
    it('adds a widget to the visible set', () => {
      useWidgetStore.getState().hideWidget('trades');
      useWidgetStore.getState().showWidget('trades');
      expect(useWidgetStore.getState().visibleWidgets.has('trades')).toBe(true);
    });

    it('persists the change via saveVisibleWidgets', () => {
      useWidgetStore.getState().hideWidget('trades');
      vi.clearAllMocks();

      useWidgetStore.getState().showWidget('trades');
      expect(saveVisibleWidgets).toHaveBeenCalled();
    });

    it('does not duplicate an already visible widget', () => {
      vi.clearAllMocks();
      useWidgetStore.getState().showWidget('candlestick');
      // Already visible, so no persistence call
      expect(saveVisibleWidgets).not.toHaveBeenCalled();
    });
  });

  describe('resetWidgets', () => {
    it('restores all widgets to visible', () => {
      useWidgetStore.getState().hideWidget('orderbook');
      useWidgetStore.getState().hideWidget('trades');

      useWidgetStore.getState().resetWidgets();

      const { visibleWidgets } = useWidgetStore.getState();
      for (const type of WIDGET_TYPES) {
        expect(visibleWidgets.has(type)).toBe(true);
      }
    });

    it('calls clearVisibleWidgets to clear storage', () => {
      useWidgetStore.getState().resetWidgets();
      expect(clearVisibleWidgets).toHaveBeenCalled();
    });
  });

  describe('hydrateWidgets', () => {
    it('loads widgets from localStorage when data exists', () => {
      mockedLoadVisibleWidgets.mockReturnValue(['candlestick', 'orderbook']);

      useWidgetStore.getState().hydrateWidgets();

      const { visibleWidgets, isHydrated } = useWidgetStore.getState();
      expect(isHydrated).toBe(true);
      expect(visibleWidgets.size).toBe(2);
      expect(visibleWidgets.has('candlestick')).toBe(true);
      expect(visibleWidgets.has('orderbook')).toBe(true);
    });

    it('keeps default widgets when localStorage returns null', () => {
      mockedLoadVisibleWidgets.mockReturnValue(null);

      useWidgetStore.getState().hydrateWidgets();

      const { visibleWidgets, isHydrated } = useWidgetStore.getState();
      expect(isHydrated).toBe(true);
      expect(visibleWidgets.size).toBe(WIDGET_TYPES.length);
    });
  });
});
