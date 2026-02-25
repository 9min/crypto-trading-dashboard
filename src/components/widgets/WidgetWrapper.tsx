'use client';

// =============================================================================
// WidgetWrapper Component
// =============================================================================
// Common wrapper for all dashboard widgets. Provides a consistent title bar
// (serving as the drag handle for react-grid-layout) and border styling.
// =============================================================================

import { memo, type ReactNode } from 'react';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface WidgetWrapperProps {
  /** Widget title displayed in the header bar */
  title: string;
  /** Widget content */
  children: ReactNode;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const WidgetWrapper = memo(function WidgetWrapper({ title, children }: WidgetWrapperProps) {
  return (
    <div className="border-border bg-background-secondary flex h-full flex-col overflow-hidden rounded-lg border">
      <div className="widget-drag-handle border-border bg-background-tertiary flex h-8 shrink-0 cursor-grab items-center border-b px-3 active:cursor-grabbing">
        <span className="text-foreground-secondary text-xs font-medium">{title}</span>
      </div>
      <div className="relative flex-1 overflow-hidden">{children}</div>
    </div>
  );
});
