/**
 * O14 seeds-as-data (run-2 U10): read human-added ingestion seeds from the
 * `ingestion_seeds` table and merge them with the static `seeds.ts` list.
 *
 * The table is nao's seed-add surface (demo feature (c)) — the human-added
 * complement to C9's predetermined seeds (code) and the future gap-driven loop
 * (O9). A db seed is a discovery TOPIC anchor only, shaped exactly like a
 * static `Seed`; it enters the seeder as a `static_topic`-style anchor and
 * NEVER as a metric pair — the C9 candidate list stays the only source of
 * pairs and the LLM still cannot add pairs (candidates.ts / postprocess gates
 * untouched).
 *
 * FAIL-SOFT (load-bearing, mirrors tools/llm-router/src/overrides.ts): the
 * pipeline must never be bricked by this boundary. `fetchDbSeeds` returns
 * `undefined` (static topics only) with ONE loud warning when SUPABASE_URL /
 * SUPABASE_SERVICE_ROLE_KEY are absent from env or Supabase is unreachable /
 * errors. It never throws. Locally the two env values come from
 * `npx supabase status` (the same values apps/nao's gen-env projects into
 * apps/nao/.dev.vars); CI/prod would provide them as real env — the same
 * sourcing pattern as tools/llm-router/scripts/publish-status.ts.
 *
 * Merge semantics: static SEEDS + db seeds, deduped by topic slug — the
 * STATIC seed wins on collision (code is the bootstrap truth; a db row
 * shadowing a built-in is ignored with a warning).
 *
 * ESM / NodeNext — imports use explicit `.js` extensions.
 */

import type { Seed } from '../types.js';
import { SEEDS } from '../seeds.js';

/** The slug contract the table CHECK enforces — re-validated here (defense in depth). */
const SLUG_RE = /^[a-z0-9_]+$/;
const MAX_SLUG_LENGTH = 64;

export interface FetchDbSeedsOptions {
  /** Injectable env; default process.env. Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. */
  env?: Record<string, string | undefined>;
  /** Injectable fetch (tests). */
  fetchFn?: (url: string, init: RequestInit) => Promise<Response>;
  /** Warning sink; default console.warn. */
  warn?: (message: string) => void;
  /** Abort the boundary read after this long (fail-soft, not fail-slow). */
  timeoutMs?: number;
}

/** Raw row shape returned by PostgREST for the seeds table. */
interface SeedRow {
  slug?: unknown;
  label?: unknown;
  query_hint?: unknown;
}

/**
 * Fetch ENABLED human-added seeds from `ingestion_seeds` via PostgREST and
 * convert them to the static `Seed` shape (`topic` = slug, `query` =
 * query_hint or the label, `topicTags` = [slug]). Returns `undefined`
 * (→ static topics only) on ANY problem, with one loud warning. Rows with an
 * invalid slug are skipped individually (warned), never fatal.
 */
export async function fetchDbSeeds(opts: FetchDbSeedsOptions = {}): Promise<Seed[] | undefined> {
  const env = opts.env ?? process.env;
  const warn = opts.warn ?? console.warn;
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (url === undefined || url.length === 0 || key === undefined || key.length === 0) {
    warn(
      'brain-ingest db-seeds: boundary not configured (SUPABASE_URL / ' +
        'SUPABASE_SERVICE_ROLE_KEY absent from env) — running on STATIC seed topics only. ' +
        'Any seeds added in nao are NOT part of this run.',
    );
    return undefined;
  }

  const fetchFn = opts.fetchFn ?? (fetch as (u: string, i: RequestInit) => Promise<Response>);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 4000);
  try {
    const res = await fetchFn(
      `${url.replace(/\/+$/, '')}/rest/v1/ingestion_seeds` +
        '?select=slug,label,query_hint&enabled=eq.true&order=created_at.asc',
      {
        method: 'GET',
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: controller.signal,
      },
    );
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const rows = (await res.json()) as SeedRow[];
    if (!Array.isArray(rows)) throw new Error('unexpected non-array response');

    const seeds: Seed[] = [];
    for (const row of rows) {
      const slug = row.slug;
      const label = row.label;
      if (
        typeof slug !== 'string' ||
        slug.length > MAX_SLUG_LENGTH ||
        !SLUG_RE.test(slug) ||
        typeof label !== 'string' ||
        label.trim() === ''
      ) {
        warn(`brain-ingest db-seeds: skipping malformed row (slug=${String(slug)})`);
        continue;
      }
      const hint = typeof row.query_hint === 'string' ? row.query_hint.trim() : '';
      seeds.push({
        topic: slug,
        query: hint !== '' ? hint : label.trim(),
        topicTags: [slug],
      });
    }
    return seeds;
  } catch (err) {
    warn(
      `brain-ingest db-seeds: boundary unreachable (${err instanceof Error ? err.message : String(err)}) ` +
        '— running on STATIC seed topics only. The pipeline is never bricked by this boundary (fail-soft).',
    );
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/** The merged seed pool plus the counts the run header logs ("N static + M db"). */
export interface MergedSeeds {
  seeds: Seed[];
  staticCount: number;
  /** Db seeds actually ADDED (a row shadowed by a static slug does not count). */
  dbCount: number;
  /** False when the boundary was unavailable (fail-soft — static only). */
  dbAvailable: boolean;
}

/**
 * Merge the static seed list with db seeds, deduping by topic slug — STATIC
 * wins on collision (the shadowed db row is dropped with a warning). Pure.
 */
export function mergeSeeds(
  staticSeeds: readonly Seed[],
  dbSeeds: readonly Seed[] | undefined,
  warn: (message: string) => void = console.warn,
): MergedSeeds {
  const seeds: Seed[] = [...staticSeeds];
  const seen = new Set(staticSeeds.map((s) => s.topic));
  let dbCount = 0;
  for (const s of dbSeeds ?? []) {
    if (seen.has(s.topic)) {
      warn(
        `brain-ingest db-seeds: ignoring db seed '${s.topic}' — it shadows a static seeds.ts ` +
          'topic (static wins on collision)',
      );
      continue;
    }
    seen.add(s.topic);
    seeds.push(s);
    dbCount++;
  }
  return {
    seeds,
    staticCount: staticSeeds.length,
    dbCount,
    dbAvailable: dbSeeds !== undefined,
  };
}

/**
 * The one call the CLI entry points use: fetch db seeds (fail-soft) and merge
 * them onto the static `SEEDS`. The merged pool flows everywhere the static
 * list flows today — discovery seed selection AND the seeder's topic anchors —
 * without touching the C9 pair gate (a db seed anchors exactly like a static
 * topic; the LLM still cannot add pairs).
 */
export async function loadMergedSeeds(opts: FetchDbSeedsOptions = {}): Promise<MergedSeeds> {
  const warn = opts.warn ?? console.warn;
  const dbSeeds = await fetchDbSeeds(opts);
  return mergeSeeds(SEEDS, dbSeeds, warn);
}
