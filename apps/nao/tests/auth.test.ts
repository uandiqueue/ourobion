// ourobion nao — auth unit tests (node:test, fixtures only — no live Supabase).
//
// Covered:
//   1. verifyAccessToken(token): the `jose` module is stubbed via mock.module so
//      no JWKS is fetched and no real signature is checked. We assert the
//      happy-path (stubbed jwtVerify resolves → claims returned), the
//      invalid-token path (stubbed jwtVerify throws → null), and that a
//      missing/empty token short-circuits to null WITHOUT invoking jose.
//
// Run with: npm test (node --experimental-test-module-mocks --test — mock.module
// is still flag-gated on Node 26).
//
// NOTE (run-2 U6): stub payloads carry role:'authenticated' — auth.ts pins the
// audience AND rejects any token whose role claim is not 'authenticated', so a
// stub without it exercises the rejection path, not the happy path.
//
// R4-U2 REMOVED the former role()/user_role/Role cases from this file — that
// scaffold was deleted from src/lib/auth.ts (it read a claim nothing ever
// set; see that file's header). Nao capability tier is now resolved
// exclusively by src/lib/authzServer.ts's resolveNaoRole()/requireRole(),
// which is covered by apps/nao/tests/authz.test.ts.
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
const { verifyAccessToken, getUser } = await import('../src/lib/auth.ts');

function resetJose() {
  joseState.verifyResult = { payload: {} };
  joseState.verifyError = null;
  joseState.jwtVerifyCalls = 0;
  joseState.createRemoteJWKSetCalls = 0;
}

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
    payload: { sub: 'user-123', email: 'a@b.co', role: 'authenticated' },
  };
  const claims = await verifyAccessToken('header.payload.sig');
  assert.ok(claims);
  assert.equal(claims?.sub, 'user-123');
  assert.equal(claims?.email, 'a@b.co');
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
test('getUser(): verifies Bearer token and maps to AuthUser (no role field — see this file\'s header)', async () => {
  resetJose();
  joseState.verifyResult = {
    payload: { sub: 'user-xyz', email: 'x@y.z', role: 'authenticated' },
  };
  const req = new Request('https://nao.test/api', {
    headers: { authorization: 'Bearer some.jwt.token' },
  });
  const user = await getUser(req);
  assert.ok(user);
  assert.equal(user?.sub, 'user-xyz');
  assert.equal(user?.email, 'x@y.z');
  assert.equal((user as unknown as Record<string, unknown>).role, undefined);
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
  joseState.verifyResult = { payload: { email: 'no-sub@x.co', role: 'authenticated' } };
  const req = new Request('https://nao.test/api', {
    headers: { authorization: 'Bearer t.o.k' },
  });
  assert.equal(await getUser(req), null);
});
