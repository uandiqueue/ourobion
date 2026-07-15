/**
 * b2 · Per-ISSN venue cache (design §b2 "Cache per-ISSN").
 *
 * One JSON file mapping normalized ISSN → {@link VenueInfo}, living in the
 * corpus data dir (`data/corpus/venues.json` — gitignored, DERIVED tier:
 * rebuildable by re-running the lookups). Persistence discipline mirrors
 * limits/budget.ts's `usage.json`: read tolerates a missing/corrupt file
 * (start clean), writes are atomic (temp file + rename). Unresolved lookups
 * are cached too — "OpenAlex knows no source for this ISSN" is an answer, and
 * `fetchedAt` keeps staleness visible if a re-probe policy lands later.
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  fetchVenueByIssn,
  normalizeIssn,
  unresolvedVenueInfo,
  type VenueInfo,
  type VenueLookupOptions,
} from './openalexSources.js';

/** Cache filename inside the corpus dir. */
export const VENUE_CACHE_FILENAME = 'venues.json';

/** Default corpus dir: `<repoRoot>/data/corpus` (matches run.ts / budget.ts). */
function defaultCorpusDir(): string {
  const here = dirname(fileURLToPath(import.meta.url)); // .../src/venue
  return resolve(here, '..', '..', '..', '..', 'data', 'corpus');
}

/** On-disk shape of `venues.json`. */
interface VenueCacheFile {
  version: 1;
  venues: Record<string, VenueInfo>;
}

/**
 * File-backed per-ISSN cache. Entries are read at construction and the file
 * is rewritten on every `set` (lookups are rare and tiny — simplicity over
 * write batching, same trade budget.ts makes).
 */
export class VenueCache {
  private readonly filePath: string;
  private venues: Record<string, VenueInfo>;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.venues = this.load();
  }

  /** Open the cache at `<corpusDir>/venues.json` (default `<repoRoot>/data/corpus`). */
  static open(corpusDir?: string): VenueCache {
    return new VenueCache(resolve(corpusDir ?? defaultCorpusDir(), VENUE_CACHE_FILENAME));
  }

  /** Crash-safe load: missing/corrupt file → empty cache. */
  private load(): Record<string, VenueInfo> {
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as VenueCacheFile;
      if (parsed && typeof parsed === 'object' && parsed.venues) return parsed.venues;
    } catch {
      // Missing or corrupt file → start clean.
    }
    return {};
  }

  /** Atomic write: temp file + rename (mirrors budget.ts `persist`). */
  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const payload: VenueCacheFile = { version: 1, venues: this.venues };
    const tmp = `${this.filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
    renameSync(tmp, this.filePath);
  }

  /** Cached entry for a (normalized) ISSN, or undefined on a miss. */
  get(issn: string): VenueInfo | undefined {
    const key = normalizeIssn(issn) ?? issn.trim();
    return this.venues[key];
  }

  /** Store an entry under its normalized ISSN and persist. */
  set(info: VenueInfo): void {
    const key = normalizeIssn(info.issn) ?? info.issn;
    this.venues[key] = info;
    this.persist();
  }

  /** Number of cached entries (observability / tests). */
  get size(): number {
    return Object.keys(this.venues).length;
  }
}

/**
 * Cache-through venue lookup: hit → cached {@link VenueInfo} (no fetch);
 * miss → {@link fetchVenueByIssn}, result stored (resolved or not). A
 * non-ISSN input short-circuits to an uncached unresolved outcome.
 */
export async function lookupVenueCached(
  rawIssn: string,
  cache: VenueCache,
  opts: VenueLookupOptions = {},
): Promise<{ venue: VenueInfo; cacheHit: boolean }> {
  const issn = normalizeIssn(rawIssn);
  if (issn === null) {
    const now = opts.now ?? ((): Date => new Date());
    return { venue: unresolvedVenueInfo(rawIssn.trim(), now().toISOString()), cacheHit: false };
  }
  const hit = cache.get(issn);
  if (hit !== undefined) return { venue: hit, cacheHit: true };
  const venue = await fetchVenueByIssn(issn, opts);
  cache.set(venue);
  return { venue, cacheHit: false };
}
