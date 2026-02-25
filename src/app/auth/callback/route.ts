// =============================================================================
// OAuth Callback Route Handler
// =============================================================================
// Handles the Supabase OAuth redirect after a user signs in with Google or
// GitHub. Exchanges the authorization code for a session, then redirects
// the user back to the dashboard.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/?auth_error=true`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(`${origin}/?auth_error=true`);
  }

  const response = NextResponse.redirect(origin);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth/callback] Failed to exchange code for session', {
      timestamp: Date.now(),
      error: error.message,
    });
    return NextResponse.redirect(`${origin}/?auth_error=true`);
  }

  return response;
}
