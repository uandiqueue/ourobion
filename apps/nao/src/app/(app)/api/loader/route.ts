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
// column). R4-U3 stamps 'simulated:run4-demo' and REGISTERS the vocabulary in
// public.nao_simulation_origins rather than constraining the columns: a CHECK or a
// trigger there would break four `expect_ok` assertions in R4-U2's authz harness
// (supabase/tests/authz/40_pre_u2_probe.sql, 60_assertions.sql insert 'probe:pa' /
// 'probe:pb' and expect success, and U3's migrations are live while those assertions
// run). See lib/simulatedHealth.ts's SIMULATED_DATA_ORIGIN_RUN4 comment.
//
// R4-U3 (O26) — WHAT CHANGED HERE, AND WHY IT IS NOT COSMETIC. This is the referent
// for the forward reference the pre-U3 file carried ("R4-U3 owns the non-atomicity
// between the two upserts").
//
//  1. ATOMICITY. POST used to issue TWO independent PostgREST upserts — two
//     transactions, a `throw` between them, no compensation — so a wearable failure
//     after a gut success left a HALF-LOADED DAY in truth: a day whose self-report
//     metrics exist and whose wearable metrics do not, indistinguishable afterwards
//     from a real partial log, and readable by the pipeline in that state. Both
//     writes now happen inside ONE call to
//     `public.nao_loader_apply_simulated_days(...)`. PostgREST runs one request in
//     one transaction and the function has NO exception handler, so any failure
//     aborts everything: no gut rows, no wearable rows, no run row. "Partially
//     applied" stops being a representable state, and a retry with the same
//     requestKey is a clean first execution because the key's uniqueness record died
//     with the transaction.
//
//  2. THE TARGET IS EXPLICIT AND MUST NOT BE THE CALLER. POST used to write
//     `user_id: gate.userId` — "load simulated data into whoever is signed in".
//     O26 requires simulation to be isolated to an approved demo context, so
//     `target` is now a REQUIRED body field, is never defaulted, and a target equal
//     to the caller is refused. The RPC refuses again (registered in
//     `nao_demo_targets`, not itself nao staff, distinct from `auth.uid()`) with ONE
//     fixed message and errcode 42501, so it is not an oracle over the demo roster.
//     The RPC's parameter has NO DEFAULT: omitting it is a function-resolution
//     failure, not a silent fall back to auth.uid().
//     CONSEQUENCE, STATED PLAINLY: components/LoaderPanel.tsx still POSTs without a
//     `target` and therefore now receives a 400 naming the missing field. Adding the
//     field to that panel belongs to whichever unit owns
//     apps/nao/src/components/** — it is outside this unit's owned paths.
//
//  3. PLANNING READS BOTH TRUTH TABLES. The plan used to come from
//     `daily_gut_rows` alone, so a day present only on the wearable side was
//     invisible to planning. The range now comes from `nao_loader_watermark`, over
//     both tables (lib/loaderRuns.ts's watermarkRange) — which is also the only way
//     to read the TARGET's range at all, since daily_gut_rows/wearable_daily RLS is
//     `auth.uid() = user_id` and R4-U2's Invariant P forbids changing it.
//
//  4. NO IDENTITY IN THE RESPONSE OR THE AUDIT ROW. The body carries `targetLabel`
//     (the registry's non-identifying `demo:<name>`) and `requestKey` (a hash) —
//     never the target uuid. It is additionally passed through `redactDeep` on the
//     way out, so a future field cannot leak one either.
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
import { guardRole, recordControlEvent, redactDeep, redactText } from '@/lib/authzServer';
import {
  DEFAULT_FIRST_LOAD_DAYS,
  DEFAULT_INCREMENT_DAYS,
  DEFAULT_SEED,
  SIMULATED_DATA_ORIGIN_RUN4,
  generateSimulatedDays,
  planLoadRange,
  validateLoaderBody,
  validateLoaderTarget,
  type LoadedRange,
  type LoaderRequestBody,
  type LoaderScenario,
  type SimulatedDay,
} from '@/lib/simulatedHealth';
import {
  PLAN_INPUTS_RPC,
  buildApplyArgs,
  buildLoaderResponse,
  deriveRequestKey,
  httpStatusForLoaderError,
  parseApplyResult,
  parsePlanInputs,
  watermarkRange,
} from '@/lib/loaderRuns';

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

  // The one check that needs the caller's identity. 403, not 400: "you may not aim
  // the loader here" is an authorization answer, and it is the SAME answer (and the
  // same message) the RPC gives for every other not-permitted target, so the route
  // does not become an oracle the RPC refused to be.
  const targetError = validateLoaderTarget(body.target, gate.userId);
  if (targetError) return json({ error: targetError }, 403);

  const supabase = await createServerSupabaseClient();
  const today = todayUtc();
  const seed = body.seed ?? DEFAULT_SEED;
  const scenario: LoaderScenario = body.scenario ?? 'recent-dip';
  const origin = body.origin ?? SIMULATED_DATA_ORIGIN_RUN4;

  try {
    // ── Stable input watermark (design §D.1) ────────────────────────────────
    // A GATED `security definer` read — `nao_authorize('curator')` then
    // `nao_loader_assert_target(...)` — because the caller's own client cannot see
    // the TARGET's rows at all under `auth.uid() = user_id` RLS, and because the
    // underlying `nao_loader_watermark` is service_role-only for good reason (a bare
    // grant would make it an oracle over any user's log dates). It supplies both the
    // planner's existing range (over BOTH truth tables) and the digest that makes a
    // derived request key stable for one logical request.
    const planRead = await supabase.rpc(PLAN_INPUTS_RPC, { p_target_user_id: body.target });
    if (planRead.error) {
      return json(
        { error: redactText(planRead.error.message) },
        httpStatusForLoaderError(planRead.error.code),
      );
    }
    const planInputs = parsePlanInputs(planRead.data);
    if (planInputs === null) {
      return json({ error: 'loader watermark unavailable for the requested target' }, 500);
    }
    const watermarkBefore = planInputs.watermark;

    const existing: LoadedRange | null = watermarkRange(watermarkBefore);
    const days = body.days ?? (existing === null ? DEFAULT_FIRST_LOAD_DAYS : DEFAULT_INCREMENT_DAYS);
    const plan = planLoadRange(existing, days, today);

    // Explicit key ⇒ authoritative and durable forever. Derived key ⇒ collapses the
    // concurrent/immediate replay (two clicks, a double submit, a retry that arrives
    // before the first attempt commits), because all of those read the same
    // pre-write watermark. It deliberately does NOT collapse a retry that arrives
    // after the first attempt committed: that attempt changed the watermark by
    // definition, and "retry" vs "load 7 more days" are different intents that only
    // the caller can distinguish — which is what an explicit key is for, and what
    // the 14 → +7 → 21 acceptance run depends on.
    const requestKeyMode = body.requestKey === undefined ? 'derived' : 'explicit';
    const requestKey =
      body.requestKey ??
      (await deriveRequestKey({
        targetUserId: body.target,
        scenario,
        seed,
        days: body.days ?? null,
        anchorDate: today,
        watermarkDigest: watermarkBefore.digest,
      }));

    // GATE ORDER + AUDIT ORDER (R4-U2 finding 2, C4): this stays the FIRST
    // recordControlEvent in this handler and the action stays 'loader.simulate' —
    // apps/nao/tests/authz.test.ts pins both, and inventing a new action would
    // require altering nao_control_events' CHECK constraint, which is U2's.
    // It also stays BEFORE the RPC, which means an audit row can exist for a run
    // that then rolled back. That is correct and deliberate: the audit log records
    // ATTEMPTS BY AN ACTOR, `nao_loader_runs` records WHAT COMMITTED. `requestKey`
    // is what joins the two, and it is a hash — the audit row still carries no
    // identity of the target.
    await recordControlEvent('loader.simulate', scenario, {
      days: body.days,
      seed,
      origin,
      requestKey,
      requestKeyMode,
    });

    const generated: SimulatedDay[] = plan.segments.flatMap((segment) =>
      generateSimulatedDays({
        startDate: segment.startDate,
        days: segment.days,
        seed,
        scenario,
        anchorDate: today,
        origin,
      }),
    );

    // ── The atomic write (design §A.2, §C.1) ────────────────────────────────
    // ONE PostgREST request ⇒ ONE transaction. Inside it, in order: U2's
    // `nao_authorize('curator')` gate, payload shape checks, target validation, an
    // advisory transaction lock on the target, the lease check, the run-row insert
    // (`on conflict (request_key) do nothing` — a NULL id means replay, return the
    // stored result), the pre-write provenance scan over BOTH tables, then both
    // upserts with row-count assertions. Gut and wearable rows travel together in
    // `p_days` as matched pairs, so there is no ordering between them to get wrong
    // and no window in which one exists without the other.
    const applyCall = await supabase.rpc(
      'nao_loader_apply_simulated_days',
      buildApplyArgs({
        target: body.target,
        requestKey,
        origin,
        seed,
        scenario,
        anchorDate: today,
        daysRequested: days,
        plan,
        generated,
      }),
    );
    if (applyCall.error) {
      // 403 authorization / 409 provenance conflict (nothing written) / 400 payload
      // / 500 otherwise — and the message is redacted either way, because a relayed
      // Postgres message can quote a conflicting value.
      return json(
        { error: redactText(applyCall.error.message) },
        httpStatusForLoaderError(applyCall.error.code),
      );
    }

    const applied = parseApplyResult(applyCall.data);

    // Re-read the watermark AFTER the apply committed, through the same gated RPC.
    // This is the response's `range` (the pre-U3 field, same shape) and the digest a
    // caller hands to the pipeline relay. It is a read of committed truth, so it
    // cannot resurrect a rolled-back write: a failed apply returned above.
    const afterRead = await supabase.rpc(PLAN_INPUTS_RPC, { p_target_user_id: body.target });
    const watermarkAfter = afterRead.error ? null : (parsePlanInputs(afterRead.data)?.watermark ?? null);

    return json(
      redactDeep(
        buildLoaderResponse({
          loadedDays: generated.length,
          plan,
          seed,
          scenario,
          origin,
          requestKey,
          requestKeyMode,
          today,
          watermarkBefore,
          watermarkAfter,
          applied: {
            ...applied,
            targetLabel: applied.targetLabel ?? planInputs.targetLabel,
          },
        }),
      ),
    );
  } catch (err) {
    // Same reason as GET: a relayed Postgres message can embed a value.
    return json({ error: redactText(err instanceof Error ? err.message : String(err)) }, 500);
  }
}
