/**
 * Router facade (memory 0013: "build the LLM-router first").
 *
 * `LlmRouter.route(request)`:
 *   resolve node config (model/route/maxOutputTokens from router.config.json)
 *   → pre-call budget check (fail-closed, worst-case estimate — budget.ts)
 *   → dispatch to the configured route (localAgent mailbox / apiWorker fetch)
 *   → record actual usage in the ledger
 *   → return the LlmResponse.
 *
 * Constructing a router NEVER requires an API key: config load, budget ledger,
 * and the local_agent route are fully keyless. A missing key surfaces only when
 * an api_worker-routed node is actually dispatched (typed
 * RouterKeyMissingError from routes/apiWorker.ts).
 *
 * `checkConfig()` returns the operator report the CLI prints: per-node model /
 * family / route, the decorrelation verdict, key presence y/n, budget state.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import { randomUUID } from 'node:crypto';
import { BudgetLedger, type BudgetState } from './budget.js';
import {
  familyOf,
  loadConfig,
  providerFor,
  resolveRepoPath,
  type RouterConfig,
} from './config.js';
import { RouterConfigError } from './errors.js';
import {
  effectiveCapsFor,
  fetchCapOverrides,
  type CapOverrides,
  type FetchCapOverridesOptions,
} from './overrides.js';
import { callApiWorker, type ApiWorkerOptions } from './routes/apiWorker.js';
import { requestLocalAgent } from './routes/localAgent.js';
import {
  estimateTokens,
  LLM_NODE_IDS,
  TEST_MODE_LABEL,
  type LlmNodeId,
  type LlmRequest,
  type LlmResponse,
  type TestModeState,
  type VendorFamily,
} from './types.js';

export interface LlmRouterOptions {
  /** Pre-validated config (wins over configPath). */
  config?: RouterConfig;
  /** Config file path; default the checked-in router.config.json. */
  configPath?: string;
  /** Run identity for the per-run token cap; default a fresh UUID. */
  runId?: string;
  /** Ledger file override (default config.budget.ledgerPath, repo-root-relative). */
  ledgerPath?: string;
  /** Mailbox dir override (default config.localAgent.mailboxDir, repo-root-relative). */
  mailboxDir?: string;
  /** Injectable env for key lookup; default process.env. */
  env?: Record<string, string | undefined>;
  /** Injectable fetch for the api_worker route (tests). */
  fetchFn?: ApiWorkerOptions['fetchFn'];
  /** Injectable clock/sleep (tests). */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** api_worker retry tuning (tests). */
  maxAttempts?: number;
  baseDelayMs?: number;
  /**
   * O10 cap overrides (run-2 U8) applied to the budget ledger. The sync
   * constructor never fetches — pass a pre-fetched map here, or use
   * {@link LlmRouter.create} which fetches FAIL-SOFT from Supabase when
   * SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are present in env.
   */
  capOverrides?: CapOverrides;
  /** local_agent timing overrides (default from config.localAgent). */
  localAgentTimeoutMs?: number;
  localAgentPollIntervalMs?: number;
}

export class LlmRouter {
  readonly config: RouterConfig;
  readonly runId: string;
  private readonly ledger: BudgetLedger;
  private readonly opts: LlmRouterOptions;

  constructor(opts: LlmRouterOptions = {}) {
    this.opts = opts;
    this.config = opts.config ?? loadConfig(opts.configPath);
    this.runId = opts.runId ?? randomUUID();
    this.ledger = new BudgetLedger({
      config: this.config,
      ...(opts.ledgerPath !== undefined ? { ledgerPath: opts.ledgerPath } : {}),
      ...(opts.now !== undefined ? { now: opts.now } : {}),
      ...(opts.capOverrides !== undefined ? { overrides: opts.capOverrides } : {}),
    });
  }

  /**
   * Async factory — the O10 override seam for pipeline callers: fetch cap
   * overrides from `llm_router_cap_overrides` (FAIL-SOFT: absent env or an
   * unreachable Supabase → file caps + one loud warning, never a throw), then
   * construct the router with them. Explicit `capOverrides` in opts wins
   * (no fetch). The plain constructor stays sync and never touches the network.
   */
  static async create(
    opts: LlmRouterOptions = {},
    fetchOpts: FetchCapOverridesOptions = {},
  ): Promise<LlmRouter> {
    if (opts.capOverrides !== undefined) return new LlmRouter(opts);
    const overrides = await fetchCapOverrides({
      ...(opts.env !== undefined ? { env: opts.env } : {}),
      ...fetchOpts,
    });
    return new LlmRouter({
      ...opts,
      ...(overrides !== undefined ? { capOverrides: overrides } : {}),
    });
  }

  /** Route one request per the module docstring. */
  async route(req: LlmRequest): Promise<LlmResponse> {
    const node = this.config.nodes[req.nodeId];
    if (node === undefined) {
      throw new RouterConfigError(`llm-router: unknown nodeId '${String(req.nodeId)}'`);
    }
    const maxOutputTokens = req.maxOutputTokens ?? node.maxOutputTokens;

    // Fail-closed pre-check with a worst-case estimate: prompt-length input,
    // full output ceiling. Actuals are recorded after the call.
    const estimate = {
      inputTokens: estimateTokens((req.system ?? '') + req.prompt),
      outputTokens: maxOutputTokens,
    };
    this.ledger.assertCanSpend(req.nodeId, this.runId, node.model, estimate);

    let response: LlmResponse;
    if (node.route === 'api_worker') {
      response = await callApiWorker(this.config, req, node.model, maxOutputTokens, {
        ...(this.opts.fetchFn !== undefined ? { fetchFn: this.opts.fetchFn } : {}),
        ...(this.opts.env !== undefined ? { env: this.opts.env } : {}),
        ...(this.opts.sleep !== undefined ? { sleep: this.opts.sleep } : {}),
        ...(this.opts.maxAttempts !== undefined ? { maxAttempts: this.opts.maxAttempts } : {}),
        ...(this.opts.baseDelayMs !== undefined ? { baseDelayMs: this.opts.baseDelayMs } : {}),
      });
    } else {
      response = await requestLocalAgent(req, node.model, maxOutputTokens, {
        dir: this.opts.mailboxDir ?? resolveRepoPath(this.config.localAgent.mailboxDir),
        timeoutMs: this.opts.localAgentTimeoutMs ?? this.config.localAgent.timeoutMs,
        pollIntervalMs: this.opts.localAgentPollIntervalMs ?? this.config.localAgent.pollIntervalMs,
        ...(this.opts.now !== undefined ? { now: this.opts.now } : {}),
        ...(this.opts.sleep !== undefined ? { sleep: this.opts.sleep } : {}),
      });
    }

    this.ledger.record(req.nodeId, this.runId, node.model, response.usage);
    const testMode = this.testModeState();
    return testMode !== undefined ? { ...response, testMode } : response;
  }

  /**
   * TEST-MODE state (label + reason) when the config carries a `testMode`
   * block, else undefined. Attached to every route() result so downstream
   * consumers can stamp verifier verdicts with {@link TEST_MODE_LABEL}.
   */
  testModeState(): TestModeState | undefined {
    return this.config.testMode !== undefined
      ? { reason: this.config.testMode.reason, label: TEST_MODE_LABEL }
      : undefined;
  }

  /** Current budget snapshot (today's per-node spend + run totals). */
  budgetState(): BudgetState {
    return this.ledger.state();
  }
}

/** Per-node row of the operator report. */
export interface NodeReportRow {
  nodeId: LlmNodeId;
  model: string;
  family: VendorFamily;
  route: 'local_agent' | 'api_worker';
  maxOutputTokens: number;
  priceProvisional: boolean;
  keyEnvVar: string;
  keyPresent: boolean;
  /** EFFECTIVE per-day USD cap for this node (O10 override ?? file value). */
  perDayUsdCap: number;
  perDayUsdCapOverridden: boolean;
  /** EFFECTIVE per-run output-token cap applied to this node's calls. */
  perRunTokenCap: number;
  perRunTokenCapOverridden: boolean;
}

export interface CheckConfigReport {
  nodes: NodeReportRow[];
  decorrelation: {
    /**
     * True when both decorrelation clauses hold. False is only reachable
     * under TEST-MODE — outside it a violating config cannot load at all.
     */
    ok: boolean;
    synthesisFamily: VendorFamily;
    verifierFamily: VendorFamily;
    verifierNonAnthropic: boolean;
  };
  /** Present exactly when the config carries a `testMode` block. */
  testMode?: TestModeState;
  /** env-var → present, for every provider referenced by the config. */
  keys: Record<string, boolean>;
  budget: BudgetState;
}

export interface CheckConfigOptions {
  config?: RouterConfig;
  configPath?: string;
  env?: Record<string, string | undefined>;
  ledgerPath?: string;
  now?: () => number;
  /**
   * O10 cap overrides to report/apply (run-2 U8). checkConfig itself stays
   * sync and never fetches — the CLI fetches (fail-soft) and passes them in.
   */
  capOverrides?: CapOverrides;
}

/**
 * Build the operator report. Throws RouterConfigError when the config itself
 * is invalid (decorrelation violations included) — a returned report always
 * describes a valid config.
 */
export function checkConfig(opts: CheckConfigOptions = {}): CheckConfigReport {
  const config = opts.config ?? loadConfig(opts.configPath);
  const env = opts.env ?? process.env;
  const ledger = new BudgetLedger({
    config,
    ...(opts.ledgerPath !== undefined ? { ledgerPath: opts.ledgerPath } : {}),
    ...(opts.now !== undefined ? { now: opts.now } : {}),
    ...(opts.capOverrides !== undefined ? { overrides: opts.capOverrides } : {}),
  });

  const keys: Record<string, boolean> = {};
  for (const p of config.providers) {
    const v = env[p.envKey];
    keys[p.envKey] = v !== undefined && v.length > 0;
  }

  const nodes: NodeReportRow[] = LLM_NODE_IDS.map((nodeId) => {
    const n = config.nodes[nodeId];
    const provider = providerFor(config, n.model)!; // validated config ⇒ defined
    const caps = effectiveCapsFor(config, opts.capOverrides, nodeId);
    return {
      nodeId,
      model: n.model,
      family: provider.family,
      route: n.route,
      maxOutputTokens: n.maxOutputTokens,
      priceProvisional: config.prices[n.model]?.provisional === true,
      keyEnvVar: provider.envKey,
      keyPresent: keys[provider.envKey] === true,
      perDayUsdCap: caps.perDayUsd,
      perDayUsdCapOverridden: caps.perDayOverridden,
      perRunTokenCap: caps.perRunTokens,
      perRunTokenCapOverridden: caps.perRunOverridden,
    };
  });

  const synthesisFamily = familyOf(config, config.nodes.synthesis.model);
  const verifierFamily = familyOf(config, config.nodes.verifier.model);
  const verifierNonAnthropic = verifierFamily !== 'anthropic';
  return {
    nodes,
    decorrelation: {
      ok: synthesisFamily !== verifierFamily && verifierNonAnthropic,
      synthesisFamily,
      verifierFamily,
      verifierNonAnthropic,
    },
    ...(config.testMode !== undefined
      ? { testMode: { reason: config.testMode.reason, label: TEST_MODE_LABEL } }
      : {}),
    keys,
    budget: ledger.state(),
  };
}
