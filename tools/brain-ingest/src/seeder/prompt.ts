/**
 * Prompt construction for the seeder's query-generation call (design step 2).
 *
 * One prompt covers the whole candidate batch (one router call for the lot, not
 * one per candidate). The LLM's job is narrow and phrasing-only: for each KNOWN
 * candidate, produce scholarly, search-engine-ready queries for the discovery
 * adapters (Crossref / PubMed / Europe PMC / arXiv / Semantic Scholar). It must
 * NOT invent candidates (C9) — the response is validated against the candidate
 * ids and any unknown key is dropped.
 *
 * `PROMPT_VERSION` is the projection's provenance stamp — bump it when the
 * prompt text changes so a re-run's artifact is attributable.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import type { SeedCandidate } from './types.js';

/** Bump on any change to the system/prompt text below (artifact provenance). */
export const PROMPT_VERSION = 'seeder-2026-08-01.2';

export const SEEDER_SYSTEM = [
  'You are the ourobion brain pipeline\'s research-query seeder.',
  'You turn a fixed list of candidate metric relationships into scholarly search',
  'queries for academic discovery APIs (Crossref, PubMed, Europe PMC, arXiv,',
  'Semantic Scholar).',
  '',
  'Rules:',
  '- Work ONLY with the candidates given. Never invent new candidates, metrics,',
  '  or relationships. The JSON keys in your reply MUST be exactly the candidate',
  '  ids provided — no others.',
  '- For each candidate, write concise queries a scholarly search engine would',
  '  match: prefer domain terminology and MeSH-style vocabulary, spell out',
  '  synonyms of the underlying physiological concept (not the raw snake_case',
  '  metric key), and cover BOTH directions of the relationship where relevant.',
  '- Queries are free-text search strings (2–8 words typical), not boolean DSL.',
  '- Preserve named instruments and acronyms from a static-topic target verbatim',
  '  in at least one query for that candidate (for example IBS-SSS or PHQ-9).',
  '- 3 to 6 queries per candidate. No duplicates. No commentary.',
  '- Reply with a SINGLE JSON object and nothing else: keys are candidate ids,',
  '  values are arrays of query strings.',
].join('\n');

/** Render the candidate block the user turn lists for the model. */
function candidateBlock(candidates: readonly SeedCandidate[]): string {
  return candidates
    .map((c) => {
      const metrics = c.metricKeys.length > 0 ? ` [metrics: ${c.metricKeys.join(', ')}]` : '';
      return `- id: ${c.id}\n  source: ${c.source}\n  target: ${c.label}${metrics}`;
    })
    .join('\n');
}

/**
 * Build the `{ system, prompt }` for the batch. The prompt restates the output
 * contract inline (the mailbox/`expectJson` path appends its own instruction,
 * but a self-describing prompt keeps the artifact reproducible from the request
 * file alone).
 */
export function buildSeederPrompt(candidates: readonly SeedCandidate[]): {
  system: string;
  prompt: string;
} {
  const ids = candidates.map((c) => c.id);
  const prompt = [
    `Generate scholarly search queries for these ${candidates.length} candidate(s).`,
    '',
    candidateBlock(candidates),
    '',
    'Return a single JSON object whose keys are EXACTLY these candidate ids:',
    JSON.stringify(ids),
    'and whose values are arrays of 3–6 distinct query strings each.',
  ].join('\n');
  return { system: SEEDER_SYSTEM, prompt };
}
