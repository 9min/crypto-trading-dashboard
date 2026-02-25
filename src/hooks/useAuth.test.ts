import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockSignOut = vi.fn();
const mockUnsubscribe = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}));

// Import after mocks are set up
import { useAuth } from './useAuth';

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().reset();

    // Default: no existing session
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });

    // Default: auth state change returns unsubscribe
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });

    mockSignInWithOAuth.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('checks for existing session on mount', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      user_metadata: { full_name: 'Test User', avatar_url: 'https://example.com/avatar.png' },
    };

    mockGetSession.mockResolvedValue({
      data: { session: { user: mockUser } },
    });

    renderHook(() => useAuth());

    // Wait for async getSession
    await vi.waitFor(() => {
      expect(useAuthStore.getState().user).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
      });
    });
  });

  it('registers an auth state change listener', () => {
    renderHook(() => useAuth());
    expect(mockOnAuthStateChange).toHaveBeenCalledOnce();
  });

  it('unsubscribes from auth state changes on unmount', () => {
    const { unmount } = renderHook(() => useAuth());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });

  it('updates authStore when auth state changes to signed in', async () => {
    let authCallback: (event: string, session: unknown) => void = () => {};
    mockOnAuthStateChange.mockImplementation((cb: typeof authCallback) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });

    renderHook(() => useAuth());

    act(() => {
      authCallback('SIGNED_IN', {
        user: {
          id: 'user-2',
          email: 'new@example.com',
          user_metadata: { full_name: 'New User' },
        },
      });
    });

    expect(useAuthStore.getState().user).toEqual({
      id: 'user-2',
      email: 'new@example.com',
      name: 'New User',
      avatarUrl: null,
    });
  });

  it('clears authStore when auth state changes to signed out', async () => {
    useAuthStore.getState().setUser({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test',
      avatarUrl: null,
    });

    let authCallback: (event: string, session: unknown) => void = () => {};
    mockOnAuthStateChange.mockImplementation((cb: typeof authCallback) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });

    renderHook(() => useAuth());

    act(() => {
      authCallback('SIGNED_OUT', null);
    });

    expect(useAuthStore.getState().user).toBeNull();
  });

  it('signInWithGoogle calls signInWithOAuth with correct provider', async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: expect.stringContaining('/auth/callback') },
    });
  });

  it('signOut calls supabase signOut and resets authStore', async () => {
    useAuthStore.getState().setUser({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test',
      avatarUrl: null,
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
