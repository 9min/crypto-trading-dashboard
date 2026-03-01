// =============================================================================
// useChartSync Tests
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChartSync } from './useChartSync';
import { useMultiChartStore } from '@/stores/multiChartStore';
import type { ChartSyncHub, ChartLike, SeriesLike } from '@/lib/chart/ChartSyncHub';

// -----------------------------------------------------------------------------
// Mock Factories
// -----------------------------------------------------------------------------

function createMockSyncHub(): ChartSyncHub {
  return {
    register: vi.fn(),
    unregister: vi.fn(),
    destroy: vi.fn(),
    get size() {
      return 0;
    },
  } as unknown as ChartSyncHub;
}

function createMockChart(): ChartLike {
  return {
    subscribeCrosshairMove: vi.fn(),
    unsubscribeCrosshairMove: vi.fn(),
    setCrosshairPosition: vi.fn(),
    clearCrosshairPosition: vi.fn(),
  };
}

function createMockSeries(): SeriesLike {
  return {
    coordinateToPrice: vi.fn(() => 50000),
  };
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('useChartSync', () => {
  beforeEach(() => {
    useMultiChartStore.setState({ crosshairSync: true });
  });

  it('registers panel with sync hub when chart is ready and sync is enabled', () => {
    const hub = createMockSyncHub();
    const chart = createMockChart();
    const series = createMockSeries();
    const chartRef = { current: chart };
    const seriesRef = { current: series };

    renderHook(() =>
      useChartSync({
        panelId: 'panel-1',
        chartRef,
        seriesRef,
        syncHub: hub,
        isChartReady: true,
      }),
    );

    expect(hub.register).toHaveBeenCalledWith('panel-1', chart, series);
  });

  it('does not register when chart is not ready', () => {
    const hub = createMockSyncHub();
    const chartRef = { current: null };
    const seriesRef = { current: null };

    renderHook(() =>
      useChartSync({
        panelId: 'panel-1',
        chartRef,
        seriesRef,
        syncHub: hub,
        isChartReady: false,
      }),
    );

    expect(hub.register).not.toHaveBeenCalled();
  });

  it('does not register when crosshairSync is disabled', () => {
    useMultiChartStore.setState({ crosshairSync: false });

    const hub = createMockSyncHub();
    const chart = createMockChart();
    const series = createMockSeries();
    const chartRef = { current: chart };
    const seriesRef = { current: series };

    renderHook(() =>
      useChartSync({
        panelId: 'panel-1',
        chartRef,
        seriesRef,
        syncHub: hub,
        isChartReady: true,
      }),
    );

    expect(hub.register).not.toHaveBeenCalled();
    // Should unregister when sync is disabled
    expect(hub.unregister).toHaveBeenCalledWith('panel-1');
  });

  it('unregisters panel on unmount', () => {
    const hub = createMockSyncHub();
    const chart = createMockChart();
    const series = createMockSeries();
    const chartRef = { current: chart };
    const seriesRef = { current: series };

    const { unmount } = renderHook(() =>
      useChartSync({
        panelId: 'panel-1',
        chartRef,
        seriesRef,
        syncHub: hub,
        isChartReady: true,
      }),
    );

    unmount();
    expect(hub.unregister).toHaveBeenCalledWith('panel-1');
  });

  it('re-registers when crosshairSync toggles from off to on', () => {
    useMultiChartStore.setState({ crosshairSync: false });

    const hub = createMockSyncHub();
    const chart = createMockChart();
    const series = createMockSeries();
    const chartRef = { current: chart };
    const seriesRef = { current: series };

    renderHook(() =>
      useChartSync({
        panelId: 'panel-1',
        chartRef,
        seriesRef,
        syncHub: hub,
        isChartReady: true,
      }),
    );

    expect(hub.register).not.toHaveBeenCalled();

    // Enable sync via store update (triggers re-render through selector)
    act(() => {
      useMultiChartStore.setState({ crosshairSync: true });
    });
    expect(hub.register).toHaveBeenCalledWith('panel-1', chart, series);
  });

  it('does not register when chartRef is null even if chart is ready', () => {
    const hub = createMockSyncHub();
    const chartRef = { current: null };
    const seriesRef = { current: createMockSeries() };

    renderHook(() =>
      useChartSync({
        panelId: 'panel-1',
        chartRef,
        seriesRef,
        syncHub: hub,
        isChartReady: true,
      }),
    );

    expect(hub.register).not.toHaveBeenCalled();
  });
});
