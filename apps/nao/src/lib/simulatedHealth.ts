// ourobion nao — simulated health-data generator (O11, run-2 U6).
//
// PURE module: no IO, no clock, no Supabase — the /api/loader route handler is the
// I/O glue (nao's ingestControl.ts convention). Given a start date, a day count and a
// seed, produces one coherent row per day for biotope's EXISTING truth tables
// (daily_gut_rows + wearable_daily — O11 locked: reuse the registry tables, never a
// parallel schema). Deterministic: the same (seed, scenario, anchorDate, date) always
// yields the same values, so re-loads upsert identical rows (idempotent).
//
// STATISTICAL SHAPE (mirrors scripts/seed-test-data.sql's realism goals, plus the
// structure S4/S5 need to actually fire):
//   - a shared per-day latent "wellness" factor drives gut_comfort_score, mood_score,
//     energy_score, sleep_duration_min and hrv_sdnn_ms together → correlated series
//     (the S5 pair evaluator and the gut↔mood co-movement rule see real co-movement);
//   - scenario 'recent-dip' (default) adds a downward shift over the DIP_DAYS days
//     ending at `anchorDate` (the route passes "today"): scores drop ~1.5–2 points,
//     sleep ~90 min, HRV ~15 ms → S3 7-day trends turn "falling" and S4 modified-z
//     leaves the ±1σ̂ deadband, so trend rules and signal patterns fire on demo data;
//   - 1–5 ordinal scores carry enough noise that the 28-day baseline's MAD is
//     non-degenerate (ADR-0002 suppresses MAD = 0 baselines).
//
// PROVENANCE (O11 locked: simulated rows clearly distinguishable; D3 records the
// nao-writes-biotope-tables deviation): every wearable_daily row sets the EXISTING
// `source` column and every daily_gut_rows row sets the NEW additive nullable
// `data_origin` column (migration 20260724120000) to SIMULATED_DATA_ORIGIN.

/** The provenance flag stamped on every simulated row (null/other = real data). */
export const SIMULATED_DATA_ORIGIN = 'simulated:run2-demo';

/**
 * R4-U3 (O26): the origin the ATOMIC loader writes. Registered in
 * `public.nao_simulation_origins`; NOT a CHECK constraint on
 * `daily_gut_rows.data_origin` / `wearable_daily.source`.
 *
 * WHY A REGISTRY AND NOT A CHECK (design §B.2, constraint C3 — this is
 * mechanical, not a preference): R4-U2's authz harness inserts
 * `data_origin = 'probe:pa'` / `'probe:pb'` and `source = 'probe:pa'` /
 * `'probe:pb'` and expects `ok` (supabase/tests/authz/40_pre_u2_probe.sql,
 * 60_assertions.sql), and seeds `'seed:baseline'` in both columns
 * (30_pre_u2_seed.sql). U3's migrations apply BEFORE U2's assertions run, so a
 * closed-vocabulary CHECK — or a BEFORE INSERT/UPDATE trigger rewriting the
 * marker — would turn four `expect_ok` assertions into `error:23514` and break
 * the pre-vs-post identity assertion too. The vocabulary is therefore closed at
 * the WRITER (the `nao_loader_apply_simulated_days` RPC, which consults the
 * registry table) and at this boundary (validateLoaderBody), never at the
 * column.
 *
 * `SIMULATED_DATA_ORIGIN` ('simulated:run2-demo') stays exported and unchanged:
 * rows already carrying it are REGISTERED (hence recognised as simulated, hence
 * overwritable by the loader), so nothing already in a database is orphaned.
 */
export const SIMULATED_DATA_ORIGIN_RUN4 = 'simulated:run4-demo';

/** Shape of one row of the `public.nao_simulation_origins` registry. */
export interface SimulationOrigin {
  origin: string;
  label: string;
  /** false ⇒ the marker names real/provider data and the loader must never write or overwrite it. */
  isSimulated: boolean;
  /** Which harness/unit owns the marker. */
  owner: string;
}

/**
 * Mirror of the seed rows in `20260728030000_nao_simulation_provenance.sql`.
 *
 * DESCRIPTIVE for rows that already exist, PRESCRIPTIVE for what this loader may
 * write: an unregistered marker (a typo such as `simulated:run4-demoo`, or a real
 * provider value such as `provider:oura`) fails closed — refused here at the
 * boundary and refused again by the RPC's pre-write conflict scan. `'probe:pa'` /
 * `'probe:pb'` are deliberately ABSENT: unregistered ⇒ treated as non-simulated ⇒
 * protected, which is the correct posture for another harness's fixtures and needs
 * no coordination with U2.
 */
export const SIMULATION_ORIGIN_REGISTRY: readonly SimulationOrigin[] = Object.freeze([
  Object.freeze({
    origin: SIMULATED_DATA_ORIGIN,
    label: 'O11/run-2 demo loader',
    isSimulated: true,
    owner: 'apps/nao/src/lib/simulatedHealth.ts',
  }),
  Object.freeze({
    origin: SIMULATED_DATA_ORIGIN_RUN4,
    label: 'R4-U3 atomic demo loader',
    isSimulated: true,
    owner: 'apps/nao/src/lib/simulatedHealth.ts',
  }),
  Object.freeze({
    origin: 'seed:baseline',
    label: 'R4-U2 authz probe fixture',
    isSimulated: true,
    owner: 'supabase/tests/authz/30_pre_u2_seed.sql',
  }),
]) as readonly SimulationOrigin[];

/**
 * The registry's own CHECK regex, mirrored (`namespace:name`). It constrains the
 * REGISTRY, where a closed vocabulary is safe — never the truth tables' columns.
 */
export const SIMULATION_ORIGIN_RE = /^[a-z][a-z0-9]*:[A-Za-z0-9._-]{1,48}$/;

/** True iff `value` is a registered, simulated origin the loader may WRITE. */
export function isRegisteredSimulatedOrigin(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    SIMULATION_ORIGIN_REGISTRY.some((entry) => entry.origin === value && entry.isSimulated)
  );
}

export const LOADER_SCENARIOS = ['recent-dip', 'steady'] as const;
export type LoaderScenario = (typeof LOADER_SCENARIOS)[number];

/** Days (ending at anchorDate) the 'recent-dip' scenario shifts downward. */
export const DIP_DAYS = 3;

export const DEFAULT_FIRST_LOAD_DAYS = 14;
export const DEFAULT_INCREMENT_DAYS = 7;
export const MAX_LOAD_DAYS = 60;
export const DEFAULT_SEED = 'run2-demo';

// ─── Deterministic pseudo-randomness ────────────────────────────────────────────────

/** FNV-1a 32-bit hash — folds (seed, date, channel) into a PRNG seed. */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — small deterministic PRNG over a 32-bit seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform [0,1) for one (seed, date, channel) triple. */
function unit(seed: string, date: string, channel: string): number {
  return mulberry32(fnv1a(`${seed}|${date}|${channel}`))();
}

/** Approximately standard-normal noise (Irwin–Hall over 3 uniforms, rescaled to σ≈1). */
function gauss(seed: string, date: string, channel: string): number {
  const rand = mulberry32(fnv1a(`${seed}|${date}|${channel}`));
  return (rand() + rand() + rand() - 1.5) * 2;
}

// ─── Date math (UTC, ISO yyyy-mm-dd) ────────────────────────────────────────────────

export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDaysIso(a: string, b: string): number {
  const ms = new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime();
  return Math.round(ms / 86400000);
}

// ─── Row shapes (column names verbatim from the migrations) ─────────────────────────

export interface SimulatedGutRow {
  log_date: string;
  region: string;
  urine_colour: number;
  stool_form: number;
  stool_count: number;
  stool_variability: number;
  outside_meals: number;
  mosquito_bites: number;
  energy_score: number;
  mood_score: number;
  gut_comfort_score: number;
  symptom_flags: string[];
  notes: string;
  standing_water_present: boolean;
  on_antibiotics: boolean;
  gut_watch_active: boolean;
  log_completeness: number;
  /** Provenance (additive column, migration 20260724120000): always a REGISTERED simulated origin. */
  data_origin: string;
}

export interface SimulatedWearableRow {
  date: string;
  resting_hr_bpm: number;
  hrv_sdnn_ms: number;
  sleep_duration_min: number;
  spo2_pct: number;
  body_temp_c: number;
  step_count: number;
  /** Provenance via wearable_daily's EXISTING source column: always a REGISTERED simulated origin. */
  source: string;
}

export interface SimulatedDay {
  date: string;
  gut: SimulatedGutRow;
  wearable: SimulatedWearableRow;
}

export interface GenerateOptions {
  /** First generated day (inclusive), ISO yyyy-mm-dd. */
  startDate: string;
  /** Number of consecutive days to generate. */
  days: number;
  seed?: string;
  scenario?: LoaderScenario;
  /**
   * The 'recent-dip' shift covers the DIP_DAYS days ending here (the route passes
   * "today", so the dip is always the most recent data). Days outside the window —
   * and every day under 'steady' — carry baseline noise only.
   */
  anchorDate: string;
  /**
   * Provenance marker stamped on BOTH row shapes. Defaults to
   * {@link SIMULATED_DATA_ORIGIN_RUN4} — the R4-U3 atomic loader's origin.
   * Passing {@link SIMULATED_DATA_ORIGIN} reproduces the run-2 stamp byte for
   * byte, which is why the older constant stays exported: existing rows keep
   * their marker and stay recognised (registered) as simulated.
   */
  origin?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────────

function clampInt(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(value)));
}

function clampRound(value: number, lo: number, hi: number, digits: number): number {
  const f = 10 ** digits;
  return Math.min(hi, Math.max(lo, Math.round(value * f) / f));
}

// ─── Generator ──────────────────────────────────────────────────────────────────────

/**
 * Generate `days` consecutive simulated days starting at `startDate`. Pure and
 * deterministic in all inputs; each day depends only on (seed, scenario, anchorDate,
 * date), so overlapping loads produce byte-identical rows.
 */
export function generateSimulatedDays(opts: GenerateOptions): SimulatedDay[] {
  const seed = opts.seed ?? DEFAULT_SEED;
  const scenario = opts.scenario ?? 'recent-dip';
  const origin = opts.origin ?? SIMULATED_DATA_ORIGIN_RUN4;
  const dipStart = addDaysIso(opts.anchorDate, -(DIP_DAYS - 1));

  const out: SimulatedDay[] = [];
  for (let i = 0; i < opts.days; i++) {
    const date = addDaysIso(opts.startDate, i);
    const dip = scenario === 'recent-dip' && date >= dipStart && date <= opts.anchorDate ? 1 : 0;

    // Shared latent wellness factor — the correlation backbone.
    const w = gauss(seed, date, 'wellness');
    const g = (channel: string) => gauss(seed, date, channel);
    const u = (channel: string) => unit(seed, date, channel);

    // Wearables (continuous; CHECK-free but kept physiological).
    const sleepMin = clampInt(432 + 30 * w - 95 * dip + 18 * g('sleep'), 240, 600);
    const hrv = clampRound(56 + 7 * w - 16 * dip + 3 * g('hrv'), 20, 120, 1);
    const restingHr = clampInt(62 - 3 * w + 6 * dip + 2 * g('rhr'), 45, 100);
    const spo2 = clampRound(97.5 + 0.4 * g('spo2') - 0.6 * dip, 90, 100, 1);
    const bodyTemp = clampRound(36.7 + 0.15 * g('temp') + 0.15 * dip, 35.5, 38.5, 1);
    const steps = clampInt(8200 + 1200 * w - 2500 * dip + 1500 * g('steps'), 500, 30000);

    // Self-report ordinals (CHECK ranges from the daily_gut_rows migration). Noise is
    // deliberately generous so the 28-day baseline keeps MAD > 0 (ADR-0002 degeneracy).
    const gutComfort = clampInt(3.9 + 0.7 * w - 1.9 * dip + 0.55 * g('gut'), 1, 5);
    const mood = clampInt(3.9 + 0.7 * w - 1.8 * dip + 0.55 * g('mood'), 1, 5);
    const energy = clampInt(
      3.9 + 0.5 * w + ((sleepMin - 432) / 120) * 0.5 - 1.5 * dip + 0.45 * g('energy'),
      1,
      5,
    );
    const urineColour = clampInt(3 + 0.9 * g('urine') + 1.2 * dip, 1, 8);
    const stoolForm = clampInt(4 + 0.8 * g('stool') + 0.8 * dip, 1, 7);
    const stoolCount = clampInt(1.8 + 0.7 * g('count') + 0.6 * dip, 0, 10);
    const stoolVariability = clampInt(0.8 + 0.8 * g('variability'), 0, 6);
    const outsideMeals = clampInt(1 + 0.8 * g('meals'), 0, 3);
    const mosquitoBites = clampInt(1.2 + 1.2 * g('mosquito'), 0, 20);
    const completeness = clampRound(84 + 8 * g('dqs'), 60, 100, 2);

    out.push({
      date,
      gut: {
        log_date: date,
        region: 'SG',
        urine_colour: urineColour,
        stool_form: stoolForm,
        stool_count: stoolCount,
        stool_variability: stoolVariability,
        outside_meals: outsideMeals,
        mosquito_bites: mosquitoBites,
        energy_score: energy,
        mood_score: mood,
        gut_comfort_score: gutComfort,
        symptom_flags: (dip ? u('flags') < 0.7 : u('flags') < 0.15) ? ['bloating'] : [],
        notes: `simulated demo row (${scenario})`,
        standing_water_present: u('water') < 0.1,
        on_antibiotics: false,
        gut_watch_active: false,
        log_completeness: completeness,
        data_origin: origin,
      },
      wearable: {
        date,
        resting_hr_bpm: restingHr,
        hrv_sdnn_ms: hrv,
        sleep_duration_min: sleepMin,
        spo2_pct: spo2,
        body_temp_c: bodyTemp,
        step_count: steps,
        source: origin,
      },
    });
  }
  return out;
}

// ─── Load-range planning (the "N more days" continuation math) ──────────────────────

export interface LoadedRange {
  minDate: string;
  maxDate: string;
}

export interface LoadSegment {
  startDate: string;
  days: number;
}

export interface LoadPlan {
  /** Contiguous batches to generate (0–2: forward catch-up, then history backfill). */
  segments: LoadSegment[];
  /** Days appended after the current max (clamped at `today`). */
  forwardDays: number;
  /** Days prepended before the current min once forward headroom is exhausted. */
  backfillDays: number;
}

/**
 * Plan where "N more days" go:
 *   - no data yet → one batch of N days ENDING TODAY (the demo needs current data so
 *     the engine's evaluated day — today — has values);
 *   - data present → fill forward from maxDate+1 up to today first (the main-loop
 *     "days passing" case), then BACKFILL any remainder before minDate (the
 *     same-sitting case: the range already reaches today, so more days = more
 *     history, which strengthens baselines/pair windows on the next analysis run).
 * Never plans a day after `today`.
 */
export function planLoadRange(
  existing: LoadedRange | null,
  requestedDays: number,
  today: string,
): LoadPlan {
  if (existing === null) {
    return {
      segments: [{ startDate: addDaysIso(today, -(requestedDays - 1)), days: requestedDays }],
      forwardDays: requestedDays,
      backfillDays: 0,
    };
  }

  const headroom = Math.max(0, diffDaysIso(existing.maxDate, today));
  const forwardDays = Math.min(requestedDays, headroom);
  const backfillDays = requestedDays - forwardDays;

  const segments: LoadSegment[] = [];
  if (forwardDays > 0) {
    segments.push({ startDate: addDaysIso(existing.maxDate, 1), days: forwardDays });
  }
  if (backfillDays > 0) {
    segments.push({ startDate: addDaysIso(existing.minDate, -backfillDays), days: backfillDays });
  }
  return { segments, forwardDays, backfillDays };
}

// ─── Request validation (pure — the route handler is IO glue only) ──────────────────

export interface LoaderRequestBody {
  /**
   * REQUIRED (R4-U3, O26): the approved demo target's `auth.users` id. The loader
   * writes THIS user's raw truth, never the caller's, and never falls back to the
   * session's own id — the pre-U3 self-write path (`user_id: gate.userId`) is
   * retired, because "load simulated data into whoever is signed in" is
   * incompatible with mechanically isolating simulation to an approved demo
   * context. A body without `target` is a 400; `target === caller` is a 403
   * ({@link validateLoaderTarget}); a target that is not a live row in
   * `nao_demo_targets` is a 403 raised by the RPC with ONE fixed message, so the
   * function is not an oracle over the demo roster.
   */
  target: string;
  /**
   * Optional durable idempotency key. When present it is authoritative forever: the
   * same key always returns the first completed result. When absent the route
   * DERIVES one from the stable input watermark (see `deriveRequestKey` in
   * ./loaderRuns.ts), which collapses the concurrent/immediate replay but — by
   * construction, and deliberately — not a retry that arrives after the first
   * attempt already committed, because that attempt changed the watermark. That is
   * the same mechanism the 14 → +7 → 21 acceptance run depends on, so it must not
   * be "fixed".
   */
  requestKey?: string;
  /** Optional registered simulated origin to stamp; defaults to SIMULATED_DATA_ORIGIN_RUN4. */
  origin?: string;
  days?: number;
  seed?: string;
  scenario?: LoaderScenario;
}

/**
 * `seed` was length-capped but not charset-checked (R4-U2 re-review finding
 * N1): it flows straight into `recordControlEvent`'s audit `detail` at
 * api/loader/route.ts, so a NUL (or any other character the database cannot
 * store) inside it could suppress the audit row for `loader.simulate` while
 * the loader's own write — plain numeric wearable/gut rows, never the seed
 * string itself — still succeeded. Every real caller passes a short
 * word/topic-shaped token (the UI's free-text field, `DEFAULT_SEED` =
 * 'run2-demo', and every seed used across this module's own tests: 'abc',
 * 'xyz', 's', 'dip', 'flat', 'corr', 'rng', 'prov') — letters, digits, and
 * `. _ : -` covers all of them with room for a future namespaced value in the
 * `simulated:run4-demo` style DATA_ORIGIN already uses.
 */
const SEED_RE = /^[A-Za-z0-9._:-]{1,64}$/;

/** Canonical 8-4-4-4-12 uuid, anchored — the `target` shape check. */
export const LOADER_TARGET_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * An explicit `requestKey`'s charset and length. Same charset as {@link SEED_RE}
 * for the same reason (it reaches `recordControlEvent`'s audit `detail` and the
 * `nao_loader_runs.request_key` column, so no byte Postgres cannot store may get
 * in), with a 16-character floor: a durable idempotency key short enough to
 * collide by accident is worse than none, because a collision returns ANOTHER
 * request's stored result.
 */
export const LOADER_REQUEST_KEY_RE = /^[A-Za-z0-9._:-]{16,128}$/;

/** Returns an error message, or null when the body is valid. */
export function validateLoaderBody(body: unknown): string | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return 'body must be a JSON object';
  }
  const b = body as Record<string, unknown>;
  if (b.days !== undefined) {
    if (typeof b.days !== 'number' || !Number.isInteger(b.days) || b.days < 1 || b.days > MAX_LOAD_DAYS) {
      return `days must be an integer between 1 and ${MAX_LOAD_DAYS}`;
    }
  }
  if (b.seed !== undefined) {
    if (typeof b.seed !== 'string' || !SEED_RE.test(b.seed)) {
      return 'seed must be a non-empty string of at most 64 characters, using only letters, digits, and . _ : -';
    }
  }
  if (b.scenario !== undefined) {
    if (typeof b.scenario !== 'string' || !(LOADER_SCENARIOS as readonly string[]).includes(b.scenario)) {
      return `scenario must be one of: ${LOADER_SCENARIOS.join(', ')}`;
    }
  }
  // ── R4-U3 (O26) ────────────────────────────────────────────────────────────
  // Checked AFTER days/seed/scenario deliberately: those three messages are the
  // ones every pre-U3 caller and test already depends on, and re-ordering them
  // would change which error a malformed body reports. All of these run only
  // AFTER guardRole('curator') has already passed (see the loader route's GATE
  // ORDER comment), so none of them is an oracle for an unauthorized caller.
  if (b.target === undefined || b.target === null) {
    return 'target is required: the approved demo user_id the simulated rows belong to';
  }
  if (typeof b.target !== 'string' || !LOADER_TARGET_RE.test(b.target)) {
    return 'target must be a uuid (the approved demo user_id)';
  }
  if (b.requestKey !== undefined) {
    if (typeof b.requestKey !== 'string' || !LOADER_REQUEST_KEY_RE.test(b.requestKey)) {
      return 'requestKey must be 16-128 characters, using only letters, digits, and . _ : -';
    }
  }
  if (b.origin !== undefined) {
    if (typeof b.origin !== 'string' || !SIMULATION_ORIGIN_RE.test(b.origin)) {
      return 'origin must be a namespaced marker of the form namespace:name';
    }
    if (!isRegisteredSimulatedOrigin(b.origin)) {
      // Fail closed on an unknown marker: a typo is unregistered, therefore
      // treated as real data, therefore never written and never overwritten.
      return 'origin must be a registered simulated origin (see nao_simulation_origins)';
    }
  }
  return null;
}

/**
 * The one check that needs the caller's identity, so it cannot live in
 * {@link validateLoaderBody} (which is pure over the body alone).
 *
 * The target must be DISTINCT from the caller. Two independent reasons: O26 wants
 * simulation isolated to an approved demo account, and a curator who can aim the
 * loader at themselves has re-created the retired self-write path through the new
 * door. The RPC enforces the same rule again with errcode 42501 and its single
 * fixed message; this boundary check exists so the common mistake gets a clear
 * answer without a round-trip, and returns the SAME 403 status the RPC would.
 */
export function validateLoaderTarget(target: unknown, callerUserId: string): string | null {
  if (typeof target !== 'string' || !LOADER_TARGET_RE.test(target)) {
    return 'target must be a uuid (the approved demo user_id)';
  }
  if (target.toLowerCase() === callerUserId.toLowerCase()) {
    return 'loader target not permitted';
  }
  return null;
}
