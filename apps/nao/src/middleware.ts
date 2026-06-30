// ourobion nao — auth gate (Next middleware, runs at the edge on every request).
//
// v1 policy: any AUTHENTICATED Supabase user may view the app. Unauthenticated
// requests are redirected to /login. The login page itself and static assets are
// always allowed so the redirect target (and Next's own chunks) can load.
//
// Flow per request:
//   1. Skip the allowlist (/login, Next internals, static files, favicon).
//   2. Use @supabase/ssr bound to the request/response cookies to read — and, if
//      needed, REFRESH — the session. Refreshed cookies are written onto the
//      response so the browser stays signed in.
//   3. Independently VERIFY the access token's signature at the edge with `jose`
//      against the cached JWKS (no per-request round-trip). A cookie present but
//      not cryptographically valid does NOT count as authenticated.
//   4. No valid session → 302 to /login?redirectedFrom=<path>. Valid → continue.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { verifyAccessToken } from '@/lib/auth';

/** Paths that never require auth. */
function isPublicPath(pathname: string): boolean {
  if (pathname === '/login' || pathname.startsWith('/login/')) {
    return true;
  }
  // Next internals + common static assets (the matcher below also excludes
  // most of these, but keep the guard explicit/defensive).
  if (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return true;
  }
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Response we may attach refreshed session cookies to.
  let res = NextResponse.next({ request: { headers: req.headers } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If public config is missing the app cannot authenticate anyone — fail
  // closed by sending unauthenticated traffic to /login.
  if (!url || !anonKey) {
    return redirectToLogin(req);
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        // Mirror writes onto both the request (for any downstream reads) and the
        // response (so the refreshed session reaches the browser).
        for (const { name, value } of cookiesToSet) {
          req.cookies.set(name, value);
        }
        res = NextResponse.next({ request: { headers: req.headers } });
        for (const { name, value, options } of cookiesToSet) {
          res.cookies.set(name, value, options);
        }
      },
    },
  });

  // Refresh + read the session from cookies. getSession() triggers a token
  // refresh when needed (writing new cookies via setAll above).
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Edge-verify the access token's signature — a forged/expired cookie must not
  // pass even if @supabase/ssr surfaced a session object.
  const claims = await verifyAccessToken(session?.access_token);

  if (!claims) {
    return redirectToLogin(req);
  }

  // v1: any authenticated user passes. (Role checks deferred.)
  return res;
}

function redirectToLogin(req: NextRequest): NextResponse {
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('redirectedFrom', req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on everything EXCEPT Next internals and obvious static files. The
  // in-handler allowlist still guards /login and edge cases.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
