/**
 * Response validation + deterministic post-processing (design step 2).
 *
 * The LLM reply is untrusted text. This module:
 *   1. parses it as JSON (a non-object / malformed body is a hard error);
 *   2. REJECTS any key not in the candidate list (logged + dropped) — enforcing
 *      C9 (the LLM may not add pairs);
 *   3. per candidate: trims, drops empties, dedupes case-insensitively, and caps
 *      at `capPerCandidate` — producing a stable, deterministic query set.
 *
 * Missing candidates (the model returned no queries for an id) yield an empty
 * array, logged. Pure: no I/O.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import type { SeedCandidate } from './types.js';

/** Default per-candidate query cap (design step 2: "cap per candidate (config)"). */
export const DEFAULT_CAP_PER_CANDIDATE = 6;

export interface ValidateResult {
  /** candidate id → cleaned, capped queries (every candidate present). */
  byId: Map<string, string[]>;
  /** response keys not in the candidate list (dropped). */
  rejectedKeys: string[];
  /** candidate ids the response omitted or left empty. */
  missingIds: string[];
}

/** Dedupe queries case-insensitively, preserving first-seen order. */
function dedupeQueries(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of raw) {
    if (typeof q !== 'string') continue;
    const trimmed = q.trim();
    if (trimmed.length === 0) continue;
    const norm = trimmed.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(trimmed);
  }
  return out;
}

/**
 * Validate + post-process the seeder LLM reply against the candidate list.
 * Throws on malformed JSON / a non-object top level (the router promised a JSON
 * object via `expectJson`); everything else is handled gracefully.
 */
export function validateSeederResponse(
  text: string,
  candidates: readonly SeedCandidate[],
  capPerCandidate: number = DEFAULT_CAP_PER_CANDIDATE,
): ValidateResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `seeder: response was not valid JSON — ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('seeder: response JSON was not a keyed object of candidate ids → queries');
  }

  const known = new Set(candidates.map((c) => c.id));
  const record = parsed as Record<string, unknown>;

  const rejectedKeys: string[] = [];
  for (const key of Object.keys(record)) {
    if (!known.has(key)) rejectedKeys.push(key);
  }

  const byId = new Map<string, string[]>();
  const missingIds: string[] = [];
  for (const c of candidates) {
    const cleaned = dedupeQueries(record[c.id]).slice(0, Math.max(0, capPerCandidate));
    byId.set(c.id, cleaned);
    if (cleaned.length === 0) missingIds.push(c.id);
  }

  return { byId, rejectedKeys, missingIds };
}
