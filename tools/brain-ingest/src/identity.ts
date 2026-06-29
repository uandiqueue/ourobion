/**
 * Paper identity — the `paper_uid` spine (design §4).
 *
 * Deterministic, DOI-preferring, never-empty id assignment plus same-paper
 * dedup. This is the join key (`Citation.paperId`) that ties every brain edge
 * back to its source paper(s).
 *
 * Pure logic only — no network, no clock except the injected `now`, no
 * `Math.random` (the ULID generator takes a seed/now injector so tests are
 * deterministic). Imports from `./types.js` only (ESM / NodeNext, `.js`).
 */

import { createHash } from 'node:crypto';
import type { Candidate, Identifiers, PaperRecord } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// DOI normalization (§4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonicalize a DOI string for use in a `doi:` uid and in the identifiers map.
 * Lowercases, trims, and strips any resolver prefix (`https://doi.org/`,
 * `http://dx.doi.org/`, a bare `doi:` scheme). Returns `null` for empty / junk
 * input so callers can fall through to the next identifier.
 */
export function normalizeDoi(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  let s = raw.trim().toLowerCase();
  if (s === '') return null;
  // strip a leading `doi:` scheme if present
  if (s.startsWith('doi:')) s = s.slice(4).trim();
  // strip resolver hosts (http/https, with or without dx.)
  s = s.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
  s = s.trim();
  if (s === '') return null;
  // a real DOI always starts with the `10.` registrant prefix
  if (!s.startsWith('10.')) return null;
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Other-identifier normalization (kept narrow — §4 fallback order)
// ─────────────────────────────────────────────────────────────────────────────

function normalizePmid(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const s = raw.trim().toLowerCase().replace(/^pmid:/, '').trim();
  // PMIDs are bare integers
  return /^\d+$/.test(s) ? s : null;
}

function normalizePmcid(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  let s = raw.trim().toUpperCase().replace(/^PMCID:/, '').trim();
  // accept `PMC123456` or a bare `123456`; canonical form keeps the `PMC` prefix
  if (/^\d+$/.test(s)) s = `PMC${s}`;
  return /^PMC\d+$/.test(s) ? s : null;
}

function normalizeArxiv(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  let s = raw.trim().toLowerCase().replace(/^arxiv:/, '').trim();
  s = s.replace(/^https?:\/\/arxiv\.org\/abs\//, '');
  s = s.replace(/v\d+$/, ''); // drop version suffix so v1/v2 collapse
  s = s.trim();
  return s === '' ? null : s;
}

/**
 * Normalize every present field of an `Identifiers` map to its canonical form,
 * dropping junk values. Used both for uid derivation and when merging maps.
 */
export function normalizeIdentifiers(ids: Identifiers): Identifiers {
  const out: Identifiers = {};
  const doi = normalizeDoi(ids.doi);
  if (doi != null) out.doi = doi;
  const pmid = normalizePmid(ids.pmid);
  if (pmid != null) out.pmid = pmid;
  const pmcid = normalizePmcid(ids.pmcid);
  if (pmcid != null) out.pmcid = pmcid;
  const arxiv = normalizeArxiv(ids.arxiv);
  if (arxiv != null) out.arxiv = arxiv;
  if (ids.openalex != null && ids.openalex.trim() !== '') {
    out.openalex = ids.openalex.trim();
  }
  if (ids.s2 != null && ids.s2.trim() !== '') {
    out.s2 = ids.s2.trim();
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Content fingerprint + ULID fallback (§4)
// ─────────────────────────────────────────────────────────────────────────────

/** Metadata used to pin a `corpus:ULID` when no external id exists (§4). */
export interface FallbackMeta {
  title: string;
  authors: string[];
  year: number | null;
}

/** Collapse a title to a comparable form: lowercase, strip punctuation, fold whitespace. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '') // drop combining diacritics (NFKD-decomposed)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Family name of the first author (token after the last space), lowercased. */
export function firstAuthorFamily(authors: string[]): string {
  const first = authors[0];
  if (first == null) return '';
  const trimmed = first.trim();
  if (trimmed === '') return '';
  const parts = trimmed.split(/\s+/);
  const family = parts[parts.length - 1] ?? '';
  return family.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Content fingerprint `sha1(normTitle + firstAuthorFamily + year)` (§4). Stable
 * across re-encounters of the same id-less paper so it pins the same ULID.
 */
export function contentFingerprint(meta: FallbackMeta): string {
  const payload = [
    normalizeTitle(meta.title),
    firstAuthorFamily(meta.authors),
    meta.year == null ? '' : String(meta.year),
  ].join('');
  return createHash('sha1').update(payload, 'utf8').digest('hex');
}

// Crockford's base32 alphabet (ULID spec).
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Deterministic ULID generator. Takes a 48-bit millisecond timestamp and 80
 * bits of "randomness" supplied by the caller (derived from the content
 * fingerprint, not `Math.random`) so the same paper always yields the same
 * ULID — and tests are reproducible. Returns a 26-char Crockford-base32 string.
 */
export function encodeUlid(timeMs: number, randomBytes: Uint8Array): string {
  if (randomBytes.length < 10) {
    throw new Error('encodeUlid requires at least 10 random bytes (80 bits)');
  }
  // 48-bit time → 10 base32 chars (high bits first)
  let time = Math.floor(timeMs);
  const timeChars: string[] = new Array<string>(10);
  for (let i = 9; i >= 0; i--) {
    timeChars[i] = CROCKFORD[time % 32] as string;
    time = Math.floor(time / 32);
  }
  // 80-bit randomness → 16 base32 chars, packed MSB-first across the 10 bytes
  let acc = 0n;
  for (let i = 0; i < 10; i++) {
    acc = (acc << 8n) | BigInt(randomBytes[i] as number);
  }
  const randChars: string[] = new Array<string>(16);
  for (let i = 15; i >= 0; i--) {
    randChars[i] = CROCKFORD[Number(acc % 32n)] as string;
    acc /= 32n;
  }
  return timeChars.join('') + randChars.join('');
}

/**
 * Derive a pinned `corpus:ULID` from a content fingerprint. The fingerprint's
 * leading 10 bytes become the ULID's randomness, so the same fingerprint always
 * maps to the same ULID with no `Math.random`. `now` (default 0) seeds the time
 * component — pass a fixed value in tests for full determinism.
 */
export function corpusUidFromFingerprint(fingerprint: string, now = 0): string {
  const bytes = new Uint8Array(10);
  for (let i = 0; i < 10; i++) {
    bytes[i] = parseInt(fingerprint.slice(i * 2, i * 2 + 2), 16);
  }
  return `corpus:${encodeUlid(now, bytes)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// paper_uid derivation (§4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive the canonical `paper_uid` for a paper (design §4):
 *   DOI → pmid → pmcid → arxiv → `corpus:ULID` pinned by content fingerprint.
 * Never returns empty. `now` is the injectable clock for the ULID fallback.
 */
export function paperUidFor(
  identifiers: Identifiers,
  fallbackMeta: FallbackMeta,
  now = 0,
): string {
  const ids = normalizeIdentifiers(identifiers);
  if (ids.doi != null) return `doi:${ids.doi}`;
  if (ids.pmid != null) return `pmid:${ids.pmid}`;
  if (ids.pmcid != null) return `pmcid:${ids.pmcid}`;
  if (ids.arxiv != null) return `arxiv:${ids.arxiv}`;
  return corpusUidFromFingerprint(contentFingerprint(fallbackMeta), now);
}

// ─────────────────────────────────────────────────────────────────────────────
// Dedup — collapse same-paper candidates (§4)
// ─────────────────────────────────────────────────────────────────────────────

/** One canonical paper after dedup: a uid, the merged identifiers, and the merged candidate. */
export interface DedupedPaper {
  paperUid: string;
  identifiers: Identifiers;
  /** the canonical candidate (richest metadata of the merged group) */
  candidate: Candidate;
  /** every `discoveredVia` that surfaced this paper, in first-seen order */
  discoveredVia: string[];
}

/** The dedup keys for a candidate, in resolution order: DOI → PMCID → PMID → arXiv → fingerprint. */
function dedupKeys(ids: Identifiers, meta: FallbackMeta): string[] {
  const keys: string[] = [];
  if (ids.doi != null) keys.push(`doi:${ids.doi}`);
  if (ids.pmcid != null) keys.push(`pmcid:${ids.pmcid}`);
  if (ids.pmid != null) keys.push(`pmid:${ids.pmid}`);
  if (ids.arxiv != null) keys.push(`arxiv:${ids.arxiv}`);
  // Only fall back to the content fingerprint when the candidate carries NO
  // external id (§4: "lacking a shared external id, the same fingerprint").
  // Otherwise a title+author+year collision could collapse two id-bearing
  // papers with DIFFERENT DOIs into one paper_uid, dropping a real paper.
  if (keys.length === 0) keys.push(`fp:${contentFingerprint(meta)}`);
  return keys;
}

export function mergeIdentifiers(a: Identifiers, b: Identifiers): Identifiers {
  // `a` wins on conflict (it was seen first / is canonical); `b` fills gaps.
  return normalizeIdentifiers({ ...b, ...a });
}

/** Choose the richer of two candidates for canonical metadata (longer abstract / more authors). */
function richerCandidate(a: Candidate, b: Candidate): Candidate {
  const score = (c: Candidate): number =>
    (c.abstract?.length ?? 0) +
    c.authors.length * 10 +
    (c.title.length > 0 ? 1 : 0) +
    (c.year != null ? 5 : 0) +
    (c.venue != null ? 2 : 0);
  return score(b) > score(a) ? b : a;
}

/**
 * Collapse same-paper candidates arriving from multiple discovery APIs into
 * canonical papers (design §4). Two candidates merge when they share **any**
 * identifier in resolution order (DOI → PMCID → PMID → arXiv), or, lacking a
 * shared external id, the same title+author+year fingerprint. Merged groups
 * union their `identifiers` maps and keep the richest metadata.
 *
 * `now` is the injectable clock passed through to the `corpus:ULID` fallback so
 * id-less papers get deterministic uids in tests.
 */
export function resolveDedup(candidates: Candidate[], now = 0): DedupedPaper[] {
  // Union-find over candidate indices, linked by shared dedup keys.
  const parent: number[] = candidates.map((_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r] as number;
    let cur = x;
    while (parent[cur] !== r) {
      const next = parent[cur] as number;
      parent[cur] = r;
      cur = next;
    }
    return r;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra; // lower index wins as root (first-seen)
  };

  const metaOf = (c: Candidate): FallbackMeta => ({
    title: c.title,
    authors: c.authors,
    year: c.year,
  });

  // Map each dedup key to the first candidate index that claimed it; link collisions.
  const keyOwner = new Map<string, number>();
  candidates.forEach((c, i) => {
    const ids = normalizeIdentifiers(c.identifiers);
    for (const key of dedupKeys(ids, metaOf(c))) {
      const owner = keyOwner.get(key);
      if (owner === undefined) keyOwner.set(key, i);
      else union(owner, i);
    }
  });

  // Gather groups by root, preserving first-seen order.
  const groups = new Map<number, number[]>();
  const order: number[] = [];
  candidates.forEach((_, i) => {
    const r = find(i);
    const g = groups.get(r);
    if (g === undefined) {
      groups.set(r, [i]);
      order.push(r);
    } else {
      g.push(i);
    }
  });

  const result: DedupedPaper[] = [];
  for (const root of order) {
    const members = groups.get(root) as number[];
    let canonical = candidates[members[0] as number] as Candidate;
    let mergedIds = normalizeIdentifiers(canonical.identifiers);
    const via: string[] = [];
    const seenVia = new Set<string>();

    for (const idx of members) {
      const c = candidates[idx] as Candidate;
      mergedIds = mergeIdentifiers(mergedIds, normalizeIdentifiers(c.identifiers));
      canonical = richerCandidate(canonical, c);
      if (!seenVia.has(c.discoveredVia)) {
        seenVia.add(c.discoveredVia);
        via.push(c.discoveredVia);
      }
    }

    const paperUid = paperUidFor(
      mergedIds,
      { title: canonical.title, authors: canonical.authors, year: canonical.year },
      now,
    );

    result.push({
      paperUid,
      identifiers: mergedIds,
      candidate: { ...canonical, identifiers: mergedIds },
      discoveredVia: via,
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reconciliation — collapse records whose (OpenAlex-enriched) ids now overlap (§4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * External-id dedup keys ONLY (`doi:`/`pmcid:`/`pmid:`/`arxiv:`) — never the
 * content fingerprint. Used by {@link reconcileByIdentifiers} so two records
 * merge solely on a shared REAL identifier, never on a title+author+year
 * collision (which could fold two genuinely different papers into one).
 */
function externalIdKeys(ids: Identifiers): string[] {
  const keys: string[] = [];
  if (ids.doi != null) keys.push(`doi:${ids.doi}`);
  if (ids.pmcid != null) keys.push(`pmcid:${ids.pmcid}`);
  if (ids.pmid != null) keys.push(`pmid:${ids.pmid}`);
  if (ids.arxiv != null) keys.push(`arxiv:${ids.arxiv}`);
  return keys;
}

/** De-dupe a list, preserving first-seen order. */
function dedupeStrings(items: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of items) {
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** Richness score for picking the BASE record when no member is `fetched`. */
function recordRichness(r: PaperRecord): number {
  const oa = r.oa;
  const oaScore =
    (oa.isOa ? 4 : 0) +
    (oa.bestOaUrl != null ? 3 : 0) +
    (oa.status !== 'unknown' ? 2 : 0) +
    (oa.license != null ? 1 : 0) +
    (oa.version != null ? 1 : 0);
  return oaScore + (r.abstract?.length ?? 0) / 100;
}

/**
 * Post-OA-location reconciliation pass (design §4). After records are enriched
 * with OpenAlex's full id set, two records that were minted with DISJOINT ids
 * (e.g. one `doi:`-only, one `pmcid:`-only) now share an identifier. This pass
 * union-finds records linked by any SHARED EXTERNAL id (DOI/PMCID/PMID/arXiv —
 * NOT the content fingerprint) and collapses each group to ONE canonical,
 * DOI-preferring record.
 *
 * Returns the reconciled record set (`merged`, stable first-seen order) and the
 * list of `absorbed` uids — the orphan uids whose `meta/<uid>.json` + manifest
 * line must be removed (their paper now lives under the group's canonical uid).
 *
 * Singletons pass through unchanged. The canonical record keeps a fetched
 * member's `storage`/`fullText`/`fetchedAt`/`oa` (the bytes are already on R2
 * under that storage key, independent of the uid).
 */
export function reconcileByIdentifiers(
  records: PaperRecord[],
): { merged: PaperRecord[]; absorbed: string[] } {
  // Union-find over record indices, linked by shared external-id keys only.
  const parent: number[] = records.map((_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r] as number;
    let cur = x;
    while (parent[cur] !== r) {
      const next = parent[cur] as number;
      parent[cur] = r;
      cur = next;
    }
    return r;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra; // lower index wins as root (first-seen)
  };

  const keyOwner = new Map<string, number>();
  records.forEach((rec, i) => {
    const ids = normalizeIdentifiers(rec.identifiers);
    for (const key of externalIdKeys(ids)) {
      const owner = keyOwner.get(key);
      if (owner === undefined) keyOwner.set(key, i);
      else union(owner, i);
    }
  });

  // Gather groups by root, preserving first-seen order.
  const groups = new Map<number, number[]>();
  const order: number[] = [];
  records.forEach((_, i) => {
    const r = find(i);
    const g = groups.get(r);
    if (g === undefined) {
      groups.set(r, [i]);
      order.push(r);
    } else {
      g.push(i);
    }
  });

  const merged: PaperRecord[] = [];
  const absorbed: string[] = [];

  for (const root of order) {
    const members = (groups.get(root) as number[]).map((i) => records[i] as PaperRecord);

    if (members.length === 1) {
      merged.push(members[0] as PaperRecord); // singleton — pass through unchanged
      continue;
    }

    // Union all members' identifiers (first-seen wins on conflict; rest fill gaps).
    let unionedIds: Identifiers = normalizeIdentifiers((members[0] as PaperRecord).identifiers);
    for (const m of members) {
      unionedIds = mergeIdentifiers(unionedIds, normalizeIdentifiers(m.identifiers));
    }

    // Canonical uid: DOI-preferring (§4), fixed clock 0 (no id-less group reaches here).
    const base0 = members[0] as PaperRecord;
    const canonicalUid = paperUidFor(
      unionedIds,
      { title: base0.title, authors: base0.authors, year: base0.year },
      0,
    );

    // Choose the BASE record: prefer a `fetched` member (keep its storage/fullText/
    // fetchedAt/oa); else the richest (most-populated oa, longest abstract); tie-break
    // by the member whose current uid already equals the canonical uid.
    const base = members.reduce((best, cur) => {
      const bf = best.status === 'fetched';
      const cf = cur.status === 'fetched';
      if (cf !== bf) return cf ? cur : best;
      const br = recordRichness(best);
      const cr = recordRichness(cur);
      if (cr !== br) return cr > br ? cur : best;
      // tie-break: a member already wearing the canonical uid wins.
      if (cur.paperUid === canonicalUid && best.paperUid !== canonicalUid) return cur;
      return best;
    });

    const topicTags = dedupeStrings(members.flatMap((m) => m.topicTags));
    const discoveredVia = dedupeStrings(
      members.flatMap((m) => m.discoveredVia.split(',').map((s) => s.trim()).filter(Boolean)),
    ).join(',');
    const errors = members.flatMap((m) => m.errors);

    const canonical: PaperRecord = {
      ...base,
      paperUid: canonicalUid,
      identifiers: unionedIds,
      topicTags,
      discoveredVia,
      errors,
      // metrics/journal/workType/concepts/oa stay from the base (per spec — prefer base).
      // IMPORTANT: if the base was `fetched`, keep its `storage` AS-IS. storage.key
      // already points at the real bytes on R2; the uid may change here but the bytes
      // do NOT move, so we must NOT recompute or null the storage key.
    };

    merged.push(canonical);
    for (const m of members) {
      if (m.paperUid !== canonicalUid) absorbed.push(m.paperUid);
    }
  }

  // De-dupe absorbed and, for safety, exclude any uid that also survives as a canonical.
  const survivors = new Set(merged.map((m) => m.paperUid));
  const absorbedFinal = dedupeStrings(absorbed).filter((uid) => !survivors.has(uid));

  return { merged, absorbed: absorbedFinal };
}
