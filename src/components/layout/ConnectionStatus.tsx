'use client';

import { memo, useCallback } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { WebSocketManager } from '@/lib/websocket/WebSocketManager';
import { Button } from '@/components/ui/Button';

interface StatusConfig {
  color: string;
  label: string;
  pulse: boolean;
}

export const ConnectionStatus = memo(function ConnectionStatus() {
  const connectionState = useUiStore((state) => state.connectionState);

  const handleReconnect = useCallback(() => {
    WebSocketManager.getInstance().reconnect();
  }, []);

  const getStatusConfig = (): StatusConfig => {
    switch (connectionState.status) {
      case 'connected':
        return { color: 'bg-connected', label: 'Connected', pulse: false };
      case 'connecting':
        return { color: 'bg-reconnecting', label: 'Connecting...', pulse: true };
      case 'reconnecting':
        return {
          color: 'bg-reconnecting',
          label: `Reconnecting (${connectionState.attempt})...`,
          pulse: true,
        };
      case 'failed':
        return { color: 'bg-disconnected', label: 'Disconnected', pulse: false };
      case 'idle':
      default:
        return { color: 'bg-foreground-tertiary', label: 'Idle', pulse: false };
    }
  };

  const config = getStatusConfig();
  const isFailed = connectionState.status === 'failed';

  return (
    <div data-testid="connection-status" className="flex items-center gap-2">
      <div className="relative flex h-2 w-2">
        {config.pulse && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full ${config.color} opacity-75`}
          />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${config.color} ${connectionState.status === 'connected' ? 'status-dot-glow' : ''}`}
        />
      </div>
      <span className="text-foreground-secondary text-xs">{config.label}</span>
      {isFailed && (
        <Button variant="ghost" size="sm" onClick={handleReconnect}>
          Reconnect
        </Button>
      )}
    </div>
  );
});
