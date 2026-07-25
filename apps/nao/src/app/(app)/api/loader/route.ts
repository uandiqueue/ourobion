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
// column) = 'simulated:run2-demo'. Dev-only posture per D3: any authenticated user
// (the two ourobion devs) may load; no extra role gate in v1.
import { createServerSupabaseClient } from '@/lib/supabase-server';
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
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'not authenticated' }, 401);

  try {
    const [gut, wearable] = await Promise.all([
      tableRange(supabase, 'daily_gut_rows', 'log_date'),
      tableRange(supabase, 'wearable_daily', 'date'),
    ]);
    return json({ today: todayUtc(), gut, wearable });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}

export async function POST(req: Request): Promise<Response> {
  let body: LoaderRequestBody;
  try {
    body = (await req.json()) as LoaderRequestBody;
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  const validationError = validateLoaderBody(body);
  if (validationError) return json({ error: validationError }, 400);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'not authenticated' }, 401);

  const today = todayUtc();
  const seed = body.seed ?? DEFAULT_SEED;
  const scenario: LoaderScenario = body.scenario ?? 'recent-dip';

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

    const gutRows = generated.map((d) => ({ user_id: user.id, ...d.gut }));
    const wearableRows = generated.map((d) => ({ user_id: user.id, ...d.wearable }));

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
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}
