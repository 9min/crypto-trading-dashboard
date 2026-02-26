// =============================================================================
// Indicator Store Unit Tests
// =============================================================================

import { useIndicatorStore } from './indicatorStore';
import type { IndicatorConfig } from '@/types/indicator';

// Helper to reset store state between tests
function resetStore(): void {
  useIndicatorStore.getState().reset();
}

describe('indicatorStore', () => {
  beforeEach(() => {
    resetStore();
  });

  // ---------------------------------------------------------------------------
  // Initial State
  // ---------------------------------------------------------------------------

  describe('initial state', () => {
    it('has 7 default indicators', () => {
      const { indicators, indicatorOrder } = useIndicatorStore.getState();
      expect(Object.keys(indicators)).toHaveLength(7);
      expect(indicatorOrder).toHaveLength(7);
    });

    it('all default indicators start as hidden', () => {
      const { indicators } = useIndicatorStore.getState();
      for (const config of Object.values(indicators)) {
        expect(config.visible).toBe(false);
      }
    });

    it('includes expected indicator ids', () => {
      const { indicators } = useIndicatorStore.getState();
      expect(indicators['sma-20']).toBeDefined();
      expect(indicators['sma-50']).toBeDefined();
      expect(indicators['ema-12']).toBeDefined();
      expect(indicators['ema-26']).toBeDefined();
      expect(indicators['bb-20']).toBeDefined();
      expect(indicators['rsi-14']).toBeDefined();
      expect(indicators['volume']).toBeDefined();
    });

    it('order matches expected sequence', () => {
      const { indicatorOrder } = useIndicatorStore.getState();
      expect(indicatorOrder).toEqual([
        'sma-20',
        'sma-50',
        'ema-12',
        'ema-26',
        'bb-20',
        'rsi-14',
        'volume',
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // addIndicator
  // ---------------------------------------------------------------------------

  describe('addIndicator', () => {
    it('adds a new indicator', () => {
      const config: IndicatorConfig = {
        type: 'sma',
        id: 'sma-100',
        period: 100,
        color: '#ff0000',
        visible: true,
      };
      useIndicatorStore.getState().addIndicator(config);

      const { indicators, indicatorOrder } = useIndicatorStore.getState();
      expect(indicators['sma-100']).toEqual(config);
      expect(indicatorOrder).toContain('sma-100');
    });

    it('does not overwrite an existing indicator with same id', () => {
      const original = useIndicatorStore.getState().indicators['sma-20'];
      const duplicate: IndicatorConfig = {
        type: 'sma',
        id: 'sma-20',
        period: 999,
        color: '#000000',
        visible: true,
      };
      useIndicatorStore.getState().addIndicator(duplicate);

      const { indicators } = useIndicatorStore.getState();
      expect(indicators['sma-20'].visible).toBe(original.visible);
    });

    it('appends to order list', () => {
      const config: IndicatorConfig = {
        type: 'ema',
        id: 'ema-50',
        period: 50,
        color: '#00ff00',
        visible: false,
      };
      useIndicatorStore.getState().addIndicator(config);

      const { indicatorOrder } = useIndicatorStore.getState();
      expect(indicatorOrder[indicatorOrder.length - 1]).toBe('ema-50');
    });
  });

  // ---------------------------------------------------------------------------
  // removeIndicator
  // ---------------------------------------------------------------------------

  describe('removeIndicator', () => {
    it('removes an existing indicator', () => {
      useIndicatorStore.getState().removeIndicator('sma-20');

      const { indicators, indicatorOrder } = useIndicatorStore.getState();
      expect(indicators['sma-20']).toBeUndefined();
      expect(indicatorOrder).not.toContain('sma-20');
    });

    it('does not modify state when removing a non-existent id', () => {
      const before = useIndicatorStore.getState();
      useIndicatorStore.getState().removeIndicator('nonexistent');
      const after = useIndicatorStore.getState();

      expect(after.indicators).toBe(before.indicators);
      expect(after.indicatorOrder).toBe(before.indicatorOrder);
    });

    it('preserves other indicators', () => {
      useIndicatorStore.getState().removeIndicator('sma-20');

      const { indicators } = useIndicatorStore.getState();
      expect(indicators['sma-50']).toBeDefined();
      expect(indicators['ema-12']).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // toggleIndicator
  // ---------------------------------------------------------------------------

  describe('toggleIndicator', () => {
    it('toggles visibility from false to true', () => {
      expect(useIndicatorStore.getState().indicators['sma-20'].visible).toBe(false);

      useIndicatorStore.getState().toggleIndicator('sma-20');

      expect(useIndicatorStore.getState().indicators['sma-20'].visible).toBe(true);
    });

    it('toggles visibility from true to false', () => {
      useIndicatorStore.getState().toggleIndicator('sma-20'); // false → true
      useIndicatorStore.getState().toggleIndicator('sma-20'); // true → false

      expect(useIndicatorStore.getState().indicators['sma-20'].visible).toBe(false);
    });

    it('does not modify state for non-existent id', () => {
      const before = useIndicatorStore.getState();
      useIndicatorStore.getState().toggleIndicator('nonexistent');
      const after = useIndicatorStore.getState();

      expect(after.indicators).toBe(before.indicators);
    });

    it('preserves all other config fields', () => {
      const before = useIndicatorStore.getState().indicators['rsi-14'];
      useIndicatorStore.getState().toggleIndicator('rsi-14');
      const after = useIndicatorStore.getState().indicators['rsi-14'];

      expect(after.type).toBe(before.type);
      expect(after.id).toBe(before.id);
      if (after.type === 'rsi' && before.type === 'rsi') {
        expect(after.period).toBe(before.period);
        expect(after.color).toBe(before.color);
        expect(after.overbought).toBe(before.overbought);
        expect(after.oversold).toBe(before.oversold);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // updateIndicator
  // ---------------------------------------------------------------------------

  describe('updateIndicator', () => {
    it('updates partial config fields', () => {
      useIndicatorStore.getState().updateIndicator('sma-20', { color: '#ff0000' });

      const config = useIndicatorStore.getState().indicators['sma-20'];
      expect(config.type === 'sma' && config.color).toBe('#ff0000');
    });

    it('does not modify state for non-existent id', () => {
      const before = useIndicatorStore.getState();
      useIndicatorStore.getState().updateIndicator('nonexistent', { visible: true });
      const after = useIndicatorStore.getState();

      expect(after.indicators).toBe(before.indicators);
    });

    it('preserves fields not included in the partial', () => {
      const before = useIndicatorStore.getState().indicators['sma-20'];
      useIndicatorStore.getState().updateIndicator('sma-20', { visible: true });
      const after = useIndicatorStore.getState().indicators['sma-20'];

      if (before.type === 'sma' && after.type === 'sma') {
        expect(after.period).toBe(before.period);
        expect(after.color).toBe(before.color);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // resetToDefaults
  // ---------------------------------------------------------------------------

  describe('resetToDefaults', () => {
    it('restores all indicators to default state', () => {
      // Modify some indicators
      useIndicatorStore.getState().toggleIndicator('sma-20');
      useIndicatorStore.getState().removeIndicator('ema-12');
      useIndicatorStore.getState().updateIndicator('rsi-14', { visible: true });

      useIndicatorStore.getState().resetToDefaults();

      const { indicators, indicatorOrder } = useIndicatorStore.getState();
      expect(Object.keys(indicators)).toHaveLength(7);
      expect(indicatorOrder).toHaveLength(7);
      for (const config of Object.values(indicators)) {
        expect(config.visible).toBe(false);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // reset
  // ---------------------------------------------------------------------------

  describe('reset', () => {
    it('resets to initial state', () => {
      useIndicatorStore.getState().toggleIndicator('sma-20');
      useIndicatorStore.getState().removeIndicator('volume');

      useIndicatorStore.getState().reset();

      const { indicators, indicatorOrder } = useIndicatorStore.getState();
      expect(Object.keys(indicators)).toHaveLength(7);
      expect(indicatorOrder).toHaveLength(7);
      expect(indicators['sma-20'].visible).toBe(false);
      expect(indicators['volume']).toBeDefined();
    });
  });
});
