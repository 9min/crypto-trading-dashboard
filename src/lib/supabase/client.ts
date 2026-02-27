// =============================================================================
// Supabase Client
// =============================================================================
// Initializes the Supabase client for authentication (Google/GitHub OAuth)
// and data persistence (layout configurations, watchlist).
//
// The client is null when environment variables are not configured,
// allowing the app to run without Supabase in development.
// =============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getClientEnv, validateEnv } from '@/lib/env';

validateEnv();

const { NEXT_PUBLIC_SUPABASE_URL: supabaseUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey } =
  getClientEnv();

/**
 * Supabase client instance.
 *
 * Returns `null` when the required environment variables
 * (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are not set.
 * All consumers must handle the null case gracefully.
 */
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : null;
