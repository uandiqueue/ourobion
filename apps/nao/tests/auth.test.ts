// ourobion nao — auth unit tests (node:test, fixtures only — no live Supabase).
//
// Covered:
//   1. role(claims): `user_role` present → that role; absent/empty/non-string →
//      'viewer' (the v1 default).
//   2. verifyAccessToken(token): the `jose` module is stubbed via mock.module so
//      no JWKS is fetched and no real signature is checked. We assert the
//      happy-path (stubbed jwtVerify resolves → claims returned), the
//      invalid-token path (stubbed jwtVerify throws → null), and that a
//      missing/empty token short-circuits to null WITHOUT invoking jose.
//
// Run with: node --test (Node >= 22 for test.mock.module).
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

// ── jose stub ───────────────────────────────────────────────────────────────
// State the stub reads, so individual tests can steer jwtVerify's behaviour.
const joseState: {
  verifyResult: { payload: Record<string, unknown> } | null;
  verifyError: Error | null;
  jwtVerifyCalls: number;
  createRemoteJWKSetCalls: number;
} = {
  verifyResult: { payload: {} },
  verifyError: null,
  jwtVerifyCalls: 0,
  createRemoteJWKSetCalls: 0,
};

mock.module('jose', {
  namedExports: {
    createRemoteJWKSet(_url: URL) {
      joseState.createRemoteJWKSetCalls += 1;
      // Return an opaque key-getter; the stubbed jwtVerify ignores it.
      return async () => ({});
    },
    async jwtVerify(_token: string, _key: unknown, _opts: unknown) {
      joseState.jwtVerifyCalls += 1;
      if (joseState.verifyError) {
        throw joseState.verifyError;
      }
      return joseState.verifyResult;
    },
  },
});

// Provide a Supabase URL so getJwks() doesn't throw when first invoked.
process.env.SUPABASE_URL = 'https://example.supabase.co';

// Import AFTER registering the mock so auth.ts binds the stubbed jose.
const { role, verifyAccessToken, getUser } = await import('../src/lib/auth.ts');

function resetJose() {
  joseState.verifyResult = { payload: {} };
  joseState.verifyError = null;
  joseState.jwtVerifyCalls = 0;
  joseState.createRemoteJWKSetCalls = 0;
}

// ── role() ───────────────────────────────────────────────────────────────────
test('role(): returns user_role claim when present', () => {
  assert.equal(role({ user_role: 'admin' }), 'admin');
  assert.equal(role({ user_role: 'editor' }), 'editor');
});

test('role(): defaults to viewer when claim absent', () => {
  assert.equal(role({}), 'viewer');
  assert.equal(role(undefined), 'viewer');
  assert.equal(role(null), 'viewer');
});

test('role(): defaults to viewer for empty / non-string user_role', () => {
  assert.equal(role({ user_role: '' }), 'viewer');
  // Non-string values are ignored (treated as absent).
  assert.equal(role({ user_role: 123 as unknown as string }), 'viewer');
});

// ── verifyAccessToken() ───────────────────────────────────────────────────────
test('verifyAccessToken(): missing token short-circuits to null without calling jose', async () => {
  resetJose();
  assert.equal(await verifyAccessToken(undefined), null);
  assert.equal(await verifyAccessToken(null), null);
  assert.equal(await verifyAccessToken(''), null);
  assert.equal(joseState.jwtVerifyCalls, 0);
});

test('verifyAccessToken(): valid token resolves to claims (stubbed jwtVerify)', async () => {
  resetJose();
  joseState.verifyResult = {
    payload: { sub: 'user-123', email: 'a@b.co', user_role: 'admin' },
  };
  const claims = await verifyAccessToken('header.payload.sig');
  assert.ok(claims);
  assert.equal(claims?.sub, 'user-123');
  assert.equal(claims?.email, 'a@b.co');
  assert.equal(role(claims), 'admin');
  assert.equal(joseState.jwtVerifyCalls, 1);
});

test('verifyAccessToken(): invalid token returns null (stubbed jwtVerify throws)', async () => {
  resetJose();
  joseState.verifyError = new Error('signature verification failed');
  const claims = await verifyAccessToken('bad.token.here');
  assert.equal(claims, null);
  assert.equal(joseState.jwtVerifyCalls, 1);
});

test('verifyAccessToken(): JWKS set is built once and reused across calls', async () => {
  resetJose();
  joseState.verifyResult = { payload: { sub: 'u1' } };
  await verifyAccessToken('a.b.c');
  await verifyAccessToken('d.e.f');
  // createRemoteJWKSet is memoised at module scope — at most one construction
  // across the whole suite. (May be 0 here if an earlier test already built it.)
  assert.ok(joseState.createRemoteJWKSetCalls <= 1);
});

// ── getUser() ─────────────────────────────────────────────────────────────────
test('getUser(): verifies Bearer token and maps to AuthUser', async () => {
  resetJose();
  joseState.verifyResult = {
    payload: { sub: 'user-xyz', email: 'x@y.z', user_role: 'viewer' },
  };
  const req = new Request('https://nao.test/api', {
    headers: { authorization: 'Bearer some.jwt.token' },
  });
  const user = await getUser(req);
  assert.ok(user);
  assert.equal(user?.sub, 'user-xyz');
  assert.equal(user?.role, 'viewer');
  assert.equal(joseState.jwtVerifyCalls, 1);
});

test('getUser(): no Authorization header → null, jose untouched', async () => {
  resetJose();
  const req = new Request('https://nao.test/api');
  assert.equal(await getUser(req), null);
  assert.equal(joseState.jwtVerifyCalls, 0);
});

test('getUser(): verified claims without sub → null', async () => {
  resetJose();
  joseState.verifyResult = { payload: { email: 'no-sub@x.co' } };
  const req = new Request('https://nao.test/api', {
    headers: { authorization: 'Bearer t.o.k' },
  });
  assert.equal(await getUser(req), null);
});
