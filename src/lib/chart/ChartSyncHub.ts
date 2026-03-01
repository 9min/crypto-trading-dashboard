// =============================================================================
// ChartSyncHub
// =============================================================================
// Coordinates crosshair synchronization across multiple chart panels.
// Plain class (non-React) to avoid unnecessary re-renders — crosshair events
// fire at 60fps and must be handled outside the React render cycle.
//
// Usage:
//   const hub = new ChartSyncHub();
//   hub.register(panelId, chart, series);
//   // ... later
//   hub.unregister(panelId);
// =============================================================================

// We use opaque type aliases to avoid importing lightweight-charts types
// at the module level (dynamic import only). The actual API shape is:
//   chart.subscribeCrosshairMove(handler)
//   chart.unsubscribeCrosshairMove(handler)
//   series.coordinateToPrice(y) => number | null
//   chart.setCrosshairPosition(price, time, series)
//   chart.clearCrosshairPosition()

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ChartCrosshairMoveParams {
  time?: number;
  point?: { x: number; y: number };
}

type CrosshairMoveHandler = (params: ChartCrosshairMoveParams) => void;

interface ChartLike {
  subscribeCrosshairMove: (handler: CrosshairMoveHandler) => void;
  unsubscribeCrosshairMove: (handler: CrosshairMoveHandler) => void;
  setCrosshairPosition: (price: number, time: number, series: SeriesLike) => void;
  clearCrosshairPosition: () => void;
}

interface SeriesLike {
  coordinateToPrice: (y: number) => number | null;
}

interface RegisteredPanel {
  chart: ChartLike;
  series: SeriesLike;
  handler: CrosshairMoveHandler;
}

// -----------------------------------------------------------------------------
// ChartSyncHub
// -----------------------------------------------------------------------------

export class ChartSyncHub {
  private panels = new Map<string, RegisteredPanel>();
  private isBroadcasting = false;

  /**
   * Register a chart panel for crosshair synchronization.
   * Subscribes to the chart's crosshair move events and forwards
   * them to all other registered panels.
   */
  register(panelId: string, chart: ChartLike, series: SeriesLike): void {
    // Unregister existing panel with the same ID to avoid duplicate subscriptions
    this.unregister(panelId);

    const handler: CrosshairMoveHandler = (params) => {
      this.handleCrosshairMove(panelId, params);
    };

    chart.subscribeCrosshairMove(handler);
    this.panels.set(panelId, { chart, series, handler });
  }

  /**
   * Unregister a chart panel and remove its crosshair subscription.
   */
  unregister(panelId: string): void {
    const panel = this.panels.get(panelId);
    if (!panel) return;

    panel.chart.unsubscribeCrosshairMove(panel.handler);
    this.panels.delete(panelId);
  }

  /**
   * Unregister all panels and clear all subscriptions.
   */
  destroy(): void {
    const ids = [...this.panels.keys()];
    for (const id of ids) {
      this.unregister(id);
    }
  }

  /**
   * Returns the number of registered panels.
   */
  get size(): number {
    return this.panels.size;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private handleCrosshairMove(sourceId: string, params: ChartCrosshairMoveParams): void {
    // Guard against infinite loops: when we call setCrosshairPosition on
    // other charts, they fire their own crosshairMove events. The
    // isBroadcasting flag prevents re-entrant propagation.
    if (this.isBroadcasting) return;

    this.isBroadcasting = true;

    try {
      const time = params.time;
      const point = params.point;

      for (const [id, panel] of this.panels) {
        if (id === sourceId) continue;

        if (time && point) {
          // Convert the source chart's y-coordinate to a price on the target series
          const price = panel.series.coordinateToPrice(point.y);
          if (price !== null) {
            panel.chart.setCrosshairPosition(price, time, panel.series);
          }
        } else {
          // Mouse left the source chart — clear crosshair on targets
          panel.chart.clearCrosshairPosition();
        }
      }
    } finally {
      this.isBroadcasting = false;
    }
  }
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export type { ChartLike, SeriesLike, ChartCrosshairMoveParams, CrosshairMoveHandler };
