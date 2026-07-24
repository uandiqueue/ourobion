// ourobion nao — model-config panel helpers (O10 / demo feature (a), run-2 U8).
//
// Pure, IO-free logic for the /models panel + /api/models routes (nao's
// ingestControl/simulatedHealth convention: route handlers are IO glue over
// unit-tested pure functions). The panel reads the O10 boundaries
// llm_router_status / llm_router_spend (PROJECTIONS of tools/llm-router's
// router.config.json + budget ledger — publish-driven, hence the staleness
// helper) and writes ONLY llm_router_cap_overrides (caps only, the locked
// demo exception — no source toggles, no model-id editing).

/** The six router nodes — mirrors tools/llm-router/src/types.ts LLM_NODE_IDS. */
export const LLM_ROUTER_NODES = [
  'seeder',
  'synthesis',
  'verifier',
  'phrasing_card',
  'report_narrative',
  'extract_assist',
] as const;
export type LlmRouterNode = (typeof LLM_ROUTER_NODES)[number];

/** Bounds mirror the migration CHECKs (20260724130000) + router overrides.ts. */
export const MAX_PER_DAY_USD_CAP = 5.0;
export const MAX_PER_RUN_TOKEN_CAP = 200_000;

/** Snapshot older than this is flagged stale — publishing is an explicit script. */
export const STALE_AFTER_MS = 60 * 60 * 1000; // 1 hour

/** Row of llm_router_status (column names as in the table). */
export interface ModelStatusRow {
  node: LlmRouterNode;
  model_id: string;
  route: 'local_agent' | 'api_worker';
  max_output_tokens: number;
  per_day_usd_cap: number;
  per_run_token_cap: number;
  hard_stop_fraction: number;
  test_mode: boolean;
  test_mode_reason: string | null;
  published_at: string;
}

/** Row of llm_router_spend. */
export interface ModelSpendRow {
  day: string;
  node: LlmRouterNode;
  calls: number;
  tokens_in: number;
  tokens_out: number;
  usd: number;
  published_at: string;
}

/** Row of llm_router_cap_overrides. */
export interface CapOverrideRow {
  node: LlmRouterNode;
  per_day_usd_cap: number | null;
  per_run_token_cap: number | null;
  updated_by: string;
  updated_at: string;
}

/** Validated POST /api/models/caps body: null clears that override. */
export interface CapsUpdate {
  node: LlmRouterNode;
  perDayUsdCap: number | null;
  perRunTokenCap: number | null;
}

export type ParseResult = { ok: true; value: CapsUpdate } | { ok: false; error: string };

function parseCapValue(
  raw: unknown,
  label: string,
  max: number,
  integer: boolean,
): { value: number | null } | { error: string } {
  if (raw === undefined || raw === null) return { value: null };
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return { error: `${label} must be a number (or null to clear the override)` };
  }
  const value = integer ? raw : Math.round(raw * 100) / 100; // USD caps are cents-granular (numeric(8,2))
  if (integer && !Number.isInteger(raw)) return { error: `${label} must be an integer` };
  if (value <= 0) return { error: `${label} must be positive` };
  if (value > max) {
    return { error: `${label} must be <= ${max} (run-budget guard — matches the table CHECK)` };
  }
  return { value };
}

/** Validate a caps-edit request body. Caps only — nothing else is writable. */
export function parseCapsBody(body: unknown): ParseResult {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;
  const node = b.node;
  if (typeof node !== 'string' || !(LLM_ROUTER_NODES as readonly string[]).includes(node)) {
    return { ok: false, error: `node must be one of ${LLM_ROUTER_NODES.join(', ')}` };
  }
  const day = parseCapValue(b.perDayUsdCap, 'perDayUsdCap', MAX_PER_DAY_USD_CAP, false);
  if ('error' in day) return { ok: false, error: day.error };
  const run = parseCapValue(b.perRunTokenCap, 'perRunTokenCap', MAX_PER_RUN_TOKEN_CAP, true);
  if ('error' in run) return { ok: false, error: run.error };
  return {
    ok: true,
    value: { node: node as LlmRouterNode, perDayUsdCap: day.value, perRunTokenCap: run.value },
  };
}

/** Override replaces the file cap where present (router overrides.ts semantics). */
export function effectiveCap(
  fileCap: number,
  override: number | null | undefined,
): { value: number; overridden: boolean } {
  return override !== null && override !== undefined
    ? { value: override, overridden: true }
    : { value: fileCap, overridden: false };
}

/** Spend as a fraction of cap (0 when the cap is degenerate). */
export function spendFraction(usd: number, cap: number): number {
  if (!Number.isFinite(cap) || cap <= 0) return 0;
  return usd / cap;
}

/** At/over the hard-stop line (>= hardStopFraction, i.e. >=95% shipped)? */
export function isHardStopped(usd: number, cap: number, hardStopFraction: number): boolean {
  return spendFraction(usd, cap) >= hardStopFraction;
}

/** Publish-driven snapshot honesty: older than STALE_AFTER_MS → stale. */
export function isStale(publishedAt: string, nowMs: number): boolean {
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return true; // unparsable = unaccountable = stale
  return nowMs - t > STALE_AFTER_MS;
}
