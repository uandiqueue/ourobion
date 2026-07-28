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
//
// AUTH (R4-U2): GET requires nao `viewer`; POST and PATCH require `curator`
// (operating the corpus/pipeline, per the R4-U2 design §A.1) via
// requireRole()/guardRole() (apps/nao/src/lib/authzServer.ts). `created_by` (a
// raw curator uuid) is never selected/returned by any handler — explicit
// column list + redactDeep(), layer-1 redaction over the DB-layer column
// revoke Agent A is adding on the same table; this route does not assume that
// landed.
//
// GATE ORDER (R4-U2 review finding 6): `guardRole` is the FIRST statement of POST
// and of PATCH, before `req.json()` and the body parsers — running the parse
// first handed a non-member a 400-vs-403 schema oracle over both request shapes.
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { guardRole, recordControlEvent, redactDeep, redactText } from '@/lib/authzServer';
import { buildSeedCatalog, parseAddSeedBody, parseToggleSeedBody } from '@/lib/seedsControl';
import type { DbSeedRow } from '@/lib/seedsControl';
import { INGEST_SEED_TOPICS } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Explicit column list shared by every query below — never `created_by` (a
// raw curator uuid). Layer-1 redaction over the DB-layer column revoke Agent
// A is adding on the same table; this route does not assume that landed.
const SEED_COLUMNS = 'id, slug, label, query_hint, enabled, created_at';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function GET(): Promise<Response> {
  const gate = await guardRole('viewer');
  if (!gate.ok) return gate.response;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ingestion_seeds')
    .select(SEED_COLUMNS)
    .order('created_at', { ascending: true });
  if (error) return json({ error: redactText(error.message) }, 500);

  return json(
    redactDeep({ ok: true, seeds: buildSeedCatalog(INGEST_SEED_TOPICS, (data ?? []) as DbSeedRow[]) }),
  );
}

export async function POST(req: Request): Promise<Response> {
  const gate = await guardRole('curator');
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  const parsed = parseAddSeedBody(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const { slug, label, queryHint } = parsed.value;

  await recordControlEvent('seeds.add', slug, { label, queryHint });

  // Honest guard: a slug shadowing a built-in would be silently ignored by the
  // pipeline (static wins on collision) — refuse it here instead.
  if ((INGEST_SEED_TOPICS as readonly string[]).includes(slug)) {
    return json({ error: `'${slug}' is a built-in seed topic — pick a different slug` }, 409);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ingestion_seeds')
    .insert({
      slug,
      label,
      query_hint: queryHint,
      created_by: gate.userId,
    })
    .select(SEED_COLUMNS)
    .single();
  if (error) {
    // 23505 = unique_violation on slug — a duplicate, not a server fault.
    if (error.code === '23505') return json({ error: `seed '${slug}' already exists` }, 409);
    return json({ error: redactText(error.message) }, 500);
  }

  return json(redactDeep({ ok: true, seed: data }));
}

export async function PATCH(req: Request): Promise<Response> {
  const gate = await guardRole('curator');
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  const parsed = parseToggleSeedBody(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const supabase = await createServerSupabaseClient();
  const { slug, enabled } = parsed.value;

  await recordControlEvent('seeds.toggle', slug, { enabled });

  const { data, error } = await supabase
    .from('ingestion_seeds')
    .update({ enabled }) // ONLY enabled — the column grant blocks anything else
    .eq('slug', slug)
    .select(SEED_COLUMNS)
    .maybeSingle();
  if (error) return json({ error: redactText(error.message) }, 500);
  if (data === null) return json({ error: `unknown seed: ${slug}` }, 404);

  return json(redactDeep({ ok: true, seed: data }));
}
