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
import { AttemptJournal, providerContentSha256 } from './attemptJournal.js';
import { BudgetLedger, costUsd, type BudgetState } from './budget.js';
import {
  familyOf,
  loadConfig,
  providerFor,
  resolveRepoPath,
  validateConfig,
  type RouterConfig,
} from './config.js';
import { RouterAttemptJournalError, RouterConfigError } from './errors.js';
import {
  effectiveCapsFor,
  fetchCapOverrides,
  type CapOverrides,
  type FetchCapOverridesOptions,
} from './overrides.js';
import {
  callApiWorker,
  canonicalizeProviderContent,
  type ApiWorkerOptions,
} from './routes/apiWorker.js';
import { requestLocalAgent } from './routes/localAgent.js';
import {
  estimateTokens,
  LLM_NODE_IDS,
  ACCEPTANCE_MAX_INPUT_BYTES,
  ACCEPTANCE_MAX_OUTPUT_TOKENS,
  ACCEPTANCE_JOURNAL_REPO_PATH,
  DEFAULT_RAW_BODY_CAP_BYTES,
  type LlmNodeId,
  type LlmRequest,
  type LlmResponse,
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
  /**
   * R4-U3 raw-body retention for api_worker calls. DEFAULTS TO RETAINED — the
   * point of the retention is that the provider evidence cannot be lost, so it is
   * opt-OUT (for a caller with a specific reason), never opt-in.
   */
  retainRawBody?: boolean;
  /** Byte cap for a retained raw body (default DEFAULT_RAW_BODY_CAP_BYTES). */
  rawBodyCapBytes?: number;
}

export class LlmRouter {
  readonly config: RouterConfig;
  readonly runId: string;
  private readonly ledger: BudgetLedger;
  private readonly opts: LlmRouterOptions;

  constructor(opts: LlmRouterOptions = {}) {
    this.opts = opts;
    this.config = opts.config === undefined
      ? loadConfig(opts.configPath)
      : validateConfig(structuredClone(opts.config));
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
    const acceptance = req.acceptance;
    const family = this.familyOfNode(req.nodeId);
    const canonicalContent = family === null ? undefined : canonicalizeProviderContent(req, family);
    const maxOutputTokens = acceptance === undefined
      ? (req.maxOutputTokens ?? node.maxOutputTokens)
      : ACCEPTANCE_MAX_OUTPUT_TOKENS;

    if (acceptance !== undefined) {
      if (this.config.acceptance?.journalPath !== ACCEPTANCE_JOURNAL_REPO_PATH) {
        throw new RouterAttemptJournalError(
          'llm-router acceptance: config must bind the fixed router-owned journal path',
        );
      }
      if ('journalPath' in (acceptance as unknown as Record<string, unknown>)) {
        throw new RouterAttemptJournalError(
          'llm-router acceptance: callers cannot select or override the router-owned journal path',
        );
      }
      if (node.route !== 'api_worker') {
        throw new RouterAttemptJournalError('llm-router acceptance: local_agent routes are not provider evidence');
      }
      if (req.maxOutputTokens !== undefined && req.maxOutputTokens !== ACCEPTANCE_MAX_OUTPUT_TOKENS) {
        throw new RouterAttemptJournalError(
          `llm-router acceptance: maxOutputTokens is fixed at ${ACCEPTANCE_MAX_OUTPUT_TOKENS}`,
        );
      }
      if (req.expectJson !== true) {
        throw new RouterAttemptJournalError('llm-router acceptance: expectJson must be true');
      }
      if (this.opts.retainRawBody === false) {
        throw new RouterAttemptJournalError('llm-router acceptance: raw response retention cannot be disabled');
      }
      if (
        this.opts.rawBodyCapBytes !== undefined &&
        this.opts.rawBodyCapBytes !== DEFAULT_RAW_BODY_CAP_BYTES
      ) {
        throw new RouterAttemptJournalError(
          `llm-router acceptance: raw body cap is fixed at ${DEFAULT_RAW_BODY_CAP_BYTES} bytes`,
        );
      }
      const inputBytes = canonicalContent!.inputBytes;
      if (inputBytes > ACCEPTANCE_MAX_INPUT_BYTES) {
        throw new RouterAttemptJournalError(
          `llm-router acceptance: prompt is ${inputBytes} bytes; ceiling is ${ACCEPTANCE_MAX_INPUT_BYTES}`,
        );
      }
      const correctLeg =
        (req.nodeId === 'synthesis' && family === 'anthropic') ||
        (req.nodeId === 'verifier' && family === 'agnes');
      if (!correctLeg) {
        throw new RouterAttemptJournalError(
          'llm-router acceptance: only Anthropic synthesis and Agnes verification are authorized',
        );
      }
      if (this.config.prices[node.model]?.provisional !== false) {
        throw new RouterAttemptJournalError(
          `llm-router acceptance: model '${node.model}' lacks an authoritative non-provisional price`,
        );
      }
    }

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
        ...(acceptance !== undefined
          ? { maxAttempts: Math.min(this.opts.maxAttempts ?? 3, 3) }
          : this.opts.maxAttempts !== undefined ? { maxAttempts: this.opts.maxAttempts } : {}),
        ...(this.opts.baseDelayMs !== undefined ? { baseDelayMs: this.opts.baseDelayMs } : {}),
        ...(acceptance !== undefined
          ? { retainRawBody: true, rawBodyCapBytes: DEFAULT_RAW_BODY_CAP_BYTES }
          : this.opts.retainRawBody !== undefined ? { retainRawBody: this.opts.retainRawBody } : {}),
        ...(acceptance === undefined && this.opts.rawBodyCapBytes !== undefined
          ? { rawBodyCapBytes: this.opts.rawBodyCapBytes }
          : {}),
        ...(acceptance !== undefined ? {
          attemptJournal: {
            journal: new AttemptJournal(resolveRepoPath(ACCEPTANCE_JOURNAL_REPO_PATH), {
              ...(this.opts.now !== undefined ? { now: this.opts.now } : {}),
              allowedRoot: resolveRepoPath('data/llm-router'),
            }),
            input: {
              acceptanceRunId: acceptance.acceptanceRunId,
              logicalCallId: acceptance.logicalCallId,
              nodeId: req.nodeId,
              providerFamily: this.familyOfNode(req.nodeId)!,
              model: node.model,
              promptHash: providerContentSha256(canonicalContent!.serialized),
              inputByteCeiling: ACCEPTANCE_MAX_INPUT_BYTES,
              outputTokenCeiling: ACCEPTANCE_MAX_OUTPUT_TOKENS,
              // One token per permitted UTF-8 byte is deliberately conservative
              // and includes far more headroom than estimateTokens' 4 chars/token.
              reservedUsd: costUsd(this.config, node.model, {
                inputTokens: ACCEPTANCE_MAX_INPUT_BYTES,
                outputTokens: ACCEPTANCE_MAX_OUTPUT_TOKENS,
              }),
            },
          },
        } : {}),
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
    // R4-U4 follow-on (B-BR1/B-BR2): the ROUTE knows whether the provider returned
    // an identity; only the ROUTER sees the whole config, so it fills the two
    // config-derived members here. Neither can promote an unattested identity —
    // `providerAttested` is decided at the route and never rewritten.
    const completed: LlmResponse = {
      ...response,
      modelIdentity: {
        ...response.modelIdentity,
        family: response.modelIdentity.family ?? this.familyOfNode(req.nodeId),
        decorrelatedFromSynthesis: this.decorrelatedFromSynthesis(req.nodeId),
      },
    };
    if (acceptance !== undefined) {
      const returnedFamily = providerFor(this.config, completed.modelIdentity.model)?.family;
      if (
        !completed.modelIdentity.providerAttested ||
        returnedFamily !== completed.modelIdentity.family ||
        completed.rawBody === undefined ||
        completed.rawBody.truncated
      ) {
        throw new RouterAttemptJournalError(
          'llm-router acceptance: provider identity/raw response evidence is missing, mismatched, or truncated',
        );
      }
    }
    return completed;
  }

  /** Configured vendor family for a node, or null when the model matches no provider. */
  private familyOfNode(nodeId: LlmNodeId): VendorFamily | null {
    const node = this.config.nodes[nodeId];
    if (node === undefined) return null;
    return providerFor(this.config, node.model)?.family ?? null;
  }

  /**
   * O7 / B-BR2 decorrelation for one node: true only when its configured family
   * DIFFERS from the synthesis node's family. null when either family is
   * unresolvable. FAIL CLOSED: this never returns true on missing information.
   *
   * R4-U3 removed the test-mode short-circuit that hard-returned false here; the
   * invariant is now enforced at config load, so a router that constructed at all
   * has a decorrelated verifier and this reports the real comparison.
   */
  private decorrelatedFromSynthesis(nodeId: LlmNodeId): boolean | null {
    const own = this.familyOfNode(nodeId);
    const synthesis = this.familyOfNode('synthesis');
    if (own === null || synthesis === null) return null;
    return own !== synthesis;
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
     * True when family(verifier) !== family(synthesis). A config loaded through
     * `loadConfig` can never report false — the invariant is a load failure. It
     * stays a reported field because `checkConfig` also accepts a caller-supplied
     * `config` object that bypassed validation.
     */
    ok: boolean;
    synthesisFamily: VendorFamily;
    verifierFamily: VendorFamily;
  };
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
  return {
    nodes,
    decorrelation: {
      ok: synthesisFamily !== verifierFamily,
      synthesisFamily,
      verifierFamily,
    },
    keys,
    budget: ledger.state(),
  };
}
