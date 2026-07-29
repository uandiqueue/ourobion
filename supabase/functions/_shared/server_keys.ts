// R4-U2: Supabase replacement API-key resolution for privileged Edge Functions.
//
// Hosted Edge Functions receive named replacement keys as JSON objects.  Keep the
// parsing here, rather than sprinkling JSON.parse calls through handlers, so a malformed
// deployment fails deterministically and never silently falls back to an older credential.

export type ServerKeyKind = "publishable" | "secret"
export type ServerKeySource = "named" | "singular" | "legacy-local-cli"

export interface ResolvedServerKey {
  value: string
  source: ServerKeySource
}

export class ServerKeyConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ServerKeyConfigurationError"
  }
}

type Environment = Record<string, string | undefined>

export interface ResolveServerKeyOptions {
  keyName?: string
  /** Explicit compatibility switch for the local Supabase CLI's legacy-only output. */
  allowLegacyLocalCli?: boolean
  /** Required with allowLegacyLocalCli; must be exactly the local API origin. */
  supabaseUrl?: string
}

function names(kind: ServerKeyKind) {
  return kind === "publishable"
    ? {
      named: "SUPABASE_PUBLISHABLE_KEYS",
      singular: "SUPABASE_PUBLISHABLE_KEY",
      legacy: "SUPABASE_ANON_KEY",
    }
    : {
      named: "SUPABASE_SECRET_KEYS",
      singular: "SUPABASE_SECRET_KEY",
      legacy: "SUPABASE_SERVICE_ROLE_KEY",
    }
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function validReplacementKey(value: string, kind: ServerKeyKind): boolean {
  const prefix = kind === "publishable" ? "sb_publishable_" : "sb_secret_"
  return value.startsWith(prefix) && /^[A-Za-z0-9_-]+$/.test(value.slice(prefix.length)) &&
    value.length > prefix.length
}

/** Exact local CLI Functions origin. Query/hash/user-info/path tricks are rejected. */
export function isStrictLocalSupabaseUrl(raw: string | undefined): boolean {
  if (!raw) return false
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  return url.protocol === "http:" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
    url.port === "54321" && url.username === "" && url.password === "" &&
    (url.pathname === "" || url.pathname === "/") && url.search === "" && url.hash === ""
}

function validateReplacementKey(value: string, kind: ServerKeyKind, variable: string): string {
  const trimmed = value.trim()
  if (!validReplacementKey(trimmed, kind)) {
    const expected = kind === "publishable" ? "sb_publishable_" : "sb_secret_"
    throw new ServerKeyConfigurationError(`${variable} must be a ${expected} replacement key`)
  }
  return trimmed
}

/**
 * Resolve one replacement key by its dashboard name (normally `default`).
 *
 * Named variables are authoritative if present: invalid JSON, a non-object, or a missing
 * selected name is a configuration error rather than an invitation to use a different key.
 * Singular replacement variables support runtimes that expose one named key directly. The
 * legacy fallback is deliberately last and exists only for the local Supabase CLI, which does
 * not currently expose replacement-key variables. Production must not rely on it.
 */
/**
 * Read ONLY the variables `resolveServerKey` can consult for `kind`, plus `SUPABASE_URL` for the
 * strict-local-CLI check. Callers used to hand over the whole environment object — every unrelated
 * secret in it — to a helper that needs at most four names. O36's H3 bulk-environment rule flags
 * that, and correctly: a whole-env object in scope is one careless `console.error(env)` away from
 * a leak. This keeps the blast radius to the names actually required, with identical resolution
 * behaviour.
 */
export function readServerKeyEnv(kind: ServerKeyKind): Environment {
  const vars = names(kind)
  return {
    [vars.named]: Deno.env.get(vars.named),
    [vars.singular]: Deno.env.get(vars.singular),
    [vars.legacy]: Deno.env.get(vars.legacy),
    SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
  }
}

export function resolveServerKey(
  env: Environment,
  kind: ServerKeyKind,
  options: ResolveServerKeyOptions = {},
): ResolvedServerKey {
  const keyName = options.keyName ?? "default"
  const vars = names(kind)
  const named = env[vars.named]
  if (named !== undefined) {
    let parsed: unknown
    try {
      parsed = JSON.parse(named)
    } catch {
      throw new ServerKeyConfigurationError(`${vars.named} must be a JSON object`)
    }
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new ServerKeyConfigurationError(`${vars.named} must be a JSON object`)
    }
    const candidate = (parsed as Record<string, unknown>)[keyName]
    if (!nonBlank(candidate)) {
      throw new ServerKeyConfigurationError(`${vars.named}.${keyName} must be a non-empty string`)
    }
    return { value: validateReplacementKey(candidate, kind, `${vars.named}.${keyName}`), source: "named" }
  }

  const singular = env[vars.singular]
  if (singular !== undefined) {
    if (!nonBlank(singular)) {
      throw new ServerKeyConfigurationError(`${vars.singular} must be a non-empty string`)
    }
    return { value: validateReplacementKey(singular, kind, vars.singular), source: "singular" }
  }

  const legacy = env[vars.legacy]
  if (nonBlank(legacy)) {
    if (!options.allowLegacyLocalCli || !isStrictLocalSupabaseUrl(options.supabaseUrl)) {
      throw new ServerKeyConfigurationError(
        `${vars.legacy} is permitted only for the strict local Supabase CLI origin`,
      )
    }
    return { value: legacy.trim(), source: "legacy-local-cli" }
  }

  throw new ServerKeyConfigurationError(
    `${vars.named} (preferred) or ${vars.singular} is required; ${vars.legacy} is only a local CLI fallback`,
  )
}
