/**
 * Agentic-seeder types (memory 0013 roster; phase-2-plan §"Agentic seeder";
 * architecture §10.1 pipeline-entry variant).
 *
 * The seeder turns the metric registry's `derivedFrom[]` relationships + the
 * shipped rule blueprints' co-named metrics + the six static topic anchors into
 * scholarly search queries for the ingestion discovery adapters
 * (Crossref/PubMed/EuropePMC/arXiv/S2). It supersedes the static topic list
 * (`seeds.ts`), which stays as the bootstrap/fallback.
 *
 * House pattern (matches `verify/quoteCheck.ts`): this package does NOT import
 * `shared/` — the registry + blueprint shapes are STRUCTURAL MIRRORS here, and
 * the real data is loaded at runtime via `load.ts` (dynamic import + fs). The
 * types below are the only surface the pure candidate builder + validator use.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

/** Where a candidate relationship target came from (its provenance). */
export type CandidateSource = 'derivedFrom' | 'rule_blueprint' | 'static_topic';

/**
 * One candidate the seeder will ask the LLM to phrase search queries for. The
 * candidate list is the ONLY source of pairs (C9 — the LLM must not invent new
 * pairs; its job is phrasing queries for KNOWN candidates).
 *
 *  - `derivedFrom`  — a (derived metric ← input metric) pair from the registry;
 *    `metricKeys` is `[derivedMetric, inputMetric]` (order carries direction).
 *  - `rule_blueprint` — two metrics co-named by a shipped rule blueprint;
 *    `metricKeys` is the pair, lexicographically sorted (undirected).
 *  - `static_topic` — one of the six domain anchors; `metricKeys` is empty and
 *    `topic` carries the seed slug.
 */
export interface SeedCandidate {
  /** Stable id — the JSON key the LLM response is validated against. */
  id: string;
  source: CandidateSource;
  /** The metric key(s) this candidate names; `[]` for a static-topic anchor. */
  metricKeys: string[];
  /** Seed slug — present only for `static_topic` candidates. */
  topic?: string;
  /** Human-readable description handed to the LLM (what to search for). */
  label: string;
}

/**
 * Structural mirror of the registry's `MetricDefinition` — only the fields the
 * candidate builder reads. The real values are loaded at runtime from
 * `shared/metrics/registry.ts` (see `load.ts`).
 */
export interface RegistryMetricInput {
  key: string;
  status: string;
  /** For source:'derived' — the metric keys it is computed from; null otherwise. */
  derivedFrom: readonly string[] | null;
}

/**
 * Structural mirror of the slice of a rule blueprint the seeder reads: the
 * metric keys a rule names together. A blueprint naming ≥2 keys contributes the
 * unordered pairs of those keys.
 */
export interface BlueprintInput {
  ruleId: string;
  metricKeys: readonly string[];
  status?: string;
}

/** Structural mirror of a static `Seed` (topic anchor input). */
export interface TopicInput {
  topic: string;
  query: string;
  topicTags: readonly string[];
}

/** One candidate's generated queries in the output artifact. */
export interface SeedQueryEntry {
  id: string;
  source: CandidateSource;
  metricKeys: string[];
  topic?: string;
  label: string;
  /** Search-engine-ready queries (deduped, capped, stable order). */
  queries: string[];
}

/**
 * The versioned `seed-queries.json` artifact — a rebuildable projection (never
 * truth), written under the pipeline's gitignored data layout (`data/corpus/`).
 */
export interface SeedQueryArtifact {
  schemaVersion: 1;
  generatedAt: string;
  promptVersion: string;
  /** The model that actually answered (as reported by the router response). */
  model: string;
  /** Which router route served the generation call. */
  route: string;
  /** Per-source candidate tallies (audit / session-log evidence). */
  counts: Record<CandidateSource, number>;
  candidates: SeedQueryEntry[];
}
