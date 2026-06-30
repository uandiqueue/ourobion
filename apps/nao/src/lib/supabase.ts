// ourobion nao — browser-side Supabase client factory (@supabase/ssr).
//
// CLIENT-SAFE module: this file is imported by Client Components (the /login
// page) and therefore MUST NOT pull in any server-only API. The server factory
// — which imports `next/headers` — lives in ./supabase-server.ts so it never
// reaches the client bundle. (Co-locating both in one module caused webpack to
// drag `next/headers` into the 'use client' login page and fail `next build`.)
//
// Reads the public URL + anon key from NEXT_PUBLIC_* (the only secrets that
// reach the browser) and manages the session in cookies via @supabase/ssr.
//
// Edge token VERIFICATION does NOT go through this client — that is done offline
// with `jose` against the JWKS (see ./auth.ts). This client is for the
// interactive login flow and browser-side session plumbing only.
import { createBrowserClient as createSsrBrowserClient } from '@supabase/ssr';

/** Public config — these are the ONLY values that reach the browser. */
export function publicSupabaseConfig(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Set them in apps/nao/.env.public and run `npm run gen-env`.',
    );
  }
  return { url, anonKey };
}

/**
 * Browser-side Supabase client for Client Components (e.g. the login page).
 * Persists the session in cookies so the server can read it.
 */
export function createBrowserClient() {
  const { url, anonKey } = publicSupabaseConfig();
  return createSsrBrowserClient(url, anonKey);
}
