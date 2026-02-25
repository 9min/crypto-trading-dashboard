'use client';

// =============================================================================
// Toast Component
// =============================================================================
// Individual toast notification item with icon, message, and close button.
// Auto-dismisses after the configured duration. Uses CSS animations for
// slide-in and fade-out transitions.
// =============================================================================

import { memo, useEffect, useCallback } from 'react';
import { useToastStore, type Toast as ToastData } from '@/stores/toastStore';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ToastProps {
  toast: ToastData;
}

// -----------------------------------------------------------------------------
// Icons
// -----------------------------------------------------------------------------

function InfoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const ICON_MAP = {
  info: InfoIcon,
  success: SuccessIcon,
  warning: WarningIcon,
  error: ErrorIcon,
} as const;

const COLOR_MAP = {
  info: 'text-foreground-secondary',
  success: 'text-buy',
  warning: 'text-reconnecting',
  error: 'text-sell',
} as const;

const BORDER_COLOR_MAP = {
  info: 'border-l-foreground-secondary',
  success: 'border-l-buy',
  warning: 'border-l-reconnecting',
  error: 'border-l-sell',
} as const;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const Toast = memo(function Toast({ toast }: ToastProps) {
  const removeToast = useToastStore((state) => state.removeToast);

  const handleClose = useCallback(() => {
    removeToast(toast.id);
  }, [removeToast, toast.id]);

  // Auto-dismiss after duration
  useEffect(() => {
    if (toast.duration <= 0) return;

    const timeoutId = setTimeout(handleClose, toast.duration);
    return () => {
      clearTimeout(timeoutId);
    };
  }, [toast.duration, handleClose]);

  const Icon = ICON_MAP[toast.type];

  return (
    <div
      role="alert"
      className={`bg-background-secondary border-border animate-toast-slide-in flex items-start gap-2 rounded-md border border-l-2 px-3 py-2.5 shadow-lg ${BORDER_COLOR_MAP[toast.type]}`}
      style={{ minWidth: '280px', maxWidth: '380px' }}
    >
      <span className={`mt-0.5 shrink-0 ${COLOR_MAP[toast.type]}`}>
        <Icon />
      </span>
      <p className="text-foreground flex-1 text-xs leading-relaxed">{toast.message}</p>
      <button
        onClick={handleClose}
        className="text-foreground-tertiary hover:text-foreground mt-0.5 shrink-0 transition-colors"
        aria-label="Dismiss notification"
        type="button"
      >
        <CloseIcon />
      </button>
    </div>
  );
});
