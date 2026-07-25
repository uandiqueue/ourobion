/**
 * O10 cap overrides (run-2 U8): consume nao's ONE write surface,
 * `llm_router_cap_overrides` (the demo exception — token/spend CAPS only).
 *
 * Semantics (documented decision):
 *  - An override REPLACES the file cap for its node (it may lower OR raise it),
 *    bounded twice: the table CHECKs (per_day_usd_cap <= 5.00,
 *    per_run_token_cap <= 200000) and the same bounds re-enforced here
 *    ({@link MAX_PER_DAY_USD_CAP} / {@link MAX_PER_RUN_TOKEN_CAP}) so a
 *    hand-edited or out-of-band row still cannot blow the run budget.
 *  - The config's caps are GLOBAL-per-config today (budget.perDayUsdPerNode,
 *    budget.perRunOutputTokens); the smallest correct change is to resolve an
 *    EFFECTIVE per-node cap at spend-check time ({@link effectiveCapsFor},
 *    consumed by BudgetLedger) instead of restructuring the config. The
 *    per-run token counter stays run-wide — the override changes the ceiling
 *    that counter is checked against for calls made by the overridden node.
 *
 * FAIL-SOFT (load-bearing): the router must never be bricked by the boundary.
 * `fetchCapOverrides` returns `undefined` (file config only) with ONE loud
 * warning when SUPABASE_URL/key are absent from env or Supabase is
 * unreachable/errors. It never throws.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import type { RouterConfig } from './config.js';
import { LLM_NODE_IDS, type LlmNodeId } from './types.js';

/** Cap overrides for one node (absent field = no override, file value applies). */
export interface NodeCapOverride {
  perDayUsdCap?: number;
  perRunTokenCap?: number;
}

/** node → override, as fetched from `llm_router_cap_overrides`. */
export type CapOverrides = Partial<Record<LlmNodeId, NodeCapOverride>>;

/** Mirror of the migration CHECK `per_day_usd_cap <= 5.00` (run-budget guard). */
export const MAX_PER_DAY_USD_CAP = 5.0;
/** Mirror of the migration CHECK `per_run_token_cap <= 200000` (C7's shipped ceiling). */
export const MAX_PER_RUN_TOKEN_CAP = 200_000;

export interface FetchCapOverridesOptions {
  /** Injectable env; default process.env. Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. */
  env?: Record<string, string | undefined>;
  /** Injectable fetch (tests). */
  fetchFn?: (url: string, init: RequestInit) => Promise<Response>;
  /** Warning sink; default console.warn. */
  warn?: (message: string) => void;
  /** Abort the boundary read after this long (fail-soft, not fail-slow). */
  timeoutMs?: number;
}

/** Raw row shape returned by PostgREST for the overrides table. */
interface OverrideRow {
  node?: unknown;
  per_day_usd_cap?: unknown;
  per_run_token_cap?: unknown;
}

/**
 * Validate one numeric override value against (0, max]; returns the value or
 * undefined (ignored) with a warning. Defense-in-depth: the table CHECKs
 * enforce the same bounds, but the router refuses to trust any row blindly.
 */
function boundedValue(
  raw: unknown,
  max: number,
  label: string,
  warn: (m: string) => void,
): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || n > max) {
    warn(
      `llm-router cap-overrides: ignoring out-of-bounds ${label} (${String(raw)}) — ` +
        `must be a finite number in (0, ${max}]`,
    );
    return undefined;
  }
  return n;
}

/**
 * Fetch cap overrides from `llm_router_cap_overrides` via PostgREST.
 * Returns undefined (→ file caps only) on ANY problem, with one loud warning.
 * Locally SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY come from
 * `npx supabase status` (the same values apps/nao's gen-env projects into
 * apps/nao/.dev.vars); CI/prod would provide them as real env.
 */
export async function fetchCapOverrides(
  opts: FetchCapOverridesOptions = {},
): Promise<CapOverrides | undefined> {
  const env = opts.env ?? process.env;
  const warn = opts.warn ?? console.warn;
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (url === undefined || url.length === 0 || key === undefined || key.length === 0) {
    warn(
      'llm-router cap-overrides: boundary not configured (SUPABASE_URL / ' +
        'SUPABASE_SERVICE_ROLE_KEY absent from env) — running on FILE caps only. ' +
        'Any caps edited in nao are NOT applied to this process.',
    );
    return undefined;
  }

  const fetchFn = opts.fetchFn ?? (fetch as (u: string, i: RequestInit) => Promise<Response>);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 4000);
  try {
    const res = await fetchFn(
      `${url.replace(/\/+$/, '')}/rest/v1/llm_router_cap_overrides` +
        '?select=node,per_day_usd_cap,per_run_token_cap',
      {
        method: 'GET',
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: controller.signal,
      },
    );
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const rows = (await res.json()) as OverrideRow[];
    if (!Array.isArray(rows)) throw new Error('unexpected non-array response');

    const overrides: CapOverrides = {};
    for (const row of rows) {
      const node = row.node;
      if (typeof node !== 'string' || !(LLM_NODE_IDS as readonly string[]).includes(node)) {
        warn(`llm-router cap-overrides: ignoring row for unknown node '${String(node)}'`);
        continue;
      }
      const perDayUsdCap = boundedValue(
        row.per_day_usd_cap,
        MAX_PER_DAY_USD_CAP,
        `per_day_usd_cap for '${node}'`,
        warn,
      );
      const perRunTokenCap = boundedValue(
        row.per_run_token_cap,
        MAX_PER_RUN_TOKEN_CAP,
        `per_run_token_cap for '${node}'`,
        warn,
      );
      if (perDayUsdCap === undefined && perRunTokenCap === undefined) continue;
      overrides[node as LlmNodeId] = {
        ...(perDayUsdCap !== undefined ? { perDayUsdCap } : {}),
        ...(perRunTokenCap !== undefined ? { perRunTokenCap } : {}),
      };
    }
    return overrides;
  } catch (err) {
    warn(
      `llm-router cap-overrides: boundary unreachable (${err instanceof Error ? err.message : String(err)}) ` +
        '— running on FILE caps only. The router is never bricked by this boundary (fail-soft).',
    );
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/** Effective (post-override) caps for one node. */
export interface EffectiveCaps {
  perDayUsd: number;
  perDayOverridden: boolean;
  perRunTokens: number;
  perRunOverridden: boolean;
}

/**
 * Resolve the effective caps for `nodeId`: the override REPLACES the file
 * value where present (already bounds-checked at fetch), else the file value.
 */
export function effectiveCapsFor(
  config: RouterConfig,
  overrides: CapOverrides | undefined,
  nodeId: LlmNodeId,
): EffectiveCaps {
  const o = overrides?.[nodeId];
  return {
    perDayUsd: o?.perDayUsdCap ?? config.budget.perDayUsdPerNode,
    perDayOverridden: o?.perDayUsdCap !== undefined,
    perRunTokens: o?.perRunTokenCap ?? config.budget.perRunOutputTokens,
    perRunOverridden: o?.perRunTokenCap !== undefined,
  };
}
