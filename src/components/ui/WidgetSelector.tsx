'use client';

// =============================================================================
// WidgetSelector Component
// =============================================================================
// Header dropdown/popover for toggling widget visibility in the dashboard grid.
// Shows all 7 widget types with toggle checkboxes.
// =============================================================================

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { useWidgetStore } from '@/stores/widgetStore';
import { WIDGET_METADATA } from '@/types/widget';
import { WIDGET_TYPES, type WidgetType } from '@/types/widget';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const WidgetSelector = memo(function WidgetSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const visibleWidgets = useWidgetStore((state) => state.visibleWidgets);
  const hideWidget = useWidgetStore((state) => state.hideWidget);
  const showWidget = useWidgetStore((state) => state.showWidget);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent): void => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleWidgetToggle = useCallback(
    (type: WidgetType) => {
      if (visibleWidgets.has(type)) {
        hideWidget(type);
      } else {
        showWidget(type);
      }
    },
    [visibleWidgets, hideWidget, showWidget],
  );

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="text-foreground-secondary hover:bg-background-tertiary hover:text-foreground relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors"
        aria-label="Toggle widgets"
      >
        {/* Grid icon */}
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
            d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
          />
        </svg>
        {visibleWidgets.size < WIDGET_TYPES.length && (
          <span className="bg-accent text-accent-text absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold">
            {visibleWidgets.size}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="border-border bg-background-secondary absolute top-full right-0 z-50 mt-2 w-52 overflow-hidden rounded-lg border shadow-xl">
          {/* Header */}
          <div className="border-border flex items-center justify-between border-b px-3 py-2">
            <span className="text-foreground text-xs font-semibold">Widgets</span>
            <span className="bg-background-tertiary text-foreground-secondary rounded px-1.5 py-0.5 text-[10px] font-medium">
              {visibleWidgets.size}/{WIDGET_TYPES.length}
            </span>
          </div>

          {/* Widget toggles */}
          <div className="py-1">
            {WIDGET_TYPES.map((type) => {
              const meta = WIDGET_METADATA[type];
              const isVisible = visibleWidgets.has(type);
              const isLastVisible = isVisible && visibleWidgets.size <= 1;

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleWidgetToggle(type)}
                  disabled={isLastVisible}
                  className={`flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                    isLastVisible ? 'cursor-not-allowed opacity-50' : 'hover:bg-background-tertiary'
                  }`}
                >
                  {/* Checkbox */}
                  <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      isVisible
                        ? 'border-accent bg-accent'
                        : 'border-foreground-tertiary bg-background'
                    }`}
                  >
                    {isVisible && (
                      <svg
                        className="h-3 w-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={3}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                    )}
                  </div>
                  <span
                    className={
                      isVisible ? 'text-foreground font-medium' : 'text-foreground-secondary'
                    }
                  >
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
