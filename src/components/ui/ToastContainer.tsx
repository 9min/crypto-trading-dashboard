'use client';

// =============================================================================
// ToastContainer Component
// =============================================================================
// Renders all active toast notifications in a fixed position overlay.
// Uses ReactDOM.createPortal to render outside the main component tree,
// preventing layout interference with the dashboard grid.
// =============================================================================

import { memo, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useToastStore } from '@/stores/toastStore';
import { Toast } from './Toast';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Subscribe is a no-op — the value never changes after mount. */
const subscribeNoop = (): (() => void) => () => {};
const getClientSnapshot = (): boolean => true;
const getServerSnapshot = (): boolean => false;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const ToastContainer = memo(function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);
  const isMounted = useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot);

  if (!isMounted || toasts.length === 0) return null;

  return createPortal(
    <div
      className="fixed right-4 bottom-4 z-50 flex flex-col gap-2"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>,
    document.body,
  );
});
