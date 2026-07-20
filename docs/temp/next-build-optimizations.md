---
title: Next-Build Optimizations — Jayden-approved backlog for the next long-horizon run
summary: Optimizations surfaced during unit-by-unit sign-off review of the prior long-horizon runs (phase2-run, phase2-audit, phase2-research-fixes) and explicitly approved by Jayden for a FUTURE build run to execute. Each entry LOCKS the intent + architecture decision so the build agent executes, never re-decides. Dev aid (docs/temp), not ground truth.
type: plan
scope: shared
status: canonical
updated: 2026-07-20
---

# Next-Build Optimizations — approved backlog for the next long-horizon run

This doc accumulates optimizations that Jayden approved during the **unit-by-unit sign-off review** of
the prior long-horizon runs. It is the input a future build run consumes: read this top-to-bottom,
execute each open `O`-item as specified.

## The contract (read before executing any item)

- **These are Jayden's decisions, already made.** Each entry records the **intent** and the **locked
  architecture decision**. The build agent's job is to **execute it faithfully — NOT to re-open, second-
  guess, or "improve" the decision.** Where an item says *do NOT re-decide X*, that is a hard boundary.
- **Scope discipline is explicit per item.** Each entry states exactly what to change AND what to leave
  untouched. Do not widen scope. If executing an item reveals a genuinely new question the entry does not
  answer, STOP and record it as a blocked/backlog item for Jayden — do not resolve it autonomously.
- **Source-traceable.** Each item names the sign-off unit it came from so the reasoning trail is intact.
- **Two-tier truth still applies.** Accepted ADR bodies remain immutable (`context_sync --check`); if an
  item would touch one, it records amendment intent for retro-review instead (as the research-fixes run did).

Status values: `open` (ready for the next run) · `done` (executed, with the commit/PR) · `dropped` (with why).

---

## O1 · Complete the `deadbandSigma` → `deadbandK` reconciliation in the architecture doc

- **Source:** U1 (build run) sign-off · decision D5.
- **Status:** open.
- **Intent (Jayden):** the **shipped contract is authoritative**. `MetricDefinition.signal.deadbandK`
  (daily 3-state deadband in robust σ̂ = MAD/0.6745 units, per accepted ADR-0002) is ground truth; the
  architecture doc must describe *that field*, not the superseded `deadbandSigma` (mean/SD, 0.5). U1
  shipped the field correctly and U7 added the correct superseded-banner to §S4, but three other spots in
  `docs/shared/insight-engine-architecture.md` still name the old field — so the doc's own authoritative
  §11 hyperparameter table currently contradicts the shipped code.
- **Locked decision — do NOT re-decide:**
  - Do **not** reopen the `deadbandSigma`-vs-`deadbandK` choice — it is settled (D5, per accepted ADR-0002).
  - Do **not** change any shipped code (`shared/metrics/registry.ts` / `.dart` / `.schema.ts` are correct).
  - Do **not** change the **value** `1.0` here — whether 1.0 is the right constant is a *separate* product
    calibration (research-fixes B3 / D3, still pending Jayden's intent sign-off) and is OUT OF SCOPE for
    this doc fix. This item only renames/relabels the doc references and marks the value provisional.
  - This is a **documentation-only** reconciliation.
- **Exactly what to do** — in `docs/shared/insight-engine-architecture.md`, bring these 3 stale references
  in line with the shipped field (verify line numbers at execution time; the doc may have moved):
  1. **§7 L0 bundle** (~line 242): `signal: { deadbandSigma: number }` (default 0.5) →
     `signal: { deadbandK: number }` (deadband in robust σ̂ = MAD/0.6745 units; 1.0 provisional, per ADR-0002).
  2. **Sibling registry-PR note** (~line 882): same rename + units correction.
  3. **§11 hyperparameter registry table** (~line 1026): the row `S4 deadband σ | signal.deadbandSigma | 0.5`
     → `signal.deadbandK | 1.0` (robust σ̂ units); mark it **provisional — pending calibration** and
     cross-reference research-fixes **B3** (the fire-rate calibration + anomaly-vs-nudge intent decision).
  - **Leave §S4 (~line 220) as-is** — its "[Superseded — see ADR-0002]" banner already names `deadbandK`
    correctly.
- **Gate:** doc-only; `context_sync --check` must stay green (re-run `--fix-index` if the index moves).
- **What it gates:** nothing — purely a truth-consistency fix so §11 stops contradicting shipped config.

### O1a · Drift guard so §11 can't silently diverge from shipped config again
- **Status:** open — **approved in principle; realized by O3** (do NOT build a separate guard).
- **Intent (Jayden):** the root cause of O1 was that architecture §11 is hand-maintained and drifted from
  the shipped config objects. The fix is not a bespoke §11 checker but the **generated register** in O3:
  once §11 is a generated view over the single register, the generation step *is* the drift guard.
- **Locked decision — do NOT re-decide:** do not design or build a standalone §11-vs-config cross-check.
  Implement this as a property of O3's generated catalog/register. This entry exists only to record that
  the drift concern is owned and where it is solved.

---

## O2 · Method & Parameter Register (MPR) — the reviewer-facing statistical dossier

- **Source:** U1 sign-off discussion (`deadbandK`/`0.6745` → generalized to every provisional constant).
- **Status:** open — **now a hard gate.**
- **Gate (Jayden, 2026-07-20):** ALL statistical method/number sign-offs are **DEFERRED until this
  register exists.** Neither teammate signs the *science* before then; a stats team reviews through the
  register once built. (Engineering correctness of a stats unit — built as specified, tests green — may
  still be signed by Alton in the meantime; only the *method/number* is deferred.)
- **Intent (Jayden):** produce ONE self-contained artifact shippable to an external **statistics team**
  so they can (Job A) verify the statistical **methods** are correct and (Job B) **calibrate** the free
  parameters — **without repo access**. It is a **consolidation / view** of four existing fragmented
  sources — architecture **§11**, the **evidence-review RU verdicts**, the **config-decisions C-entries**,
  and the **backlog B-entries** — into one per-method review surface. It is NOT new science.
- **Locked structure — do NOT re-decide these:**
  - **Two layers.** Layer 1 = universal **method cards** (one per statistical *procedure* — NOT per metric,
    NOT per build unit; in this system the methods are universal, only parameters vary). Layer 2 =
    **parameter rows** under each method.
  - **Every constant carries a `type` tag** (mandatory — do NOT list derived and free constants
    undifferentiated, which was the §11 failure): `derived` = fixed math constant (e.g. `0.6745` = Φ⁻¹(0.75);
    method-review only, **NEVER calibrated**) · `structural` = a modeling choice (e.g. additive edge form,
    median-vs-mean, Spearman-vs-Pearson, boolean-conjunction-vs-CCF; method-review, not a tunable number) ·
    `free` = a hyperparameter to calibrate.
  - **Every `free` parameter carries a `scope` tag** = "one value per what?" = the calibration unit =
    how many numbers + what data granularity: `global` (system-wide) · `per-group:<axis>` where `<axis>` is a
    REAL registry field (`tier`/`continuity`/`type`/`reliability`/`source`) · `per-metric` · `per-entity:<x>`
    (non-metric methods, e.g. per venue-field). **Scope is itself a reviewable decision** — where current
    scope is provisional (e.g. S3 cutoffs are `global` today but B1/RU5b argues `per-group:reliability` or
    `per-metric`; `deadbandK` is modeled `per-metric` but calibrated `global`-as-placeholder), the card MUST
    state current scope AND the open scope question, never silently pick one.
  - **The two review jobs stay separate per card:** Job A = method-correctness questions; Job B =
    calibration spec (*objective · data required · procedure · current provisional value · what unblocks it*).
    Different audiences read different sections.
  - **Dossier scope = STATISTICAL methods only.** Exclude pure ops knobs (budget 95% hard-stop, spend caps) —
    not for the stats team.
- **Method-card schema:** id · name · purpose (plain) · operates-on entity (metric-day / metric-pair / edge /
  venue) · method + equations in **standard notation, not code** · structural choices · parameter rows
  (`type` + `scope` + value(s) + provenance `cited`/`uncited`/`by-design` + Job-B spec) · Job-A method
  questions · method variants (usually "none"; else "selected by `<metric property>`", e.g. daily aggregation
  by `continuity`) · status (needs-method-review / needs-calibration / confirmed) · refs (code location · ADR ·
  backlog B-ref).
- **Reuse, do NOT redo:** fold the evidence-review RU verdicts in as the "method-review-so-far" per card
  (e.g. A1 confirmed the canonical 2/N Pyper–Peterman form; RU2a flagged the additive edge form as
  literature-hostile; RU3c gave the `deadbandK` Gaussian ~31.7% fire rate). C-entries supply
  rationale/alternatives; B-entries supply calibration blockers.
- **The ~8 method cards to produce:** S3 baseline confidence · S4 robust anomaly signal · S5 pairwise
  correlation (ρ / N_eff / BH-FDR / stability) · coincidence-lag path · edge-score + gating · venue
  impactTier · U1 applicability grader · (S9 novelty/staleness if judged statistical).
- **Round-trip:** every parameter gets a stable id so the team returns `id → {verdict, value, citation,
  method}` and it flows back into the config objects + the register.
- **Gate / what it gates:** gates nothing; it is the enabling artifact for external method-review +
  calibration of every provisional constant (B1–B7 + all of §11).

---

## O3 · Registry Catalog + co-located review surface

- **Source:** U1 sign-off discussion (registry proliferation: metrics / brain / rules / router / engine
  config / the new MPR).
- **Status:** open.
- **Intent (Jayden):** make registries **discoverable and reviewable WITHOUT relocating the code ones.**
  The code registries are truth-tier, location-bound, guard-coupled contracts and MUST stay where the code
  needs them. The human-review surface is a separate, **generated** layer on top.
- **Locked decisions — do NOT re-decide:**
  - **Do NOT create a physical directory that HOLDS the code registries.** They stay in `shared/*`,
    `tools/*/config*` (+ `router.config.json`), `supabase/functions/*/config.ts`, and `data/rules/`. Moving
    them breaks the parity/drift guards, imports, the cross-language TS↔Dart seam, and the 2-reviewer
    `shared/` gate. **The code IS the registry.**
  - **Do create ONE generated Registry Catalog** — a pointer/index over the in-place registries, built the
    same way as `docs/INDEX.md` (from a small per-registry manifest/front-matter, via `context_sync`), so it
    cannot go stale. Row schema: **Registry · Tier (truth-tier contract / code-config / dev-aid doc) ·
    Location · Schema & guard · Owner · What it holds · Review status.**
  - **Do co-locate the review VIEWS (docs, not code) in ONE directory** — `docs/shared/registries/` holds the
    catalog + the MPR (O2) + the calibration status/provenance surface. These are generated-from / link-to the
    code registries; they NEVER hold the truth themselves.
  - **§11 becomes a generated VIEW** sourced from the register/MPR — no longer hand-maintained (hand-
    maintenance is what let O1 drift). **The generation step IS the drift guard (subsumes O1a).**
- **Composes with:** O2 (the MPR is one catalog entry and one co-located view) and O1a (realized here).
- **Gate / what it gates:** gates nothing; discoverability + anti-drift infrastructure for all registries.

---

## O4 · Make `derived_metrics` read-only for users (revert to select-only, matching sibling projections)

- **Source:** U2 (build run) sign-off · decision D9 · audit finding **A15**.
- **Status:** open.
- **Intent (Jayden):** `derived_metrics` is a **server-computed projection** (two-tier truth:
  rebuildable from raw rows, *never hand-edited, never truth-tier* — its own table comment). It must be
  written **only by the server-side engine** (Supabase Edge Functions, as `service_role`), exactly like
  its siblings `baseline_snapshots` / `personal_signals` / `composed_insights`, and be **read-only to
  users**. Its current full user-CRUD RLS contradicts that comment and lets a user JWT **self-poison**
  the projection (audit A15). Nothing writes the table today (verified: no app or engine writer — it
  appears only in the registry enum + the guard's column map), so the fix is free.
- **Locked decision — do NOT re-decide:**
  - **Revert RLS to select-only:** DROP the three user write policies (`insert` / `update` / `delete` on
    own rows); KEEP the `select` (read own rows) policy. The engine writes as `service_role`, which
    bypasses RLS — so the writer is unaffected.
  - **Do NOT keep full CRUD** unless a concrete *client* writer is actually introduced. D9's "M2
    client-side derivation already exists" premise does **not** apply to this table — M2 writes
    `daily_gut_rows` (its grandfathered raw instance), not `derived_metrics`. The heavy/statistical
    derivation is all server-side (compute-baselines / evaluate-signals / generate-insights on the cron).
  - **Do NOT edit the existing migration** (`20260715140420_create_continuity_storage_primitives.sql`) —
    migrations are append-only (D19). Ship a **NEW additive migration**.
  - The `never hand-edited / never truth-tier` comment stays and is now actually honored.
- **Exactly what to do:**
  1. New migration `supabase/migrations/<ts>_derived_metrics_select_only.sql` that runs `drop policy` on
     the three write policies (`"Users can insert own derived metrics"`, `"…update…"`, `"…delete…"`) on
     `public.derived_metrics`; leave `"Users can select own derived metrics"` intact.
  2. `db reset` clean; check whether the Dart guard's table→migration map
     (`apps/biotope/test/guards/metrics_registry_schema_test.dart`) needs the new migration acknowledged.
- **Gate / what it gates:** gates nothing today (empty, unwritten table); closes a latent
  self-poisoning surface before any stage populates it.
- **If intent changes** (a client writer is genuinely planned): instead of this revert, correct the
  table comment to describe it as a user-writable store — but that breaks two-tier truth, so
  select-only is strongly preferred.

---

## O5 · Design-time storage-primitive coverage pass over the metric catalog

- **Source:** U2 (build run) sign-off discussion (Jayden) · builds on D9's `daily_log`-deferral.
- **Status:** open.
- **Intent (Jayden):** we already know the metrics we intend to ship — the candidate superset is
  `docs/biotope/metrics-catalog.md` (~360, IDs `L-`/`E-`/`D-`) and the committed set is the 100-metric
  wave plan (memory 0014). The catalog is **already organized on the storage axis** (A2 *continuity* +
  A3 *tier ladder* T0–T5). So storage-primitive coverage should be **validated at design time against
  that known set**, NOT discovered one grandfathered instance at a time. This turns primitive/table
  decisions (whether/when to generalize `daily_log`, whether a `static`/profile store is needed) into
  **deliberate calls made from the full picture**.
- **Concrete gaps this pass would surface (already spotted during U2 review — evidence the pass is worth it):**
  - **`continuity: 'static'` has NO storage table.** `metricContinuitySchema` = `continuous · episodic ·
    state · static`, but `metricTableSchema` has no home for `static` (T5 Profile/Static). A metric
    declaring `static` today has nowhere valid to live.
  - **`daily_log` (the continuous spine) is not generalized** — only the grandfathered `daily_gut_rows`
    exists (D9). The catalog's T1/T2 continuous-manual layer is the full spine set; counting it decides
    if/when generalization pays off.
  - **`env_daily` is in the table union but unused** (no migration/guard/metric) — a dangling home
    (noted in the U2 session log).
- **Tier/continuity → primitive map (the axis to reconcile against):** T0 Passive → `signals`; T1/T2
  Daily continuous → `daily_log` spine; T3 Event → `events`; T4 Periods/States → `state_bands`; T5
  Profile/Static → (**gap**); computed → `derived_metrics`.
- **Locked decisions — do NOT re-decide:**
  - This pass **does NOT mandate building `daily_log` or a static/profile store now.** It produces the
    **coverage matrix + counts** so the build/defer decision is deliberate. Any table that IS built
    follows the grandfathering rule (append-only; never rewrite/migrate `daily_gut_rows` et al.).
  - Reconcile against the **existing** axis (`continuity` × `table` × `tier`) — do NOT invent a new
    classification axis; the catalog and registry already carry it.
  - **Surface, don't silently fix:** if a committed metric fits no primitive, that is a finding for
    Jayden (a new-primitive decision), NOT an autonomous new table.
  - **Scope:** classify the **committed set first** (100-wave, memory 0014); treat the ~360 catalog as
    the reference superset — do not over-invest classifying speculative candidates.
- **Exactly what to do:**
  1. Build a coverage matrix: every committed metric → `continuity` → `tier` → target primitive `table`
     → status (`homed` / `gap`). Source it from the catalog + memory-0014 wave plan; cross-check the
     registry's `continuity`/`table` fields.
  2. Report the gaps (static/profile home; `daily_log` generalization count; `env_daily` dangling) as
     decisions for Jayden.
  3. Add a **coverage guard** (composes with O3's registry catalog): every registry metric's
     `continuity`↔`table` pairing is valid, and every committed-wave metric maps to an existing
     primitive — fails CI if a metric is homeless.
- **Composes with:** O3 (the matrix + guard is a registry-catalog view) and D9 (supplies the data to
  revisit the `daily_log` deferral deliberately).
- **Gate / what it gates:** gates nothing now; de-risks the storage design before Wave-1 metrics land
  on the primitives (worklist U14).

---

## O6 · `CODEOWNERS` path-based review routing (+ branch protection) for the two-person team

- **Source:** U1/U2 sign-off discussion (Jayden) — split review load so Jayden doesn't gate everything.
- **Status:** open.
- **Intent (Jayden):** enforce the sign-off routing rule **automatically, per file path, on every future
  PR** (tool-enforced, not memory-enforced), so each reviewer only sees their domain. Mirrors the
  sign-off protocol now in `docs/temp/phase2-run-signoff-decisions.md`.
- **Locked routing (tiers fixed; refine the globs as the repo grows):**
  - `shared/**` → **BOTH** (Jayden + Alton), **2 required approvals** — the memory-0002 rule / register B8.
  - **Jayden (agent-related — the hackathon deliverable)** — `tools/llm-router/**`, the synthesis /
    verifier / seeder paths (`tools/brain-ingest/src/**` synth+verify), and any prompt-template files.
  - **Alton (build / plumbing)** — `apps/**`, most of `tools/**`, `.github/**`, `supabase/migrations/**`,
    engine *plumbing* (`supabase/functions/*/index.ts`).
  - **Statistical paths → DEFERRED, no CODEOWNER assigned now** (`supabase/functions/*/stats.ts`,
    `*/config.ts` thresholds, `tools/engine-stats/**`, `tools/brain-ingest/src/venue/**` impactTier, the
    §11 surface) — reviewed via the Methodology & Parameter Register (**O2**) once built, not gated here.
- **Do:** add `.github/CODEOWNERS` with those globs; enable "require review from Code Owners" on the
  `dev-phase2` and `main` branch-protection rules; set `shared/**` to require 2 approvals. Needs both
  teammates' **GitHub handles** (Jayden's is the `uandiqueue` org owner; Alton's TBD).
- **Composes with:** the sign-off protocol (this run) · register **B8** (shared/ retro-review) · **O2**
  (science routing later delegates to the stats team).
- **Gate / what it gates:** gates nothing; process automation that makes the review split self-enforcing.

---

## O7 · Generalize the synthesis↔verifier decorrelation invariant (vendor-agnostic; main model swappable)

- **Source:** U3 (LLM router) sign-off review (Jayden). Config: C6 / `tools/llm-router/src/config.ts`.
- **Status:** open — tracked **condition of U3's sign-off** (Jayden 2026-07-20); lands with the api-key integration (B5).
- **Intent (Jayden):** the current invariant hardcodes `family(verifier) !== 'anthropic'`, which assumes
  the main/synthesis model is Anthropic. It is **not** — the synthesis (main) model must be **swappable to
  any vendor**. The real, general guard is: **the verifier's operator (vendor/family) must differ from the
  synthesis operator's**, whatever synthesis is. Decorrelation exists to avoid sharing one vendor's
  training/blind-spots, so it is **symmetric and family-level**, not an Anthropic special-case.
- **Locked decision — do NOT re-decide:**
  - Replace the two-clause invariant (`family(synthesis) !== family(verifier)` **AND**
    `family(verifier) !== 'anthropic'`) with the single general rule
    **`family(verifier) !== family(synthesis)`**, both resolved from config, for any synthesis vendor.
  - Keep it **operator/family-level** (not merely a different model id) — same vendor, different model
    still shares blind-spots.
  - **No hardcoded vendor name** anywhere in the guard.
  - It must hold on the **real `api_worker` route** (where it actually matters), not only at config load.
- **Related C6 model choice (Jayden, at key-load / B5):** synthesis may move `sonnet-5 → opus` for
  quality; whatever vendor synthesis lands on, the verifier must be a **different** operator (that is what
  O7 enforces). Pin the exact ids when provisioning keys.
- **Gate / what it gates:** gates the real adversarial-verification integrity claim once keys land (B5) —
  land O7 **with** the api-key integration.

## O8 · Document + calibrate the router's provisional config (`maxOutputTokens`, budget caps)

- **Source:** U3 sign-off review (Jayden — "not sure how those config is chosen"). Config: C6/C7 /
  `router.config.json`.
- **Status:** open — tracked **condition of U3's sign-off** (Jayden 2026-07-20); lands with the api-key integration (B5).
- **Intent (Jayden):** the per-node `maxOutputTokens` (synthesis/seeder/verifier 8k, phrasing/extract 2k,
  report 4k) and the C7 caps (200k/run, $5/day/node, 95% hard-stop) are **undocumented provisional
  guesses** with no recorded basis. Record the **intended rationale per node** (expected output size for
  that task) and **calibrate against real token usage** once keys land.
- **Locked decision — do NOT re-decide:**
  - Do NOT silently retune values first — **document the basis per node**, then calibrate on real runs.
  - This is **agent-config** calibration (NOT the statistical calibration deferred to O2), but it likewise
    needs real-run data — so it unblocks alongside the api-key integration (B5), not before.
- **Gate / what it gates:** gates nothing; the caps are safe provisionals meanwhile.

---

## O9 · Location-fetch trigger config — per-source distance/refresh thresholds for env-API collectors

- **Source:** Alton design conversation (2026-07-20), surfaced while reviewing U2/D9 (storage primitives)
  and the environmental-exposome derived metrics (`docs/biotope/metrics-catalog.md` §C2, D-77–D-102
  env exposome + D-133–D-145 One Health). **Not yet Jayden-reviewed** — unlike every other entry in this
  doc, this is a proposal, not a locked decision; flag to Jayden before a build run executes it.
- **Status:** open — **pending Jayden review** (provenance caveat above; do not treat as pre-approved).
- **Intent (Alton):** the env-API-backed derived metrics (AQI, weather, pollen, dengue-cluster proximity,
  NDVI/UV) need a location-change trigger to decide when a network call to an external API is worth
  making. Location updates should ride the OS-level significant-change/visit API (cheap wakeup; matches
  E-2's existing "visit + significant-change logging" note) — never continuous GPS polling, which breaks
  the passive layer's "~zero cost to user" premise (§A1). But "meaningfully different" for *re-fetch*
  purposes is not one constant: each external source has its own spatial resolution (a dengue cluster is
  block-sized; AQI/weather are multi-km grids; pollen is regional), and each has its own refresh cadence
  (most update hourly regardless of movement) — so staleness needs a second, independent time-based
  trigger alongside the distance check.
- **Locked decision — do NOT re-decide** *(pending Jayden's confirmation, per the caveat above)*:
  - This is an **ops/engineering config, NOT a statistical method or parameter** — explicitly out of the
    MPR's scope (O2 excludes "pure ops knobs... not for the stats team"). Do not route it to the stats
    team or the MPR.
  - Routes as **Alton / build-plumbing**, not deferred.
  - Trigger mechanism = OS significant-change/visit API, not continuous polling — matches E-1/E-2.
  - Refetch gate (per source, not global):
    `should_refetch = distance_from(last_fetch_location) > source.spatial_resolution_km`
    `                 OR (now - last_fetch_time) > source.refresh_interval_hours`
- **Exactly what to do:**
  1. When the env-API collectors for D-77–D-102 / D-133–D-145 are actually built, add a per-source
     code-config registry (location TBD at build time, e.g. alongside the relevant edge function's
     `config.ts`, following the existing `router.config.json` / `supabase/functions/*/config.ts` pattern)
     with rows: `source id · spatial_resolution_km · refresh_interval_hours · provenance`.
  2. Populate initial per-source values as a build-time engineering call (record as a C-entry if formally
     signed off) — not pre-decided here; illustrative starting points only: AQI/weather ~3–5km / 1hr,
     dengue clusters ~0.3km / 24hr, pollen coarser/regional / 24hr+.
  3. Register the new config file so O3's future Registry Catalog picks it up.
- **Composes with:** O3 (registry catalog indexing), O5 (storage-primitive coverage pass — same
  D-77–D-102/D-133–D-145 metric set), the not-yet-scheduled env-API collector build.
- **Gate / what it gates:** gates nothing yet — no env-API collectors exist to build against; this is
  forward design capture ahead of that work.

---

## O10 · Known-venue override table for impactTier banding (sourced, not vibes)

- **Source:** Alton design conversation (2026-07-20), surfaced while reviewing U4 (`quoteCheck` + venue
  lookup) sign-off — C8's h-index cutoffs are explicitly uncalibrated placeholders. **Not yet
  Jayden-reviewed** — a proposal, not a locked decision; flag to Jayden before a build run executes it.
- **Status:** open — **pending Jayden review**.
- **Intent (Alton):** `bandImpactTier` (`tools/brain-ingest/src/venue/banding.ts`, C8) only assigns a
  tier when OpenAlex resolves the venue's h-index/type — unresolved venues already correctly return
  `unknown`, never a silent `low` (confirmed sound in U4 sign-off). What's still weak is the tier
  boundary itself: round-number h-index cutoffs with no external anchor. Two complementary fixes,
  not alternatives:
  1. **Wire up the already-designed SJR quartile slot** (`sjrQuartile` optional param, shipped in U4 but
     unfed) — SJR quartiles are an existing, externally-maintained bibliometric standard, so anchoring to
     it replaces "we picked round numbers" with "we deferred to a recognized ranking." Blocked on
     sourcing an SJR snapshot + checking its license (CC-BY-NC-SA-ish, per U4's session log).
  2. **A small, sourced known-venue override table** for cases the automated lookup misses or
     under-serves (e.g. an obviously top-tier journal whose OpenAlex h-index doesn't reflect it) — e.g.
     `{ issn/name → tier }` for a short list of well-known venues (Nature, Science, Cell, NEJM, …).
- **Locked decision — do NOT re-decide** *(pending Jayden's confirmation)*:
  - **The override table must be built from an AI *research* pass, not an AI *runtime decision*.** An
    LLM may compile candidate entries, but each entry requires a cited bibliometric source (an SJR
    quartile, a JCR ranking, an official top-venues list) — not the model asserting reputation from
    training-data recall. Uncited entries are rejected, same cite-don't-fabricate discipline as
    `evidence-review-run`.
  - **No live LLM call in the runtime venue-lookup path.** The table is a one-time research pass, human-
    reviewed and locked as a static, versioned config (same shape as `IMPACT_BANDS_C8`), checked into
    the repo — not a call made per-lookup. This preserves the existing pipeline's keyless/deterministic/
    cached/reproducible properties (U4).
  - **Precedence order:** known-venue override table → OpenAlex h-index/SJR banding → `unknown`. The
    override table supplements, it does not replace, the metric-based path.
- **Exactly what to do:**
  1. Run an AI-assisted research pass to shortlist well-known venues with a citable bibliometric source
     per entry; human review locks the final table.
  2. Add `tools/brain-ingest/src/venue/knownVenues.ts` (or similar), consulted before the OpenAlex call
     in `bandImpactTier`.
  3. Separately, resolve the SJR snapshot blocker (fix 1 above) — the two fixes are independent and both
     reduce C8's current subjectivity.
- **Composes with:** U4 (the venue-lookup module this extends), O2/MPR (C8's cutoffs are still routed
  there for the metric-based path; this table is an ops/engineering supplement, not itself statistical).
- **Gate / what it gates:** gates nothing; reduces C8's placeholder-number reliance ahead of real venue
  lookups running at scale.
