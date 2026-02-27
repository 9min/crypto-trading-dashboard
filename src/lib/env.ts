// =============================================================================
// Environment Variable Validation
// =============================================================================
// Provides runtime validation and type-safe access to environment variables.
// Missing variables emit console.warn — the app continues to function,
// but Supabase-dependent features (auth, preferences sync) are disabled.
// =============================================================================

const CLIENT_ENV_KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const;

interface ClientEnv {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
}

let validated = false;

/**
 * Validates that all required client environment variables are set.
 * Logs a warning for each missing variable.
 * Safe to call multiple times — only validates once.
 */
export function validateEnv(): string[] {
  const missing: string[] = [];

  for (const key of CLIENT_ENV_KEYS) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      missing.push(key);
    }
  }

  if (missing.length > 0 && !validated) {
    console.warn(
      `[env] Missing environment variables: ${missing.join(', ')}. ` +
        'Supabase features (auth, preferences sync) will be disabled.',
    );
  }

  validated = true;
  return missing;
}

/**
 * Returns a type-safe object of client environment variables.
 * Triggers validation on first call.
 * Values default to empty string when not set.
 */
export function getClientEnv(): ClientEnv {
  if (!validated) {
    validateEnv();
  }

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
