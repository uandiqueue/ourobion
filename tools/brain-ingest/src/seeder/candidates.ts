/**
 * Candidate builder — the DETERMINISTIC half of the seeder (design step 1).
 *
 * Enumerates candidate relationship targets from three sources, deduplicates,
 * and emits them in a STABLE order:
 *   (a) every registry metric with `derivedFrom[]` → one (metric ← input) pair
 *       per input (order carries direction);
 *   (b) metric pairs co-named by a shipped rule blueprint → the unordered pairs
 *       of a blueprint's `metricKeys` (a single-metric blueprint contributes
 *       none — current MVP rules are all single-metric, so this yields 0 today,
 *       and lights up automatically when a cross-metric blueprint lands);
 *   (c) the six static topics as domain anchors.
 *
 * This list is the ONLY source of pairs (C9, phase2-run-config): the LLM must
 * not add pairs — its job downstream is phrasing search queries for these known
 * candidates. Pure: no I/O, no network, no dynamic import — inputs are handed in
 * (loaded by `load.ts` for a real run, or fixtures in tests).
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import type {
  BlueprintInput,
  RegistryMetricInput,
  SeedCandidate,
  TopicInput,
} from './types.js';

export interface BuildCandidatesInput {
  metrics: readonly RegistryMetricInput[];
  blueprints: readonly BlueprintInput[];
  topics: readonly TopicInput[];
}

/** Unordered canonical key for a metric pair (dedup across sources). */
function pairKey(a: string, b: string): string {
  return `pair:${[a, b].sort().join('|')}`;
}

/** Every unordered pair (i<j) of a blueprint's metric keys, in index order. */
function unorderedPairs(keys: readonly string[]): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i];
      const b = keys[j];
      if (a !== undefined && b !== undefined && a !== b) out.push([a, b]);
    }
  }
  return out;
}

/**
 * Build the deduplicated, stably-ordered candidate list. Order:
 * derivedFrom (registry order → input order) → rule_blueprint (ruleId order →
 * pair order) → static_topic (topic order). A later duplicate of a pair already
 * emitted by an earlier (higher-priority) source is dropped; static-topic
 * anchors dedupe by topic slug.
 */
/**
 * #307 · Metrics that measure the APP, not the person, and are therefore never subjects of
 * SCIENTIFIC discovery.
 *
 * Found the hard way. A bounded-ingestion run seeded from the agentic artifact carried SEVEN
 * `log_completeness__*` candidates — `__mood_score`, `__gut_comfort_score`, `__energy_score`,
 * `__urine_colour`, `__stool_form`, `__outside_meals`, `__mosquito_bites`. Each asks the literature
 * about our own logging-completeness metric. The run was killed during discovery, before anything
 * was resolved, fetched or stored, so no corpus was polluted — but nothing in the code prevented it,
 * only noticing.
 *
 * The exclusion belongs HERE rather than in a hand-maintained artifact, because `buildCandidates`
 * derives pairs MECHANICALLY from registry `derivedFrom[]`: any metric other metrics derive from
 * becomes a discovery subject automatically, whether or not it describes a person. The gap ledger
 * shows the same shape independently — 15 of its 29 rows pair something against `log_completeness`,
 * which is why it is not a selection input either.
 *
 * These stay in the registry and stay derivable. They are excluded only from being asked ABOUT.
 */
export const NON_SCIENTIFIC_METRIC_KEYS: ReadonlySet<string> = new Set(['log_completeness', 'notes']);

export function buildCandidates(input: BuildCandidatesInput): SeedCandidate[] {
  const out: SeedCandidate[] = [];
  const seenPairs = new Set<string>();
  const seenTopics = new Set<string>();

  // (a) registry derivedFrom — active metrics only (a deprecated metric is not a
  //     live relationship target). Direction preserved: [derived, input].
  for (const m of input.metrics) {
    if (m.status !== 'active') continue;
    if (m.derivedFrom === null) continue;
    // #307: an app-measuring metric is not a scientific-discovery subject, on EITHER side of a pair.
    if (NON_SCIENTIFIC_METRIC_KEYS.has(m.key)) continue;
    for (const inputKey of m.derivedFrom) {
      if (inputKey === m.key) continue;
      if (NON_SCIENTIFIC_METRIC_KEYS.has(inputKey)) continue;
      const key = pairKey(m.key, inputKey);
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      out.push({
        id: `df:${m.key}__${inputKey}`,
        source: 'derivedFrom',
        metricKeys: [m.key, inputKey],
        label: `Relationship between "${m.key}" and its derivation input "${inputKey}"`,
      });
    }
  }

  // (b) rule blueprints — pairs co-named by one blueprint. Sort by ruleId for a
  //     stable, OS-independent order (fs enumeration order is not guaranteed).
  const orderedBlueprints = [...input.blueprints].sort((x, y) =>
    x.ruleId < y.ruleId ? -1 : x.ruleId > y.ruleId ? 1 : 0,
  );
  for (const bp of orderedBlueprints) {
    if (bp.status !== undefined && bp.status !== 'active') continue;
    for (const [a, b] of unorderedPairs(bp.metricKeys)) {
      // #307: same exclusion as the derivedFrom source above. A blueprint may legitimately name an
      // app-measuring metric (a completeness-gated rule is a real rule), but that does not make it a
      // scientific-discovery subject — so the RULE stays valid while the discovery pair is dropped.
      if (NON_SCIENTIFIC_METRIC_KEYS.has(a) || NON_SCIENTIFIC_METRIC_KEYS.has(b)) continue;
      const key = pairKey(a, b);
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      const [s0, s1] = [a, b].sort();
      out.push({
        id: `rb:${s0}__${s1}`,
        source: 'rule_blueprint',
        metricKeys: [s0!, s1!],
        label: `Relationship between "${s0}" and "${s1}" (co-named by rule "${bp.ruleId}")`,
      });
    }
  }

  // (c) static topics — domain anchors (no metric pair).
  for (const t of input.topics) {
    if (seenTopics.has(t.topic)) continue;
    seenTopics.add(t.topic);
    out.push({
      id: `st:${t.topic}`,
      source: 'static_topic',
      metricKeys: [],
      topic: t.topic,
      label: `Domain literature for "${t.topic}" (${t.query})`,
    });
  }

  return out;
}

/** Per-source tally of a candidate list (session-log evidence / artifact). */
export function candidateCounts(
  candidates: readonly SeedCandidate[],
): Record<SeedCandidate['source'], number> {
  const counts = { derivedFrom: 0, rule_blueprint: 0, static_topic: 0 };
  for (const c of candidates) counts[c.source]++;
  return counts;
}
