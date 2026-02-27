// =============================================================================
// Environment Variable Validation
// =============================================================================
// Provides runtime validation and type-safe access to environment variables.
// Missing variables emit console.error — the app continues to function,
// but Supabase-dependent features (auth, preferences sync) are disabled.
//
// NOTE: getClientEnv() uses static process.env.NEXT_PUBLIC_* references
// because Next.js inlines only static accesses at build time.
// Dynamic process.env[key] would resolve to undefined in client bundles.
// =============================================================================

interface ClientEnv {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
}

let validated = false;

/**
 * Validates that all required client environment variables are set.
 * Logs a structured error for missing variables.
 * Safe to call multiple times — only validates once.
 */
export function validateEnv(): string[] {
  const env = getClientEnv();
  const missing: string[] = [];

  if (!env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL.trim() === '') {
    missing.push('NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim() === '') {
    missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  if (missing.length > 0 && !validated) {
    console.error('[env] Missing environment variables', {
      component: 'env',
      action: 'validateEnv',
      timestamp: Date.now(),
      missing,
      message: 'Supabase features (auth, preferences sync) will be disabled.',
    });
  }

  validated = true;
  return missing;
}

/**
 * Returns a type-safe object of client environment variables.
 * Uses static process.env references for Next.js build-time inlining.
 * Values default to empty string when not set.
 */
export function getClientEnv(): ClientEnv {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  };
}

/**
 * Resets validation state. Only used for testing.
 */
export function resetEnvValidation(): void {
  validated = false;
}
