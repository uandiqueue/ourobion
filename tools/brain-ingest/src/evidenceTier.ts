/** Pure A5 evidence-tier projection: deterministic, rules-first, no I/O/LLM. */
import { createHash } from 'node:crypto';

import type { PaperRecord } from './types.js';

export type EvidenceTier = 1 | 2 | 3 | 4 | 5;
export type EvidenceClassificationStatus = 'classified' | 'unknown' | 'conflicted';
export type EvidenceSupervision =
  | 'publication-type'
  | 'mesh'
  | 'curator'
  | 'keyword'
  | 'floor'
  | 'conflict';

export interface EvidenceTierClassification {
  /** Direct rule result; null preserves uncertainty instead of pretending the floor is evidence. */
  tier: EvidenceTier | null;
  /** Numeric projection required by the existing Citation/CorpusDoc contract. */
  assignedTier: EvidenceTier;
  status: EvidenceClassificationStatus;
  supervision: EvidenceSupervision;
  reviewRequired: boolean;
  basis: readonly string[];
  inputsHash: `sha256:${string}`;
}

export type EvidenceTierInput = Pick<
  PaperRecord,
  | 'paperUid'
  | 'title'
  | 'abstract'
  | 'workType'
  | 'publicationTypes'
  | 'meshHeadings'
  | 'evidenceDesign'
>;

const PT_META = new Set(['D017418', 'D000078182']);
const PT_RCT = 'D016449';
const PT_RCT_AS_TOPIC = 'D016032';
const MESH_COHORT = 'D015331';
const MESH_CROSS_SECTIONAL = 'D003430';
const MESH_ANIMALS = 'D000818';
const MESH_HUMANS = 'D006801';

const designTier: Record<NonNullable<PaperRecord['evidenceDesign']>['design'], EvidenceTier> = {
  cohort: 3,
  longitudinal: 3,
  'cross-sectional': 2,
  mechanistic: 1,
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((key) => `${JSON.stringify(key)}:${canonical(o[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashInputs(input: EvidenceTierInput): `sha256:${string}` {
  const payload = {
    paperUid: input.paperUid,
    title: input.title ?? null,
    abstract: input.abstract ?? null,
    workType: input.workType ?? null,
    publicationTypes: [...(input.publicationTypes ?? [])]
      .map((value) => ({ ui: value.ui, name: value.name.trim() }))
      .sort((a, b) => canonical(a).localeCompare(canonical(b))),
    meshHeadings: [...(input.meshHeadings ?? [])]
      .map((value) => ({ ui: value.ui, name: value.name.trim(), majorTopic: value.majorTopic }))
      .sort((a, b) => canonical(a).localeCompare(canonical(b))),
    evidenceDesign: input.evidenceDesign ?? null,
  };
  return `sha256:${createHash('sha256').update(canonical(payload)).digest('hex')}`;
}

function result(
  input: EvidenceTierInput,
  tier: EvidenceTier | null,
  status: EvidenceClassificationStatus,
  supervision: EvidenceSupervision,
  basis: string[],
  reviewRequired: boolean,
): EvidenceTierClassification {
  return {
    tier,
    assignedTier: tier ?? 2,
    status,
    supervision,
    reviewRequired,
    basis,
    inputsHash: hashInputs(input),
  };
}

function chooseLayer(
  input: EvidenceTierInput,
  supervision: EvidenceSupervision,
  candidates: Array<{ tier: EvidenceTier; basis: string }>,
  reviewRequired: boolean,
): EvidenceTierClassification | null {
  if (candidates.length === 0) return null;
  const tiers = new Set(candidates.map((candidate) => candidate.tier));
  if (tiers.size > 1) {
    return result(
      input,
      null,
      'conflicted',
      'conflict',
      candidates.map((candidate) => `tier-${candidate.tier}:${candidate.basis}`),
      true,
    );
  }
  return result(input, candidates[0]!.tier, 'classified', supervision, candidates.map((c) => c.basis), reviewRequired);
}

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

export function classifyEvidenceTier(input: EvidenceTierInput): EvidenceTierClassification {
  const publicationCandidates: Array<{ tier: EvidenceTier; basis: string }> = [];
  for (const value of input.publicationTypes ?? []) {
    const name = normalized(value.name);
    if (value.ui === PT_RCT_AS_TOPIC || name === 'randomized controlled trials as topic') continue;
    if ((value.ui !== null && PT_META.has(value.ui)) || name === 'meta-analysis' || name === 'systematic review') {
      publicationCandidates.push({ tier: 5, basis: `publication-type:${value.ui ?? 'name'}:${value.name}` });
    } else if (value.ui === PT_RCT || name === 'randomized controlled trial') {
      publicationCandidates.push({ tier: 4, basis: `publication-type:${value.ui ?? 'name'}:${value.name}` });
    }
  }
  const mesh = input.meshHeadings ?? [];
  const hasAnimals = mesh.some((value) => value.ui === MESH_ANIMALS || normalized(value.name) === 'animals');
  const hasHumans = mesh.some((value) => value.ui === MESH_HUMANS || normalized(value.name) === 'humans');
  if (hasAnimals && !hasHumans) {
    return result(
      input,
      1,
      'classified',
      'mesh',
      [
        'mesh:Animals-without-Humans',
        ...publicationCandidates.map((candidate) => `capped:${candidate.basis}`),
      ],
      publicationCandidates.length > 0,
    );
  }
  const publication = chooseLayer(input, 'publication-type', publicationCandidates, false);
  if (publication !== null) return publication;
  const meshCandidates: Array<{ tier: EvidenceTier; basis: string }> = [];
  for (const value of mesh) {
    if (value.ui === MESH_COHORT || normalized(value.name) === 'cohort studies') {
      meshCandidates.push({ tier: 3, basis: `mesh:${value.ui ?? 'name'}:${value.name}` });
    } else if (value.ui === MESH_CROSS_SECTIONAL || normalized(value.name) === 'cross-sectional studies') {
      meshCandidates.push({ tier: 2, basis: `mesh:${value.ui ?? 'name'}:${value.name}` });
    }
  }
  const meshResult = chooseLayer(input, 'mesh', meshCandidates, false);
  if (meshResult !== null) return meshResult;

  if (input.evidenceDesign !== undefined) {
    return result(
      input,
      designTier[input.evidenceDesign.design],
      'classified',
      'curator',
      [`curator-design:${input.evidenceDesign.design}`],
      false,
    );
  }

  const workType = normalized(input.workType ?? '');
  const title = input.title ?? '';
  const abstract = input.abstract ?? '';
  const text = `${title}\n${abstract}`.toLowerCase();
  if (workType === 'review') {
    if (/\b(systematic review|meta-analysis|meta analysis)\b/.test(text)) {
      return result(input, 5, 'classified', 'keyword', ['review-candidate:systematic-or-meta'], true);
    }
    return result(input, null, 'unknown', 'floor', ['review-without-systematic-or-meta-corroboration'], true);
  }

  const animalAssisted = /\b(animal-assisted|equine-assisted|hippotherapy|service animal)\b/.test(text);
  const nonHumanTitle = !animalAssisted && /\b(mice|mouse|rats?|dogs?|canine|cats?|feline|pigs?|swine|horses?|equine|zebrafish|drosophila)\b/i.test(title);
  if (nonHumanTitle || /\b(in vitro|cell culture|animal model)\b/.test(text)) {
    return result(input, 1, 'classified', 'keyword', [nonHumanTitle ? 'keyword:non-human-title' : 'keyword:mechanistic'], true);
  }
  if (/\brandomi[sz](ed|ation)\b/.test(text)) {
    return result(input, 4, 'classified', 'keyword', ['keyword:randomized'], true);
  }
  if (/\b(cohort|longitudinal|prospective follow-up|retrospective follow-up)\b/.test(text)) {
    return result(input, 3, 'classified', 'keyword', ['keyword:cohort-or-longitudinal'], true);
  }
  if (/\bcross[- ]sectional\b/.test(text)) {
    return result(input, 2, 'classified', 'keyword', ['keyword:cross-sectional'], true);
  }
  return result(input, null, 'unknown', 'floor', ['conservative-tier-2-floor:no-design-signal'], true);
}
