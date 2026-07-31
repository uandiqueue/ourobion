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
import type { EvidenceTierClassification, EvidenceTierInput } from '../evidenceTier.js';
import { classifyEvidenceTier } from '../evidenceTier.js';
import type { PaperRecord } from '../types.js';

const EVIDENCE_TIERS: readonly number[] = [1, 2, 3, 4, 5];
const IMPACT_TIERS: readonly string[] = ['high', 'moderate', 'low', 'preprint'];

function classifierInputs(
  raw: unknown,
  paperId: string,
  title: string,
  fail: (detail: string) => never,
): EvidenceTierInput | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    fail('evidenceInputs must be an object when present');
  }
  const value = raw as Record<string, unknown>;
  if (!(value.abstract === null || typeof value.abstract === 'string')) {
    fail('evidenceInputs.abstract must be a string or null');
  }
  if (!(value.workType === null || typeof value.workType === 'string')) {
    fail('evidenceInputs.workType must be a string or null');
  }
  const publicationTypes = value.publicationTypes;
  if (publicationTypes !== undefined && (
    !Array.isArray(publicationTypes) ||
    publicationTypes.some((item) =>
      typeof item !== 'object' || item === null ||
      !(typeof (item as Record<string, unknown>).name === 'string') ||
      !((item as Record<string, unknown>).ui === null || typeof (item as Record<string, unknown>).ui === 'string'))
  )) fail('evidenceInputs.publicationTypes is invalid');
  const meshHeadings = value.meshHeadings;
  if (meshHeadings !== undefined && (
    !Array.isArray(meshHeadings) ||
    meshHeadings.some((item) =>
      typeof item !== 'object' || item === null ||
      !(typeof (item as Record<string, unknown>).name === 'string') ||
      !((item as Record<string, unknown>).ui === null || typeof (item as Record<string, unknown>).ui === 'string') ||
      typeof (item as Record<string, unknown>).majorTopic !== 'boolean')
  )) fail('evidenceInputs.meshHeadings is invalid');
  const evidenceDesign = value.evidenceDesign;
  if (evidenceDesign !== undefined) {
    if (typeof evidenceDesign !== 'object' || evidenceDesign === null || Array.isArray(evidenceDesign)) {
      fail('evidenceInputs.evidenceDesign is invalid');
    }
    const design = evidenceDesign as Record<string, unknown>;
    if (
      !['cohort', 'longitudinal', 'cross-sectional', 'mechanistic'].includes(String(design.design)) ||
      design.source !== 'curator' ||
      typeof design.attestedAt !== 'string' || Number.isNaN(Date.parse(design.attestedAt))
    ) fail('evidenceInputs.evidenceDesign is invalid');
  }
  return {
    paperUid: paperId,
    title,
    abstract: value.abstract as string | null,
    workType: value.workType as string | null,
    ...(publicationTypes !== undefined ? { publicationTypes: structuredClone(publicationTypes) as NonNullable<EvidenceTierInput['publicationTypes']> } : {}),
    ...(meshHeadings !== undefined ? { meshHeadings: structuredClone(meshHeadings) as NonNullable<EvidenceTierInput['meshHeadings']> } : {}),
    ...(evidenceDesign !== undefined ? { evidenceDesign: structuredClone(evidenceDesign) as NonNullable<EvidenceTierInput['evidenceDesign']> } : {}),
  };
}

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
  const evidenceInputs = classifierInputs(o.evidenceInputs, o.paperId as string, o.title as string, fail);
  let evidenceClassification: EvidenceTierClassification | undefined;
  if (evidenceInputs !== undefined) {
    evidenceClassification = classifyEvidenceTier(evidenceInputs);
    if (evidenceClassification.assignedTier !== o.evidenceTier) {
      fail('evidenceTier does not match the recomputed classifier result');
    }
  } else if (o.evidenceClassification !== undefined) {
    const c = o.evidenceClassification as Record<string, unknown>;
    if (
      typeof c !== 'object' || c === null ||
      !['classified', 'unknown', 'conflicted'].includes(String(c.status)) ||
      !(c.tier === null || (typeof c.tier === 'number' && EVIDENCE_TIERS.includes(c.tier))) ||
      typeof c.assignedTier !== 'number' || !EVIDENCE_TIERS.includes(c.assignedTier) ||
      !['publication-type', 'mesh', 'curator', 'keyword', 'floor', 'conflict'].includes(String(c.supervision)) ||
      typeof c.reviewRequired !== 'boolean' ||
      !Array.isArray(c.basis) || c.basis.some((value) => typeof value !== 'string') ||
      typeof c.inputsHash !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(c.inputsHash)
    ) {
      fail('evidenceClassification has an invalid uncertainty/provenance shape');
    }
    const classifiedMatches = c.status === 'classified' && c.tier === o.evidenceTier && c.assignedTier === o.evidenceTier;
    const floorMatches = c.status !== 'classified' && c.tier === null && c.assignedTier === 2 && o.evidenceTier === 2 && c.reviewRequired === true;
    if (!classifiedMatches && !floorMatches) {
      fail('classification must match evidenceTier, or use the explicit unknown/conflicted tier-2 review floor');
    }
    evidenceClassification = c as unknown as EvidenceTierClassification;
  }
  return {
    paperId: o.paperId as string,
    title: o.title as string,
    year: o.year as number | null,
    text: o.text as string,
    evidenceTier: o.evidenceTier as VerifyEvidenceTier,
    ...(evidenceInputs !== undefined ? {
      evidenceInputs: {
        abstract: evidenceInputs.abstract,
        workType: evidenceInputs.workType,
        ...(evidenceInputs.publicationTypes !== undefined ? { publicationTypes: evidenceInputs.publicationTypes } : {}),
        ...(evidenceInputs.meshHeadings !== undefined ? { meshHeadings: evidenceInputs.meshHeadings } : {}),
        ...(evidenceInputs.evidenceDesign !== undefined ? { evidenceDesign: evidenceInputs.evidenceDesign } : {}),
      },
    } : {}),
    ...(evidenceClassification !== undefined ? { evidenceClassification } : {}),
    impactTier: o.impactTier as VerifyImpactTier,
  };
}

/** Build the derived verifier corpus projection from truth-tier paper metadata + canonical text. */
export function buildCorpusDoc(
  paper: PaperRecord,
  text: string,
  impactTier: VerifyImpactTier,
): CorpusDoc {
  if (text.trim() === '') throw new Error(`verify corpus: paper '${paper.paperUid}' canonical text is empty`);
  const evidenceClassification = classifyEvidenceTier(paper);
  const evidenceInputs: NonNullable<CorpusDoc['evidenceInputs']> = {
    abstract: paper.abstract,
    workType: paper.workType ?? null,
    ...(paper.publicationTypes !== undefined ? { publicationTypes: structuredClone(paper.publicationTypes) } : {}),
    ...(paper.meshHeadings !== undefined ? { meshHeadings: structuredClone(paper.meshHeadings) } : {}),
    ...(paper.evidenceDesign !== undefined ? { evidenceDesign: structuredClone(paper.evidenceDesign) } : {}),
  };
  return {
    paperId: paper.paperUid,
    title: paper.title,
    year: paper.year,
    text,
    evidenceTier: evidenceClassification.assignedTier,
    evidenceInputs,
    evidenceClassification,
    impactTier,
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
