/**
 * Router config: load + validate `router.config.json` (phase2-run-config C6–C7).
 *
 * Validation is plain TS (no zod — matches the brain-ingest house style) and
 * FAILS LOUDLY at load. The load-bearing invariant is **decorrelation**
 * (memory 0013 / architecture §10.1 / brain-synthesis-design):
 *
 *   family(nodes.synthesis.model) !== family(nodes.verifier.model)
 *   family(nodes.verifier.model)  !== 'anthropic'
 *
 * A same-family verifier shares the synthesizer's blind spots and rubber-stamps
 * it; per §10.1 the verifier is explicitly non-Anthropic. No config that
 * violates this can be constructed.
 *
 * Paths in the config (`budget.ledgerPath`, `localAgent.mailboxDir`) are
 * repo-root-relative and resolved via `resolveRepoPath` — no hardcoded absolute
 * paths anywhere (mirrors brain-ingest `limits/budget.ts`'s defaultCorpusDir).
 *
 * ESM / NodeNext — imports use explicit `.js` extensions. No network.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, resolve } from 'node:path';
import { LLM_NODE_IDS, type LlmNodeId, type RouteKind, type VendorFamily } from './types.js';
import { RouterConfigError } from './errors.js';

/** Per-node routing entry. */
export interface NodeConfig {
  /** Exact model id (C6) — lives here, never in node code. */
  model: string;
  /** Which route serves this node right now (both are always implementable). */
  route: RouteKind;
  /** Default output-token ceiling per call. */
  maxOutputTokens: number;
}

/** Model-id prefix → vendor family + the env var holding that vendor's key. */
export interface ProviderEntry {
  prefix: string;
  family: VendorFamily;
  envKey: string;
}

/** Per-model price row (C7; provisional until real runs calibrate). */
export interface PriceEntry {
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
  /** All shipped prices are provisional — kept explicit so reports can say so. */
  provisional?: boolean;
}

/** Budget caps (C7). */
export interface BudgetConfig {
  /** Output-token cap per run (200k shipped). */
  perRunOutputTokens: number;
  /** USD cap per UTC day per node/stage ($5 shipped). */
  perDayUsdPerNode: number;
  /** Hard-stop fraction — refuse the call that would cross this (0.95 shipped). */
  hardStopFraction: number;
  /** Ledger file, repo-root-relative unless absolute. */
  ledgerPath: string;
  /**
   * Ledger retention window in days (A11): day/run entries whose UTC day is
   * strictly older are pruned on ledger load/persist. Optional —
   * defaults to `DEFAULT_RETENTION_DAYS` (30) in budget.ts, so pre-existing
   * configs stay valid.
   */
  retentionDays?: number;
}

/** Local-agent mailbox defaults. */
export interface LocalAgentConfig {
  /** Mailbox dir, repo-root-relative unless absolute. */
  mailboxDir: string;
  timeoutMs: number;
  pollIntervalMs: number;
}

export interface RouterConfig {
  version: 1;
  nodes: Record<LlmNodeId, NodeConfig>;
  providers: ProviderEntry[];
  prices: Record<string, PriceEntry>;
  budget: BudgetConfig;
  localAgent: LocalAgentConfig;
}

const VALID_ROUTES: readonly RouteKind[] = ['local_agent', 'api_worker'];
const VALID_FAMILIES: readonly VendorFamily[] = ['anthropic', 'openai', 'google'];

/** tools/llm-router/src → up 2 = tools/llm-router, up 4 = repo root. */
export function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url)); // .../tools/llm-router/src
  return resolve(here, '..', '..', '..');
}

/** Resolve a config path: absolute stays; relative is repo-root-relative. */
export function resolveRepoPath(p: string): string {
  return isAbsolute(p) ? p : resolve(repoRoot(), p);
}

/** Default checked-in config file. */
export function defaultConfigPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', 'router.config.json');
}

function fail(msg: string): never {
  throw new RouterConfigError(`llm-router config: ${msg}`);
}

function isPositiveInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n > 0;
}

function isPositiveNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/**
 * First provider entry whose prefix matches wins (entries are checked in
 * config order). Returns undefined when no prefix matches.
 */
export function providerFor(config: RouterConfig, model: string): ProviderEntry | undefined {
  return config.providers.find((p) => model.startsWith(p.prefix));
}

/** Vendor family of a model id, or a loud failure if unmapped. */
export function familyOf(config: RouterConfig, model: string): VendorFamily {
  const entry = providerFor(config, model);
  if (entry === undefined) {
    fail(
      `model '${model}' matches no provider prefix — add a providers[] entry mapping its prefix to a vendor family`,
    );
  }
  return entry.family;
}

/**
 * Validate an already-parsed config object. Returns the same object, typed.
 * Enforces: shape, all six nodes present, every node model resolves to a
 * family and has a price row, budget sanity, and the DECORRELATION INVARIANT.
 */
export function validateConfig(raw: unknown): RouterConfig {
  if (raw === null || typeof raw !== 'object') fail('config must be a JSON object');
  const c = raw as Partial<RouterConfig>;

  if (c.version !== 1) fail(`unsupported config version ${String(c.version)} (expected 1)`);

  // providers
  if (!Array.isArray(c.providers) || c.providers.length === 0) {
    fail('providers must be a non-empty array');
  }
  for (const p of c.providers) {
    if (typeof p?.prefix !== 'string' || p.prefix.length === 0) fail('providers[].prefix must be a non-empty string');
    if (!VALID_FAMILIES.includes(p.family as VendorFamily)) {
      fail(`providers[].family '${String(p?.family)}' is not one of ${VALID_FAMILIES.join('|')}`);
    }
    if (typeof p.envKey !== 'string' || p.envKey.length === 0) fail('providers[].envKey must be a non-empty string');
  }

  // prices
  if (c.prices === null || typeof c.prices !== 'object') fail('prices must be an object');
  for (const [model, price] of Object.entries(c.prices as Record<string, PriceEntry>)) {
    if (!isPositiveNumber(price?.inputUsdPerMTok) || !isPositiveNumber(price?.outputUsdPerMTok)) {
      fail(`prices['${model}'] must carry positive inputUsdPerMTok/outputUsdPerMTok`);
    }
  }

  // nodes
  if (c.nodes === null || typeof c.nodes !== 'object') fail('nodes must be an object');
  const nodes = c.nodes as Record<string, NodeConfig>;
  for (const id of LLM_NODE_IDS) {
    const n = nodes[id];
    if (n === undefined) fail(`nodes.${id} is missing — all six pipeline nodes must be configured`);
    if (typeof n.model !== 'string' || n.model.length === 0) fail(`nodes.${id}.model must be a non-empty string`);
    if (!VALID_ROUTES.includes(n.route)) {
      fail(`nodes.${id}.route '${String(n.route)}' is not one of ${VALID_ROUTES.join('|')}`);
    }
    if (!isPositiveInt(n.maxOutputTokens)) fail(`nodes.${id}.maxOutputTokens must be a positive integer`);
  }
  for (const key of Object.keys(nodes)) {
    if (!(LLM_NODE_IDS as readonly string[]).includes(key)) fail(`nodes.${key} is not a known node id`);
  }

  // budget
  const b = c.budget as BudgetConfig | undefined;
  if (b === undefined || typeof b !== 'object') fail('budget must be an object');
  if (!isPositiveInt(b.perRunOutputTokens)) fail('budget.perRunOutputTokens must be a positive integer');
  if (!isPositiveNumber(b.perDayUsdPerNode)) fail('budget.perDayUsdPerNode must be a positive number');
  if (
    typeof b.hardStopFraction !== 'number' ||
    !(b.hardStopFraction > 0 && b.hardStopFraction <= 1)
  ) {
    fail('budget.hardStopFraction must be in (0, 1]');
  }
  if (typeof b.ledgerPath !== 'string' || b.ledgerPath.length === 0) fail('budget.ledgerPath must be a non-empty string');
  if (b.retentionDays !== undefined && !isPositiveInt(b.retentionDays)) {
    fail('budget.retentionDays must be a positive integer when set');
  }

  // localAgent
  const la = c.localAgent as LocalAgentConfig | undefined;
  if (la === undefined || typeof la !== 'object') fail('localAgent must be an object');
  if (typeof la.mailboxDir !== 'string' || la.mailboxDir.length === 0) fail('localAgent.mailboxDir must be a non-empty string');
  if (!isPositiveInt(la.timeoutMs)) fail('localAgent.timeoutMs must be a positive integer');
  if (!isPositiveInt(la.pollIntervalMs)) fail('localAgent.pollIntervalMs must be a positive integer');

  const config = c as RouterConfig;

  // Every node model must resolve to a family and have a price row.
  for (const id of LLM_NODE_IDS) {
    const model = config.nodes[id].model;
    familyOf(config, model); // throws when unmapped
    if (config.prices[model] === undefined) {
      fail(`nodes.${id}.model '${model}' has no prices[] entry — budget accounting would be blind`);
    }
  }

  // THE DECORRELATION INVARIANT (memory 0013 / §10.1). Fail loudly.
  const synthesisFamily = familyOf(config, config.nodes.synthesis.model);
  const verifierFamily = familyOf(config, config.nodes.verifier.model);
  if (synthesisFamily === verifierFamily) {
    fail(
      `decorrelation violated: synthesis ('${config.nodes.synthesis.model}', ${synthesisFamily}) and ` +
        `verifier ('${config.nodes.verifier.model}', ${verifierFamily}) are the same vendor family — ` +
        `a same-family verifier shares the synthesizer's blind spots (memory 0013)`,
    );
  }
  if (verifierFamily === 'anthropic') {
    fail(
      `decorrelation violated: verifier ('${config.nodes.verifier.model}') is Anthropic-family — ` +
        `per architecture §10.1 the verifier MUST be non-Anthropic`,
    );
  }

  return config;
}

/** Load + validate the config file (default: the checked-in router.config.json). */
export function loadConfig(configPath?: string): RouterConfig {
  const path = configPath ?? defaultConfigPath();
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    fail(`cannot read/parse '${path}': ${err instanceof Error ? err.message : String(err)}`);
  }
  return validateConfig(raw);
}
