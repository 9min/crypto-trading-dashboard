'use client';

import { useAuth } from '@/hooks/useAuth';
import { usePreferencesSync } from '@/hooks/usePreferencesSync';

/**
 * Side-effect component that initializes auth session listener and
 * preferences sync. Lazy-loaded via next/dynamic to keep Supabase
 * out of the initial JS bundle for non-authenticated users.
 */
export function AuthProvider(): null {
  useAuth();
  usePreferencesSync();
  return null;
}
