// ourobion nao — server-side Supabase client factory (@supabase/ssr).
//
// SERVER-ONLY module: it imports `next/headers`, which only works inside Server
// Components / Route Handlers. Do NOT import this from a Client Component — that
// is what split it out of ./supabase.ts (the browser-safe module the 'use client'
// login page imports). Keeping the two apart is what lets `next build` succeed.
//
// Bridges @supabase/ssr's cookie contract to Next's `cookies()` store so SSR can
// read or refresh the session from request cookies. Public config is shared from
// ./supabase.ts (it only reads NEXT_PUBLIC_* values, safe on both sides).
import { createServerClient as createSsrServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { publicSupabaseConfig } from './supabase';

/**
 * Server-side Supabase client bound to the incoming request's cookie store.
 * Use in Server Components / Route Handlers. Server Components cannot mutate
 * cookies, so cookie writes are wrapped in try/catch (a no-op there); in Route
 * Handlers / actions the writes take effect and refresh the session.
 */
export async function createServerSupabaseClient() {
  const { url, anonKey } = publicSupabaseConfig();
  const cookieStore = await cookies();

  return createSsrServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component where cookies are read-only.
          // Session refresh is handled in middleware / route handlers instead.
        }
      },
    },
  });
}
