/**
 * Agentic seeder — orchestration + barrel (memory 0013 roster; design steps
 * 1–3). Wires the deterministic candidate builder to the LLM query-generation
 * call (through the shared `@ourobion/llm-router`) and the versioned artifact.
 *
 * Flow (a real run):
 *   load registry metrics + rule blueprints (`load.ts`) + static topics
 *   → buildCandidates (deterministic, C9: the only source of pairs)
 *   → buildSeederPrompt (one batched call for the lot)
 *   → router.route({ nodeId:'seeder', expectJson:true })  [local_agent mailbox]
 *   → validateSeederResponse (reject unknown pairs, dedupe, cap)
 *   → assembleArtifact → writeArtifact (data/corpus/seed-queries.json).
 *
 * `--candidates-only` stops after the deterministic build (no LLM); `--dry-run`
 * builds the prompt too but issues no router call and writes nothing.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import { join } from 'node:path';

import { LlmRouter } from '../../../llm-router/src/index.js';
import type { LlmRequest, LlmResponse } from '../../../llm-router/src/index.js';

import { SEEDS } from '../seeds.js';
import { buildCandidates, candidateCounts } from './candidates.js';
import { loadBlueprints, loadRegistryMetrics, repoRoot } from './load.js';
import { buildSeederPrompt, PROMPT_VERSION } from './prompt.js';
import { assembleArtifact, seedQueriesPath, writeArtifact } from './artifact.js';
import { DEFAULT_CAP_PER_CANDIDATE, validateSeederResponse } from './validate.js';
import type {
  BlueprintInput,
  RegistryMetricInput,
  SeedCandidate,
  SeedQueryArtifact,
  TopicInput,
} from './types.js';

/** Structural minimum of the router the seeder needs (injectable in tests). */
export interface SeederRouter {
  route(req: LlmRequest): Promise<LlmResponse>;
}

/** Default corpus dir (matches run.ts's `defaultCorpusDir`): `<repoRoot>/data/corpus`. */
export function defaultCorpusDir(root = repoRoot()): string {
  return join(root, 'data', 'corpus');
}

export interface SeederOptions {
  /** Where the artifact is written / the router run-state lives. */
  corpusDir?: string;
  /** Injected router (tests); default a real `LlmRouter` (local_agent per config). */
  router?: SeederRouter;
  /** Run identity for the router's per-run token cap. */
  runId?: string;
  /** Per-candidate query cap; default `DEFAULT_CAP_PER_CANDIDATE`. */
  capPerCandidate?: number;
  /** Injected registry metrics (tests); default loaded from `shared/metrics`. */
  metrics?: readonly RegistryMetricInput[];
  /** Injected blueprints (tests); default loaded from `data/rules`. */
  blueprints?: readonly BlueprintInput[];
  /**
   * Topic anchors; default the static `SEEDS`. The CLI passes the MERGED
   * static + `ingestion_seeds` pool (O14 seeds-as-data, `dbSeeds.ts`) so
   * human-added db seeds anchor candidates exactly like static topics — the
   * C9 pair gate is untouched (a topic anchor carries no metric pair and the
   * LLM still cannot add pairs).
   */
  topics?: readonly TopicInput[];
  now?: () => number;
  log?: (line: string) => void;
}

/**
 * Build the deterministic candidate list (design step 1). Loads the registry +
 * blueprints from disk unless injected. Used by `--candidates-only` and by the
 * full run.
 */
export async function enumerateSeederCandidates(
  opts: SeederOptions = {},
): Promise<SeedCandidate[]> {
  const root = repoRoot();
  const metrics = opts.metrics ?? (await loadRegistryMetrics(root));
  const blueprints = opts.blueprints ?? loadBlueprints(root);
  const topics = opts.topics ?? SEEDS;
  return buildCandidates({ metrics, blueprints, topics });
}

export interface GenerateResult {
  artifact: SeedQueryArtifact;
  path: string;
  candidates: SeedCandidate[];
  rejectedKeys: string[];
  missingIds: string[];
  response: LlmResponse;
}

/**
 * Keep each static topic's canonical source query in the derived artifact.
 *
 * The LLM adds search variants; it must not replace the hand-authored topic
 * anchor that justified the candidate. This is especially important for named
 * instruments (IBS-SSS, PHQ-9, and peers), which a plausible paraphrase can
 * otherwise erase. Anchor-first ordering also makes the behavior deterministic.
 */
export function retainTopicAnchorQueries(
  byId: Map<string, string[]>,
  topics: readonly TopicInput[],
  capPerCandidate: number,
): string[] {
  if (capPerCandidate <= 0) return [];
  const retained: string[] = [];
  for (const topic of topics) {
    const anchor = topic.query.trim();
    if (anchor.length === 0) continue;
    const id = `st:${topic.topic}`;
    const current = byId.get(id);
    if (current === undefined) continue;
    const withoutDuplicate = current.filter(
      (query) => query.toLowerCase() !== anchor.toLowerCase(),
    );
    byId.set(id, [anchor, ...withoutDuplicate].slice(0, capPerCandidate));
    retained.push(id);
  }
  return retained;
}

/**
 * Full run (design steps 1–3): candidates → batched LLM call → validate → write
 * the artifact. Returns the artifact plus the validation report (rejected /
 * missing) for the caller to log as run evidence.
 */
export async function generateSeedQueries(opts: SeederOptions = {}): Promise<GenerateResult> {
  const log = opts.log ?? (() => {});
  const corpusDir = opts.corpusDir ?? defaultCorpusDir();
  const cap = opts.capPerCandidate ?? DEFAULT_CAP_PER_CANDIDATE;

  const candidates = await enumerateSeederCandidates(opts);
  const counts = candidateCounts(candidates);
  log(
    `seeder: ${candidates.length} candidate(s) — derivedFrom=${counts.derivedFrom} ` +
      `rule_blueprint=${counts.rule_blueprint} static_topic=${counts.static_topic}`,
  );

  const { system, prompt } = buildSeederPrompt(candidates);
  // U8/D13 carry-forward: construct via the async factory so nao-edited cap
  // overrides (llm_router_cap_overrides) bind this real pipeline call.
  // Fail-soft: absent env / unreachable Supabase → file caps + one warning.
  const router: SeederRouter =
    opts.router ??
    (await LlmRouter.create({ ...(opts.runId !== undefined ? { runId: opts.runId } : {}) }));

  const response = await router.route({ nodeId: 'seeder', system, prompt, expectJson: true });

  const validated = validateSeederResponse(response.text, candidates, cap);
  const { byId, rejectedKeys } = validated;
  const topics = opts.topics ?? SEEDS;
  const retainedTopicIds = retainTopicAnchorQueries(byId, topics, cap);
  const missingIds = validated.missingIds.filter((id) => (byId.get(id)?.length ?? 0) === 0);
  if (rejectedKeys.length > 0) {
    log(`seeder: dropped ${rejectedKeys.length} unknown key(s) (C9): ${rejectedKeys.join(', ')}`);
  }
  if (missingIds.length > 0) {
    log(`seeder: ${missingIds.length} candidate(s) received no queries: ${missingIds.join(', ')}`);
  }
  log(`seeder: retained ${retainedTopicIds.length} canonical topic query anchor(s)`);

  const artifact = assembleArtifact({
    candidates,
    byId,
    promptVersion: PROMPT_VERSION,
    model: response.model,
    route: response.route,
    ...(opts.now !== undefined ? { now: opts.now } : {}),
  });
  const path = writeArtifact(corpusDir, artifact);
  log(`seeder: wrote ${artifact.candidates.length} candidate(s) → ${path}`);

  return { artifact, path, candidates, rejectedKeys, missingIds, response };
}

export { buildCandidates, candidateCounts } from './candidates.js';
export { buildSeederPrompt, PROMPT_VERSION, SEEDER_SYSTEM } from './prompt.js';
export { validateSeederResponse, DEFAULT_CAP_PER_CANDIDATE } from './validate.js';
export {
  assembleArtifact,
  readArtifact,
  writeArtifact,
  seedQueriesPath,
  seedsFromArtifact,
  SEED_QUERIES_FILE,
} from './artifact.js';
export { loadBlueprints, loadRegistryMetrics, repoRoot } from './load.js';
export { fetchDbSeeds, mergeSeeds, loadMergedSeeds } from './dbSeeds.js';
export type { FetchDbSeedsOptions, MergedSeeds } from './dbSeeds.js';
export type * from './types.js';
