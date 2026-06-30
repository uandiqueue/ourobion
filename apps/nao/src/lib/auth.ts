// ourobion nao — edge access-token verification.
//
// Supabase signs its access tokens (JWTs) with ES256. We verify them WITHOUT a
// network round-trip per request: `jose`'s createRemoteJWKSet fetches the
// project's public JWKS once, caches it at module scope, and reuses it (with its
// own internal cache/refresh) for every verification.
//
// v1 authorization gate: any AUTHENTICATED user may view. We still read a role
// claim (`user_role`, default 'viewer') so later phases can enforce roles
// without re-plumbing the token path.
//
// Server-only module: relies on env.SUPABASE_URL (a Worker/.dev.vars secret,
// mirrored from NEXT_PUBLIC_SUPABASE_URL by scripts/gen-env.mjs). Do not import
// from Client Components.
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload, JWTVerifyResult } from 'jose';

/** Roles understood in v1. Only 'viewer' is enforced (everyone authenticated). */
export type Role = 'viewer' | 'admin' | string;

/** Supabase access-token claims we care about. */
export interface AccessClaims extends JWTPayload {
  /** Subject = Supabase user id (uuid). */
  sub?: string;
  email?: string;
  /** Custom role claim; absent on default Supabase tokens. */
  user_role?: string;
  /** Supabase's built-in coarse role ('authenticated' | 'anon' | ...). */
  role?: string;
}

/** Minimal authenticated-user view derived from verified claims. */
export interface AuthUser {
  sub: string;
  email?: string;
  role: Role;
  claims: AccessClaims;
}

/**
 * Resolve the Supabase project URL for JWKS. Server-only: prefers the
 * Worker/.dev.vars secret SUPABASE_URL, falling back to the public mirror.
 */
function supabaseUrl(): string {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      'Missing SUPABASE_URL (server) / NEXT_PUBLIC_SUPABASE_URL. ' +
        'gen-env mirrors NEXT_PUBLIC_SUPABASE_URL into .dev.vars as SUPABASE_URL.',
    );
  }
  return url.replace(/\/+$/, '');
}

// JWKS set cached at module scope — built lazily on first verify, then reused.
// jose's remote set has its own cooldown/refresh, so this is one fetch amortised
// across all requests in the isolate.
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`${supabaseUrl()}/auth/v1/.well-known/jwks.json`),
    );
  }
  return jwks;
}

/**
 * Read the effective role from verified claims.
 * Returns the `user_role` claim when present, otherwise 'viewer'.
 */
export function role(claims: AccessClaims | null | undefined): Role {
  const r = claims?.user_role;
  if (typeof r === 'string' && r.length > 0) {
    return r;
  }
  return 'viewer';
}

/**
 * Verify a Supabase access token (ES256) against the cached JWKS.
 * Resolves to the verified claims, or `null` if the token is missing/invalid/
 * expired. Never throws for an untrusted token — verification failure is a
 * normal "not authenticated" outcome.
 */
export async function verifyAccessToken(
  token: string | null | undefined,
): Promise<AccessClaims | null> {
  if (!token) {
    return null;
  }
  try {
    const { payload }: JWTVerifyResult = await jwtVerify(token, getJwks(), {
      algorithms: ['ES256'],
      // Pin the issuer to THIS Supabase project and require the 'authenticated'
      // audience. Without these, any token signed by the project's keys — e.g.
      // an anonymous-sign-in token whose aud/role is 'anon' — would pass the
      // signature check and be accepted by the gate, granting corpus access to
      // a non-logged-in identity. v1 policy: only AUTHENTICATED users may view.
      issuer: `${supabaseUrl()}/auth/v1`,
      audience: 'authenticated',
    });
    const claims = payload as AccessClaims;
    // Defense in depth: reject anything not minted for the authenticated role,
    // even if a future Supabase change relaxes the `aud` claim.
    if (claims.role !== 'authenticated') {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

/** Pull a Supabase access token out of an Authorization: Bearer header. */
function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Resolve the authenticated user for a request by verifying its Bearer access
 * token. Returns `null` when there is no valid token. Cookie-session reads are
 * handled separately by the middleware via @supabase/ssr; this helper is the
 * edge-verification path for API/route handlers that carry a Bearer token.
 */
export async function getUser(req: Request): Promise<AuthUser | null> {
  const claims = await verifyAccessToken(bearerToken(req));
  if (!claims || !claims.sub) {
    return null;
  }
  return {
    sub: claims.sub,
    email: claims.email,
    role: role(claims),
    claims,
  };
}
