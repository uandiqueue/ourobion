/**
 * A10 · Fixture-corpus loader for verifier-owned retrieval (O15/B1).
 *
 * The verifier's corpus-internal retrieval rung ranks {@link CorpusDoc}s, but until
 * this cycle NOTHING fed it on a real CLI run (`runVerify` never set
 * `retrieve.corpus`, so every run searched an empty corpus). This module loads a
 * committed LOCAL corpus file — JSONL, one CorpusDoc per line — so `brain-ingest
 * verify --corpus <path>` runs grounded retrieval offline. A live-retrieval
 * adapter (A6 co-occurrence index / discovery-backed corpus) is a LATER cycle.
 *
 * Parsing FAILS LOUDLY: a malformed line, a bad shape, or a duplicate paperId
 * throws with the line number, rather than silently verifying against a partial
 * corpus (a truth-adjacent input must not degrade quietly).
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import { readFileSync } from 'node:fs';

import type { CorpusDoc, VerifyEvidenceTier, VerifyImpactTier } from './types.js';

const EVIDENCE_TIERS: readonly number[] = [1, 2, 3, 4, 5];
const IMPACT_TIERS: readonly string[] = ['high', 'moderate', 'low', 'preprint'];

/** Validate one parsed JSONL record as a CorpusDoc; throws naming `where` on violation. */
export function parseCorpusDoc(raw: unknown, where: string): CorpusDoc {
  const fail = (detail: string): never => {
    throw new Error(`verify corpus: ${where}: ${detail}`);
  };
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    fail('each line must be a JSON object (a CorpusDoc)');
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.paperId !== 'string' || o.paperId.length === 0) fail('paperId must be a non-empty string');
  if (typeof o.title !== 'string' || o.title.length === 0) fail('title must be a non-empty string');
  if (o.year !== null && (typeof o.year !== 'number' || !Number.isInteger(o.year))) {
    fail('year must be an integer or null');
  }
  if (typeof o.text !== 'string' || o.text.trim().length === 0) {
    fail('text must be a non-empty string (the canonical extracted text retrieval ranks + evidence quotes)');
  }
  if (typeof o.evidenceTier !== 'number' || !EVIDENCE_TIERS.includes(o.evidenceTier)) {
    fail('evidenceTier must be 1..5');
  }
  if (typeof o.impactTier !== 'string' || !IMPACT_TIERS.includes(o.impactTier)) {
    fail(`impactTier must be one of ${IMPACT_TIERS.join('|')}`);
  }
  return {
    paperId: o.paperId as string,
    title: o.title as string,
    year: o.year as number | null,
    text: o.text as string,
    evidenceTier: o.evidenceTier as VerifyEvidenceTier,
    impactTier: o.impactTier as VerifyImpactTier,
  };
}

/**
 * Parse a JSONL corpus (one CorpusDoc per line; blank lines skipped; BOM
 * tolerated). Throws with the offending line number on any malformed line,
 * invalid doc, or duplicate paperId. `source` names the input in errors.
 */
export function loadCorpusFromText(text: string, source = 'corpus'): CorpusDoc[] {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const docs: CorpusDoc[] = [];
  const seen = new Set<string>();
  const lines = clean.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim() === '') continue;
    const where = `${source}:${i + 1}`;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch (err) {
      throw new Error(
        `verify corpus: ${where}: invalid JSON — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const doc = parseCorpusDoc(raw, where);
    if (seen.has(doc.paperId)) {
      throw new Error(`verify corpus: ${where}: duplicate paperId '${doc.paperId}'`);
    }
    seen.add(doc.paperId);
    docs.push(doc);
  }
  return docs;
}

/** Read + parse a JSONL corpus file from disk (fails loudly — see module docstring). */
export function loadCorpusFromFile(path: string): CorpusDoc[] {
  return loadCorpusFromText(readFileSync(path, 'utf8'), path);
}

/**
 * paperId → canonical text map over the corpus. A corpus supplied to the CLI also
 * serves the A9 quoteCheck for papers it contains (the R2 text loader fills any
 * cited id the corpus lacks — see cli.ts runVerify).
 */
export function corpusTexts(docs: readonly CorpusDoc[]): Map<string, string> {
  return new Map(docs.map((d) => [d.paperId, d.text]));
}
