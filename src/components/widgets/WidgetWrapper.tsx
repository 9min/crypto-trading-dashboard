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
  /** Optional close/hide callback. When provided, a close button is rendered. */
  onClose?: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const WidgetWrapper = memo(function WidgetWrapper({
  title,
  children,
  headerActions,
  onClose,
}: WidgetWrapperProps) {
  return (
    <div className="border-border bg-background-secondary flex h-full flex-col rounded-lg border shadow-[var(--shadow-widget)]">
      <div className="widget-drag-handle border-border bg-background-tertiary relative z-10 flex h-8 shrink-0 cursor-grab items-center justify-between border-b px-3 transition-colors active:cursor-grabbing">
        <span
          data-testid="widget-title"
          className="border-accent text-foreground-secondary border-l-2 pl-2 text-xs font-medium"
        >
          {title}
        </span>
        <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
          {headerActions}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="text-foreground-tertiary hover:text-sell flex h-5 w-5 cursor-pointer items-center justify-center rounded transition-colors"
              aria-label={`Hide ${title}`}
            >
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
});
