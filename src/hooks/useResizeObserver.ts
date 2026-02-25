// =============================================================================
// useResizeObserver Hook
// =============================================================================
// Tracks the dimensions of a DOM element using ResizeObserver.
// Returns the current { width, height } of the observed element, debounced
// to avoid excessive updates during rapid resize events.
// =============================================================================

import { useState, useEffect, type RefObject } from 'react';
import { debounce } from '@/utils/debounce';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ElementSize {
  /** Element width in CSS pixels */
  width: number;
  /** Element height in CSS pixels */
  height: number;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const RESIZE_DEBOUNCE_MS = 100;

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Observes an element's dimensions via ResizeObserver and returns its size.
 * Updates are debounced to prevent layout thrashing during rapid resizes.
 *
 * @param ref - React ref pointing to the element to observe
 * @param debounceMs - Debounce delay in milliseconds (default: 100)
 * @returns The current size of the observed element
 */
export function useResizeObserver(
  ref: RefObject<HTMLElement | null>,
  debounceMs = RESIZE_DEBOUNCE_MS,
): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const debouncedUpdate = debounce((entry: ResizeObserverEntry) => {
      const { width, height } = entry.contentRect;
      setSize((prev) => {
        if (prev.width === width && prev.height === height) return prev;
        return { width, height };
      });
    }, debounceMs);

    const observer = new ResizeObserver((entries: ResizeObserverEntry[]) => {
      const entry = entries[0];
      if (entry) {
        debouncedUpdate(entry);
      }
    });

    observer.observe(element);

    // Read initial size synchronously
    const rect = element.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });

    return () => {
      observer.disconnect();
      debouncedUpdate.cancel();
    };
  }, [ref, debounceMs]);

  return size;
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export type { ElementSize };
