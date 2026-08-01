/**
 * Tests for the REAL verifier-corpus builder (src/verify/corpusBuild.ts).
 *
 * The point of the module is HONESTY, so that is what these assert:
 *  - `evidenceTier` is the deterministic classifier's, never hand-assigned —
 *    proven by round-tripping emitted lines through `loadCorpusFromText`, which
 *    RE-RUNS `classifyEvidenceTier` and rejects any line whose tier disagrees;
 *  - `impactTier` comes from the per-ISSN venue cache + C8 banding, and an
 *    unresolvable venue takes the repo's own conservative unscored band
 *    (`EXTERNAL_DEFAULT_IMPACT_TIER`), never a flattering guess;
 *  - `text` is real canonical text or the real abstract, with `textSource`
 *    recording which — and a paper with NEITHER is SKIPPED and counted rather
 *    than padded with a placeholder body;
 *  - no network: the venue resolver reads only the cache, never OpenAlex.
 *
 * NO network, NO provider, NO R2.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildCorpusRows,
  cachedVenueImpactResolver,
  serializeCorpusRows,
  textDirLoader,
} from '../src/verify/corpusBuild.js';
import { loadCorpusFromText } from '../src/verify/corpus.js';
import { EXTERNAL_DEFAULT_IMPACT_TIER } from '../src/verify/retrieval.js';
import { classifyEvidenceTier } from '../src/evidenceTier.js';
import { encodeKeySegment } from '../src/storage/r2.js';
import { VenueCache } from '../src/venue/cache.js';
import type { VenueInfo } from '../src/venue/openalexSources.js';
import type { PaperRecord } from '../src/types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function paper(over: Partial<PaperRecord> & { paperUid: string }): PaperRecord {
  return {
    title: 'A study of sleep and heart rate variability',
    authors: [],
    year: 2020,
    venue: 'Journal of Sleep',
    abstract: 'We measured resting heart rate variability across a night of sleep in adults.',
    discoveredVia: 'openalex',
    topicTags: ['sleep_hrv'],
    oa: { isOa: true, status: 'gold', bestOaUrl: null, license: null, version: null },
    storage: { kind: 'none' },
    fullText: { extracted: false, method: null, charCount: null },
    status: 'discovered',
    errors: [],
    fetchedAt: null,
    ...over,
  } as unknown as PaperRecord;
}

function venueInfo(over: Partial<VenueInfo> & { issn: string }): VenueInfo {
  return {
    resolved: true,
    sourceId: 'S1',
    displayName: 'Journal of Sleep',
    type: 'journal',
    issnL: over.issn,
    hIndex: 10,
    twoYrMeanCitedness: 1,
    isCore: true,
    worksCount: 100,
    fetchedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'corpus-build-'));
}

// ─────────────────────────────────────────────────────────────────────────────
// evidenceTier — the classifier's, and recomputable
// ─────────────────────────────────────────────────────────────────────────────

test('evidenceTier is the deterministic classifier output, not hand-assigned', () => {
  // An RCT publication type is a tier-4 rule in src/evidenceTier.ts.
  const rct = paper({
    paperUid: 'doi:10/rct',
    publicationTypes: [{ ui: 'D016449', name: 'Randomized Controlled Trial' }],
  } as Partial<PaperRecord> & { paperUid: string });
  // A meta-analysis is tier 5. Different inputs MUST yield different tiers —
  // a builder that defaulted everything to one value would fail this.
  const meta = paper({
    paperUid: 'doi:10/meta',
    publicationTypes: [{ ui: 'D017418', name: 'Meta-Analysis' }],
  } as Partial<PaperRecord> & { paperUid: string });

  const { rows } = buildCorpusRows([rct, meta]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.doc.evidenceTier, 4);
  assert.equal(rows[1]!.doc.evidenceTier, 5);
  // And each equals what the classifier says for that record, by construction.
  assert.equal(rows[0]!.doc.evidenceTier, classifyEvidenceTier(rct).assignedTier);
  assert.equal(rows[1]!.doc.evidenceTier, classifyEvidenceTier(meta).assignedTier);
});

test('emitted docs carry evidenceInputs + evidenceClassification so the tier is recomputable', () => {
  const { rows } = buildCorpusRows([
    paper({
      paperUid: 'doi:10/cohort',
      meshHeadings: [{ ui: 'D015331', name: 'Cohort Studies', majorTopic: true }],
    } as Partial<PaperRecord> & { paperUid: string }),
  ]);
  const doc = rows[0]!.doc;
  assert.ok(doc.evidenceInputs, 'evidenceInputs must be present');
  assert.ok(doc.evidenceClassification, 'evidenceClassification must be present');
  assert.equal(doc.evidenceClassification!.supervision, 'mesh');
  assert.match(doc.evidenceClassification!.inputsHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(doc.evidenceTier, 3);
});

test('serialized corpus round-trips through the strict loader, which re-runs the classifier', () => {
  const records = [
    paper({ paperUid: 'doi:10/a' }),
    paper({
      paperUid: 'doi:10/b',
      publicationTypes: [{ ui: 'D016449', name: 'Randomized Controlled Trial' }],
    } as Partial<PaperRecord> & { paperUid: string }),
    paper({
      paperUid: 'doi:10/c',
      meshHeadings: [
        { ui: 'D000818', name: 'Animals', majorTopic: false },
      ],
    } as Partial<PaperRecord> & { paperUid: string }),
  ];
  const { rows } = buildCorpusRows(records);
  const jsonl = serializeCorpusRows(rows);

  // loadCorpusFromText recomputes classifyEvidenceTier per line and throws if
  // the emitted evidenceTier disagrees — so a pass proves the tiers are real.
  const docs = loadCorpusFromText(jsonl, 'generated');
  assert.equal(docs.length, 3);
  assert.deepEqual(docs.map((d) => d.evidenceTier), rows.map((r) => r.doc.evidenceTier));
  assert.equal(docs[2]!.evidenceTier, 1, 'Animals-without-Humans is the tier-1 mesh rule');
});

test('a tampered evidenceTier is rejected by the loader (the tier cannot be faked)', () => {
  const { rows } = buildCorpusRows([
    paper({
      paperUid: 'doi:10/b',
      publicationTypes: [{ ui: 'D016449', name: 'Randomized Controlled Trial' }],
    } as Partial<PaperRecord> & { paperUid: string }),
  ]);
  const line = JSON.parse(serializeCorpusRows(rows).trim()) as Record<string, unknown>;
  line['evidenceTier'] = 5; // hand-promote it
  assert.throws(
    () => loadCorpusFromText(JSON.stringify(line), 'tampered'),
    /does not match the recomputed classifier result/,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// text — real canonical text or real abstract, never synthesised
// ─────────────────────────────────────────────────────────────────────────────

test('canonical extracted text is preferred and recorded as the source', () => {
  const p = paper({ paperUid: 'doi:10/full' });
  const { rows, stats } = buildCorpusRows([p], {
    loadText: () => 'Full extracted body text of the paper.',
  });
  assert.equal(rows[0]!.doc.text, 'Full extracted body text of the paper.');
  assert.equal(rows[0]!.textSource, 'canonical-text');
  assert.equal(stats.byTextSource['canonical-text'], 1);
});

test('abstract is the fallback body, verbatim, and is recorded as such', () => {
  const p = paper({ paperUid: 'doi:10/abs' });
  const { rows, stats } = buildCorpusRows([p]);
  assert.equal(rows[0]!.doc.text, p.abstract);
  assert.equal(rows[0]!.textSource, 'abstract');
  assert.equal(stats.byTextSource.abstract, 1);
});

test('a paper with neither canonical text nor abstract is SKIPPED and counted, never padded', () => {
  const p = paper({ paperUid: 'doi:10/empty', abstract: null });
  const { rows, skips, stats } = buildCorpusRows([p]);
  assert.equal(rows.length, 0, 'no placeholder doc may be emitted');
  assert.equal(stats.skipped, 1);
  assert.equal(skips[0]!.reason, 'no-text');
  assert.equal(skips[0]!.paperId, 'doi:10/empty');
  assert.equal(stats.bySkipReason['no-text'], 1);
});

test('a blank/whitespace abstract counts as no text (not an empty body)', () => {
  const { rows, skips } = buildCorpusRows([paper({ paperUid: 'doi:10/ws', abstract: '   \n  ' })]);
  assert.equal(rows.length, 0);
  assert.equal(skips[0]!.reason, 'no-text');
});

test('an extracted-but-unreachable full text is skipped with a distinguishing detail', () => {
  const p = paper({
    paperUid: 'doi:10/r2only',
    abstract: null,
    fullText: { extracted: true, method: 'jats', charCount: 5000 },
  } as Partial<PaperRecord> & { paperUid: string });
  const { skips } = buildCorpusRows([p]);
  assert.equal(skips[0]!.reason, 'no-text');
  assert.match(skips[0]!.detail!, /not reachable offline/);
});

test('a titleless record is skipped rather than emitted with a fabricated title', () => {
  const { rows, skips } = buildCorpusRows([paper({ paperUid: 'doi:10/untitled', title: '  ' })]);
  assert.equal(rows.length, 0);
  assert.equal(skips[0]!.reason, 'no-title');
});

test('a duplicate paperUid is skipped (the loader forbids duplicate paperIds)', () => {
  const { rows, skips, stats } = buildCorpusRows([
    paper({ paperUid: 'doi:10/dup' }),
    paper({ paperUid: 'doi:10/dup' }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(skips[0]!.reason, 'duplicate-paper-id');
  assert.equal(stats.emitted, 1);
  // And the emitted corpus therefore loads cleanly.
  assert.equal(loadCorpusFromText(serializeCorpusRows(rows), 'dedup').length, 1);
});

test('textDirLoader reads the R2 text/<uid>.txt layout and falls back when absent or blank', () => {
  const dir = tmpDir();
  const uid = 'doi:10.1234/foo bar';
  writeFileSync(join(dir, `${encodeKeySegment(uid)}.txt`), 'Real extracted text.', 'utf8');
  const blankUid = 'doi:10.1234/blank';
  writeFileSync(join(dir, `${encodeKeySegment(blankUid)}.txt`), '   ', 'utf8');

  const load = textDirLoader(dir);
  assert.equal(load(paper({ paperUid: uid })), 'Real extracted text.');
  assert.equal(load(paper({ paperUid: blankUid })), null, 'a blank file is not text');
  assert.equal(load(paper({ paperUid: 'doi:10/missing' })), null);

  const { rows } = buildCorpusRows(
    [paper({ paperUid: uid }), paper({ paperUid: blankUid })],
    { loadText: load },
  );
  assert.equal(rows[0]!.textSource, 'canonical-text');
  assert.equal(rows[1]!.textSource, 'abstract', 'blank canonical file falls back to the abstract');
});

// ─────────────────────────────────────────────────────────────────────────────
// impactTier — cached venue band, else the repo's conservative unscored band
// ─────────────────────────────────────────────────────────────────────────────

test('impactTier comes from the per-ISSN cache banded by C8, with an auditable basis', () => {
  const cache = new VenueCache(join(tmpDir(), 'venues.json'));
  cache.set(venueInfo({ issn: '1234-5679', hIndex: 150 })); // ≥100 → high
  const p = paper({
    paperUid: 'doi:10/high',
    journal: { issn: ['1234-5679'], publisher: null, type: 'journal' },
  } as Partial<PaperRecord> & { paperUid: string });

  const { rows, stats } = buildCorpusRows([p], { resolveImpact: cachedVenueImpactResolver(cache) });
  assert.equal(rows[0]!.doc.impactTier, 'high');
  assert.match(rows[0]!.impactBasis, /venue-cache 1234-5679: h-index 150 >= 100/);
  assert.equal(stats.venueBanded, 1);
  assert.equal(stats.venueUnresolved, 0);
});

test('a preprint server bands to preprint, not a flattering tier', () => {
  const cache = new VenueCache(join(tmpDir(), 'venues.json'));
  cache.set(venueInfo({ issn: '1234-5679', type: 'repository', displayName: 'bioRxiv', hIndex: 300 }));
  const p = paper({
    paperUid: 'doi:10/pre',
    journal: { issn: ['1234-5679'], publisher: null, type: 'repository' },
  } as Partial<PaperRecord> & { paperUid: string });
  const { rows } = buildCorpusRows([p], { resolveImpact: cachedVenueImpactResolver(cache) });
  assert.equal(rows[0]!.doc.impactTier, 'preprint');
});

test('an uncached venue takes the repo conservative unscored band, and says so', () => {
  const cache = new VenueCache(join(tmpDir(), 'venues.json'));
  const p = paper({
    paperUid: 'doi:10/uncached',
    journal: { issn: ['1234-5679'], publisher: null, type: 'journal' },
  } as Partial<PaperRecord> & { paperUid: string });
  const { rows, stats } = buildCorpusRows([p], { resolveImpact: cachedVenueImpactResolver(cache) });
  assert.equal(rows[0]!.doc.impactTier, EXTERNAL_DEFAULT_IMPACT_TIER);
  assert.equal(rows[0]!.doc.impactTier, 'low');
  assert.match(rows[0]!.impactBasis, /unresolved-venue \(1234-5679:not-cached\)/);
  assert.equal(stats.venueUnresolved, 1);
  assert.equal(stats.venueBanded, 0);
});

test('a record with no ISSN reports no-issn-on-record rather than a fake cache miss', () => {
  const cache = new VenueCache(join(tmpDir(), 'venues.json'));
  const p = paper({
    paperUid: 'doi:10/noissn',
    journal: { issn: [], publisher: null, type: null },
  } as Partial<PaperRecord> & { paperUid: string });
  const { rows } = buildCorpusRows([p], { resolveImpact: cachedVenueImpactResolver(cache) });
  assert.match(rows[0]!.impactBasis, /no-issn-on-record/);
  assert.equal(rows[0]!.doc.impactTier, EXTERNAL_DEFAULT_IMPACT_TIER);
});

test('a cached-but-unresolved venue is reported as unresolved, not as uncached', () => {
  const cache = new VenueCache(join(tmpDir(), 'venues.json'));
  cache.set(venueInfo({ issn: '1234-5679', resolved: false, sourceId: null, displayName: null, type: null, hIndex: null }));
  const p = paper({
    paperUid: 'doi:10/unres',
    journal: { issn: ['1234-5679'], publisher: null, type: null },
  } as Partial<PaperRecord> & { paperUid: string });
  const { rows } = buildCorpusRows([p], { resolveImpact: cachedVenueImpactResolver(cache) });
  assert.match(rows[0]!.impactBasis, /venue-unresolved/);
  assert.doesNotMatch(rows[0]!.impactBasis, /not-cached/);
  assert.equal(rows[0]!.doc.impactTier, EXTERNAL_DEFAULT_IMPACT_TIER);
});

test('the first bandable ISSN wins when a record lists print + electronic', () => {
  const cache = new VenueCache(join(tmpDir(), 'venues.json'));
  cache.set(venueInfo({ issn: '2222-2223', hIndex: 60 })); // ≥50 → moderate
  const p = paper({
    paperUid: 'doi:10/two',
    journal: { issn: ['1111-1119', '2222-2223'], publisher: null, type: 'journal' },
  } as Partial<PaperRecord> & { paperUid: string });
  const { rows } = buildCorpusRows([p], { resolveImpact: cachedVenueImpactResolver(cache) });
  assert.equal(rows[0]!.doc.impactTier, 'moderate');
  assert.match(rows[0]!.impactBasis, /venue-cache 2222-2223/);
});

// ─────────────────────────────────────────────────────────────────────────────
// Accounting + serialization
// ─────────────────────────────────────────────────────────────────────────────

test('stats account for every record read (emitted + skipped)', () => {
  const records = [
    paper({ paperUid: 'doi:10/1' }),
    paper({ paperUid: 'doi:10/2', abstract: null }),
    paper({ paperUid: 'doi:10/3' }),
  ];
  const { stats } = buildCorpusRows(records);
  assert.equal(stats.recordsRead, 3);
  assert.equal(stats.emitted + stats.skipped, 3);
  assert.equal(stats.emitted, 2);
});

test('--limit stops after N emitted docs', () => {
  const records = [1, 2, 3, 4, 5].map((n) => paper({ paperUid: `doi:10/${n}` }));
  const { rows, stats } = buildCorpusRows(records, { limit: 2 });
  assert.equal(rows.length, 2);
  assert.equal(stats.emitted, 2);
});

test('serialization writes one JSON line per doc with the provenance keys, newline-terminated', () => {
  const { rows } = buildCorpusRows([paper({ paperUid: 'doi:10/x' })]);
  const jsonl = serializeCorpusRows(rows);
  assert.ok(jsonl.endsWith('\n'));
  const lines = jsonl.trimEnd().split('\n');
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
  assert.equal(parsed['textSource'], 'abstract');
  assert.equal(typeof parsed['impactBasis'], 'string');
  // The provenance keys are additive: the strict loader ignores them.
  assert.equal(loadCorpusFromText(jsonl, 'x').length, 1);
});

test('an empty build serializes to an empty string (no stray newline)', () => {
  assert.equal(serializeCorpusRows([]), '');
});
