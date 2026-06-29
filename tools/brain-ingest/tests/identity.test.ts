/**
 * Tests for src/identity.ts — the paper_uid scheme (design §4) and same-paper
 * dedup. Pure logic, fixtures only, no network. Run via `tsx` + node:test.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Candidate, Identifiers, PaperRecord } from '../src/types.js';
import {
  normalizeDoi,
  normalizeIdentifiers,
  normalizeTitle,
  firstAuthorFamily,
  contentFingerprint,
  corpusUidFromFingerprint,
  encodeUlid,
  paperUidFor,
  resolveDedup,
  reconcileByIdentifiers,
} from '../src/identity.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'identity-candidates.json'), 'utf8'),
) as { candidates: Candidate[] };

// ─────────────────────────────────────────────────────────────────────────────
// normalizeDoi
// ─────────────────────────────────────────────────────────────────────────────

test('normalizeDoi strips resolver prefixes and lowercases', () => {
  assert.equal(normalizeDoi('https://doi.org/10.1099/MIC.0.001234'), '10.1099/mic.0.001234');
  assert.equal(normalizeDoi('http://dx.doi.org/10.1/AbC'), '10.1/abc');
  assert.equal(normalizeDoi('doi:10.1/X'), '10.1/x');
  assert.equal(normalizeDoi('  10.1/Y  '), '10.1/y');
});

test('normalizeDoi rejects non-DOI / empty input', () => {
  assert.equal(normalizeDoi(undefined), null);
  assert.equal(normalizeDoi(null), null);
  assert.equal(normalizeDoi(''), null);
  assert.equal(normalizeDoi('not-a-doi'), null);
  assert.equal(normalizeDoi('https://doi.org/'), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeIdentifiers
// ─────────────────────────────────────────────────────────────────────────────

test('normalizeIdentifiers canonicalizes each field and drops junk', () => {
  const out = normalizeIdentifiers({
    doi: 'https://doi.org/10.1/A',
    pmid: 'PMID:123',
    pmcid: '456',
    arxiv: 'arXiv:2401.01234v3',
    openalex: ' W9 ',
    s2: '',
  });
  assert.deepEqual(out, {
    doi: '10.1/a',
    pmid: '123',
    pmcid: 'PMC456',
    arxiv: '2401.01234',
    openalex: 'W9',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fingerprint helpers
// ─────────────────────────────────────────────────────────────────────────────

test('normalizeTitle folds case, punctuation, whitespace, diacritics', () => {
  assert.equal(
    normalizeTitle('Antibiotics & the   Vector: Field Notes (Dengue)!'),
    'antibiotics the vector field notes dengue',
  );
  // diacritic-folding: "Café" -> "cafe"
  assert.equal(normalizeTitle('Café Study'), 'cafe study');
});

test('firstAuthorFamily takes the last token of the first author', () => {
  assert.equal(firstAuthorFamily(['Jane Q. Doe', 'R Smith']), 'doe');
  assert.equal(firstAuthorFamily(['María García López']), 'lópez'.replace(/[^a-z0-9]/g, ''));
  assert.equal(firstAuthorFamily([]), '');
});

test('contentFingerprint is deterministic and order-stable', () => {
  const a = contentFingerprint({ title: 'A Study', authors: ['Jane Doe'], year: 2020 });
  const b = contentFingerprint({ title: 'a   study', authors: ['Jane DOE'], year: 2020 });
  assert.equal(a, b, 'normalization makes the fingerprint stable across formatting');
  assert.match(a, /^[0-9a-f]{40}$/, 'sha1 hex');
});

// ─────────────────────────────────────────────────────────────────────────────
// ULID generator — deterministic, no Math.random
// ─────────────────────────────────────────────────────────────────────────────

test('encodeUlid is 26 chars of Crockford base32 and deterministic', () => {
  const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const u1 = encodeUlid(0, bytes);
  const u2 = encodeUlid(0, bytes);
  assert.equal(u1, u2);
  assert.equal(u1.length, 26);
  assert.match(u1, /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26}$/);
});

test('encodeUlid rejects insufficient randomness', () => {
  assert.throws(() => encodeUlid(0, new Uint8Array(9)));
});

test('corpusUidFromFingerprint pins the same uid for the same fingerprint', () => {
  const fp = contentFingerprint({ title: 'X', authors: ['A B'], year: 2000 });
  assert.equal(corpusUidFromFingerprint(fp), corpusUidFromFingerprint(fp));
  assert.match(corpusUidFromFingerprint(fp), /^corpus:[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26}$/);
});

// ─────────────────────────────────────────────────────────────────────────────
// paperUidFor — the §4 preference order
// ─────────────────────────────────────────────────────────────────────────────

const meta = { title: 'T', authors: ['A B'], year: 2020 };

test('paperUidFor prefers DOI', () => {
  assert.equal(
    paperUidFor({ doi: 'https://doi.org/10.1/A', pmid: '1', pmcid: '2', arxiv: '3' }, meta),
    'doi:10.1/a',
  );
});

test('paperUidFor falls back pmid -> pmcid -> arxiv in order', () => {
  assert.equal(paperUidFor({ pmid: '123', pmcid: '456', arxiv: 'x' }, meta), 'pmid:123');
  assert.equal(paperUidFor({ pmcid: '456', arxiv: '2401.1' }, meta), 'pmcid:PMC456');
  assert.equal(paperUidFor({ arxiv: 'arXiv:2401.01234v2' }, meta), 'arxiv:2401.01234');
});

test('paperUidFor falls back to corpus:ULID when no external id', () => {
  const uid = paperUidFor({}, meta);
  assert.match(uid, /^corpus:[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26}$/);
  // pinned: same metadata -> same uid
  assert.equal(uid, paperUidFor({}, meta));
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveDedup — the headline requirement
// ─────────────────────────────────────────────────────────────────────────────

test('two source variants of one paper collapse to one uid (DOI + shared PMID chain)', () => {
  const deduped = resolveDedup(fixture.candidates);

  // 5 input candidates: #1+#2 share a DOI; #3 shares PMID with #2 -> all three
  // collapse. #4 (arxiv) and #5 (id-less) are distinct -> 3 papers total.
  assert.equal(deduped.length, 3);

  const merged = deduped[0]!;
  assert.equal(merged.paperUid, 'doi:10.1099/mic.0.001234', 'DOI wins the uid');
  // union of all identifiers across the three variants
  assert.equal(merged.identifiers.doi, '10.1099/mic.0.001234');
  assert.equal(merged.identifiers.pmid, '34567890');
  assert.equal(merged.identifiers.pmcid, 'PMC8123456');
  assert.equal(merged.identifiers.openalex, 'W123');
  // every discovering source recorded
  assert.deepEqual(merged.discoveredVia, ['crossref', 'pubmed', 'europepmc']);
  // richest metadata kept (the pubmed variant: longest abstract + most authors)
  assert.equal(merged.candidate.authors.length, 3);
  assert.ok((merged.candidate.abstract?.length ?? 0) > 100);

  // the arxiv preprint
  const arx = deduped.find((d) => d.paperUid.startsWith('arxiv:'))!;
  assert.equal(arx.paperUid, 'arxiv:2401.01234');

  // the id-less candidate -> corpus:ULID
  const corpus = deduped.find((d) => d.paperUid.startsWith('corpus:'))!;
  assert.match(corpus.paperUid, /^corpus:[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26}$/);
});

test('resolveDedup is deterministic across runs (no Math.random)', () => {
  const a = resolveDedup(fixture.candidates).map((d) => d.paperUid);
  const b = resolveDedup(fixture.candidates).map((d) => d.paperUid);
  assert.deepEqual(a, b);
});

test('resolveDedup keeps distinct DOIs separate despite a shared fingerprint', () => {
  // Two genuinely distinct papers (e.g. an article and its erratum, or a
  // preprint + published pair) that share the same title+firstAuthor+year
  // fingerprint but carry DIFFERENT DOIs. They must NOT be merged: the
  // fingerprint key is only a fallback for id-less candidates (§4). A false
  // merge would silently drop one paper from the corpus and mis-attribute
  // its citations to the surviving uid.
  const base = {
    title: 'Editorial',
    authors: ['Sole Author'],
    year: 2021,
    venue: 'Journal of Things',
    abstract: null,
  } satisfies Partial<Candidate>;
  const c1: Candidate = {
    ...base,
    identifiers: { doi: '10.1/aaa' },
    discoveredVia: 'crossref',
  };
  const c2: Candidate = {
    ...base,
    identifiers: { doi: '10.1/bbb' },
    discoveredVia: 'pubmed',
  };
  // Sanity: the two share the same content fingerprint.
  assert.equal(
    contentFingerprint({ title: c1.title, authors: c1.authors, year: c1.year }),
    contentFingerprint({ title: c2.title, authors: c2.authors, year: c2.year }),
  );

  const deduped = resolveDedup([c1, c2]);
  assert.equal(deduped.length, 2, 'distinct DOIs must stay separate');
  const uids = new Set(deduped.map((d) => d.paperUid));
  assert.deepEqual(uids, new Set(['doi:10.1/aaa', 'doi:10.1/bbb']));
});

test('resolveDedup collapses id-less duplicates by fingerprint', () => {
  const c1: Candidate = {
    identifiers: {},
    title: 'A Lonely Preprint',
    authors: ['Sole Author'],
    year: 2022,
    venue: null,
    abstract: null,
    discoveredVia: 'doaj',
  };
  const c2: Candidate = {
    ...c1,
    title: 'a   lonely    preprint', // same after normalization
    discoveredVia: 'biorxiv',
  };
  const deduped = resolveDedup([c1, c2]);
  assert.equal(deduped.length, 1);
  assert.deepEqual(deduped[0]!.discoveredVia, ['doaj', 'biorxiv']);
});

// ─────────────────────────────────────────────────────────────────────────────
// reconcileByIdentifiers — the post-OA-location merge (§4)
// ─────────────────────────────────────────────────────────────────────────────

function paperRec(uid: string, ids: Identifiers, over: Partial<PaperRecord> = {}): PaperRecord {
  return {
    paperUid: uid,
    identifiers: ids,
    title: `Title ${uid}`,
    authors: ['A. Author'],
    year: 2024,
    venue: 'Journal',
    abstract: null,
    discoveredVia: 'crossref',
    topicTags: [],
    oa: { isOa: false, status: 'unknown', bestOaUrl: null, license: null, version: null },
    retrievability: 'unknown',
    storage: { kind: 'none' },
    fullText: { extracted: false, method: null, charCount: null },
    status: 'discovered',
    errors: [],
    fetchedAt: null,
    ...over,
  };
}

test('reconcileByIdentifiers: doi-only + pmcid-only for the same paper merge to the doi: uid', () => {
  // After OpenAlex enrichment, the doi-only record now also carries the pmcid,
  // so the two records share `pmcid:PMC8123456` and collapse.
  const a = paperRec(
    'doi:10.3390/s24010001',
    { doi: '10.3390/s24010001', pmcid: 'PMC8123456' },
    { discoveredVia: 'crossref', topicTags: ['sensors'] },
  );
  const b = paperRec(
    'pmcid:PMC8123456',
    { pmcid: 'PMC8123456' },
    { discoveredVia: 'europepmc', topicTags: ['microbiome'] },
  );

  const { merged, absorbed } = reconcileByIdentifiers([a, b]);
  assert.equal(merged.length, 1, 'collapsed to one canonical record');
  const canon = merged[0]!;
  assert.equal(canon.paperUid, 'doi:10.3390/s24010001', 'DOI-preferring canonical uid');
  assert.equal(canon.identifiers.doi, '10.3390/s24010001');
  assert.equal(canon.identifiers.pmcid, 'PMC8123456', 'unioned identifiers');
  assert.deepEqual(canon.topicTags.sort(), ['microbiome', 'sensors']);
  assert.deepEqual(canon.discoveredVia, 'crossref,europepmc');
  // The pmcid-only uid is absorbed (its meta/ object must be deleted).
  assert.deepEqual(absorbed, ['pmcid:PMC8123456']);
});

test('reconcileByIdentifiers: two genuinely different papers (no shared id) are NOT merged', () => {
  const a = paperRec('doi:10.1/aaa', { doi: '10.1/aaa', pmid: '111' });
  const b = paperRec('doi:10.1/bbb', { doi: '10.1/bbb', pmid: '222' });
  const { merged, absorbed } = reconcileByIdentifiers([a, b]);
  assert.equal(merged.length, 2, 'distinct ids stay separate');
  assert.deepEqual(absorbed, []);
  assert.deepEqual(
    new Set(merged.map((m) => m.paperUid)),
    new Set(['doi:10.1/aaa', 'doi:10.1/bbb']),
  );
});

test("reconcileByIdentifiers: a fetched member's storage survives the merge", () => {
  // The pmcid-only record was already fetched (its bytes live at jats/<that uid>).
  // It must become the BASE so storage.key is kept AS-IS even though the uid changes.
  const fetched = paperRec(
    'pmcid:PMC9000001',
    { pmcid: 'PMC9000001' },
    {
      status: 'fetched',
      fetchedAt: '2026-06-29T00:00:00.000Z',
      storage: {
        kind: 'object',
        key: 'jats/pmcid%3APMC9000001.xml',
        contentType: 'application/xml',
        sizeBytes: 1234,
        sha256: 'abc',
      },
      fullText: { extracted: true, method: 'jats', charCount: 4321 },
      oa: { isOa: true, status: 'green', bestOaUrl: 'https://x/p', license: 'cc-by', version: 'published' },
    },
  );
  const doiOnly = paperRec('doi:10.3390/s24020002', { doi: '10.3390/s24020002', pmcid: 'PMC9000001' });

  const { merged, absorbed } = reconcileByIdentifiers([doiOnly, fetched]);
  assert.equal(merged.length, 1);
  const canon = merged[0]!;
  assert.equal(canon.paperUid, 'doi:10.3390/s24020002', 'DOI-preferring uid');
  assert.equal(canon.status, 'fetched', 'kept the fetched base status');
  // storage.key is preserved AS-IS (NOT recomputed for the new uid) — bytes do not move.
  assert.equal(canon.storage.key, 'jats/pmcid%3APMC9000001.xml');
  assert.equal(canon.fullText.charCount, 4321);
  assert.equal(canon.fetchedAt, '2026-06-29T00:00:00.000Z');
  assert.deepEqual(absorbed, ['pmcid:PMC9000001']);
});

test('reconcileByIdentifiers: singletons pass through unchanged, stable order', () => {
  const a = paperRec('doi:10.1/x', { doi: '10.1/x' });
  const b = paperRec('arxiv:2401.1', { arxiv: '2401.1' });
  const { merged, absorbed } = reconcileByIdentifiers([a, b]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0]!.paperUid, 'doi:10.1/x');
  assert.equal(merged[1]!.paperUid, 'arxiv:2401.1');
  assert.deepEqual(absorbed, []);
});
