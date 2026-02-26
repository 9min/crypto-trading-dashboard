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
  /** Optional actions rendered at the right side of the header */
  headerActions?: ReactNode;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const WidgetWrapper = memo(function WidgetWrapper({
  title,
  children,
  headerActions,
}: WidgetWrapperProps) {
  return (
    <div className="border-border bg-background-secondary flex h-full flex-col rounded-lg border">
      <div className="widget-drag-handle border-border bg-background-tertiary relative z-10 flex h-8 shrink-0 cursor-grab items-center justify-between border-b px-3 transition-colors active:cursor-grabbing">
        <span className="border-accent text-foreground-secondary border-l-2 pl-2 text-xs font-medium">
          {title}
        </span>
        {headerActions ? (
          <div className="flex items-center" onMouseDown={(e) => e.stopPropagation()}>
            {headerActions}
          </div>
        ) : null}
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
});
