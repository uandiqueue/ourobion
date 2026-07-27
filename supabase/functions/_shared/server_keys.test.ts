import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  resolveServerKey,
  ServerKeyConfigurationError,
} from "./server_keys.ts"
import { fetchEngineStage } from "./engine_request.ts"

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "..", "..", "..")

test("replacement keys resolve from named JSON without any legacy key", () => {
  const env = {
    SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: "sb_publishable_opaque" }),
    SUPABASE_SECRET_KEYS: JSON.stringify({ default: "sb_secret_opaque" }),
  }
  assert.deepEqual(resolveServerKey(env, "publishable"), {
    value: "sb_publishable_opaque",
    source: "named",
  })
  assert.deepEqual(resolveServerKey(env, "secret"), {
    value: "sb_secret_opaque",
    source: "named",
  })
})

test("named replacement keys support an explicit named key", () => {
  const env = { SUPABASE_SECRET_KEYS: JSON.stringify({ engine: "sb_secret_engine" }) }
  assert.deepEqual(resolveServerKey(env, "secret", { keyName: "engine" }), {
    value: "sb_secret_engine",
    source: "named",
  })
})

test("singular replacement forms work when named JSON is absent", () => {
  assert.deepEqual(resolveServerKey({ SUPABASE_PUBLISHABLE_KEY: "sb_publishable_one" }, "publishable"), {
    value: "sb_publishable_one",
    source: "singular",
  })
  assert.deepEqual(resolveServerKey({ SUPABASE_SECRET_KEY: "sb_secret_one" }, "secret"), {
    value: "sb_secret_one",
    source: "singular",
  })
})

test("legacy keys require an explicit switch and an exact local CLI URL", () => {
  const local = { allowLegacyLocalCli: true, supabaseUrl: "http://127.0.0.1:54321" }
  assert.equal(
    resolveServerKey({ SUPABASE_ANON_KEY: "legacy-anon" }, "publishable", local).source,
    "legacy-local-cli",
  )
  assert.equal(
    resolveServerKey({ SUPABASE_SERVICE_ROLE_KEY: "legacy-service" }, "secret", {
      allowLegacyLocalCli: true,
      supabaseUrl: "http://localhost:54321/",
    }).source,
    "legacy-local-cli",
  )
})

test("legacy keys fail closed outside the exact local CLI origin", () => {
  const invalidUrls = [
    undefined,
    "https://project.supabase.co",
    "http://127.0.0.1:54321/functions/v1/run-pipeline",
    "http://127.0.0.1:54321?host=evil.example",
    "http://user:pass@127.0.0.1:54321",
    "http://127.0.0.1:54322",
    "http://localhost.example:54321",
  ]
  for (const supabaseUrl of invalidUrls) {
    assert.throws(
      () => resolveServerKey({ SUPABASE_ANON_KEY: "legacy-anon" }, "publishable", {
        allowLegacyLocalCli: true,
        supabaseUrl,
      }),
      ServerKeyConfigurationError,
      `legacy key unexpectedly accepted for ${String(supabaseUrl)}`,
    )
  }
  assert.throws(
    () => resolveServerKey(
      { SUPABASE_ANON_KEY: "legacy-anon" },
      "publishable",
      { supabaseUrl: "http://127.0.0.1:54321" },
    ),
    ServerKeyConfigurationError,
  )
})

test("replacement key prefixes prevent publishable and secret key kinds being mixed", () => {
  for (const [env, kind] of [
    [{ SUPABASE_PUBLISHABLE_KEY: "sb_secret_wrong" }, "publishable"],
    [{ SUPABASE_SECRET_KEY: "sb_publishable_wrong" }, "secret"],
    [{ SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: "sb_secret_wrong" }) }, "publishable"],
    [{ SUPABASE_SECRET_KEYS: JSON.stringify({ default: "sb_publishable_wrong" }) }, "secret"],
  ] as const) {
    assert.throws(() => resolveServerKey(env, kind), ServerKeyConfigurationError)
  }
})

test("named configuration is authoritative and fails closed when malformed or incomplete", () => {
  for (const env of [
    { SUPABASE_SECRET_KEYS: "not-json", SUPABASE_SERVICE_ROLE_KEY: "legacy" },
    { SUPABASE_SECRET_KEYS: "[]", SUPABASE_SERVICE_ROLE_KEY: "legacy" },
    { SUPABASE_SECRET_KEYS: JSON.stringify({ other: "sb_secret_other" }), SUPABASE_SERVICE_ROLE_KEY: "legacy" },
    { SUPABASE_SECRET_KEYS: JSON.stringify({ default: "   " }), SUPABASE_SERVICE_ROLE_KEY: "legacy" },
  ]) {
    assert.throws(() => resolveServerKey(env, "secret"), ServerKeyConfigurationError)
  }
})

test("absent replacement and legacy forms fail closed", () => {
  assert.throws(() => resolveServerKey({}, "publishable"), ServerKeyConfigurationError)
  assert.throws(() => resolveServerKey({ SUPABASE_SECRET_KEY: "" }, "secret"), ServerKeyConfigurationError)
})

test("superseding cron migration uses only apikey with app.supabase_publishable_key", () => {
  const sql = readFileSync(
    resolve(repoRoot, "supabase", "migrations", "20260728030000_supersede_cron_publishable_apikey.sql"),
    "utf8",
  )
  assert.equal((sql.match(/current_setting\('app\.supabase_publishable_key'\)/g) ?? []).length, 2)
  assert.match(sql, /'apikey',\s+current_setting\('app\.supabase_publishable_key'\)/)
  assert.doesNotMatch(sql, /'Authorization'/i)
  assert.doesNotMatch(sql, /app\.service_role_key/)
})

test("all internal-secret engine functions disable platform JWT verification", () => {
  const config = readFileSync(resolve(repoRoot, "supabase", "config.toml"), "utf8")
  for (const fn of ["compute-baselines", "evaluate-signals", "generate-insights", "run-pipeline"]) {
    const section = config.match(new RegExp(`\\[functions\\.${fn.replace("-", "\\-")}\\]([\\s\\S]*?)(?=\\n\\[|$)`))?.[1]
    assert.ok(section, `${fn} config section is missing`)
    assert.match(section!, /verify_jwt\s*=\s*false/)
  }
})

test("run-pipeline's production request helper sends apikey plus internal secret without Authorization", async () => {
  let capturedUrl = ""
  let capturedInit: RequestInit | undefined
  const fetchStub = (async (input: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(input)
    capturedInit = init
    return new Response("{}", { status: 200 })
  }) as typeof fetch

  await fetchEngineStage(
    fetchStub,
    "https://project.supabase.co",
    "evaluate-signals",
    "sb_publishable_test",
    "x".repeat(43),
  )

  assert.equal(capturedUrl, "https://project.supabase.co/functions/v1/evaluate-signals")
  assert.equal(capturedInit?.method, "POST")
  assert.equal(capturedInit?.body, "{}")
  const headers = new Headers(capturedInit?.headers)
  assert.equal(headers.get("apikey"), "sb_publishable_test")
  assert.equal(headers.get("x-ourobion-internal-secret"), "x".repeat(43))
  assert.equal(headers.get("authorization"), null)
})
