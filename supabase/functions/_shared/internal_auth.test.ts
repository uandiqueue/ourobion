// ─── R4-U2 · tests for the internal-secret protocol ───────────────────────────────────────
//
// RUNNER: `node --test supabase/functions/_shared/internal_auth.test.ts`
// (Node 26 strips the types natively; the module under test imports nothing and uses only Web
// Crypto, which Node has had globally since v20 — that portability is the whole point of the
// design, so the code CI could execute is byte-for-byte the code the edge runtime runs.)
//
// Deno is NOT required and no server is started. `node --test` + relative `.ts` imports is the
// repo's existing convention for TS suites (apps/nao/tests/*.test.ts, tools/*/tests/*.test.ts);
// no package.json or lockfile is added anywhere for this file.
//
// NO REAL CREDENTIAL APPEARS HERE. Every secret is generated at runtime by `randomSecret()`
// from `crypto.getRandomValues`, so there is not one committed 43-char base64url literal that a
// secret scanner could flag or a reader could mistake for a live value.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  equalDigests,
  INTERNAL_SECRET_HEADER,
  INTERNAL_SECRET_HEADER_WIRE,
  INTERNAL_SECRET_SHAPE,
  isWellFormedInternalSecret,
  UNAUTHORIZED_BODY,
  unauthorizedResponse,
  verifyInternalSecret,
  verifyPresentedSecret,
} from "./internal_auth.ts";

const here = dirname(fileURLToPath(import.meta.url));
const functionsDir = resolve(here, "..");
const FUNCTIONS = [
  "compute-baselines",
  "evaluate-signals",
  "generate-insights",
  "run-pipeline",
] as const;

/** The bodySha256 all four routes carry in supabase/deploy-attestation.json. */
const ATTESTED_BODY_SHA256 =
  "d089c8a9fc28e4e50223eb38c9409e362521be9380a37341304fbac7a4cd9e5f";

/** A synthetic secret of the production shape, fresh on every call. Never a real credential. */
function randomSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

function requestWith(headerValue?: string | null): Request {
  const headers = new Headers();
  if (typeof headerValue === "string") headers.set(INTERNAL_SECRET_HEADER_WIRE, headerValue);
  return new Request("https://example.invalid/functions/v1/compute-baselines", {
    method: "POST",
    headers,
  });
}

/**
 * Read a source file with line endings normalised to LF.
 *
 * Required on Windows: git checks these files out CRLF, and compute-baselines/index.ts is
 * exempt (git treats it as binary because of its deliberate NUL byte), so the four files do not
 * agree on line endings. Every source assertion below must be ending-agnostic.
 */
function readText(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

function source(fn: string): string {
  // compute-baselines/index.ts contains a deliberate literal NUL byte as the
  // `${user_id}\x00${metric_key}` map-key separator (grep reports the file as binary). It is
  // only ever READ here, never rewritten.
  return readText(resolve(functionsDir, fn, "index.ts"));
}

// ─── 1 · Accept paths ──────────────────────────────────────────────────────────────────────

test("valid CURRENT secret is accepted", async () => {
  const current = randomSecret();
  assert.deepEqual(await verifyPresentedSecret(current, { current }), {
    ok: true,
    matched: "current",
  });
  assert.equal(await verifyInternalSecret(requestWith(current), { current }), true);
});

test("valid PREVIOUS secret is accepted during a rotation window", async () => {
  const current = randomSecret();
  const previous = randomSecret();
  assert.deepEqual(await verifyPresentedSecret(previous, { current, previous }), {
    ok: true,
    matched: "previous",
  });
  // and CURRENT still works in the same window — that is what makes rotation zero-downtime
  assert.deepEqual(await verifyPresentedSecret(current, { current, previous }), {
    ok: true,
    matched: "current",
  });
});

test("PREVIOUS being absent is NOT an error", async () => {
  const current = randomSecret();
  for (const previous of [undefined, null, "", "   "]) {
    assert.deepEqual(
      await verifyPresentedSecret(current, { current, previous }),
      { ok: true, matched: "current" },
      `PREVIOUS=${JSON.stringify(previous)} must not disturb a valid CURRENT`,
    );
  }
});

// ─── 2 · Fail-closed paths ─────────────────────────────────────────────────────────────────

test("wrong secret is rejected", async () => {
  const current = randomSecret();
  const previous = randomSecret();
  const wrong = randomSecret();
  assert.deepEqual(await verifyPresentedSecret(wrong, { current, previous }), {
    ok: false,
    reason: "mismatch",
  });
  assert.equal(await verifyInternalSecret(requestWith(wrong), { current, previous }), false);
});

test("missing header is rejected", async () => {
  const current = randomSecret();
  assert.deepEqual(await verifyPresentedSecret(undefined, { current }), {
    ok: false,
    reason: "missing",
  });
  assert.deepEqual(await verifyPresentedSecret(null, { current }), {
    ok: false,
    reason: "missing",
  });
  // no header on the Request at all
  assert.equal(await verifyInternalSecret(requestWith(), { current }), false);
});

test("blank and whitespace-only headers are rejected", async () => {
  const current = randomSecret();
  for (const blank of ["", " ", "   ", "\t", "\t \t"]) {
    assert.deepEqual(
      await verifyPresentedSecret(blank, { current }),
      { ok: false, reason: "missing" },
      `blank ${JSON.stringify(blank)} must be denied`,
    );
  }
});

test("malformed headers are rejected", async () => {
  const current = randomSecret();
  const malformed = [
    `Bearer ${current}`, // a bearer prefix must never be accepted
    current.slice(0, 42), // one char short
    `${current}x`, // one char long — a length-only difference
    `${current.slice(0, 42)}+`, // base64 (not base64url) alphabet
    `${current.slice(0, 42)}/`,
    `${current.slice(0, 40)}==`, // padded
    "undefined", // the classic stringified-env accident
    "null",
  ];
  for (const value of malformed) {
    assert.deepEqual(
      await verifyPresentedSecret(value, { current }),
      { ok: false, reason: "malformed" },
      `malformed ${JSON.stringify(value)} must be denied`,
    );
  }
});

test("both env values absent or blank is rejected — never fail-open", async () => {
  const presented = randomSecret();
  const emptyEnvs = [
    {},
    { current: undefined, previous: undefined },
    { current: null, previous: null },
    { current: "", previous: "" },
    { current: "   ", previous: "\t" },
    { current: "too-short", previous: "also-bad" }, // malformed config == not configured
  ];
  for (const env of emptyEnvs) {
    assert.deepEqual(
      await verifyPresentedSecret(presented, env),
      { ok: false, reason: "not_configured" },
      `env ${JSON.stringify(env)} must deny`,
    );
  }
});

test("the ABSENT placeholder used for constant work is not itself acceptable", async () => {
  // The verifier hashes a fixed placeholder for an unconfigured slot so the number of digest
  // operations does not depend on whether PREVIOUS is set. Presenting the placeholder must
  // still be denied.
  const placeholder = "-".repeat(43);
  assert.ok(INTERNAL_SECRET_SHAPE.test(placeholder), "placeholder is shape-valid by design");
  assert.deepEqual(await verifyPresentedSecret(placeholder, {}), {
    ok: false,
    reason: "not_configured",
  });
  const current = randomSecret();
  assert.deepEqual(await verifyPresentedSecret(placeholder, { current }), {
    ok: false,
    reason: "mismatch",
  });
});

test("every failure mode is ok:false and carries no secret material", async () => {
  const current = randomSecret();
  const cases: Array<[string | null | undefined, Parameters<typeof verifyPresentedSecret>[1]]> = [
    [undefined, { current }],
    ["  ", { current }],
    [`Bearer ${current}`, { current }],
    [randomSecret(), { current }],
    [randomSecret(), {}],
  ];
  for (const [presented, env] of cases) {
    const result = await verifyPresentedSecret(presented, env);
    assert.equal(result.ok, false);
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes(current), "the result must never echo a configured secret");
    if (typeof presented === "string" && presented.length > 8) {
      assert.ok(
        !serialized.includes(presented),
        "the result must never echo the presented value",
      );
    }
  }
});

// ─── 3 · The comparison is not a plain equality ────────────────────────────────────────────

test("the verifier SHA-256-hashes both sides before comparing", async () => {
  // Behavioural proof, not a source grep: count crypto.subtle.digest invocations.
  const realDigest = crypto.subtle.digest.bind(crypto.subtle);
  const algorithms: unknown[] = [];
  const patched = (algorithm: unknown, data: BufferSource) => {
    algorithms.push(algorithm);
    return realDigest(algorithm as AlgorithmIdentifier, data);
  };
  (crypto.subtle as unknown as { digest: unknown }).digest = patched;
  try {
    const current = randomSecret();
    assert.equal((await verifyPresentedSecret(current, { current })).ok, true);
  } finally {
    (crypto.subtle as unknown as { digest: unknown }).digest = realDigest;
  }
  assert.ok(
    algorithms.length >= 2,
    `expected the presented value AND each candidate to be hashed, saw ${algorithms.length} digest calls`,
  );
  assert.ok(
    algorithms.every((a) => a === "SHA-256"),
    "every digest call must be SHA-256",
  );
});

test("a value sharing a 42-char prefix with the secret is rejected (no prefix compare)", async () => {
  const current = randomSecret();
  const lastChar = current.at(-1) as string;
  const flipped = current.slice(0, 42) + (lastChar === "A" ? "B" : "A");
  assert.notEqual(flipped, current);
  assert.ok(INTERNAL_SECRET_SHAPE.test(flipped), "the near-miss is still shape-valid");
  assert.deepEqual(await verifyPresentedSecret(flipped, { current }), {
    ok: false,
    reason: "mismatch",
  });
});

test("equalDigests folds a length difference instead of short-circuiting on it", async () => {
  const a = new Uint8Array(32).fill(7);
  const same = new Uint8Array(32).fill(7);
  const short = new Uint8Array(31).fill(7); // identical prefix, different length
  const long = new Uint8Array(33).fill(7); // identical prefix, different length
  const oneBitOff = new Uint8Array(32).fill(7);
  oneBitOff[31] = 6; // differs only in the LAST byte — a short-circuit compare would be fast
  const firstByteOff = new Uint8Array(32).fill(7);
  firstByteOff[0] = 6; // differs only in the FIRST byte

  assert.equal(equalDigests(a, same), true);
  assert.equal(equalDigests(a, short), false, "shorter input must not compare equal");
  assert.equal(equalDigests(a, long), false, "longer input must not compare equal");
  assert.equal(equalDigests(a, oneBitOff), false);
  assert.equal(equalDigests(a, firstByteOff), false);
  assert.equal(equalDigests(new Uint8Array(0), new Uint8Array(0)), false, "empty is never equal");
});

test("the verifier module contains no equality comparison of secret values", () => {
  const text = readText(resolve(here, "internal_auth.ts"));
  const code = text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//") && !line.trimStart().startsWith("*"))
    .join("\n");
  // Any direct equality between the presented value and a configured value — in either
  // direction, with or without coercion — is forbidden. (`typeof presented === "string"` is a
  // type test, not a secret comparison, so the patterns name both operands.)
  const secretNames = ["presented", "raw", "current", "previous", "env.current", "env.previous"];
  for (const left of secretNames) {
    for (const right of secretNames) {
      if (left === right) continue;
      for (const op of ["===", "!==", "==", "!="]) {
        const forbidden = `${left} ${op} ${right}`;
        assert.ok(
          !code.includes(forbidden),
          `the verifier must not contain ${JSON.stringify(forbidden)}`,
        );
      }
    }
  }
  // and no bearer-shaped string is ever constructed or compared here
  assert.ok(!code.includes("`Bearer ${"), "the verifier must not build a bearer string");
  assert.ok(!code.includes("localeCompare"), "no lexicographic comparison of secrets");
  assert.ok(!code.includes(".startsWith("), "no prefix comparison of secrets");
  // and it must contain the accumulate primitive
  assert.ok(code.includes("diff |="), "the compare must XOR-accumulate into `diff`");
  assert.ok(
    code.includes('crypto.subtle.digest("SHA-256"'),
    "the compare must be over SHA-256 digests",
  );
  // the loop body must not short-circuit
  const loop = code.slice(code.indexOf("for (let i = 0; i < DIGEST_BYTES"));
  const loopBody = loop.slice(0, loop.indexOf("}"));
  assert.ok(!loopBody.includes("return"), "the accumulate loop must not return early");
  assert.ok(!loopBody.includes("break"), "the accumulate loop must not break");
});

// ─── 4 · Header / shape contract ───────────────────────────────────────────────────────────

test("header name and shape match the R4-U2 interface contract §4", () => {
  assert.equal(INTERNAL_SECRET_HEADER, "x-ourobion-internal-secret");
  assert.equal(INTERNAL_SECRET_HEADER_WIRE, "X-Ourobion-Internal-Secret");
  assert.equal(INTERNAL_SECRET_HEADER_WIRE.toLowerCase(), INTERNAL_SECRET_HEADER);
  assert.equal(String(INTERNAL_SECRET_SHAPE), "/^[A-Za-z0-9_-]{43}$/");
  // Headers.get is case-insensitive, so the lower-case constant reads the wire header.
  const secret = randomSecret();
  assert.equal(requestWith(secret).headers.get(INTERNAL_SECRET_HEADER), secret);
});

test("isWellFormedInternalSecret accepts only 43-char base64url", () => {
  assert.equal(isWellFormedInternalSecret(randomSecret()), true);
  for (const bad of [undefined, null, "", "   ", "x".repeat(42), "x".repeat(44), "a+b/c=", 43]) {
    assert.equal(
      isWellFormedInternalSecret(bad as string | null | undefined),
      false,
      `${JSON.stringify(bad)} must not be well-formed`,
    );
  }
  // 32 random bytes as base64url is always exactly 43 chars — the shape is not accidental.
  for (let i = 0; i < 50; i++) assert.equal(randomSecret().length, 43);
});

// ─── 5 · The 401 response: byte-identical, never 500 ───────────────────────────────────────

test("the 401 body is byte-identical to the attested bodySha256", async () => {
  assert.equal(UNAUTHORIZED_BODY, "Unauthorized");
  const res = unauthorizedResponse();
  assert.equal(res.status, 401);
  const body = await res.text();
  assert.equal(body, "Unauthorized");
  assert.equal(
    createHash("sha256").update(body, "utf8").digest("hex"),
    ATTESTED_BODY_SHA256,
    "changing these 12 bytes invalidates supabase/deploy-attestation.json",
  );
  // no header echo, no configuration hint
  assert.equal(res.headers.get("content-type"), "text/plain;charset=UTF-8");
  assert.equal(res.headers.get(INTERNAL_SECRET_HEADER), null);
});

// ─── 6 · Each of the four handlers: its REAL auth prelude, executed ────────────────────────
//
// The handlers cannot be imported in Node (they are `Deno.serve` shells importing `jsr:`
// specifiers). So instead of a mock, the handler's authorization prelude is EXTRACTED VERBATIM
// from its index.ts and executed with `Deno.env` stubbed. That is the actual production source
// text running, not a re-implementation, and it needs no server and no Deno.

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<unknown>;

const PRELUDE_START = "const verdict = await verifyInternalSecretRequest(req, {";
const PRELUDE_END = "return unauthorizedResponse()\n  }";
/** Sentinel returned iff the prelude falls through, i.e. the request was AUTHORIZED. */
const PAST_AUTH = "__past_auth__";

function extractPrelude(fn: string): string {
  const text = source(fn);
  const start = text.indexOf(PRELUDE_START);
  assert.notEqual(start, -1, `${fn}: authorization prelude not found`);
  const end = text.indexOf(PRELUDE_END, start);
  assert.notEqual(end, -1, `${fn}: prelude denial branch not found`);
  return text.slice(start, end + PRELUDE_END.length);
}

async function runPrelude(fn: string, env: Record<string, string>): Promise<Response> {
  const body = `${extractPrelude(fn)}\n  return new Response(${JSON.stringify(PAST_AUTH)}, { status: 500 })`;
  const compiled = new AsyncFunction(
    "req",
    "Deno",
    "verifyInternalSecretRequest",
    "unauthorizedResponse",
    "console",
    body,
  );
  const denoStub = { env: { get: (k: string) => env[k] } };
  const quietConsole = { error: () => {} };
  const { verifyInternalSecretRequest, unauthorizedResponse: unauth } = await import(
    "./internal_auth.ts"
  );
  return (await compiled(
    requestWith(env.__presented__),
    denoStub,
    verifyInternalSecretRequest,
    unauth,
    quietConsole,
  )) as Response;
}

for (const fn of FUNCTIONS) {
  test(`${fn}: returns 401 (not 500) when NO internal secret env is configured`, async () => {
    const res = await runPrelude(fn, {}); // nothing configured, no header presented
    assert.equal(res.status, 401, `${fn} must answer 401, never 500, on missing config`);
    const body = await res.text();
    assert.equal(body, "Unauthorized");
    assert.equal(createHash("sha256").update(body, "utf8").digest("hex"), ATTESTED_BODY_SHA256);
  });

  test(`${fn}: every denial mode is the SAME 401 with the SAME bytes (no oracle)`, async () => {
    const current = randomSecret();
    const observed = new Set<string>();
    const modes: Array<Record<string, string>> = [
      {}, // not configured, no header
      { __presented__: current }, // not configured, correct-shaped header
      { OUROBION_INTERNAL_SECRET_CURRENT: current }, // configured, header missing
      { OUROBION_INTERNAL_SECRET_CURRENT: current, __presented__: "   " }, // blank
      { OUROBION_INTERNAL_SECRET_CURRENT: current, __presented__: `Bearer ${current}` }, // malformed
      { OUROBION_INTERNAL_SECRET_CURRENT: current, __presented__: randomSecret() }, // wrong
    ];
    for (const env of modes) {
      const res = await runPrelude(fn, env);
      observed.add(`${res.status}:${await res.text()}`);
    }
    assert.deepEqual([...observed], ["401:Unauthorized"], `${fn} leaked a distinguishable denial`);
  });

  test(`${fn}: the prelude opens for a correct CURRENT and for a correct PREVIOUS`, async () => {
    const current = randomSecret();
    const previous = randomSecret();
    const viaCurrent = await runPrelude(fn, {
      OUROBION_INTERNAL_SECRET_CURRENT: current,
      OUROBION_INTERNAL_SECRET_PREVIOUS: previous,
      __presented__: current,
    });
    assert.equal(await viaCurrent.text(), PAST_AUTH, `${fn} rejected a valid CURRENT`);
    const viaPrevious = await runPrelude(fn, {
      OUROBION_INTERNAL_SECRET_CURRENT: current,
      OUROBION_INTERNAL_SECRET_PREVIOUS: previous,
      __presented__: previous,
    });
    assert.equal(await viaPrevious.text(), PAST_AUTH, `${fn} rejected a valid PREVIOUS`);
    const onlyCurrent = await runPrelude(fn, {
      OUROBION_INTERNAL_SECRET_CURRENT: current,
      __presented__: current,
    });
    assert.equal(await onlyCurrent.text(), PAST_AUTH, `${fn} needs PREVIOUS to be optional`);
  });

  test(`${fn}: authorization is checked BEFORE any 500 configuration guard`, () => {
    const text = source(fn);
    const handler = text.slice(text.indexOf("Deno.serve(async (req) => {"));
    const authAt = handler.indexOf(PRELUDE_START);
    const denyAt = handler.indexOf("return unauthorizedResponse()");
    const first500 = handler.indexOf("status: 500");
    assert.ok(authAt > -1 && denyAt > authAt, `${fn}: prelude malformed`);
    assert.ok(
      first500 === -1 || first500 > denyAt,
      `${fn}: a 500 guard precedes the authorization check — that is both an oracle and an attestation-breaking 500 on the release gate's serve probe`,
    );
  });

  test(`${fn}: the service-role key is no longer request authorization`, () => {
    const text = source(fn);
    assert.ok(
      !text.includes("`Bearer ${serviceRoleKey}`"),
      `${fn}: still builds a service-role bearer`,
    );
    assert.ok(
      !/auth\s*!==\s*`Bearer/.test(text),
      `${fn}: still compares Authorization with a plain !==`,
    );
    assert.ok(
      !text.includes('req.headers.get("Authorization")'),
      `${fn}: still reads Authorization as an authorization input`,
    );
    // The 401 body must stay exactly these bytes in the source, too.
    assert.ok(
      !/new Response\("Unauthorized"/.test(text) || text.includes("unauthorizedResponse()"),
      `${fn}: should return the shared 401 helper`,
    );
  });
}

test("run-pipeline fans out the internal secret and the anon key, never the service-role key", () => {
  const text = source("run-pipeline");
  assert.ok(!text.includes("SUPABASE_SERVICE_ROLE_KEY"), "run-pipeline must not read the service key");
  assert.ok(text.includes("[INTERNAL_SECRET_HEADER_WIRE]: outboundSecret"), "must forward the secret");
  assert.ok(text.includes("Authorization: `Bearer ${anonKey}`"), "must send the anon key as the JWT");
  assert.ok(text.includes("apikey: anonKey"), "must send the anon key as apikey");
});

test("the three engine functions keep the service-role key ONLY as a database credential", () => {
  for (const fn of ["compute-baselines", "evaluate-signals", "generate-insights"] as const) {
    const text = source(fn);
    assert.ok(text.includes('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")'), `${fn}: still needs it for the DB client`);
    assert.ok(
      /(makeClient|createClient)\(Deno\.env\.get\("SUPABASE_URL"\)!, serviceRoleKey\)/.test(text),
      `${fn}: the only use of serviceRoleKey must be constructing the Supabase client`,
    );
    // exactly two textual uses: the env read and the client construction (plus its guard log)
    const uses = text.split("serviceRoleKey").length - 1;
    assert.ok(uses <= 3, `${fn}: unexpected extra uses of serviceRoleKey (${uses})`);
  }
});

test("no function or the shared module logs a secret value", () => {
  const files = [
    resolve(here, "internal_auth.ts"),
    ...FUNCTIONS.map((fn) => resolve(functionsDir, fn, "index.ts")),
  ];
  for (const file of files) {
    const text = readText(file);
    for (const line of text.split("\n")) {
      if (!/console\.(log|error|warn|info)/.test(line)) continue;
      assert.ok(
        !/OUROBION_INTERNAL_SECRET|internalSecret|outboundSecret|\bsecret\b\s*[),}]/.test(line) ||
          line.includes("is not set") ||
          line.includes("unavailable for fan-out"),
        `${file}: log line may interpolate a secret: ${line.trim()}`,
      );
      assert.ok(
        !/\$\{\s*(current|previous|presented|raw|outboundSecret|internalSecret)\s*\}/.test(line),
        `${file}: log line interpolates a secret variable: ${line.trim()}`,
      );
    }
  }
});

test("compute-baselines still contains its deliberate literal NUL separator", () => {
  // The NUL is written here as an ESCAPE so this test file itself stays plain ASCII text.
  const NUL = String.fromCharCode(0);
  const raw = readText(resolve(functionsDir, "compute-baselines", "index.ts"));
  const lines = raw.split("\n");
  const nulLines = lines.map((l, i) => (l.includes(NUL) ? i + 1 : 0)).filter(Boolean);
  assert.equal(nulLines.length, 1, "exactly one line must carry the NUL byte");
  assert.equal(nulLines[0], 171, "the NUL is expected on the baseline map-key line");
  assert.ok(
    lines[nulLines[0] - 1].includes("${row.user_id}" + NUL + "${row.metric_key}"),
    "the NUL must still be the baseline map-key separator",
  );
});
