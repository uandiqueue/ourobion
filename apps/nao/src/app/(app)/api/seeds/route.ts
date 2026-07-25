// ourobion nao — seeds-as-data API (O14 / demo feature (c), run-2 U10).
//
// GET   → the seed catalog: the six built-in topics (INGEST_SEED_TOPICS, the
//         hand-synced mirror of brain-ingest's static seeds.ts) + every
//         ingestion_seeds row, read AS THE AUTHENTICATED USER (RLS SELECT).
// POST  → { label, slug?, queryHint? } → INSERT a human-added seed AS THE
//         AUTHENTICATED USER (cookie-bound @supabase/ssr client — never the
//         service role): the RLS INSERT policy requires created_by =
//         auth.uid(), so the audit column cannot be forged. Dev posture per
//         this run's D3 precedent.
// PATCH → { slug, enabled } → toggle a db seed. The migration's column-level
//         grant lets authenticated users update ONLY `enabled` — disable,
//         don't erase (no DELETE surface).
//
// SEMANTICS (O14 locked): seeds are added AS DATA — never by editing
// seeds.ts. A seed is a discovery TOPIC/query, never a metric pair: C9's
// candidate list stays the only pair source and verifier-gating on resulting
// edges is unchanged. The pipeline reads this table fail-soft with
// static-wins-on-collision (tools/brain-ingest/src/seeder/dbSeeds.ts).
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { buildSeedCatalog, parseAddSeedBody, parseToggleSeedBody } from '@/lib/seedsControl';
import type { DbSeedRow } from '@/lib/seedsControl';
import { INGEST_SEED_TOPICS } from '@/lib/types';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function GET(): Promise<Response> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'not authenticated' }, 401);

  const { data, error } = await supabase
    .from('ingestion_seeds')
    .select('id, slug, label, query_hint, enabled, created_by, created_at')
    .order('created_at', { ascending: true });
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, seeds: buildSeedCatalog(INGEST_SEED_TOPICS, (data ?? []) as DbSeedRow[]) });
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  const parsed = parseAddSeedBody(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'not authenticated' }, 401);

  const { slug, label, queryHint } = parsed.value;

  // Honest guard: a slug shadowing a built-in would be silently ignored by the
  // pipeline (static wins on collision) — refuse it here instead.
  if ((INGEST_SEED_TOPICS as readonly string[]).includes(slug)) {
    return json({ error: `'${slug}' is a built-in seed topic — pick a different slug` }, 409);
  }

  const { data, error } = await supabase
    .from('ingestion_seeds')
    .insert({
      slug,
      label,
      query_hint: queryHint,
      created_by: user.id,
    })
    .select()
    .single();
  if (error) {
    // 23505 = unique_violation on slug — a duplicate, not a server fault.
    if (error.code === '23505') return json({ error: `seed '${slug}' already exists` }, 409);
    return json({ error: error.message }, 500);
  }

  return json({ ok: true, seed: data });
}

export async function PATCH(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  const parsed = parseToggleSeedBody(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'not authenticated' }, 401);

  const { slug, enabled } = parsed.value;
  const { data, error } = await supabase
    .from('ingestion_seeds')
    .update({ enabled }) // ONLY enabled — the column grant blocks anything else
    .eq('slug', slug)
    .select()
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (data === null) return json({ error: `unknown seed: ${slug}` }, 404);

  return json({ ok: true, seed: data });
}
