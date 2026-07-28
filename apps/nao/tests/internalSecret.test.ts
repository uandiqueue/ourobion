// ourobion nao — CI coverage bridge for the shared internal-secret verifier (R4-U2 gap fix).
//
// WHY THIS FILE EXISTS: supabase/functions/_shared/internal_auth.test.ts has 41 passing
// `node --test` cases proving the internal-secret protocol (supabase/functions/_shared/
// internal_auth.ts), but nothing in CI runs them — `.github/workflows/ci.yml`'s `deno-check`
// job only `deno check`s the four function ENTRYPOINTS (compute-baselines, evaluate-signals,
// generate-insights, run-pipeline), so a `_shared/*.test.ts` file is neither typechecked nor
// executed by any job. This file imports the real verifier by relative path (note the
// filename uses an UNDERSCORE — `internal_auth.ts`, not `internal-auth.ts`) so the existing
// `nao — typecheck & test` CI job (`npm run typecheck` + `npm test`, both over apps/nao)
// exercises this exact module's core contract too. It duplicates none of the 41 tests'
// exhaustive edge cases (see that file for those) — it proves the load-bearing behaviours a
// caller of this module depends on.
//
// R4-U2 REVIEW FINDING 5 (36 of 41 assertions unreachable by CI): this bridge originally
// carried 5 of the 41 cases — accept/reject/missing-header/rotation/fail-closed — and NONE of
// the security-critical ones, so a regression in the constant-time compare, in the
// oracle-equivalence of the failure modes, in the malformed/blank handling, or in the
// "returns 401, never 500, when nothing is configured" path would have been invisible to every
// CI job. Those properties are covered below, including the four edge functions' REAL
// authorization preludes, extracted verbatim from their index.ts and executed here (the same
// technique the shared suite uses — the handlers themselves cannot be imported, they are
// `Deno.serve` shells importing `jsr:` specifiers). CI could not be changed (out of scope for
// this unit), so the coverage had to move to a suite CI already runs.
//
// `verifyInternalSecret` returns `Promise<boolean>` — it is async because `crypto.subtle.digest`
// (SHA-256 pre-hashing, see internal_auth.ts's header comment) is itself async in every runtime
// that provides it — so every call below is `await`ed.
//
// NO REAL CREDENTIAL APPEARS HERE. Every secret is generated at runtime by `randomSecret()` from
// `crypto.getRandomValues`, matching the production shape (32 random bytes, base64url,
// `^[A-Za-z0-9_-]{43}$`) with zero committed literals a secret scanner could flag.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  INTERNAL_SECRET_HEADER,
  INTERNAL_SECRET_HEADER_WIRE,
  INTERNAL_SECRET_SHAPE,
  UNAUTHORIZED_BODY,
  equalDigests,
  isWellFormedInternalSecret,
  unauthorizedResponse,
  verifyInternalSecret,
  verifyPresentedSecret,
} from '../../../supabase/functions/_shared/internal_auth.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** supabase/functions — three levels up from apps/nao/tests. */
const FUNCTIONS_DIR = path.resolve(__dirname, '..', '..', '..', 'supabase', 'functions');
const SHARED_MODULE = path.join(FUNCTIONS_DIR, '_shared', 'internal_auth.ts');

/** The four internal-secret-gated functions. */
const FUNCTIONS = ['compute-baselines', 'evaluate-signals', 'generate-insights', 'run-pipeline'] as const;

/** The bodySha256 all four routes carry in supabase/deploy-attestation.json = sha256("Unauthorized"). */
const ATTESTED_BODY_SHA256 = 'd089c8a9fc28e4e50223eb38c9409e362521be9380a37341304fbac7a4cd9e5f';

/** A synthetic secret of the production shape, fresh on every call. Never a real credential. */
function randomSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

function requestWith(headerValue?: string | null): Request {
  const headers = new Headers();
  if (typeof headerValue === 'string') headers.set(INTERNAL_SECRET_HEADER_WIRE, headerValue);
  return new Request('https://example.invalid/functions/v1/run-pipeline', {
    method: 'POST',
    headers,
  });
}

test('verifyInternalSecret: a correct CURRENT secret is accepted', async () => {
  const current = randomSecret();
  assert.equal(await verifyInternalSecret(requestWith(current), { current }), true);
});

test('verifyInternalSecret: a correct PREVIOUS secret is accepted during a rotation window', async () => {
  const current = randomSecret();
  const previous = randomSecret();
  assert.equal(await verifyInternalSecret(requestWith(previous), { current, previous }), true);
  // CURRENT must keep working in the same window — that is what makes rotation zero-downtime.
  assert.equal(await verifyInternalSecret(requestWith(current), { current, previous }), true);
});

test('verifyInternalSecret: a wrong secret is rejected', async () => {
  const current = randomSecret();
  const wrong = randomSecret();
  assert.equal(await verifyInternalSecret(requestWith(wrong), { current }), false);
});

test('verifyInternalSecret: a missing header is rejected', async () => {
  const current = randomSecret();
  assert.equal(await verifyInternalSecret(requestWith(undefined), { current }), false);
});

test('verifyInternalSecret: both CURRENT and PREVIOUS absent is rejected (fail closed, never fail open)', async () => {
  const presented = randomSecret();
  assert.equal(await verifyInternalSecret(requestWith(presented), {}), false);
  assert.equal(
    await verifyInternalSecret(requestWith(presented), { current: null, previous: null }),
    false,
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// The security-critical properties, now executed by a CI job (see header).
// ═══════════════════════════════════════════════════════════════════════════

// ── 1 · The compare is fixed-trip and cannot short-circuit ─────────────────
test('equalDigests: fixed trip count — a last-byte difference and a first-byte difference both fail', () => {
  const a = new Uint8Array(32).fill(7);
  const same = new Uint8Array(32).fill(7);
  const lastByteOff = new Uint8Array(32).fill(7);
  lastByteOff[31] = 6; // a short-circuiting compare would answer FAST here
  const firstByteOff = new Uint8Array(32).fill(7);
  firstByteOff[0] = 6; // ...and SLOW here. Both must be plain `false`.

  assert.equal(equalDigests(a, same), true);
  assert.equal(equalDigests(a, lastByteOff), false);
  assert.equal(equalDigests(a, firstByteOff), false);
});

test('equalDigests: a length difference is FOLDED IN, not short-circuited on (no length oracle)', () => {
  const a = new Uint8Array(32).fill(7);
  assert.equal(equalDigests(a, new Uint8Array(31).fill(7)), false, 'shorter must not compare equal');
  assert.equal(equalDigests(a, new Uint8Array(33).fill(7)), false, 'longer must not compare equal');
  assert.equal(equalDigests(new Uint8Array(0), new Uint8Array(0)), false, 'empty is never equal');
  // Non-digest widths can never be accepted, however identical they look.
  assert.equal(equalDigests(new Uint8Array(16).fill(0), new Uint8Array(16).fill(0)), false);
});

test('the verifier never compares secret values with an equality operator', () => {
  const module = readFileSync(SHARED_MODULE, 'utf8').replace(/\r\n/g, '\n');
  const code = module
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*'))
    .join('\n');
  const secretNames = ['presented', 'raw', 'current', 'previous', 'env.current', 'env.previous'];
  for (const left of secretNames) {
    for (const right of secretNames) {
      if (left === right) continue;
      for (const op of ['===', '!==', '==', '!=']) {
        assert.ok(
          !code.includes(`${left} ${op} ${right}`),
          `the verifier must not contain "${left} ${op} ${right}"`,
        );
      }
    }
  }
  assert.ok(code.includes('diff |='), 'the compare must XOR-accumulate into `diff`');
  assert.ok(code.includes('crypto.subtle.digest("SHA-256"'), 'the compare must be over SHA-256 digests');
  assert.ok(!code.includes('.startsWith('), 'no prefix comparison of secrets');
  const loop = code.slice(code.indexOf('for (let i = 0; i < DIGEST_BYTES'));
  const loopBody = loop.slice(0, loop.indexOf('}'));
  assert.ok(!loopBody.includes('return'), 'the accumulate loop must not return early');
  assert.ok(!loopBody.includes('break'), 'the accumulate loop must not break');
});

test('a near-miss sharing a 42-character prefix is rejected (no prefix compare)', async () => {
  const current = randomSecret();
  const last = current.at(-1) as string;
  const nearMiss = current.slice(0, 42) + (last === 'A' ? 'B' : 'A');
  assert.notEqual(nearMiss, current);
  assert.ok(INTERNAL_SECRET_SHAPE.test(nearMiss), 'the near-miss is still shape-valid');
  assert.equal(await verifyInternalSecret(requestWith(nearMiss), { current }), false);
});

// ── 2 · Malformed / blank / whitespace forms ───────────────────────────────
test('blank and whitespace-only headers are rejected as `missing`', async () => {
  const current = randomSecret();
  for (const blank of ['', ' ', '   ', '\t', '\t \t', '\n']) {
    assert.deepEqual(
      await verifyPresentedSecret(blank, { current }),
      { ok: false, reason: 'missing' },
      `blank ${JSON.stringify(blank)} must be denied`,
    );
  }
});

test('malformed headers are rejected as `malformed`, never accepted', async () => {
  const current = randomSecret();
  const malformed = [
    `Bearer ${current}`, // a bearer prefix must never be accepted
    current.slice(0, 42), // one char short
    `${current}x`, // one char long — a length-only difference
    `${current.slice(0, 42)}+`, // base64, not base64url
    `${current.slice(0, 42)}/`,
    `${current.slice(0, 40)}==`, // padded
    'undefined', // the classic stringified-env accident
    'null',
  ];
  for (const value of malformed) {
    assert.deepEqual(
      await verifyPresentedSecret(value, { current }),
      { ok: false, reason: 'malformed' },
      `malformed ${JSON.stringify(value)} must be denied`,
    );
    assert.equal(await verifyInternalSecret(requestWith(value), { current }), false);
  }
});

test('isWellFormedInternalSecret accepts only 43-char base64url', () => {
  assert.equal(isWellFormedInternalSecret(randomSecret()), true);
  for (const bad of [undefined, null, '', '   ', 'x'.repeat(42), 'x'.repeat(44), 'a+b/c=']) {
    assert.equal(isWellFormedInternalSecret(bad), false, `${JSON.stringify(bad)} must not be well-formed`);
  }
});

// ── 3 · Not configured is 401, and a malformed CONFIG is "not configured" ──
test('a malformed or blank CONFIGURED secret counts as NOT CONFIGURED (never matched by accident)', async () => {
  const presented = randomSecret();
  for (const env of [
    {},
    { current: undefined, previous: undefined },
    { current: '', previous: '' },
    { current: '   ', previous: '\t' },
    { current: 'too-short', previous: 'also-bad' },
  ]) {
    assert.deepEqual(
      await verifyPresentedSecret(presented, env),
      { ok: false, reason: 'not_configured' },
      `env ${JSON.stringify(env)} must deny`,
    );
  }
});

test('the fixed-shape ABSENT placeholder (43 hyphens) is not itself an acceptable secret', async () => {
  const placeholder = '-'.repeat(43);
  assert.ok(INTERNAL_SECRET_SHAPE.test(placeholder), 'shape-valid by design');
  assert.deepEqual(await verifyPresentedSecret(placeholder, {}), { ok: false, reason: 'not_configured' });
  assert.deepEqual(await verifyPresentedSecret(placeholder, { current: randomSecret() }), {
    ok: false,
    reason: 'mismatch',
  });
});

// ── 4 · The 401 is byte-identical and carries no hint ──────────────────────
test('the single 401 response is byte-identical to the attested bodySha256 and echoes nothing', async () => {
  assert.equal(UNAUTHORIZED_BODY, 'Unauthorized');
  const res = unauthorizedResponse();
  assert.equal(res.status, 401);
  const body = await res.text();
  assert.equal(
    createHash('sha256').update(body, 'utf8').digest('hex'),
    ATTESTED_BODY_SHA256,
    'changing these 12 bytes invalidates supabase/deploy-attestation.json',
  );
  assert.equal(res.headers.get(INTERNAL_SECRET_HEADER), null, 'the 401 must not echo the header');
});

test('no denial result ever echoes the presented value or a configured secret', async () => {
  const current = randomSecret();
  const cases: Array<[string | null | undefined, { current?: string | null; previous?: string | null }]> = [
    [undefined, { current }],
    ['  ', { current }],
    [`Bearer ${current}`, { current }],
    [randomSecret(), { current }],
    [randomSecret(), {}],
  ];
  for (const [presented, env] of cases) {
    const result = await verifyPresentedSecret(presented, env);
    assert.equal(result.ok, false);
    const serialised = JSON.stringify(result);
    assert.ok(!serialised.includes(current), 'must never echo a configured secret');
    if (typeof presented === 'string' && presented.length > 8) {
      assert.ok(!serialised.includes(presented), 'must never echo the presented value');
    }
  }
});

// ── 5 · The four edge functions' REAL preludes, executed ───────────────────
//
// Extracted verbatim from each index.ts rather than mocked, so this is the
// production source text running. `Deno.env` is stubbed; no server, no Deno.
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<unknown>;

const PRELUDE_START = 'const verdict = await verifyInternalSecretRequest(req, {';
const PRELUDE_END = 'return unauthorizedResponse()\n  }';
/** Sentinel returned iff the prelude falls through, i.e. the request was AUTHORIZED. */
const PAST_AUTH = '__past_auth__';

/** LF-normalised read: git checks these files out CRLF on Windows, and compute-baselines is
 *  exempt from normalisation (it is treated as binary for its deliberate NUL byte). */
function readFunctionSource(fn: string): string {
  return readFileSync(path.join(FUNCTIONS_DIR, fn, 'index.ts'), 'utf8').replace(/\r\n/g, '\n');
}

async function runPrelude(fn: string, env: Record<string, string>): Promise<Response> {
  const text = readFunctionSource(fn);
  const start = text.indexOf(PRELUDE_START);
  assert.notEqual(start, -1, `${fn}: authorization prelude not found`);
  const end = text.indexOf(PRELUDE_END, start);
  assert.notEqual(end, -1, `${fn}: prelude denial branch not found`);
  const prelude = text.slice(start, end + PRELUDE_END.length);

  const compiled = new AsyncFunction(
    'req',
    'Deno',
    'verifyInternalSecretRequest',
    'unauthorizedResponse',
    'console',
    `${prelude}\n  return new Response(${JSON.stringify(PAST_AUTH)}, { status: 500 })`,
  );
  const { verifyInternalSecretRequest, unauthorizedResponse: unauth } = await import(
    '../../../supabase/functions/_shared/internal_auth.ts'
  );
  return (await compiled(
    requestWith(env.__presented__),
    { env: { get: (k: string) => env[k] } },
    verifyInternalSecretRequest,
    unauth,
    { error: () => {} },
  )) as Response;
}

for (const fn of FUNCTIONS) {
  test(`${fn}: returns 401 (not 500) when NO internal secret env is configured`, async () => {
    const res = await runPrelude(fn, {});
    assert.equal(res.status, 401, `${fn} must answer 401, never 500, on missing config`);
    const body = await res.text();
    assert.equal(body, 'Unauthorized');
    assert.equal(createHash('sha256').update(body, 'utf8').digest('hex'), ATTESTED_BODY_SHA256);
  });

  test(`${fn}: every denial mode is the SAME 401 with the SAME bytes (no oracle)`, async () => {
    const current = randomSecret();
    const observed = new Set<string>();
    const modes: Array<Record<string, string>> = [
      {}, // not configured, no header
      { __presented__: current }, // not configured, correct-shaped header
      { OUROBION_INTERNAL_SECRET_CURRENT: current }, // configured, header missing
      { OUROBION_INTERNAL_SECRET_CURRENT: current, __presented__: '   ' }, // blank
      { OUROBION_INTERNAL_SECRET_CURRENT: current, __presented__: `Bearer ${current}` }, // malformed
      { OUROBION_INTERNAL_SECRET_CURRENT: current, __presented__: randomSecret() }, // wrong
    ];
    for (const env of modes) {
      const res = await runPrelude(fn, env);
      observed.add(`${res.status}:${await res.text()}`);
    }
    assert.deepEqual([...observed], ['401:Unauthorized'], `${fn} leaked a distinguishable denial`);
  });

  test(`${fn}: the prelude opens for a correct CURRENT and for a correct PREVIOUS`, async () => {
    const current = randomSecret();
    const previous = randomSecret();
    for (const [label, env] of [
      ['CURRENT', { OUROBION_INTERNAL_SECRET_CURRENT: current, OUROBION_INTERNAL_SECRET_PREVIOUS: previous, __presented__: current }],
      ['PREVIOUS', { OUROBION_INTERNAL_SECRET_CURRENT: current, OUROBION_INTERNAL_SECRET_PREVIOUS: previous, __presented__: previous }],
      ['CURRENT with no PREVIOUS set', { OUROBION_INTERNAL_SECRET_CURRENT: current, __presented__: current }],
    ] as Array<[string, Record<string, string>]>) {
      const res = await runPrelude(fn, env);
      assert.equal(await res.text(), PAST_AUTH, `${fn} rejected a valid ${label}`);
    }
  });

  test(`${fn}: authorization is checked BEFORE any 500 configuration guard`, () => {
    const text = readFunctionSource(fn);
    const handler = text.slice(text.indexOf('Deno.serve(async (req) => {'));
    const authAt = handler.indexOf(PRELUDE_START);
    const denyAt = handler.indexOf('return unauthorizedResponse()');
    const first500 = handler.indexOf('status: 500');
    assert.ok(authAt > -1 && denyAt > authAt, `${fn}: prelude malformed`);
    assert.ok(
      first500 === -1 || first500 > denyAt,
      `${fn}: a 500 guard precedes the authorization check — both an oracle and an attestation-breaking 500 on the release gate's serve probe`,
    );
  });

  test(`${fn}: the denial REASON is logged only, and never reaches a response`, () => {
    // R4-U2 review finding 7: the four functions log `internal auth denied: <reason>`.
    // That is defence-in-depth only — the wire response is byte-identical — but the
    // reason must stay out of every Response body.
    const text = readFunctionSource(fn);
    const handler = text.slice(text.indexOf('Deno.serve(async (req) => {'));
    for (const m of handler.matchAll(/verdict\.reason/g)) {
      const line = handler.slice(handler.lastIndexOf('\n', m.index ?? 0) + 1, handler.indexOf('\n', m.index ?? 0));
      assert.match(line, /console\.(error|warn|log|info)/, `${fn}: verdict.reason used outside a log: ${line.trim()}`);
    }
    assert.doesNotMatch(handler, /new Response\([^)]*verdict\.reason/, `${fn}: a denial reason reached a response body`);
  });
}
