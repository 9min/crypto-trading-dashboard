'use client';

// =============================================================================
// ResetLayoutButton Component
// =============================================================================
// Header button that resets the dashboard layout to defaults.
// Shows a confirmation before resetting. Dispatches a custom event so that
// DashboardGrid can react to the reset without tight coupling.
// =============================================================================

import { memo, useCallback } from 'react';
import { dispatchLayoutReset } from '@/utils/layoutStorage';
import { useWidgetStore } from '@/stores/widgetStore';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const ResetLayoutButton = memo(function ResetLayoutButton() {
  const resetWidgets = useWidgetStore((state) => state.resetWidgets);

  const handleReset = useCallback(() => {
    const confirmed = window.confirm(
      'Reset layout to default? This will restore all widgets and their positions.',
    );
    if (!confirmed) return;

    // Reset widget visibility
    resetWidgets();

    // Dispatch layout reset event (DashboardGrid listens for this)
    dispatchLayoutReset();
  }, [resetWidgets]);

  return (
    <button
      type="button"
      onClick={handleReset}
      className="text-foreground-secondary hover:bg-background-tertiary hover:text-foreground flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors"
      aria-label="Reset layout"
      title="Reset layout"
    >
      {/* Rotate/refresh icon */}
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.016 4.66v4.993"
        />
      </svg>
    </button>
  );
});
