/**
 * The `seed-queries.json` artifact (design step 3): assemble, persist, read, and
 * project into ingestion `Seed`s.
 *
 * The artifact is a rebuildable PROJECTION (two-tier-truth, memory 0001) — never
 * hand-edited. It lives under the brain-ingest run-state dir (`data/corpus/`,
 * already gitignored — same home as the manifest + usage), atomically written
 * (tmp + rename) so a reader never sees a half-written file. Regenerate by
 * re-running `seed-queries`.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Seed } from '../types.js';
import { candidateCounts } from './candidates.js';
import type { SeedCandidate, SeedQueryArtifact, SeedQueryEntry } from './types.js';

/** Artifact filename inside the corpus dir. */
export const SEED_QUERIES_FILE = 'seed-queries.json';

/** Absolute artifact path for a given corpus dir. */
export function seedQueriesPath(corpusDir: string): string {
  return join(corpusDir, SEED_QUERIES_FILE);
}

export interface AssembleInput {
  candidates: readonly SeedCandidate[];
  byId: Map<string, string[]>;
  promptVersion: string;
  model: string;
  route: string;
  now?: () => number;
}

/** Assemble the versioned artifact from candidates + their validated queries. */
export function assembleArtifact(input: AssembleInput): SeedQueryArtifact {
  const now = input.now ?? Date.now;
  const entries: SeedQueryEntry[] = input.candidates.map((c) => ({
    id: c.id,
    source: c.source,
    metricKeys: c.metricKeys,
    ...(c.topic !== undefined ? { topic: c.topic } : {}),
    label: c.label,
    queries: input.byId.get(c.id) ?? [],
  }));
  return {
    schemaVersion: 1,
    generatedAt: new Date(now()).toISOString(),
    promptVersion: input.promptVersion,
    model: input.model,
    route: input.route,
    counts: candidateCounts(input.candidates),
    candidates: entries,
  };
}

/** Persist the artifact atomically (tmp + rename). Creates the dir if missing. */
export function writeArtifact(corpusDir: string, artifact: SeedQueryArtifact): string {
  mkdirSync(corpusDir, { recursive: true });
  const path = seedQueriesPath(corpusDir);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(artifact, null, 2) + '\n', 'utf8');
  renameSync(tmp, path);
  return path;
}

/**
 * Read the artifact if present + parseable, else `undefined` (the caller falls
 * back to the static `seeds.ts` topics — the fallback stays soft). A malformed
 * or wrong-version file is treated as absent rather than throwing, so a stale
 * projection never wedges a run.
 */
export function readArtifact(corpusDir: string): SeedQueryArtifact | undefined {
  const path = seedQueriesPath(corpusDir);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined;
  const a = parsed as Partial<SeedQueryArtifact>;
  if (a.schemaVersion !== 1 || !Array.isArray(a.candidates)) return undefined;
  return a as SeedQueryArtifact;
}

/**
 * Project the artifact into ingestion `Seed`s: one `Seed` per (candidate, query)
 * so every generated query drives a discovery pass. `topic` is the candidate id
 * (stable, unique per query is not required — the run unions topicTags per
 * candidate); `topicTags` carries the candidate's metric keys (or the topic slug
 * for a static-topic anchor) onto every discovered `PaperRecord`.
 *
 * Candidates with no queries contribute nothing.
 */
export function seedsFromArtifact(artifact: SeedQueryArtifact): Seed[] {
  const seeds: Seed[] = [];
  for (const c of artifact.candidates) {
    const tags = c.metricKeys.length > 0 ? c.metricKeys : c.topic !== undefined ? [c.topic] : [];
    for (const query of c.queries) {
      seeds.push({ topic: c.id, query, topicTags: [...tags] });
    }
  }
  return seeds;
}
