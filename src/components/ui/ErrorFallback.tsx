'use client';

import { memo, useCallback } from 'react';

interface ErrorFallbackProps {
  error?: Error;
  onRetry?: () => void;
  widgetName?: string;
}

export const ErrorFallback = memo(function ErrorFallback({
  error,
  onRetry,
  widgetName,
}: ErrorFallbackProps) {
  const handleRetry = useCallback(() => {
    onRetry?.();
  }, [onRetry]);

  return (
    <div className="border-disconnected/20 bg-sell-bg flex h-full flex-col items-center justify-center gap-2 rounded-lg border p-4">
      <p className="text-foreground text-sm font-medium">
        {widgetName ? `${widgetName} error` : 'Something went wrong'}
      </p>
      {error?.message && <p className="text-foreground-secondary text-xs">{error.message}</p>}
      {onRetry && (
        <button
          onClick={handleRetry}
          className="bg-accent text-background hover:bg-accent-hover mt-2 rounded-md px-3 py-1 text-xs font-medium transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
});
