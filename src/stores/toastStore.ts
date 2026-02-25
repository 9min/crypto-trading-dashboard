// =============================================================================
// Toast Store
// =============================================================================
// Manages toast notification state. Toasts are displayed as non-intrusive
// alerts (e.g., WebSocket errors) per CLAUDE.md requirements.
//
// - Maximum 5 toasts displayed simultaneously (FIFO eviction)
// - Each toast has a unique ID generated via crypto.randomUUID()
// - Auto-removal after a configurable duration (default 4000ms)
// =============================================================================

import { create } from 'zustand';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type ToastType = 'info' | 'success' | 'warning' | 'error';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  /** Auto-dismiss duration in ms. Default: 4000 */
  duration: number;
}

interface ToastStoreState {
  toasts: Toast[];
}

interface ToastStoreActions {
  /** Add a toast notification. Returns the generated toast ID. */
  addToast: (message: string, type?: ToastType, duration?: number) => string;
  /** Remove a specific toast by ID */
  removeToast: (id: string) => void;
}

type ToastStore = ToastStoreState & ToastStoreActions;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const MAX_TOASTS = 5;
const DEFAULT_DURATION_MS = 4000;

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useToastStore = create<ToastStore>()((set) => ({
  // -- State ------------------------------------------------------------------
  toasts: [],

  // -- Actions ----------------------------------------------------------------
  addToast: (
    message: string,
    type: ToastType = 'info',
    duration: number = DEFAULT_DURATION_MS,
  ): string => {
    const id = crypto.randomUUID();
    const toast: Toast = { id, message, type, duration };

    set((state) => {
      const next = [...state.toasts, toast];
      // FIFO eviction: keep only the newest MAX_TOASTS
      return { toasts: next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next };
    });

    return id;
  },

  removeToast: (id: string): void => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export type { Toast, ToastType, ToastStoreState, ToastStoreActions, ToastStore };
export { MAX_TOASTS, DEFAULT_DURATION_MS };
