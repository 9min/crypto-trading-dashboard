import { useAuthStore } from './authStore';
import type { UserProfile } from './authStore';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
  });

  it('has correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  describe('setUser', () => {
    it('sets a user profile', () => {
      const profile: UserProfile = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
      };

      useAuthStore.getState().setUser(profile);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(profile);
      expect(state.user?.id).toBe('user-123');
    });

    it('clears user when set to null', () => {
      const profile: UserProfile = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test',
        avatarUrl: null,
      };

      useAuthStore.getState().setUser(profile);
      useAuthStore.getState().setUser(null);

      expect(useAuthStore.getState().user).toBeNull();
    });

    it('handles profile with null optional fields', () => {
      const profile: UserProfile = {
        id: 'user-456',
        email: null,
        name: null,
        avatarUrl: null,
      };

      useAuthStore.getState().setUser(profile);

      const state = useAuthStore.getState();
      expect(state.user?.email).toBeNull();
      expect(state.user?.name).toBeNull();
      expect(state.user?.avatarUrl).toBeNull();
    });
  });

  describe('setLoading', () => {
    it('sets isLoading to true', () => {
      useAuthStore.getState().setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);
    });

    it('sets isLoading to false', () => {
      useAuthStore.getState().setLoading(true);
      useAuthStore.getState().setLoading(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      useAuthStore.getState().setUser({
        id: 'user-789',
        email: 'reset@test.com',
        name: 'Reset',
        avatarUrl: null,
      });
      useAuthStore.getState().setLoading(true);

      useAuthStore.getState().reset();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });
});
