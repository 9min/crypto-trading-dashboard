// =============================================================================
// useAuth Hook
// =============================================================================
// Manages Supabase authentication state: session detection, Google OAuth
// sign-in, and sign-out. All operations are no-ops when the
// Supabase client is null (env vars not configured).
// =============================================================================

'use client';

import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import type { UserProfile } from '@/stores/authStore';
import type { User } from '@supabase/supabase-js';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Maps a Supabase User to a UserProfile for the auth store. */
function toUserProfile(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email ?? null,
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    avatarUrl: user.user_metadata?.avatar_url ?? null,
  };
}

// -----------------------------------------------------------------------------
// Return Type
// -----------------------------------------------------------------------------

interface UseAuthReturn {
  /** Authenticated user profile, or null when signed out */
  user: UserProfile | null;
  /** Whether an auth operation is in progress */
  isLoading: boolean;
  /** Initiate Google OAuth sign-in */
  signInWithGoogle: () => Promise<void>;
  /** Sign out the current user */
  signOut: () => Promise<void>;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useAuth(): UseAuthReturn {
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const setUser = useAuthStore((state) => state.setUser);
  const setLoading = useAuthStore((state) => state.setLoading);
  const reset = useAuthStore((state) => state.reset);

  // ---------------------------------------------------------------------------
  // Session Detection + Auth State Change Listener
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;

    // Check existing session on mount
    setLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      if (session?.user) {
        setUser(toUserProfile(session.user));
      }
      setLoading(false);
    });

    // Listen for auth state changes (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(toUserProfile(session.user));
      } else {
        setUser(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [setUser, setLoading]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const signInWithGoogle = useCallback(async () => {
    if (!supabase || typeof window === 'undefined') return;
    const redirectTo = `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[useAuth] signOut failed', {
        timestamp: Date.now(),
        error: error.message,
      });
      return;
    }
    reset();
  }, [reset]);

  return { user, isLoading, signInWithGoogle, signOut };
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export type { UseAuthReturn };
