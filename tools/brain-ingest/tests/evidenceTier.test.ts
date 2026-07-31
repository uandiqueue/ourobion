import assert from 'node:assert/strict';
import { test } from 'node:test';

import { classifyEvidenceTier, type EvidenceTierInput } from '../src/evidenceTier.js';
import type { PaperRecord } from '../src/types.js';
import { buildCorpusDoc, parseCorpusDoc } from '../src/verify/corpus.js';

const paper = (over: Record<string, unknown> = {}): EvidenceTierInput => ({
  paperUid: 'paper:test',
  title: 'A study',
  abstract: null,
  workType: null,
  ...over,
}) as EvidenceTierInput;
const pt = (name: string, ui: string | null = null) => ({ name, ui });
const mesh = (name: string, ui: string | null) => ({ name, ui, majorTopic: false });

test('exact PT UI/name maps only systematic/meta and RCT; RCT-as-topic is refused', () => {
  assert.equal(classifyEvidenceTier(paper({ publicationTypes: [pt('Meta-Analysis', 'D017418')] })).tier, 5);
  assert.equal(classifyEvidenceTier(paper({ publicationTypes: [pt('Systematic Review', 'D000078182')] })).tier, 5);
  assert.equal(classifyEvidenceTier(paper({ publicationTypes: [pt('Randomized Controlled Trial', 'D016449')] })).tier, 4);
  const decoy = classifyEvidenceTier(paper({
    publicationTypes: [pt('Randomized Controlled Trials as Topic', 'D016032')],
  }));
  assert.deepEqual({ tier: decoy.tier, assigned: decoy.assignedTier, review: decoy.reviewRequired },
    { tier: null, assigned: 2, review: true });
});

test('PublicationType never supplies tiers 1-3; MeSH supplies cohort/cross-sectional', () => {
  for (const name of ['Cohort Studies', 'Cross-Sectional Studies', 'Animals']) {
    assert.equal(classifyEvidenceTier(paper({ publicationTypes: [pt(name)] })).tier, null);
  }
  assert.equal(classifyEvidenceTier(paper({ meshHeadings: [mesh('Cohort Studies', 'D015331')] })).tier, 3);
  assert.equal(classifyEvidenceTier(paper({ meshHeadings: [mesh('Cross-Sectional Studies', 'D003430')] })).tier, 2);
});

test('Animals without Humans is tier 1; Animals plus Humans is not', () => {
  const animals = mesh('Animals', 'D000818');
  const humans = mesh('Humans', 'D006801');
  assert.equal(classifyEvidenceTier(paper({ meshHeadings: [animals] })).tier, 1);
  const mixed = classifyEvidenceTier(paper({ meshHeadings: [animals, humans] }));
  assert.equal(mixed.tier, null);
  assert.equal(mixed.assignedTier, 2);
  assert.equal(mixed.reviewRequired, true);
});

test('Animals-without-Humans caps RCT/meta publication types before promotion', () => {
  const animals = mesh('Animals', 'D000818');
  for (const publicationType of [
    pt('Randomized Controlled Trial', 'D016449'),
    pt('Meta-Analysis', 'D017418'),
  ]) {
    const classified = classifyEvidenceTier(paper({
      publicationTypes: [publicationType],
      meshHeadings: [animals],
    }));
    assert.equal(classified.tier, 1);
    assert.equal(classified.reviewRequired, true);
    assert.match(classified.basis.join(' '), /capped:publication-type/);
  }
});

test('curator designs map tiers 1-3; conflicting strong PT evidence stays explicit', () => {
  const at = '2026-07-31T00:00:00.000Z';
  assert.equal(classifyEvidenceTier(paper({ evidenceDesign: { design: 'mechanistic', source: 'curator', attestedAt: at } })).tier, 1);
  assert.equal(classifyEvidenceTier(paper({ evidenceDesign: { design: 'cross-sectional', source: 'curator', attestedAt: at } })).tier, 2);
  assert.equal(classifyEvidenceTier(paper({ evidenceDesign: { design: 'cohort', source: 'curator', attestedAt: at } })).tier, 3);
  const conflicted = classifyEvidenceTier(paper({ publicationTypes: [
    pt('Randomized Controlled Trial', 'D016449'),
    pt('Meta-Analysis', 'D017418'),
  ] }));
  assert.equal(conflicted.status, 'conflicted');
  assert.equal(conflicted.tier, null);
  assert.equal(conflicted.assignedTier, 2);
});

test('keyword residue covers each tier but is review-required; narrative review stays floor', () => {
  const cases: Array<[string, EvidenceTierInput, number]> = [
    ['mechanistic', paper({ abstract: 'Cells were studied in vitro.' }), 1],
    ['cross-sectional', paper({ abstract: 'A cross-sectional survey was performed.' }), 2],
    ['cohort', paper({ abstract: 'A longitudinal cohort was followed.' }), 3],
    ['randomized', paper({ abstract: 'Participants were randomized to groups.' }), 4],
    ['systematic review', paper({ workType: 'review', title: 'A systematic review of studies' }), 5],
  ];
  for (const [label, input, tier] of cases) {
    const classified = classifyEvidenceTier(input);
    assert.equal(classified.tier, tier, label);
    assert.equal(classified.reviewRequired, true, label);
  }
  const narrative = classifyEvidenceTier(paper({ workType: 'review', title: 'A review of randomized trials' }));
  assert.deepEqual({ tier: narrative.tier, assignedTier: narrative.assignedTier, status: narrative.status },
    { tier: null, assignedTier: 2, status: 'unknown' });
});

test('classification hash changes with retained PT, MeSH, or paper identity', () => {
  const a = classifyEvidenceTier(paper({ publicationTypes: [pt('Systematic Review', 'D000078182')] }));
  const b = classifyEvidenceTier(paper({ meshHeadings: [mesh('Cohort Studies', 'D015331')] }));
  const c = classifyEvidenceTier({ ...paper({ publicationTypes: [pt('Systematic Review', 'D000078182')] }), paperUid: 'paper:other' });
  assert.notEqual(a.inputsHash, b.inputsHash);
  assert.notEqual(a.inputsHash, c.inputsHash);
});

test('CorpusDoc builder applies the explicit tier-2 floor as a derived review projection', () => {
  const record = { ...paper({ title: 'No design metadata' }), year: null } as unknown as PaperRecord;
  const doc = buildCorpusDoc(record, 'Canonical text.', 'moderate');
  assert.equal(doc.evidenceTier, 2);
  assert.equal(doc.evidenceClassification?.tier, null);
  assert.equal(doc.evidenceClassification?.assignedTier, 2);
  assert.equal(doc.evidenceClassification?.reviewRequired, true);
  assert.doesNotThrow(() => parseCorpusDoc(doc, 'test:floor'));
  assert.throws(() => parseCorpusDoc({ ...doc, evidenceTier: 1 }, 'test:bad-floor'), /does not match the recomputed classifier result/);
});

test('CorpusDoc load recomputes classifier/hash and ignores standalone labels', () => {
  const evidenceInputs = {
    abstract: null,
    workType: null,
    publicationTypes: [pt('Meta-Analysis', 'D017418')],
    meshHeadings: [],
  };
  const raw = {
    paperId: 'paper:meta',
    title: 'Meta study',
    year: 2026,
    text: 'Canonical evidence.',
    evidenceTier: 5,
    evidenceInputs,
    evidenceClassification: {
      tier: 1,
      assignedTier: 1,
      status: 'classified',
      supervision: 'curator',
      reviewRequired: false,
      basis: ['untrusted'],
      inputsHash: `sha256:${'0'.repeat(64)}`,
    },
    impactTier: 'moderate',
  };
  const parsed = parseCorpusDoc(raw, 'test:recompute');
  assert.equal(parsed.evidenceClassification?.tier, 5);
  assert.notEqual(parsed.evidenceClassification?.inputsHash, raw.evidenceClassification.inputsHash);
  assert.throws(
    () => parseCorpusDoc({ ...raw, evidenceTier: 1 }, 'test:mismatch'),
    /does not match the recomputed classifier result/,
  );
});
