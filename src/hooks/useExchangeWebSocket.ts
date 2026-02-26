// =============================================================================
// useExchangeWebSocket Hook
// =============================================================================
// Exchange-aware WebSocket hook that delegates to the appropriate
// exchange-specific hook based on the current exchange selection.
//
// IMPORTANT: Both hooks are ALWAYS called (Rules of Hooks). The inactive
// exchange receives null/empty params to disable its connection.
// =============================================================================

import { useUiStore } from '@/stores/uiStore';
import { useKlineStore } from '@/stores/klineStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useUpbitStream } from '@/hooks/useUpbitStream';
import { toUpbitSymbol } from '@/utils/symbolMap';
import type { KlineInterval } from '@/types/chart';

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useExchangeWebSocket(enabled = true): void {
  const exchange = useUiStore((state) => state.exchange);
  const symbol = useUiStore((state) => state.symbol);
  const interval = useKlineStore((state) => state.interval);

  // ALWAYS call both hooks (Rules of Hooks compliance).
  // Use enabled flag to disable the inactive exchange's connection.

  // Binance hook: active when exchange === 'binance' AND enabled
  useWebSocket({
    symbol,
    interval: interval as KlineInterval,
    enabled: enabled && exchange === 'binance',
  });

  // Upbit hook: active when exchange === 'upbit' AND enabled
  // Convert Binance-format symbol to Upbit format for the Upbit API
  useUpbitStream({
    symbol: enabled && exchange === 'upbit' ? toUpbitSymbol(symbol) : null,
    interval: interval as KlineInterval,
  });
}
