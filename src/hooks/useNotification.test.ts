import { renderHook, act } from '@testing-library/react';
import { useNotification } from './useNotification';

describe('useNotification', () => {
  const originalNotification = globalThis.Notification;

  afterEach(() => {
    // Restore original Notification
    if (originalNotification) {
      vi.stubGlobal('Notification', originalNotification);
    }
    vi.restoreAllMocks();
  });

  describe('when Notification API is not available', () => {
    it('returns "denied" permission', () => {
      // Remove Notification from window
      const saved = window.Notification;
      // @ts-expect-error — intentionally removing for test
      delete window.Notification;

      const { result } = renderHook(() => useNotification());
      expect(result.current.permission).toBe('denied');

      // Restore
      window.Notification = saved;
    });
  });

  describe('when Notification API is available', () => {
    let MockNotification: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      MockNotification = vi.fn();
      MockNotification.permission = 'default';
      MockNotification.requestPermission = vi.fn().mockResolvedValue('granted');
      vi.stubGlobal('Notification', MockNotification);
    });

    it('reads the current permission from Notification.permission', () => {
      MockNotification.permission = 'granted';
      const { result } = renderHook(() => useNotification());
      expect(result.current.permission).toBe('granted');
    });

    it('requestPermission calls Notification.requestPermission and updates state', async () => {
      MockNotification.permission = 'default';
      const { result } = renderHook(() => useNotification());

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(MockNotification.requestPermission).toHaveBeenCalled();
      expect(result.current.permission).toBe('granted');
    });

    it('requestPermission handles denied result', async () => {
      MockNotification.permission = 'default';
      MockNotification.requestPermission = vi.fn().mockResolvedValue('denied');

      const { result } = renderHook(() => useNotification());

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(result.current.permission).toBe('denied');
    });

    it('sendNotification creates a Notification when permission is granted', () => {
      MockNotification.permission = 'granted';
      const { result } = renderHook(() => useNotification());

      act(() => {
        result.current.sendNotification('Price Alert', 'BTC hit $50k');
      });

      expect(MockNotification).toHaveBeenCalledWith(
        'Price Alert',
        expect.objectContaining({
          body: 'BTC hit $50k',
        }),
      );
    });

    it('sendNotification is a no-op when permission is not granted', () => {
      MockNotification.permission = 'default';
      const { result } = renderHook(() => useNotification());

      act(() => {
        result.current.sendNotification('Alert', 'Test');
      });

      expect(MockNotification).not.toHaveBeenCalled();
    });

    it('sendNotification handles errors gracefully', () => {
      MockNotification.permission = 'granted';
      MockNotification.mockImplementation(() => {
        throw new Error('Notification blocked');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { result } = renderHook(() => useNotification());

      act(() => {
        result.current.sendNotification('Alert', 'Test');
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
