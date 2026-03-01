// =============================================================================
// ChartSyncHub Tests
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChartSyncHub } from './ChartSyncHub';
import type { ChartLike, SeriesLike, CrosshairMoveHandler } from './ChartSyncHub';

// -----------------------------------------------------------------------------
// Mock Factories
// -----------------------------------------------------------------------------

function createMockChart(): ChartLike & { _handlers: CrosshairMoveHandler[] } {
  const handlers: CrosshairMoveHandler[] = [];
  return {
    _handlers: handlers,
    subscribeCrosshairMove: vi.fn((handler: CrosshairMoveHandler) => {
      handlers.push(handler);
    }),
    unsubscribeCrosshairMove: vi.fn((handler: CrosshairMoveHandler) => {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    }),
    setCrosshairPosition: vi.fn(),
    clearCrosshairPosition: vi.fn(),
  };
}

function createMockSeries(priceValue: number | null = 50000): SeriesLike {
  return {
    coordinateToPrice: vi.fn(() => priceValue),
  };
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('ChartSyncHub', () => {
  let hub: ChartSyncHub;

  beforeEach(() => {
    hub = new ChartSyncHub();
  });

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  describe('register / unregister', () => {
    it('registers a panel and subscribes to crosshair events', () => {
      const chart = createMockChart();
      const series = createMockSeries();

      hub.register('panel-1', chart, series);

      expect(chart.subscribeCrosshairMove).toHaveBeenCalledOnce();
      expect(hub.size).toBe(1);
    });

    it('unregisters a panel and unsubscribes from crosshair events', () => {
      const chart = createMockChart();
      const series = createMockSeries();

      hub.register('panel-1', chart, series);
      hub.unregister('panel-1');

      expect(chart.unsubscribeCrosshairMove).toHaveBeenCalledOnce();
      expect(hub.size).toBe(0);
    });

    it('re-registering same panel id unsubscribes first then subscribes again', () => {
      const chart1 = createMockChart();
      const chart2 = createMockChart();
      const series = createMockSeries();

      hub.register('panel-1', chart1, series);
      hub.register('panel-1', chart2, series);

      expect(chart1.unsubscribeCrosshairMove).toHaveBeenCalledOnce();
      expect(chart2.subscribeCrosshairMove).toHaveBeenCalledOnce();
      expect(hub.size).toBe(1);
    });

    it('unregister on non-existent panel is a no-op', () => {
      expect(() => hub.unregister('nonexistent')).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // destroy
  // ---------------------------------------------------------------------------

  describe('destroy', () => {
    it('unregisters all panels', () => {
      const chart1 = createMockChart();
      const chart2 = createMockChart();
      const series = createMockSeries();

      hub.register('panel-1', chart1, series);
      hub.register('panel-2', chart2, series);
      expect(hub.size).toBe(2);

      hub.destroy();
      expect(hub.size).toBe(0);
      expect(chart1.unsubscribeCrosshairMove).toHaveBeenCalledOnce();
      expect(chart2.unsubscribeCrosshairMove).toHaveBeenCalledOnce();
    });
  });

  // ---------------------------------------------------------------------------
  // Crosshair synchronization
  // ---------------------------------------------------------------------------

  describe('crosshair sync', () => {
    it('broadcasts crosshair move from source to other panels', () => {
      const chart1 = createMockChart();
      const chart2 = createMockChart();
      const series1 = createMockSeries(50000);
      const series2 = createMockSeries(3000);

      hub.register('panel-1', chart1, series1);
      hub.register('panel-2', chart2, series2);

      // Simulate crosshair move on panel-1
      const handler = chart1._handlers[0];
      handler({ time: 1234567890, point: { x: 100, y: 200 } });

      // panel-2 should receive setCrosshairPosition with its own price mapping
      expect(chart2.setCrosshairPosition).toHaveBeenCalledWith(3000, 1234567890, series2);
      // panel-1 should NOT receive its own broadcast
      expect(chart1.setCrosshairPosition).not.toHaveBeenCalled();
    });

    it('clears crosshair on other panels when mouse leaves source', () => {
      const chart1 = createMockChart();
      const chart2 = createMockChart();
      const series1 = createMockSeries();
      const series2 = createMockSeries();

      hub.register('panel-1', chart1, series1);
      hub.register('panel-2', chart2, series2);

      // Simulate mouse leave (no time, no point)
      const handler = chart1._handlers[0];
      handler({});

      expect(chart2.clearCrosshairPosition).toHaveBeenCalledOnce();
    });

    it('does not cause infinite loop (re-entrant guard)', () => {
      const chart1 = createMockChart();
      const chart2 = createMockChart();
      const series1 = createMockSeries();
      const series2 = createMockSeries();

      hub.register('panel-1', chart1, series1);
      hub.register('panel-2', chart2, series2);

      // When chart2 receives setCrosshairPosition, it will fire its own
      // crosshair move event. Simulate this by having setCrosshairPosition
      // trigger chart2's handler.
      (chart2.setCrosshairPosition as ReturnType<typeof vi.fn>).mockImplementation(() => {
        // This simulates the chart firing its own crosshairMove in response
        const handler2 = chart2._handlers[0];
        if (handler2) {
          handler2({ time: 1234567890, point: { x: 100, y: 200 } });
        }
      });

      // Trigger from panel-1
      const handler1 = chart1._handlers[0];
      handler1({ time: 1234567890, point: { x: 100, y: 200 } });

      // panel-1 should NOT receive setCrosshairPosition (re-entrant guard)
      expect(chart1.setCrosshairPosition).not.toHaveBeenCalled();
    });

    it('skips panels where coordinateToPrice returns null', () => {
      const chart1 = createMockChart();
      const chart2 = createMockChart();
      const series1 = createMockSeries();
      const series2 = createMockSeries(null); // price conversion fails

      hub.register('panel-1', chart1, series1);
      hub.register('panel-2', chart2, series2);

      const handler = chart1._handlers[0];
      handler({ time: 1234567890, point: { x: 100, y: 200 } });

      expect(chart2.setCrosshairPosition).not.toHaveBeenCalled();
    });

    it('broadcasts to multiple target panels', () => {
      const chart1 = createMockChart();
      const chart2 = createMockChart();
      const chart3 = createMockChart();
      const series1 = createMockSeries(50000);
      const series2 = createMockSeries(3000);
      const series3 = createMockSeries(100);

      hub.register('panel-1', chart1, series1);
      hub.register('panel-2', chart2, series2);
      hub.register('panel-3', chart3, series3);

      const handler = chart1._handlers[0];
      handler({ time: 1000, point: { x: 50, y: 150 } });

      expect(chart2.setCrosshairPosition).toHaveBeenCalledWith(3000, 1000, series2);
      expect(chart3.setCrosshairPosition).toHaveBeenCalledWith(100, 1000, series3);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles crosshair event with time but no point gracefully', () => {
      const chart1 = createMockChart();
      const chart2 = createMockChart();
      const series1 = createMockSeries();
      const series2 = createMockSeries();

      hub.register('panel-1', chart1, series1);
      hub.register('panel-2', chart2, series2);

      const handler = chart1._handlers[0];
      handler({ time: 1234567890 }); // time present but no point

      expect(chart2.clearCrosshairPosition).toHaveBeenCalledOnce();
    });

    it('handles single panel without errors', () => {
      const chart1 = createMockChart();
      const series1 = createMockSeries();

      hub.register('panel-1', chart1, series1);

      const handler = chart1._handlers[0];
      // No other panels to broadcast to — should not throw
      expect(() => handler({ time: 1000, point: { x: 50, y: 100 } })).not.toThrow();
    });
  });
});
