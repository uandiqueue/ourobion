/**
 * LLM-router core types (memory 0013 execution constraint; architecture §10.1;
 * phase2-run-config C6–C7).
 *
 * Every LLM node in the brain pipeline dispatches through this router, which
 * supports exactly two routes per node:
 *  - `local_agent` — keyless: a filesystem mailbox fulfilled by the hosting
 *    Claude Code (or equivalent) agent session (`routes/localAgent.ts`);
 *  - `api_worker`  — metered: native-fetch adapters for the Anthropic Messages
 *    API and the OpenAI Chat Completions API (`routes/apiWorker.ts`).
 *
 * Node ids map onto the §10.1 inventory:
 *  - `seeder`           — agentic research-query seeder (memory 0013 roster)
 *  - `synthesis`        — A8 RelationshipClaim synthesis
 *  - `verifier`         — A10 adversarial verification (MUST be non-Anthropic
 *                         and a different vendor family than `synthesis` —
 *                         enforced at config load, see `config.ts`)
 *  - `phrasing_card`    — S8 grounded card phrasing (cheap tier)
 *  - `report_narrative` — S9 report narrative
 *  - `extract_assist`   — A4 role-tagging / A5 tiering assist (cheap tier)
 *
 * ESM / NodeNext — imports use explicit `.js` extensions. No network here.
 */

/** The six LLM nodes of the brain pipeline (see module docstring for mapping). */
export type LlmNodeId =
  | 'seeder'
  | 'synthesis'
  | 'verifier'
  | 'phrasing_card'
  | 'report_narrative'
  | 'extract_assist';

export const LLM_NODE_IDS: readonly LlmNodeId[] = [
  'seeder',
  'synthesis',
  'verifier',
  'phrasing_card',
  'report_narrative',
  'extract_assist',
] as const;

/** The two execution routes every node supports (memory 0013). */
export type RouteKind = 'local_agent' | 'api_worker';

/** Vendor family used for the decorrelation invariant. */
export type VendorFamily = 'anthropic' | 'openai' | 'google';

/** A single-turn request from a pipeline node. */
export interface LlmRequest {
  /** Which pipeline node is asking — resolves model/route/budget from config. */
  nodeId: LlmNodeId;
  /** Optional system prompt. */
  system?: string;
  /** The user-turn prompt. */
  prompt: string;
  /**
   * Output-token ceiling for this call; defaults to the node's configured
   * `maxOutputTokens`. Also used as the worst-case output estimate for the
   * pre-call budget check.
   */
  maxOutputTokens?: number;
  /**
   * Sampling temperature — passed through verbatim when set. NOTE: current
   * Anthropic models (claude-sonnet-5) reject non-default sampling params;
   * leave unset unless the configured model is known to accept it.
   */
  temperature?: number;
  /**
   * When true the caller expects a single JSON object as the reply. The
   * OpenAI adapter maps this to `response_format: {type: "json_object"}`;
   * the Anthropic adapter and the mailbox pass the expectation through as an
   * instruction (Anthropic has no equivalent single-turn switch on this
   * surface without structured-output schemas, which nodes don't need yet).
   */
  expectJson?: boolean;
}

/** Token usage for one call (as reported by the provider, or estimated). */
export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

/** A completed routed call. */
export interface LlmResponse {
  /** The model's text reply (JSON text when `expectJson` was honoured). */
  text: string;
  usage: LlmUsage;
  /** The model that actually answered (config model, or provider-reported). */
  model: string;
  /** Which route served the call. */
  route: RouteKind;
}

/**
 * Crude token estimate used ONLY for budget accounting when a route cannot
 * report real usage (the local-agent mailbox) and for pre-call input-cost
 * estimates. ~4 chars/token is the conventional rough figure.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
