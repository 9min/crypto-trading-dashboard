// =============================================================================
// Auth Store
// =============================================================================
// Manages user authentication state. Actual authentication flow is handled
// by Supabase; this store holds the derived user profile for UI consumption.
// =============================================================================

import { create } from 'zustand';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** User profile derived from Supabase auth session */
interface UserProfile {
  /** Supabase user ID (UUID) */
  id: string;
  /** User email address (null for phone-only auth) */
  email: string | null;
  /** Display name from OAuth provider (null if not provided) */
  name: string | null;
  /** Profile avatar URL from OAuth provider (null if not provided) */
  avatarUrl: string | null;
}

interface AuthStoreState {
  /** Authenticated user profile, or null when signed out */
  user: UserProfile | null;
  /** Whether an auth check or sign-in operation is in progress */
  isLoading: boolean;
}

interface AuthStoreActions {
  /** Set the authenticated user profile (or null to sign out) */
  setUser: (user: UserProfile | null) => void;
  /** Set the loading state during auth operations */
  setLoading: (isLoading: boolean) => void;
  /** Reset store to initial state (sign out) */
  reset: () => void;
}

type AuthStore = AuthStoreState & AuthStoreActions;

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const INITIAL_STATE: AuthStoreState = {
  user: null,
  isLoading: false,
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useAuthStore = create<AuthStore>()((set) => ({
  // -- State ------------------------------------------------------------------
  ...INITIAL_STATE,

  // -- Actions ----------------------------------------------------------------
  setUser: (user: UserProfile | null): void => {
    set({ user });
  },

  setLoading: (isLoading: boolean): void => {
    set({ isLoading });
  },

  reset: (): void => {
    set({ ...INITIAL_STATE });
  },
}));

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export type { UserProfile, AuthStoreState, AuthStoreActions, AuthStore };
