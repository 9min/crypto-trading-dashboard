// =============================================================================
// useNotification Hook
// =============================================================================
// Wraps the browser Notification API with permission management.
// =============================================================================

import { useState, useCallback } from 'react';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type NotificationPermission = 'default' | 'granted' | 'denied';

interface UseNotificationReturn {
  /** Current notification permission state */
  permission: NotificationPermission;
  /** Request notification permission from the user */
  requestPermission: () => Promise<void>;
  /** Send a browser notification (no-op if permission not granted) */
  sendNotification: (title: string, body: string) => void;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useNotification(): UseNotificationReturn {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission as NotificationPermission;
  });

  const requestPermission = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermission);
    } catch (error) {
      console.error('[useNotification] Permission request failed', {
        timestamp: Date.now(),
        error,
      });
    }
  }, []);

  const sendNotification = useCallback(
    (title: string, body: string): void => {
      if (permission !== 'granted') return;
      if (typeof window === 'undefined' || !('Notification' in window)) return;

      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: `price-alert-${Date.now()}`,
        });
      } catch (error) {
        console.error('[useNotification] Failed to send notification', {
          timestamp: Date.now(),
          error,
        });
      }
    },
    [permission],
  );

  return { permission, requestPermission, sendNotification };
}
