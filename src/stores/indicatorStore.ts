// =============================================================================
// Indicator Configuration Store
// =============================================================================
// Manages technical indicator settings: which indicators are active, their
// parameters (period, colors, etc.), and display order. The store ships with
// sensible defaults — all indicators pre-configured but hidden until toggled.
// =============================================================================

import { create } from 'zustand';
import type { IndicatorConfig } from '@/types/indicator';
import { INDICATOR_COLORS } from '@/utils/constants';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface IndicatorStoreState {
  /** Map of indicator id → config */
  indicators: Record<string, IndicatorConfig>;
  /** Ordered list of indicator ids (rendering order) */
  indicatorOrder: string[];
}

interface IndicatorStoreActions {
  /** Add a new indicator configuration */
  addIndicator: (config: IndicatorConfig) => void;
  /** Remove an indicator by id */
  removeIndicator: (id: string) => void;
  /** Toggle an indicator's visibility */
  toggleIndicator: (id: string) => void;
  /** Update partial config for an indicator (type-safe per indicator type) */
  updateIndicator: (id: string, partial: Partial<Omit<IndicatorConfig, 'type' | 'id'>>) => void;
  /** Reset all indicators to default configuration */
  resetToDefaults: () => void;
  /** Reset store to initial state */
  reset: () => void;
}

type IndicatorStore = IndicatorStoreState & IndicatorStoreActions;

// -----------------------------------------------------------------------------
// Default Indicators
// -----------------------------------------------------------------------------

function createDefaultIndicators(): Record<string, IndicatorConfig> {
  return {
    'sma-20': {
      type: 'sma',
      id: 'sma-20',
      period: 20,
      color: INDICATOR_COLORS.SMA_20,
      visible: false,
    },
    'sma-50': {
      type: 'sma',
      id: 'sma-50',
      period: 50,
      color: INDICATOR_COLORS.SMA_50,
      visible: false,
    },
    'ema-12': {
      type: 'ema',
      id: 'ema-12',
      period: 12,
      color: INDICATOR_COLORS.EMA_12,
      visible: false,
    },
    'ema-26': {
      type: 'ema',
      id: 'ema-26',
      period: 26,
      color: INDICATOR_COLORS.EMA_26,
      visible: false,
    },
    'bb-20': {
      type: 'bollingerBands',
      id: 'bb-20',
      period: 20,
      stdDev: 2,
      upperColor: INDICATOR_COLORS.BB_UPPER,
      middleColor: INDICATOR_COLORS.BB_MIDDLE,
      lowerColor: INDICATOR_COLORS.BB_LOWER,
      visible: false,
    },
    'rsi-14': {
      type: 'rsi',
      id: 'rsi-14',
      period: 14,
      color: INDICATOR_COLORS.RSI,
      overbought: 70,
      oversold: 30,
      visible: false,
    },
    volume: {
      type: 'volume',
      id: 'volume',
      maPeriod: 20,
      maColor: INDICATOR_COLORS.VOLUME_MA,
      visible: false,
    },
  };
}

const DEFAULT_ORDER = ['sma-20', 'sma-50', 'ema-12', 'ema-26', 'bb-20', 'rsi-14', 'volume'];

const INITIAL_STATE: IndicatorStoreState = {
  indicators: createDefaultIndicators(),
  indicatorOrder: DEFAULT_ORDER,
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useIndicatorStore = create<IndicatorStore>()((set) => ({
  // -- State ------------------------------------------------------------------
  ...INITIAL_STATE,

  // -- Actions ----------------------------------------------------------------

  addIndicator: (config: IndicatorConfig): void => {
    set((state) => {
      if (state.indicators[config.id]) return state;
      return {
        indicators: { ...state.indicators, [config.id]: config },
        indicatorOrder: [...state.indicatorOrder, config.id],
      };
    });
  },

  removeIndicator: (id: string): void => {
    set((state) => {
      if (!state.indicators[id]) return state;
      const { [id]: _, ...remaining } = state.indicators;
      return {
        indicators: remaining,
        indicatorOrder: state.indicatorOrder.filter((orderId) => orderId !== id),
      };
    });
  },

  toggleIndicator: (id: string): void => {
    set((state) => {
      const config = state.indicators[id];
      if (!config) return state;
      return {
        indicators: {
          ...state.indicators,
          [id]: { ...config, visible: !config.visible },
        },
      };
    });
  },

  updateIndicator: (id: string, partial: Partial<Omit<IndicatorConfig, 'type' | 'id'>>): void => {
    set((state) => {
      const config = state.indicators[id];
      if (!config) return state;
      return {
        indicators: {
          ...state.indicators,
          [id]: { ...config, ...partial } as IndicatorConfig,
        },
      };
    });
  },

  resetToDefaults: (): void => {
    set({
      indicators: createDefaultIndicators(),
      indicatorOrder: DEFAULT_ORDER,
    });
  },

  reset: (): void => {
    set({ ...INITIAL_STATE });
  },
}));

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export type { IndicatorStoreState, IndicatorStoreActions, IndicatorStore };
