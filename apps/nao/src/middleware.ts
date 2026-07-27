// ourobion nao — auth gate (Next middleware, runs at the edge on every request).
//
// AUTHENTICATION gate: any cryptographically valid, `aud=authenticated`
// Supabase session may pass this layer. Unauthenticated requests are
// redirected to /login. The login page itself and static assets are always
// allowed so the redirect target (and Next's own chunks) can load.
//
// AUTHORIZATION (nao capability tier) is deliberately NOT decided here for
// /api/ paths — this middleware is a convenience/defense-in-depth layer, NOT
// the (only, or even the primary) enforcement point. R4-U2 fixed a real
// defect where role checks were "deferred" at this layer with nothing else
// enforcing them: every /api/ route now calls requireRole()/guardRole()
// (apps/nao/src/lib/authzServer.ts) as its own first statement and is proven
// by the source-conformance test in apps/nao/tests/authz.test.ts, so a
// route-layer bug here can no longer leave a handler unguarded. For non-/api/
// (page) requests, step 5 below adds a real nao_role() membership check so a
// Biotope-only account (no nao_members row) never loads the console shell —
// this is a UX/defense-in-depth check, not itself one of the two independent
// enforcement layers (route guard + database RLS/RPC) that actually decide
// access.
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
//   5. For non-/api/ paths only: read nao_role() (an RPC on the SAME
//      cookie-bound client used above — never a JWT claim, per the R4-U2 rule
//      that role is always a fresh database read). No effective membership →
//      302 to /login?denied=nao. /api/ paths skip this round-trip: the route
//      guard already makes the identical database decision, so doing it again
//      here would just be a duplicate query with no additional safety.
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

  // Authorization convenience layer (see header comment): /api/ routes are
  // authoritatively gated by requireRole()/guardRole() in the route handler
  // itself, which makes the identical nao_role() database call — so skip a
  // redundant round-trip here. For everything else (the console shell pages),
  // deny a Biotope-only account (no effective nao_members row) up front.
  if (!pathname.startsWith('/api/')) {
    const { data: naoRole, error } = await supabase.rpc('nao_role');
    if (error || naoRole === null || naoRole === undefined) {
      return redirectToLogin(req, 'nao');
    }
  }

  return res;
}

function redirectToLogin(req: NextRequest, denied?: 'nao'): NextResponse {
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  if (denied) {
    loginUrl.searchParams.set('denied', denied);
  } else {
    loginUrl.searchParams.set('redirectedFrom', req.nextUrl.pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on everything EXCEPT Next internals and obvious static files. The
  // in-handler allowlist still guards /login and edge cases.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
