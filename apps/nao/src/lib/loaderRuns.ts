// ourobion nao — loader run identity, publication status and error mapping (R4-U3, O26).
//
// PURE module: no IO, no clock, no Supabase, no framework import — the same
// convention as ./authz.ts and ./simulatedHealth.ts, and for the same reason:
// `node --test` can import this file directly with no mocking at all, so every
// decision below is proven BY EXECUTION rather than asserted by source shape
// (route handlers themselves are not importable under node --test — see
// apps/nao/tests/authz.test.ts's header for the empirical reason).
//
// Four things live here, all of them decisions the route must not re-derive:
//
//  1. DURABLE IDEMPOTENCY (design §D.1) — `deriveRequestKey` folds the request's
//     inputs AND the target's pre-write raw-truth watermark into one key. The
//     inputs are exactly the ones that determine the output (`planLoadRange` is
//     pure in (existing range, requestedDays, today); `generateSimulatedDays` is
//     pure in (seed, scenario, anchorDate, dates)), plus the provenance state
//     that determines whether the write is permitted at all.
//
//  2. SQLSTATE → HTTP (design §C.5) — the RPC raises a distinct SQLSTATE per
//     failure class so a provenance conflict is machine-distinguishable from an
//     authorization denial and from a payload error. Pure, so every mapping is
//     unit-tested rather than discovered in production.
//
//  3. THE PUBLICATION STATUS FOLD (design §E.2) — a WORST-WINS MAXIMUM over a
//     total severity order, DERIVED on every read. There is deliberately no
//     stored `overall_status` column and no code path anywhere that ASSIGNS a
//     status: a stored aggregate is precisely what a later write clobbers, and
//     the defect being closed is "conflicting stage statuses collapse via
//     last-write-wins". Because the only way to obtain a status is to fold the
//     observations, a late-arriving `ok` stage row cannot improve an earlier
//     failure, and no arrival order can produce `published` unless every
//     condition holds simultaneously.
//
//  4. RETRY/REPAIR POLICY (design §F) — derived, and it names exactly one
//     rebuild path: the existing engine functions. Projections
//     (`baseline_snapshots`, `personal_signals`, `composed_insights`,
//     `insight_cards`, `gap_ledger`) are NEVER hand-edited; raw truth is fixed
//     only through the loader's own RPCs. There is no third path
//     (docs/memory/0001-two-tier-truth.md).
//
// NOTHING HERE CARRIES AN IDENTITY. Every value this module produces or shapes is
// safe to return to the browser and to store in the audit log: a run is named by
// its `requestKey` and a target by its registry `label`, never by a uuid. That is
// not decoration — R4-U2's one live data leak was raw `auth.users` uuids reaching
// the browser through the pipeline relay, and `redactDeep`/`redactText` would
// either strip a uuid field (leaving a confusing hole) or, if a field were named
// around the deny-list, let it through as a real regression.
import type { LoadPlan, LoadSegment, LoaderScenario, SimulatedDay } from './simulatedHealth.ts';

// ---------------------------------------------------------------------------
// Pipeline stages
// ---------------------------------------------------------------------------

/**
 * Mirror of `PIPELINE_STAGES` in supabase/functions/run-pipeline/index.ts, in the
 * same order. The sequencer runs them strictly sequentially and STOPS at the first
 * non-ok stage, which is the structural half of "a failure after baselines or
 * signals cannot publish": `generate-insights` is third and `insight_cards` — the
 * only user-visible surface — is the last thing it writes, so a stage-1 or stage-2
 * failure publishes zero new cards with no code in this repo needing to decide
 * that.
 */
export const PIPELINE_STAGES = [
  'compute-baselines',
  'evaluate-signals',
  'generate-insights',
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

// ---------------------------------------------------------------------------
// The derived publication status
// ---------------------------------------------------------------------------

/**
 * Ordered LOWEST severity first. The index IS the severity, which is what makes
 * the fold a `Math.max` and therefore associative, commutative and
 * order-independent — the three properties that make "worst wins" true no matter
 * what sequence the observations arrive in.
 *
 *   published  (0) all three stages present, all ok, all watermarks matching
 *   pending    (1) nothing observed yet
 *   incomplete (2) 1 or 2 of the 3 stages observed
 *   mixed      (3) a stage observed the target's raw truth at a DIFFERENT
 *                  watermark than the run committed — the run raced something
 *   failed     (4) any observed stage reported not-ok
 */
export const LOADER_RUN_STATUSES = [
  'published',
  'pending',
  'incomplete',
  'mixed',
  'failed',
] as const;
export type LoaderRunStatus = (typeof LOADER_RUN_STATUSES)[number];

/** Severity of each status. `failed` outranks `mixed` outranks `incomplete`. */
export const RUN_STATUS_SEVERITY: Readonly<Record<LoaderRunStatus, number>> = Object.freeze({
  published: 0,
  pending: 1,
  incomplete: 2,
  mixed: 3,
  failed: 4,
});

/** One stage outcome as OBSERVED. Nothing here is stored as an aggregate. */
export interface ObservedStage {
  stage: string;
  ok: boolean;
  httpStatus: number;
  /**
   * The target's raw-truth watermark digest observed when this stage finished, or
   * null when it could not be observed (no target scope was supplied, or the
   * watermark read failed — an unobserved watermark must never be reported as a
   * MATCHING one, so null simply contributes no `mixed` term).
   */
  watermarkDigest?: string | null;
}

/**
 * Fold observed stage outcomes into ONE status. Worst wins.
 *
 * `expectedDigest` is the digest the loader run committed (`watermark_after`). When
 * it is null the watermark cannot be checked at all and no `mixed` term is
 * contributed — the fold then reports on completeness and success only, and the
 * caller is expected to surface `watermarkChecked: false` rather than pretend the
 * check passed (see {@link buildPublicationSummary}).
 *
 * Duplicate observations of the same stage are folded worst-wins too: a not-ok
 * observation is never replaced by a later ok one for the same stage. Unknown
 * stage names are ignored rather than counted, so a future fourth stage cannot
 * silently turn a complete run into an `incomplete` one.
 */
export function foldRunStatus(
  stages: readonly ObservedStage[],
  expectedDigest: string | null,
): LoaderRunStatus {
  const worstPerStage = new Map<string, ObservedStage>();
  for (const stage of stages) {
    if (!(PIPELINE_STAGES as readonly string[]).includes(stage.stage)) continue;
    const held = worstPerStage.get(stage.stage);
    if (held === undefined || (held.ok && !stage.ok)) {
      worstPerStage.set(stage.stage, stage);
    }
  }
  const observed = [...worstPerStage.values()];

  // Every term is a severity; the answer is their maximum. Written as a list of
  // independent terms (not an if/else chain) so no term can shadow another: a run
  // that failed AND raced reports `failed`, and adding a term later cannot
  // accidentally make a worse condition unreachable.
  const terms: number[] = [RUN_STATUS_SEVERITY.published];
  if (observed.some((stage) => !stage.ok)) {
    terms.push(RUN_STATUS_SEVERITY.failed);
  }
  if (
    expectedDigest !== null &&
    observed.some(
      (stage) => typeof stage.watermarkDigest === 'string' && stage.watermarkDigest !== expectedDigest,
    )
  ) {
    terms.push(RUN_STATUS_SEVERITY.mixed);
  }
  if (observed.length === 0) {
    terms.push(RUN_STATUS_SEVERITY.pending);
  } else if (observed.length < PIPELINE_STAGES.length) {
    terms.push(RUN_STATUS_SEVERITY.incomplete);
  }
  return LOADER_RUN_STATUSES[Math.max(...terms)];
}

/** Only a full, clean, watermark-stable run is published. */
export function isPublished(status: LoaderRunStatus): boolean {
  return status === 'published';
}

/**
 * Everything that is not `published` is retryable — including `mixed`, whose repair
 * is "re-invoke the pipeline over the current raw truth", and `failed`, whose
 * repair is the same. Retrying a published run is not an error either; it is simply
 * unnecessary, and this returns false so a caller does not loop.
 */
export function isRetryable(status: LoaderRunStatus): boolean {
  return status !== 'published';
}

/**
 * What a retry must do, derived from the observations — never from a stored plan.
 *
 * `stagesToRerun` is ALWAYS the full sequence, and that is the correct answer
 * rather than a shortcut: every engine is a whole-batch rebuild from raw truth
 * (`compute-baselines` upserts on (user_id, metric_key) plus the O19 prune;
 * `evaluate-signals` upserts on (user_id, metric_a, metric_b) plus the A19
 * delete-on-loss prune; `generate-insights` re-derives `composed_insights` under a
 * content-hash primary key with ON CONFLICT DO NOTHING), so re-running from the
 * start is a rebuild, not a duplicate. Resuming "from the failed stage" would leave
 * stage-1 output stale relative to raw truth that may have moved.
 */
export interface RetryPlan {
  status: LoaderRunStatus;
  retryable: boolean;
  /** The ONLY way a projection is ever rebuilt. Never a hand-edit, never a direct write. */
  rebuildVia: 'run-pipeline';
  stagesToRerun: readonly PipelineStage[];
  /** Raw truth is unaffected by any pipeline failure: the engines only read it. */
  rawTruthAffected: false;
}

export function retryPlanFor(status: LoaderRunStatus): RetryPlan {
  return {
    status,
    retryable: isRetryable(status),
    rebuildVia: 'run-pipeline',
    stagesToRerun: PIPELINE_STAGES,
    rawTruthAffected: false,
  };
}

/** The worse of two statuses. Worst-wins ACROSS SOURCES, not only across stages. */
export function worstStatus(a: LoaderRunStatus, b: LoaderRunStatus): LoaderRunStatus {
  return RUN_STATUS_SEVERITY[a] >= RUN_STATUS_SEVERITY[b] ? a : b;
}

/**
 * Read the status out of `public.nao_loader_status`'s document (which
 * `nao_loader_record_pipeline` returns), or null when it is unusable.
 *
 * That function derives the SAME worst-wins fold in SQL, over per-stage watermark
 * digests it observed itself — which is strictly stronger than anything this layer
 * can observe, since it sees the digest at each stage's completion rather than once
 * around the whole pipeline. Its `'absent'` (no run row for the target at all) is
 * the same condition this scale calls `pending`.
 */
export function statusFromDatabase(value: unknown): LoaderRunStatus | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const status = (value as Record<string, unknown>).status;
  if (typeof status !== 'string') return null;
  if (status === 'absent') return 'pending';
  return (LOADER_RUN_STATUSES as readonly string[]).includes(status)
    ? (status as LoaderRunStatus)
    : null;
}

/** The publication verdict a route returns. Derived on every read; never stored. */
export interface PublicationSummary {
  status: LoaderRunStatus;
  published: boolean;
  retryable: boolean;
  stages: readonly { stage: string; ok: boolean; httpStatus: number }[];
  stagesObserved: number;
  stagesExpected: number;
  failedStage: string | null;
  /** false ⇒ no watermark comparison was possible, so `published` is NOT claimed. */
  watermarkChecked: boolean;
  /** null when unchecked; false ⇒ raw truth moved under the run (`mixed`). */
  watermarkStable: boolean | null;
  /**
   * 'database' ⇒ `nao_loader_status` derived it from recorded per-stage digests (the
   * authoritative form). 'relay' ⇒ derived here from the stage outcomes alone, which
   * cannot verify a watermark and is therefore capped below `published`.
   */
  source: 'database' | 'relay';
}

export function buildPublicationSummary(input: {
  stages: readonly ObservedStage[];
  expectedDigest: string | null;
  /**
   * The status `nao_loader_record_pipeline` derived in SQL, when a run was scoped.
   * It does not REPLACE the local fold — the two are combined worst-wins, so a
   * disagreement can only ever resolve pessimistically. There is still exactly one
   * rule (take the maximum severity) and still no stored aggregate anywhere.
   */
  databaseStatus?: LoaderRunStatus | null;
}): PublicationSummary {
  const folded = foldRunStatus(input.stages, input.expectedDigest);
  const databaseStatus = input.databaseStatus ?? null;
  // The database's verdict IS a watermark check: it compared each recorded stage's
  // observed digest against the run's own `watermark_after`.
  const watermarkChecked =
    databaseStatus !== null ||
    (input.expectedDigest !== null &&
      input.stages.some((stage) => typeof stage.watermarkDigest === 'string'));
  // An unverifiable watermark must never read as `published`: the whole point of the
  // digest term is that a run whose raw truth moved under it is not a publication.
  // With nothing to compare, the honest answer is "complete but unverified", which is
  // `incomplete` on this scale, not `published`.
  const local: LoaderRunStatus =
    folded === 'published' && !watermarkChecked ? 'incomplete' : folded;
  const status = databaseStatus === null ? local : worstStatus(local, databaseStatus);
  return {
    status,
    published: isPublished(status),
    retryable: isRetryable(status),
    stages: input.stages.map((stage) => ({
      stage: stage.stage,
      ok: stage.ok,
      httpStatus: stage.httpStatus,
    })),
    stagesObserved: new Set(
      input.stages
        .filter((stage) => (PIPELINE_STAGES as readonly string[]).includes(stage.stage))
        .map((stage) => stage.stage),
    ).size,
    stagesExpected: PIPELINE_STAGES.length,
    failedStage: input.stages.find((stage) => !stage.ok)?.stage ?? null,
    watermarkChecked,
    watermarkStable: watermarkChecked ? status !== 'mixed' : null,
    source: databaseStatus === null ? 'relay' : 'database',
  };
}

/**
 * Read stage outcomes out of a relayed `run-pipeline` body without trusting its
 * shape. `observedDigest` is attributed to every stage the body reports, because
 * the relay observes the target's watermark once, immediately after the sequencer
 * returns: every stage ran inside that window, so a change anywhere in the window
 * yields `mixed`. That is coarser than a per-stage observation and deliberately so
 * — the alternative would be to have the engines report a digest, which means
 * per-user scoping, which is an O12 locked decision this unit must not touch
 * (supabase/functions/run-pipeline/index.ts:21-24).
 */
export function stagesFromRelayBody(
  body: unknown,
  observedDigest: string | null,
): ObservedStage[] {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return [];
  const stages = (body as Record<string, unknown>).stages;
  if (!Array.isArray(stages)) return [];
  const out: ObservedStage[] = [];
  for (const entry of stages) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.stage !== 'string') continue;
    out.push({
      stage: row.stage,
      ok: row.ok === true,
      httpStatus: typeof row.status === 'number' ? row.status : 0,
      watermarkDigest: observedDigest,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// SQLSTATE → HTTP (design §C.5)
// ---------------------------------------------------------------------------

/** The custom SQLSTATE the RPC raises for a provenance conflict. */
export const LOADER_CONFLICT_SQLSTATE = 'OU409';

/**
 * Map a Postgres SQLSTATE from the loader RPCs to an HTTP status.
 *
 *   42501 → 403  every authorization denial: not a nao member, wrong tier, target
 *                not registered, target === caller, target is itself staff, or the
 *                target is leased by an in-flight run. ONE fixed message covers all
 *                of them so the RPC is not an oracle over the demo roster; the
 *                cases are distinguished by SETUP, never by the response.
 *   OU409 → 409  the pre-write provenance scan refused to overwrite rows that are
 *                not registered simulation. Nothing was written.
 *   23514 → 400  payload/shape violation (a CHECK, including the registry regex).
 *   22023 → 400  invalid parameter — includes the row-count assertion (a write that
 *                affected an unexpected number of rows) and request-key reuse
 *                across a different target.
 *   22P02 → 400  malformed input syntax (e.g. a non-uuid slipping past the route).
 *   42883 → 400  no function matches — what omitting a required argument produces,
 *                because the RPC's target parameter has NO DEFAULT and therefore
 *                cannot silently fall back to auth.uid().
 *   default 500  a genuine server fault.
 *
 * HONEST LIMITATION: `OU409` is not a SQLSTATE PostgREST knows, so a caller hitting
 * the RPC directly through PostgREST sees 500 for a conflict rather than 409. No
 * mutation occurred either way and the nao route is the supported caller, but the
 * rough edge is real.
 */
export function httpStatusForLoaderError(code: string | null | undefined): number {
  switch (code) {
    case '42501':
      return 403;
    case LOADER_CONFLICT_SQLSTATE:
      return 409;
    case '23514':
    case '22023':
    case '22P02':
    case '42883':
      return 400;
    default:
      return 500;
  }
}

// ---------------------------------------------------------------------------
// Durable idempotency key (design §D.1)
// ---------------------------------------------------------------------------

export const REQUEST_KEY_VERSION = 'nao.loader.v1';
/** Prefix so a derived key is visibly distinguishable from a caller-supplied one. */
export const REQUEST_KEY_PREFIX = 'nlk1-';
/** U+001F INFORMATION SEPARATOR ONE — cannot occur in any hashed field, so the join is unambiguous. */
const UNIT_SEPARATOR = '\u001F';

export interface RequestKeyInput {
  /** Hashed, never returned or logged: the key must identify the request without carrying an identity. */
  targetUserId: string;
  scenario: LoaderScenario | string;
  seed: string;
  /** null ⇒ the caller let the route choose (first load vs increment). */
  days: number | null;
  /** The UTC day the plan is anchored to. */
  anchorDate: string;
  /** The target's pre-write raw-truth digest, from `nao_loader_watermark`. */
  watermarkDigest: string;
}

async function sha256Hex(text: string): Promise<string> {
  // Web Crypto: present in Node >= 26 (this app's engine floor) and in the
  // Cloudflare Worker runtime nao deploys to. Deliberately NOT `node:crypto`,
  // which does not exist in the Worker runtime.
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive the durable request key from the STABLE INPUT WATERMARK plus every input
 * that determines the generated rows. Same logical request against the same
 * raw-truth state ⇒ same key ⇒ same generated rows ⇒ the RPC's
 * `on conflict (request_key) do nothing` collapses the replay and returns the
 * first completed result.
 *
 * The field ORDER here is fixed and the input is an object, so the key cannot
 * change because a caller passed the arguments in another order — only because a
 * VALUE changed.
 */
export async function deriveRequestKey(input: RequestKeyInput): Promise<string> {
  const parts = [
    REQUEST_KEY_VERSION,
    input.targetUserId,
    String(input.scenario),
    input.seed,
    input.days === null ? 'auto' : String(input.days),
    input.anchorDate,
    input.watermarkDigest,
  ];
  return REQUEST_KEY_PREFIX + (await sha256Hex(parts.join(UNIT_SEPARATOR)));
}

// ---------------------------------------------------------------------------
// The target's raw-truth watermark
// ---------------------------------------------------------------------------

/**
 * The RPC the route calls to obtain the target's watermark.
 *
 * NOT `nao_loader_watermark` directly: that function is a bare `security definer`
 * read with no authorization check of its own, and it is granted to `service_role`
 * ONLY — deliberately, because granting it to `authenticated` would make it an
 * oracle over ANY user's log dates and provenance markers, which is precisely the
 * cross-user exposure R4-U2 closed. `nao_loader_plan_inputs` is the GATED wrapper:
 * `nao_authorize('curator')` then `nao_loader_assert_target(...)`, returning the
 * watermark document plus the target's registry `targetLabel`.
 *
 * The route needs it because the caller's own cookie-bound client cannot see the
 * TARGET's rows at all — `daily_gut_rows`/`wearable_daily` RLS is
 * `auth.uid() = user_id` and R4-U2's Invariant P forbids changing it — so both the
 * planner's "existing range" (over BOTH tables) and the idempotency key's watermark
 * digest have to come through a definer read.
 */
export const PLAN_INPUTS_RPC = 'nao_loader_plan_inputs';

/**
 * `public.nao_loader_watermark(p_target_user_id uuid)`'s return document, as
 * surfaced through {@link PLAN_INPUTS_RPC}: `{gutCount, gutMin, gutMax, wearCount,
 * wearMin, wearMax, digest}`.
 */
export interface LoaderWatermark {
  gutCount: number;
  gutMin: string | null;
  gutMax: string | null;
  wearCount: number;
  wearMin: string | null;
  wearMax: string | null;
  digest: string;
}

function asCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number.parseInt(value, 10);
  return 0;
}

function asDate(value: unknown): string | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/** Parse the RPC's jsonb defensively; null when it is not a usable watermark. */
export function parseWatermark(value: unknown): LoaderWatermark | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const w = value as Record<string, unknown>;
  if (typeof w.digest !== 'string' || w.digest === '') return null;
  return {
    gutCount: asCount(w.gutCount),
    gutMin: asDate(w.gutMin),
    gutMax: asDate(w.gutMax),
    wearCount: asCount(w.wearCount),
    wearMin: asDate(w.wearMin),
    wearMax: asDate(w.wearMax),
    digest: w.digest,
  };
}

/** {@link PLAN_INPUTS_RPC}'s document: the watermark plus the target's registry label. */
export interface PlanInputs {
  watermark: LoaderWatermark;
  targetLabel: string | null;
}

export function parsePlanInputs(value: unknown): PlanInputs | null {
  const watermark = parseWatermark(value);
  if (watermark === null) return null;
  const label = (value as Record<string, unknown>).targetLabel;
  return {
    watermark,
    targetLabel: typeof label === 'string' && TARGET_LABEL_RE.test(label) ? label : null,
  };
}

export interface RangeSummary {
  minDate: string | null;
  maxDate: string | null;
  days: number;
}

/**
 * The planner's "existing range", taken over BOTH truth tables together.
 *
 * This is the fix for the specific defect that made a half-loaded day possible in
 * the first place: pre-U3 the plan was computed from `daily_gut_rows` ALONE, so a
 * day present on only the wearable side was invisible to planning and a
 * gut-only/wearable-only history diverged silently. Planning over the union means
 * a divergence can only ever be closed, never widened, and the RPC's per-table
 * provenance scan then decides per table whether each side may be written.
 */
export function watermarkRange(watermark: LoaderWatermark): { minDate: string; maxDate: string } | null {
  const mins = [watermark.gutMin, watermark.wearMin].filter((d): d is string => d !== null);
  const maxes = [watermark.gutMax, watermark.wearMax].filter((d): d is string => d !== null);
  if (mins.length === 0 || maxes.length === 0) return null;
  return {
    minDate: mins.reduce((a, b) => (a < b ? a : b)),
    maxDate: maxes.reduce((a, b) => (a > b ? a : b)),
  };
}

/** `daily_gut_rows`' own range, in the pre-U3 response shape (`range` in the body). */
export function gutRangeSummary(watermark: LoaderWatermark): RangeSummary {
  return { minDate: watermark.gutMin, maxDate: watermark.gutMax, days: watermark.gutCount };
}

/** Counts and digest only — no dates? No: dates are not identities, and they are the operator-useful part. */
export interface WatermarkSummary {
  gutDays: number;
  gutMin: string | null;
  gutMax: string | null;
  wearableDays: number;
  wearableMin: string | null;
  wearableMax: string | null;
  digest: string;
  /** true ⇒ the two truth tables cover exactly the same span (no half-loaded day at the edges). */
  aligned: boolean;
}

export function watermarkSummary(watermark: LoaderWatermark): WatermarkSummary {
  return {
    gutDays: watermark.gutCount,
    gutMin: watermark.gutMin,
    gutMax: watermark.gutMax,
    wearableDays: watermark.wearCount,
    wearableMin: watermark.wearMin,
    wearableMax: watermark.wearMax,
    digest: watermark.digest,
    aligned:
      watermark.gutCount === watermark.wearCount &&
      watermark.gutMin === watermark.wearMin &&
      watermark.gutMax === watermark.wearMax,
  };
}

// ---------------------------------------------------------------------------
// The RPC call payload
// ---------------------------------------------------------------------------

/** `p_plan` — the resolved plan, stored on the run row so a replay can report it. */
export interface ApplyPlanPayload {
  seed: string;
  scenario: string;
  anchorDate: string;
  daysRequested: number;
  segments: readonly LoadSegment[];
  forwardDays: number;
  backfillDays: number;
}

/** One element of `p_days` — a MATCHED PAIR, which is what makes the write atomic per day. */
export interface ApplyDayPayload {
  date: string;
  gut: SimulatedDay['gut'];
  wearable: SimulatedDay['wearable'];
}

/**
 * Named EXACTLY as `public.nao_loader_apply_simulated_days`'s parameters, so the
 * call site is a literal transcription of the function signature and a rename on
 * either side is a typecheck failure rather than a runtime "function not found".
 */
export interface ApplyArgs {
  p_target_user_id: string;
  p_request_key: string;
  p_origin: string;
  p_plan: ApplyPlanPayload;
  p_days: readonly ApplyDayPayload[];
}

export function buildApplyArgs(input: {
  target: string;
  requestKey: string;
  origin: string;
  seed: string;
  scenario: string;
  anchorDate: string;
  daysRequested: number;
  plan: LoadPlan;
  generated: readonly SimulatedDay[];
}): ApplyArgs {
  return {
    p_target_user_id: input.target,
    p_request_key: input.requestKey,
    p_origin: input.origin,
    p_plan: {
      seed: input.seed,
      scenario: input.scenario,
      anchorDate: input.anchorDate,
      daysRequested: input.daysRequested,
      segments: input.plan.segments,
      forwardDays: input.plan.forwardDays,
      backfillDays: input.plan.backfillDays,
    },
    // Gut and wearable travel TOGETHER, one object per day, in one array, in one
    // statement, in one transaction. The pre-U3 shape was two independent
    // PostgREST calls — two transactions with a `throw` between them and no
    // compensation — which is exactly the non-atomicity this unit owns.
    p_days: input.generated.map((day) => ({
      date: day.date,
      gut: day.gut,
      wearable: day.wearable,
    })),
  };
}

// ---------------------------------------------------------------------------
// The response the browser sees
// ---------------------------------------------------------------------------

/**
 * The loader's success body. Read the field list as a claim: there is no `target`,
 * no `userId`, no `actor` and no digest of a credential anywhere in it. A run is
 * identified by `requestKey` (a hash) and a target by `targetLabel` (a
 * non-identifying registry name of the form `demo:<name>`), which is why this shape
 * survives `redactDeep`/`redactText` unchanged instead of arriving at the browser
 * full of `[redacted]` holes.
 */
export interface LoaderResponseBody {
  ok: true;
  loadedDays: number;
  forwardDays: number;
  backfillDays: number;
  segments: readonly LoadSegment[];
  seed: string;
  scenario: string;
  origin: string;
  requestKey: string;
  requestKeyMode: 'explicit' | 'derived';
  /** true ⇒ this exact request already completed; the stored result is being returned. */
  replayed: boolean;
  /** The registry label of the demo target, or null when the RPC did not report one. */
  targetLabel: string | null;
  /** `daily_gut_rows`' range after the write — the pre-U3 field, same shape. */
  range: RangeSummary;
  watermarkBefore: WatermarkSummary;
  watermarkAfter: WatermarkSummary | null;
  today: string;
}

/**
 * Pull the few fields the response needs out of the RPC's returned document
 * without trusting its shape, and WITHOUT copying it through: relaying an
 * unknown document verbatim is how an unanticipated field (a target uuid, a
 * message quoting a key) reaches the browser. Only these named, typed,
 * identity-free values cross the boundary.
 */
export interface ApplyResult {
  replayed: boolean;
  targetLabel: string | null;
  /** The RPC reports the two watermarks as DIGESTS, not documents. */
  watermarkBeforeDigest: string | null;
  watermarkAfterDigest: string | null;
  /** The run's own day count — authoritative on a REPLAY, where nothing new was written. */
  loadedDays: number | null;
  /** Rows written per table, when the RPC reports them. */
  gutRowsWritten: number | null;
  wearableRowsWritten: number | null;
  firstDate: string | null;
  lastDate: string | null;
}

/** A registry label is non-identifying BY SHAPE: `demo:<name>`, never a uuid. */
const TARGET_LABEL_RE = /^demo:[a-z0-9][a-z0-9._-]{0,32}$/;

function asDigest(value: unknown): string | null {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value) ? value : null;
}

function asInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number.parseInt(value, 10);
  return null;
}

export function parseApplyResult(value: unknown): ApplyResult {
  const empty: ApplyResult = {
    replayed: false,
    targetLabel: null,
    watermarkBeforeDigest: null,
    watermarkAfterDigest: null,
    loadedDays: null,
    gutRowsWritten: null,
    wearableRowsWritten: null,
    firstDate: null,
    lastDate: null,
  };
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return empty;
  const r = value as Record<string, unknown>;
  return {
    replayed: r.replayed === true,
    // Accepted ONLY in the non-identifying shape the registry's own CHECK enforces,
    // so a uuid cannot reach the browser under this key however the RPC misbehaves.
    targetLabel:
      typeof r.targetLabel === 'string' && TARGET_LABEL_RE.test(r.targetLabel) ? r.targetLabel : null,
    watermarkBeforeDigest: asDigest(r.watermarkBefore),
    watermarkAfterDigest: asDigest(r.watermarkAfter),
    loadedDays: asInt(r.loadedDays),
    gutRowsWritten: asInt(r.gutRowsWritten),
    wearableRowsWritten: asInt(r.wearableRowsWritten),
    firstDate: asDate(r.firstDate),
    lastDate: asDate(r.lastDate),
  };
}

export function buildLoaderResponse(input: {
  /** What the route generated. The RPC's own count wins on a replay, where nothing new was written. */
  loadedDays: number;
  plan: LoadPlan;
  seed: string;
  scenario: string;
  origin: string;
  requestKey: string;
  requestKeyMode: 'explicit' | 'derived';
  today: string;
  watermarkBefore: LoaderWatermark;
  /** The post-write watermark, re-read through the gated RPC after the apply committed. */
  watermarkAfter: LoaderWatermark | null;
  applied: ApplyResult;
}): LoaderResponseBody {
  const after = input.watermarkAfter;
  return {
    ok: true,
    loadedDays: input.applied.loadedDays ?? input.loadedDays,
    forwardDays: input.plan.forwardDays,
    backfillDays: input.plan.backfillDays,
    segments: input.plan.segments,
    seed: input.seed,
    scenario: input.scenario,
    origin: input.origin,
    requestKey: input.requestKey,
    requestKeyMode: input.requestKeyMode,
    replayed: input.applied.replayed,
    targetLabel: input.applied.targetLabel,
    range: gutRangeSummary(after ?? input.watermarkBefore),
    watermarkBefore: watermarkSummary(input.watermarkBefore),
    watermarkAfter: after === null ? null : watermarkSummary(after),
    today: input.today,
  };
}

/**
 * Test/diagnostic helper: every uuid-shaped substring anywhere in a document. Used
 * by apps/nao/tests to assert the REAL response shape carries none, rather than
 * asserting it about an invented shape.
 */
export function uuidsIn(value: unknown): string[] {
  return (
    JSON.stringify(value ?? null).match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ) ?? []
  );
}
