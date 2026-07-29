/**
 * O10 read-boundary projection (run-2 U8): pure builders that turn the two
 * file-backed sources of truth —
 *
 *   - router.config.json  (C6/C7 config)      → `llm_router_status` rows
 *   - data/llm-router/ledger.json (C7 ledger) → `llm_router_spend` rows
 *
 * — into the row shapes of the Supabase projection tables nao reads
 * (migration 20260724130000_create_o10_llm_router_boundaries.sql). TWO-TIER
 * TRUTH: the files stay canonical; the tables are rebuildable snapshots,
 * published by the explicit script `scripts/publish-status.ts` (service_role).
 * Nothing here touches the network or the filesystem — offline unit-testable.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import type { LedgerFile, NodeDayCounter } from './budget.js';
import type { RouterConfig } from './config.js';
import { LLM_NODE_IDS, type LlmNodeId } from './types.js';

/** One `llm_router_status` row (column names match the table). */
export interface StatusRow {
  node: LlmNodeId;
  model_id: string;
  route: 'local_agent' | 'api_worker';
  max_output_tokens: number;
  per_day_usd_cap: number;
  per_run_token_cap: number;
  hard_stop_fraction: number;
  /**
   * R4-U3: ALWAYS false now. The router's `testMode` config block — the only
   * thing that could ever set this true — was removed along with the
   * decorrelation downgrade it enabled. The column and this field are RETAINED
   * (rather than dropped) so the O10 projection table
   * (20260724130000_create_o10_llm_router_boundaries.sql) and nao's ModelsPanel
   * need no migration, and so historical rows published during the Run 2.0
   * window keep their meaning.
   */
  test_mode: boolean;
  /** R4-U3: always null — see {@link StatusRow.test_mode}. */
  test_mode_reason: string | null;
  published_at: string;
}

/** One `llm_router_spend` row (column names match the table). */
export interface SpendRow {
  day: string;
  node: LlmNodeId;
  calls: number;
  tokens_in: number;
  tokens_out: number;
  usd: number;
  published_at: string;
}

export interface PublishRows {
  status: StatusRow[];
  spend: SpendRow[];
}

/**
 * Project config + ledger into publishable rows. `publishedAt` is injected
 * (one timestamp for the whole publish) so runs are deterministic in tests.
 *
 * - status: exactly one row per node in LLM_NODE_IDS order; caps are the FILE
 *   values (per-day USD is global-per-node in the config, so every row carries
 *   the same number today — the projection stays per-node so a future per-node
 *   config needs no schema change). Overrides live in their own table.
 * - spend: one row per (day, node) pair present in the ledger, day-then-node
 *   sorted. Run counters are not projected (nao's panel is day-oriented).
 */
export function buildStatusRows(
  config: RouterConfig,
  ledger: LedgerFile,
  publishedAt: string,
): PublishRows {
  const status: StatusRow[] = LLM_NODE_IDS.map((node) => {
    const n = config.nodes[node];
    return {
      node,
      model_id: n.model,
      route: n.route,
      max_output_tokens: n.maxOutputTokens,
      per_day_usd_cap: config.budget.perDayUsdPerNode,
      per_run_token_cap: config.budget.perRunOutputTokens,
      hard_stop_fraction: config.budget.hardStopFraction,
      // R4-U3: no config can request test mode any more — see StatusRow.test_mode.
      test_mode: false,
      test_mode_reason: null,
      published_at: publishedAt,
    };
  });

  const spend: SpendRow[] = [];
  for (const day of Object.keys(ledger.days ?? {}).sort()) {
    const nodes = ledger.days[day] ?? {};
    for (const node of LLM_NODE_IDS) {
      const c: NodeDayCounter | undefined = nodes[node];
      if (c === undefined) continue;
      spend.push({
        day,
        node,
        calls: c.calls,
        tokens_in: c.inputTokens,
        tokens_out: c.outputTokens,
        usd: c.usd,
        published_at: publishedAt,
      });
    }
  }

  return { status, spend };
}
