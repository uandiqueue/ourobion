// Server-only, cookie/RLS-bound ingestion seed catalog read shared by the
// curator catalog endpoint and the curator workflow-dispatch endpoint.
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { buildSeedCatalog } from '@/lib/seedsControl';
import type { DbSeedRow, SeedCatalogEntry } from '@/lib/seedsControl';
import { INGEST_SEED_TOPICS } from '@/lib/types';

// Never select created_by: it is a curator identity column whose authenticated
// SELECT grant is intentionally revoked by the R4-U2 redaction migration.
const SEED_COLUMNS = 'id, slug, label, query_hint, enabled, created_at';

export type SeedCatalogReadResult =
  | { ok: true; seeds: SeedCatalogEntry[] }
  | { ok: false; error: string };

export async function readSeedCatalog(): Promise<SeedCatalogReadResult> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ingestion_seeds')
    .select(SEED_COLUMNS)
    .order('created_at', { ascending: true });

  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    seeds: buildSeedCatalog(INGEST_SEED_TOPICS, (data ?? []) as DbSeedRow[]),
  };
}
