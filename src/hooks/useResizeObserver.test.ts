// =============================================================================
// useResizeObserver Tests
// =============================================================================
// Tests the hook's behavior with a mocked ResizeObserver.
// Verifies initial size reading, observer setup, and cleanup.
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResizeObserver } from './useResizeObserver';
import type { RefObject } from 'react';

// -----------------------------------------------------------------------------
// ResizeObserver Mock
// -----------------------------------------------------------------------------

type ResizeObserverCallback = (entries: ResizeObserverEntry[]) => void;

let mockObserverCallback: ResizeObserverCallback | null = null;
let mockDisconnect: ReturnType<typeof vi.fn>;
let mockObserve: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockObserverCallback = null;
  mockDisconnect = vi.fn();
  mockObserve = vi.fn();

  // Must use `function` keyword for a proper constructor
  function MockResizeObserver(this: ResizeObserver, callback: ResizeObserverCallback) {
    mockObserverCallback = callback;
    (this as unknown as Record<string, unknown>).observe = mockObserve;
    (this as unknown as Record<string, unknown>).unobserve = vi.fn();
    (this as unknown as Record<string, unknown>).disconnect = mockDisconnect;
  }

  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});

// -----------------------------------------------------------------------------
// Helper
// -----------------------------------------------------------------------------

function createMockRef(
  rect: { width: number; height: number } = { width: 200, height: 100 },
): RefObject<HTMLElement> {
  const element = {
    getBoundingClientRect: () => ({
      width: rect.width,
      height: rect.height,
      x: 0,
      y: 0,
      top: 0,
      right: rect.width,
      bottom: rect.height,
      left: 0,
      toJSON: vi.fn(),
    }),
  } as unknown as HTMLElement;

  return { current: element };
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('useResizeObserver', () => {
  it('returns initial size from getBoundingClientRect', () => {
    const ref = createMockRef({ width: 300, height: 150 });

    const { result } = renderHook(() => useResizeObserver(ref, 0));

    expect(result.current.width).toBe(300);
    expect(result.current.height).toBe(150);
  });

  it('returns zero size when ref is null', () => {
    const ref: RefObject<HTMLElement | null> = { current: null };

    const { result } = renderHook(() => useResizeObserver(ref, 0));

    expect(result.current.width).toBe(0);
    expect(result.current.height).toBe(0);
  });

  it('sets up ResizeObserver on mount', () => {
    const ref = createMockRef();

    renderHook(() => useResizeObserver(ref, 0));

    expect(mockObserve).toHaveBeenCalledTimes(1);
  });

  it('disconnects observer on unmount', () => {
    const ref = createMockRef();

    const { unmount } = renderHook(() => useResizeObserver(ref, 0));
    unmount();

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('updates size when ResizeObserver fires', async () => {
    const ref = createMockRef({ width: 200, height: 100 });

    const { result } = renderHook(() => useResizeObserver(ref, 0));

    expect(result.current.width).toBe(200);

    // Simulate a resize event
    await act(async () => {
      if (mockObserverCallback) {
        mockObserverCallback([
          {
            contentRect: { width: 400, height: 250 } as DOMRectReadOnly,
          } as ResizeObserverEntry,
        ]);
      }
      // Wait for debounce (0ms in test)
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.width).toBe(400);
    expect(result.current.height).toBe(250);
  });
});
