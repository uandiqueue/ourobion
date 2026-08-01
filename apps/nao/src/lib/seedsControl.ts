// ourobion nao — seeds-as-data helpers (O14 / demo feature (c), run-2 U10).
//
// Pure, IO-free logic for the /ingest "Seeds" section and the /api/seeds route
// (nao's ingestControl/modelsControl convention: route handlers are IO glue
// over unit-tested pure functions).
//
// The write surface is `ingestion_seeds` — human-added ingestion seeds AS DATA,
// the complement to C9's predetermined seeds (code: brain-ingest seeds.ts,
// which nao never edits) and the future gap-driven loop (O9). A seed is a
// discovery TOPIC/query only, NEVER a metric pair: the C9 candidate list stays
// the only pair source, and the pipeline consumes this table fail-soft with
// STATIC-wins-on-collision merge semantics (tools/brain-ingest/src/seeder/
// dbSeeds.ts).

/** Mirrors the table CHECK: lowercase word characters only, at most 64 chars. */
export const SEED_SLUG_RE = /^[a-z0-9_]+$/;

export const MAX_SEED_SLUG_LENGTH = 64;
const MAX_LABEL_LENGTH = 120;
const MAX_QUERY_HINT_LENGTH = 300;

/** Row of ingestion_seeds (the columns the panel reads). */
export interface DbSeedRow {
  id: number;
  slug: string;
  label: string;
  query_hint: string | null;
  enabled: boolean;
  created_by: string;
  created_at: string;
}

/**
 * One catalog entry the Seeds panel renders: the six built-in topics from
 * brain-ingest's static seeds.ts (mirrored by INGEST_SEED_TOPICS) followed by
 * the human-added db seeds.
 */
export interface SeedCatalogEntry {
  slug: string;
  label: string;
  queryHint: string | null;
  enabled: boolean;
  builtIn: boolean;
  /**
   * True for a db seed whose slug collides with a built-in topic: the pipeline
   * merge is STATIC-wins, so this row is ignored by real runs (shown honestly).
   */
  shadowedByBuiltIn: boolean;
  /** Why Run now must not dispatch this entry; null means runnable. */
  unavailableReason: string | null;
  createdAt: string | null;
}

function customSeedUnavailableReason(
  row: DbSeedRow,
  shadowedByBuiltIn: boolean,
): string | null {
  if (validateSeedSlug(row.slug) !== null) {
    return 'invalid legacy slug (must match ^[a-z0-9_]+$ and be <= 64 characters; database remediation required)';
  }
  if (shadowedByBuiltIn) return 'shadowed by built-in (static wins)';
  if (!row.enabled) return 'disabled';
  return null;
}

/**
 * Derive a table-valid slug from a human label: lowercase, every run of
 * non-alphanumerics becomes one `_`, trimmed of leading/trailing `_`, capped
 * at {@link MAX_SEED_SLUG_LENGTH}. Returns '' when nothing survives (caller errors).
 */
export function deriveSeedSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_SEED_SLUG_LENGTH)
    .replace(/_+$/, '');
}

/** Compose the catalog: built-ins first (always enabled), then db seeds in row order. */
export function buildSeedCatalog(
  staticTopics: readonly string[],
  rows: readonly DbSeedRow[],
): SeedCatalogEntry[] {
  const builtIn = new Set(staticTopics);
  return [
    ...staticTopics.map((slug) => ({
      slug,
      label: slug,
      queryHint: null,
      enabled: true,
      builtIn: true,
      shadowedByBuiltIn: false,
      unavailableReason: null,
      createdAt: null,
    })),
    ...rows.map((r) => {
      const shadowedByBuiltIn = builtIn.has(r.slug);
      return {
        slug: r.slug,
        label: r.label,
        queryHint: r.query_hint,
        enabled: r.enabled,
        builtIn: false,
        shadowedByBuiltIn,
        unavailableReason: customSeedUnavailableReason(r, shadowedByBuiltIn),
        createdAt: r.created_at,
      };
    }),
  ];
}

/** Validated POST /api/seeds body. */
export interface AddSeedRequest {
  slug: string;
  label: string;
  queryHint: string | null;
}

export type ParseAddSeedResult =
  | { ok: true; value: AddSeedRequest }
  | { ok: false; error: string };

/**
 * Validate an add-seed body: `label` required; `slug` optional (derived from
 * the label when omitted); `queryHint` optional. The slug must match the table
 * CHECK either way.
 */
export function parseAddSeedBody(body: unknown): ParseAddSeedResult {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;

  const rawLabel = b.label;
  if (typeof rawLabel !== 'string' || rawLabel.trim() === '') {
    return { ok: false, error: 'label must be a non-empty string' };
  }
  const label = rawLabel.trim();
  if (label.length > MAX_LABEL_LENGTH) {
    return { ok: false, error: `label must be <= ${MAX_LABEL_LENGTH} characters` };
  }

  const rawSlug = b.slug;
  if (rawSlug !== undefined && rawSlug !== null && typeof rawSlug !== 'string') {
    return { ok: false, error: 'slug must be a string (or omitted to derive it from the label)' };
  }
  const slug = typeof rawSlug === 'string' && rawSlug.trim() !== '' ? rawSlug.trim() : deriveSeedSlug(label);
  if (slug === '') {
    return { ok: false, error: 'label must contain at least one letter or digit (slug derivation produced nothing)' };
  }
  if (slug.length > MAX_SEED_SLUG_LENGTH || !SEED_SLUG_RE.test(slug)) {
    return { ok: false, error: `slug must match ^[a-z0-9_]+$ and be <= ${MAX_SEED_SLUG_LENGTH} characters` };
  }

  const rawHint = b.queryHint;
  if (rawHint !== undefined && rawHint !== null && typeof rawHint !== 'string') {
    return { ok: false, error: 'queryHint must be a string (or omitted)' };
  }
  const hint = typeof rawHint === 'string' ? rawHint.trim() : '';
  if (hint.length > MAX_QUERY_HINT_LENGTH) {
    return { ok: false, error: `queryHint must be <= ${MAX_QUERY_HINT_LENGTH} characters` };
  }

  return { ok: true, value: { slug, label, queryHint: hint === '' ? null : hint } };
}

/** Validated PATCH /api/seeds body (enable/disable a db seed). */
export interface ToggleSeedRequest {
  slug: string;
  enabled: boolean;
}

export type ParseToggleSeedResult =
  | { ok: true; value: ToggleSeedRequest }
  | { ok: false; error: string };

/** Validate an enable/disable body. Only `enabled` is writable (column grant). */
export function parseToggleSeedBody(body: unknown): ParseToggleSeedResult {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;
  const slug = b.slug;
  if (typeof slug !== 'string' || !SEED_SLUG_RE.test(slug) || slug.length > MAX_SEED_SLUG_LENGTH) {
    return { ok: false, error: 'slug must be a valid seed slug (^[a-z0-9_]+$)' };
  }
  if (typeof b.enabled !== 'boolean') {
    return { ok: false, error: 'enabled must be a boolean' };
  }
  return { ok: true, value: { slug, enabled: b.enabled } };
}

/** Validate a workflow seed selector against the database slug contract. */
export function validateSeedSlug(slug: unknown): string | null {
  if (
    typeof slug !== 'string' ||
    slug.length === 0 ||
    slug.length > MAX_SEED_SLUG_LENGTH ||
    !SEED_SLUG_RE.test(slug)
  ) {
    return `seed must match ^[a-z0-9_]+$ and be <= ${MAX_SEED_SLUG_LENGTH} characters`;
  }
  return null;
}

/**
 * Return why a catalog slug cannot be dispatched, or null when it is runnable.
 * Built-ins are checked first so a colliding database row can never shadow one.
 */
export function seedRunabilityError(
  catalog: readonly SeedCatalogEntry[],
  slug: string,
): string | null {
  if (catalog.some((entry) => entry.builtIn && entry.slug === slug)) return null;

  const custom = catalog.find((entry) => !entry.builtIn && entry.slug === slug);
  if (custom === undefined) return `unknown seed '${slug}'`;
  if (custom.unavailableReason !== null) {
    return `custom seed '${slug}' is unavailable: ${custom.unavailableReason}`;
  }
  return null;
}
