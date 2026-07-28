// ourobion nao — simulated health-data loader API (O11, run-2 U6).
//
// GET  → the signed-in user's current loaded range (min/max log_date + day counts for
//        daily_gut_rows and wearable_daily) plus the server's "today" (UTC — the same
//        day the engine evaluates).
// POST → validate { days?, seed?, scenario? }, plan where the days go (forward to
//        today first, then history backfill — see lib/simulatedHealth.ts's
//        planLoadRange), generate deterministic simulated rows and UPSERT them into
//        biotope's truth tables AS THE AUTHENTICATED USER.
//
// AUTH + RLS: the writes use the cookie-bound @supabase/ssr server client — the anon
// key + the user's own session, NEVER the service role — so daily_gut_rows /
// wearable_daily RLS ("insert/update own rows", auth.uid() = user_id) is enforced by
// Postgres, and the loader can only ever touch the signed-in user's data. Upserts on
// the tables' natural keys make re-loads idempotent (biotope's own writer convention:
// onConflict user_id,log_date / user_id,date).
//
// PROVENANCE (O11 locked; D3-recorded deviation): every row is stamped simulated —
// daily_gut_rows.data_origin (new additive column) and wearable_daily.source (existing
// column) = 'simulated:run2-demo'.
//
// AUTH (R4-U2): GET requires nao `viewer`, POST requires `curator` (running the
// demo loader is a corpus/pipeline operation, per the R4-U2 design §A.1) via
// requireRole()/guardRole() (apps/nao/src/lib/authzServer.ts) — NOT the same
// tier the database enforces. The database twin here is unchanged per-user
// RLS (`auth.uid() = user_id`), which authorizes ANY authenticated user
// (including a `viewer`) to write their own rows directly via PostgREST. This
// is a deliberate, accepted asymmetry (design §H.1 item 10): the route adds a
// workflow preference (only curators run the demo loader through nao), not a
// security boundary — the blast radius of writing through PostgREST directly
// is the caller's own health rows, which they already own. Do NOT "fix" this
// by gating daily_gut_rows/wearable_daily on nao_has_role — that would break
// every Biotope-only user with no nao membership at all (invariant P).
//
// GATE ORDER (R4-U2 review finding 6): `guardRole` is the FIRST statement of POST,
// before `req.json()` and validateLoaderBody — running validation first handed a
// non-member a 400-vs-403 schema oracle over this endpoint's request shape.
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { guardRole, recordControlEvent, redactText } from '@/lib/authzServer';
import {
  DEFAULT_FIRST_LOAD_DAYS,
  DEFAULT_INCREMENT_DAYS,
  DEFAULT_SEED,
  generateSimulatedDays,
  planLoadRange,
  validateLoaderBody,
  type LoadedRange,
  type LoaderRequestBody,
  type LoaderScenario,
  type SimulatedDay,
} from '@/lib/simulatedHealth';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Today in UTC — matches evaluate-signals' evaluated day. */
function todayUtc(): string {
  return new Date().toISOString().split('T')[0];
}

interface RangeSummary {
  minDate: string | null;
  maxDate: string | null;
  days: number;
}

async function tableRange(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  table: 'daily_gut_rows' | 'wearable_daily',
  dateColumn: 'log_date' | 'date',
): Promise<RangeSummary> {
  const base = () => supabase.from(table).select(dateColumn);
  const [first, last, count] = await Promise.all([
    base().order(dateColumn, { ascending: true }).limit(1),
    base().order(dateColumn, { ascending: false }).limit(1),
    supabase.from(table).select(dateColumn, { count: 'exact', head: true }),
  ]);
  for (const res of [first, last, count]) {
    if (res.error) throw new Error(`${table}: ${res.error.message}`);
  }
  const value = (row: unknown): string | null =>
    row && typeof row === 'object' ? ((row as Record<string, string>)[dateColumn] ?? null) : null;
  return {
    minDate: value(first.data?.[0]),
    maxDate: value(last.data?.[0]),
    days: count.count ?? 0,
  };
}

export async function GET(): Promise<Response> {
  const gate = await guardRole('viewer');
  if (!gate.ok) return gate.response;

  const supabase = await createServerSupabaseClient();
  try {
    const [gut, wearable] = await Promise.all([
      tableRange(supabase, 'daily_gut_rows', 'log_date'),
      tableRange(supabase, 'wearable_daily', 'date'),
    ]);
    return json({ today: todayUtc(), gut, wearable });
  } catch (err) {
    // A relayed Postgres message can embed a value (`Key (user_id, …)=(<uuid>, …)`),
    // so every error string leaving a nao route goes through redactText.
    return json({ error: redactText(err instanceof Error ? err.message : String(err)) }, 500);
  }
}

export async function POST(req: Request): Promise<Response> {
  const gate = await guardRole('curator');
  if (!gate.ok) return gate.response;

  let body: LoaderRequestBody;
  try {
    body = (await req.json()) as LoaderRequestBody;
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  const validationError = validateLoaderBody(body);
  if (validationError) return json({ error: validationError }, 400);

  const supabase = await createServerSupabaseClient();
  const today = todayUtc();
  const seed = body.seed ?? DEFAULT_SEED;
  const scenario: LoaderScenario = body.scenario ?? 'recent-dip';

  await recordControlEvent('loader.simulate', scenario, { days: body.days, seed });

  try {
    const gutRange = await tableRange(supabase, 'daily_gut_rows', 'log_date');
    const existing: LoadedRange | null =
      gutRange.minDate !== null && gutRange.maxDate !== null
        ? { minDate: gutRange.minDate, maxDate: gutRange.maxDate }
        : null;

    const days = body.days ?? (existing === null ? DEFAULT_FIRST_LOAD_DAYS : DEFAULT_INCREMENT_DAYS);
    const plan = planLoadRange(existing, days, today);

    const generated: SimulatedDay[] = plan.segments.flatMap((segment) =>
      generateSimulatedDays({
        startDate: segment.startDate,
        days: segment.days,
        seed,
        scenario,
        anchorDate: today,
      }),
    );

    // Invariant P (R4-U2 design §A.0): the acting dev's OWN user_id, written
    // through the cookie-bound anon-key client under existing per-user RLS —
    // this row construction, both upsert calls below, their onConflict
    // targets, error checks, and response shape are byte-identical to
    // pre-R4-U2 (only the auth GATE above changed). Not touched here; R4-U3
    // owns the non-atomicity between the two upserts (see design §H.5).
    const gutRows = generated.map((d) => ({ user_id: gate.userId, ...d.gut }));
    const wearableRows = generated.map((d) => ({ user_id: gate.userId, ...d.wearable }));

    // Idempotent upserts on the tables' natural keys (biotope's writer convention).
    const gutWrite = await supabase
      .from('daily_gut_rows')
      .upsert(gutRows, { onConflict: 'user_id,log_date' });
    if (gutWrite.error) throw new Error(`daily_gut_rows upsert: ${gutWrite.error.message}`);

    const wearableWrite = await supabase
      .from('wearable_daily')
      .upsert(wearableRows, { onConflict: 'user_id,date' });
    if (wearableWrite.error) throw new Error(`wearable_daily upsert: ${wearableWrite.error.message}`);

    const after = await tableRange(supabase, 'daily_gut_rows', 'log_date');
    return json({
      ok: true,
      loadedDays: generated.length,
      forwardDays: plan.forwardDays,
      backfillDays: plan.backfillDays,
      segments: plan.segments,
      seed,
      scenario,
      range: after,
      today,
    });
  } catch (err) {
    // Same reason as GET: an upsert conflict message quotes (user_id, log_date).
    return json({ error: redactText(err instanceof Error ? err.message : String(err)) }, 500);
  }
}
