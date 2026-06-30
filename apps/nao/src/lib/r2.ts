/**
 * R2 (CORPUS binding) read helper for per-paper metadata detail.
 *
 * Server-only. Reads the truth-tier per-paper record from R2 via the NATIVE
 * Cloudflare binding (`getCloudflareContext().env.CORPUS`) — no S3 SDK, no creds.
 * The detail page calls getPaperMeta(uid) for the full PaperRecord; list/search
 * never touch R2 (they hit the D1 index).
 *
 * Key layout MIRRORS tools/brain-ingest/src/storage/r2.ts:
 *   meta/<encodeURIComponent(uid)>.json   per-paper PaperRecord (this module)
 *   manifest/papers.jsonl                  combined manifest (ETL input, not read here)
 *
 * HARD RULE: this app NEVER fetches or serves full paper text (text/<uid>.txt).
 * Only the metadata key is read here.
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { PaperRecord } from '@/lib/types';

/** R2 key for the combined manifest index (ETL reads this off-Workers; not used here). */
export const MANIFEST_KEY = 'manifest/papers.jsonl';

/**
 * R2 key for one paper's full metadata record: `meta/<encodeURIComponent(uid)>.json`.
 * Replicated from tools/brain-ingest/src/storage/r2.ts `metaKey` (encodeKeySegment ==
 * encodeURIComponent) so the app reads exactly what the ingestion tool wrote.
 */
export function metaKey(paperUid: string): string {
  return `meta/${encodeURIComponent(paperUid)}.json`;
}

function corpus(): R2Bucket {
  return getCloudflareContext().env.CORPUS;
}

/**
 * Read and parse a paper's full PaperRecord from R2. Returns null when the object
 * does not exist (R2 `.get` resolves to null on miss). Throws on malformed JSON so
 * a corrupt record surfaces rather than being silently swallowed.
 */
export async function getPaperMeta(uid: string): Promise<PaperRecord | null> {
  const obj = await corpus().get(metaKey(uid));
  if (obj === null) return null;
  const text = await obj.text();
  return JSON.parse(text) as PaperRecord;
}
