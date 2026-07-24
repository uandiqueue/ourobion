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

## Run 2.0 execution record (2026-07-24/25 — PR chain #123–#135, human-gated, none merged)

Authoritative audit surface: `docs/temp/phase2-run-2/unit-signoff-index.md`. Per-item outcome:

| Item | Outcome | PR(s) |
|------|---------|-------|
| O9 | **demo slice done** (gap_ledger §A1 + detection writes + nao surfacing + human add-as-seed); full autonomous gap→research loop stays gated on B5+U16 | #127, #134 |
| O10 | **done** for (a) config + (b) spend boundaries + caps-edit write; (c) ingestion-progress boundary deliberately deferred (existing Overview covers demo) | #131 |
| O11 | **done** (nao /loader, provenance-flagged, incremental backfill) | #129 |
| O12 | **done** (run-pipeline trigger + get_insight_provenance RPC + biotope trend/provenance UI) | #128, #130 |
| O13 | **done** (edge_human_verdicts, reject supersedes serving, claims UI; un-reject carried forward) | #132 |
| O14 | **done** (ingestion_seeds table + nao UI + CLI merge; Run-now dropdown deliberately left static) | #133 |
| O15 | **done for this cycle's scope** (evidence-bearing citations, fixture corpus, CLI wiring, acceptance (i)); LIVE web retrieval = next cycle per the item itself | #125 |
| O16 | **done** (orientation-aware cards, acceptance (ii), live-proven) | #127 |
| O17 | **done** (shared servable⇒quote-check clause, acceptance (iii); B8 retro-review) | #126 |
| O18 | **done** per decision (a) gap-only | #127 |
| O19 | **done** (upsert-and-prune + freshness filter + 3 test gates) | #128 |
| O20 | **done** (derivation copy-gate at synthesis + load) | #126 |
| O1–O8 | **untouched — remain open** (not demo-scoped this run; O7/O8 still land with B5) | — |

---

## Demo acceptance target (hackathon) — what "dev-phase2 works" means

The next backend run must make this end-to-end demo run on dev-phase2 (debugging flaws / unfinished
polish are OK; the loop itself must work). UI stays simple / current-convention for now — the visual
re-skin is a **separate, human-supervised phase** (Jayden on-site with the running app), not this run.
**Main loop:**
1. Load simulated health data via a nao UI → written into biotope's Supabase tables. → **O11**
2. Analysis runs; a simple trend/graph shows in the biotope app. → **O12**
3. Load more days of simulated data (repeat step 1). → **O11**
4. Insight cards generate in the biotope app. → existing engine (U12/U13) + **O12** trigger
5. See how each insight was generated — its source/provenance — in the app. → **O12**

**Separate demo features (ALL must-have — Jayden 2026-07-22):**
- **(a)** change model config + see spend vs budget in nao → **O10** (extend with editable caps) — DEMO-CRITICAL
- **(b)** in nao, see a paper broken down + its claims + REJECT one; reject supersedes the default
  verifier verdict (default = no human check; verifier default is the interim verdict until B5) → **O13**
- **(c)** load a new ingestion seed from nao → **O14**
- **(d)** gap detector: biotope detects a missing edge → surfaced in nao during ingestion →
  **O9** (A1 gap ledger detection + nao surfacing) — DEMO-CRITICAL

The UI-simple track (`docs/temp/phase2-ui-run-prompt-draft.md`) builds only the backend-independent
surfaces now; these O-items complete the demo when this backend run executes.

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

## O9 · Build the demand-side (gap-driven) seeding loop — the complement to predetermined seeds (C9)

- **Source:** U9 (agentic seeder) sign-off (Jayden). Architecture L7/L8 + the **A1 gap ledger**; worklist
  **U16** (stretch).
- **Status:** open.
- **Intent (Jayden):** C9's predetermined seeder (registry `derivedFrom` + rule blueprints + static
  topics) is only the **cold-start / supply-side** answer to "what should the brain research" — kept
  deliberately conservative (no LLM-invented candidates) while the verifier can't yet police quality.
  The planned **complement** is the **demand-side, gap-driven loop**: when a user's personal signal (S5)
  fires with **no matching verified edge**, the **A1 gap ledger** records that gap, and the aggregate
  demand drives **new** research (gap → queue (A3) → dispatch → seeder → synthesize → verify → new edge).
  This lets the knowledge graph grow from **real user patterns**, not only pre-declared relationships.
  Predetermined seeds is "just one way"; this is the second.
- **Locked decision — do NOT re-decide:**
  - This **does NOT replace or loosen C9** — it is the **second, complementary** path (supply = C9
    predetermined; demand = gap-driven). Both stay.
  - Gap-driven candidates remain **verifier-gated** — the adversarial verifier stays the quality filter,
    so this only becomes safe once the **real non-Anthropic verifier runs (B5)**. Do NOT open free
    LLM candidate-invention without that gate (that is the exact C9 line, held until the verifier is real).
  - Build the pieces the architecture already specs: **A1 gap ledger + status classifier, A3 transport/
    queue, dispatch → seeder** (worklist **U16** / L7–L8).
  - **Privacy:** the A1 ledger aggregates `demand` with **NO user ids** (architecture §A1) — preserve that.
- **Gate / what it gates:** gates nothing now (C9 predetermined seeds is the working supply); unblocks
  graph growth from real user gaps once the verifier + gap loop land (**B5** + **U16**).
- **DEMO scope (feature d), Jayden 2026-07-22:** the demo needs the **detection + surfacing** slice of
  this now — biotope detects a missing edge (gap), the A1 ledger records it, and nao **shows the gap
  during ingestion**. Build that slice as **demo-critical**; the full autonomous gap→research→verify
  loop stays gated on B5 + U16 as above. Detection/surfacing does NOT require the verifier, so it is
  not B5-blocked; only auto-acting on the gap is.

---

## O10 · Expose backend read-boundaries for nao's control-plane panels (ingestion + model config)

- **Source:** UI-run Flag A decision (Jayden 2026-07-22). nao lane of the parallel UI build
  (`docs/temp/phase2-ui-run-prompt-draft.md`). Config source: C6/C7 / `router.config.json`, the
  llm-router **budget ledger**, and the **brain-ingest** pipeline.
- **Status:** open — GATES the corresponding nao panels; those panels are deferred out of the UI run
  until this lands.
- **Intent (Jayden):** nao's required control-plane surfaces read data whose source of truth lives in
  `tools/` and the ingest pipeline — which the UI lane may NOT touch (path-disjoint ownership). Rather
  than build these panels against fixtures, Jayden chose to **gate them on the backend first exposing
  proper read-boundaries**. The backend track owns creating those boundaries so nao can later build the
  panels against real data. Panels affected:
  - **Ingestion:** live/last-run progress across pipeline stages (discover→dedup→OA-locate→retrieve→
    extract→store) with counts/errors; source/seed-topic catalog with per-source enabled state +
    coverage; browsable history of previous ingestion runs (params, outcome, cost, artifacts).
  - **Model config:** per-node model id + route (`local_agent`/`api-worker`) + `maxOutputTokens` + caps
    (C6/C7); usage/spend from the budget ledger (per node/day/run + 95% hard-stop status); live status
    of synthesis (A8) / verification (A10) runs.
- **Locked decision — do NOT re-decide:**
  - nao does **NOT** read `tools/` files directly and the UI run does **NOT** ship fixtures dressed as
    real data for these panels — they wait for real boundaries.
  - The **backend track** creates the boundaries as read surfaces nao can query (Supabase tables/views
    or a read-only API) — one each for (a) model/route/caps config, (b) usage/spend ledger, (c) ingestion
    progress + source catalog + run history.
  - Expose **read-only** first. **DEMO EXCEPTION (feature a):** the model-config panel needs a small
    **write** path — editing the token/spend caps — plus a spend-vs-budget display. This write IS in
    scope for the demo (Jayden 2026-07-22); keep it to caps only (do NOT add source-toggling or other
    writes without a separate sign-off).
  - **Exception — not gated here:** the **API-key loading/deletion** surface uses **Cloudflare Worker
    secrets** (UI-run Flag B) and IS buildable in the UI run now (actual key *consumption* stays
    B5-blocked). Only the data-display panels above are gated by this item.
- **Gate / what it gates:** gates the nao ingestion + model-config **data panels**; does NOT gate the
  API-key UI, the graph view, or the evidence panel. Related: **O8** (router-config documentation/
  calibration) and **B5** (keys). **Demo feature (a) depends on this item.**

---

## O11 · Simulated health-data loader (nao UI → biotope Supabase)

- **Source:** UI-run demo definition (Jayden 2026-07-22), main-loop steps 1 & 3.
- **Status:** open — **demo-critical**.
- **Intent (Jayden):** a nao UI + Supabase write path that inserts **simulated** health data
  (self-report + passive metrics) into biotope's data tables so the analysis/engine has input —
  without hand-run SQL. Must support loading data **incrementally by day** so the demo can add more
  days across the loop. Per `biotope-nao-link`, nao writes via **Supabase** (shared identity + tables),
  never by calling biotope directly.
- **Locked decision — do NOT re-decide:**
  - Reuse the existing metric registry + storage-primitive tables (events / state_bands / signals /
    derived_metrics + the daily tables). Do **NOT** invent a parallel schema.
  - Simulated rows are clearly flagged in provenance so they're distinguishable from real data.
  - Writes are dev-only (the two ourobion devs; nao access is already Supabase-auth-gated).
- **Gate / what it gates:** gates main-loop steps 1–4 (no input data otherwise).

---

## O12 · Serve-pipeline trigger + insight provenance for the app

- **Source:** demo main-loop steps 2, 4, 5.
- **Status:** open — **demo-critical**.
- **Intent (Jayden):** an on-demand trigger to run the serve pipeline (compute-baselines →
  evaluate-signals → generate-insights) after data loads, so baselines/signals/**cards** appear; a
  **simple trend/graph** of the user's metrics in the biotope app; and each card's **provenance**
  (rule / edge / claim / citation) exposed so biotope can show "how this insight was generated."
- **Locked decision — do NOT re-decide:**
  - Reuse the existing engine functions (U6/U7/U12) and the existing edge/claim data (U8/U10). Do
    **NOT** rebuild the engine. Provenance reads existing `verified_edges` / claims via a read the app
    can consume.
  - Interim-verifier honesty stands (D15): a key-blocked edge serves as the honest `personal`/`hold`
    variant, not a fabricated `agree`.
- **Gate / what it gates:** gates demo steps 2, 4, 5.

---

## O13 · Human verdict override (reject supersedes verifier) + nao claim-curation surface

- **Source:** demo feature (b).
- **Status:** open — **demo-critical**; verifier default = interim until **B5**.
- **Intent (Jayden):** a nao surface showing a paper → its extracted **claims** (A8) → the verifier's
  **default verdict** (A10; interim/local until the B5 key) → a human **REJECT** action that
  **supersedes** the default verdict for serving. Default is *no human check* (verifier verdict
  stands); a human reject overrides it.
- **Locked decision — do NOT re-decide:**
  - The override is an **additive human-verdict layer** on `edge_verifications`/`verified_edges`
    (two-tier truth: artifacts stay the source; the override is **recorded**, not a silent edit).
  - Do **NOT** remove or weaken the adversarial verifier — human override sits **on top**, not
    instead of it. Reject supersedes; absence of a human action = the verifier default.
- **Gate / what it gates:** gates feature (b).

---

## O14 · Manual seed-load write path from nao

- **Source:** demo feature (c).
- **Status:** open — **demo-critical**.
- **Intent (Jayden):** a nao UI + write path to add a **new ingestion seed** (topic/query) that the
  brain-ingest pipeline picks up — the human-added complement to C9's predetermined seeds and O9's
  gap-driven seeds.
- **Locked decision — do NOT re-decide:**
  - Seeds are added **as data** (a seeds table/config the pipeline reads), NOT by editing `seeds.ts`.
  - Verifier-gating on the resulting edges is unchanged; do **NOT** open LLM-invented seeds (that is
    the C9 line, held until the verifier is real).
- **Gate / what it gates:** gates feature (c).

---

# Adversarial-verdict reconciliation (2026-07-22)

Folded from `docs/temp/phase2-backend-adversarial-verdict-2026-07-22.md` (independent read-only
adversarial review; **no-go for Phase-2 sign-off / research-linked serving / a "verifier demonstrated"
claim**). 529 Node tests passed but the failures are **semantic trust** seams tests didn't cover.
O15–O20 are the blocking/high items. **The recurring lesson: unit-green ≠ seam-correct — each of these
needs an INTEGRATION test on the real seam, not an injected/mocked unit test.**

## O15 · Ground the adversarial verifier — real retrieval + evidence-in-prompt (verdict B1) — DEMO-CRITICAL (feature b)

- **Source:** verdict B1. **Status:** open — demo-critical; central hackathon delta (full "demonstrated"
  claim is a LATER cycle).
- **Intent:** the operational `brain-ingest verify` retrieves ZERO sources (CLI never sets
  `runOpts.retrieve`) and evidence text is stripped before the prompt (`corpusHitToCitation` /
  `candidateToCitation` drop text/abstract; the prompt shows only paperId/year/tiers/title). An OpenAI
  key does NOT fix this wiring. Build an **evidence-bearing citation type** carrying bounded,
  provenance-addressable passages/finding-sentences; wire the CLI to load a corpus/retrieval adapter
  (a **local/fixture corpus is acceptable this cycle** — live retrieval is next cycle); render those
  passages in the verifier prompt.
- **Locked decision — do NOT re-decide:** the verifier judges ONLY shown evidence; evidence text +
  provenance MUST reach the router request. This cycle the verifier runs on **OpenAI (single provider)**
  — label it "scaffolded + unit-tested", **NOT** "demonstrated independent verification" (verdict). Real
  decorrelated non-Anthropic run + attested model + ablation/miss/cost-latency/second-labeller artifacts
  = later cycle.
- **Testing gate:** an INTEGRATION test on the actual CLI seam asserting evidence text + provenance
  appear in the router request. (The current test injects `retrieve:{corpus}` + a mock router and only
  checks citation metadata — that is the exact gap; it does NOT count.)
- **Gates:** feature (b) meaningfulness; any supported/partial serving.

## O16 · Orientation-aware cards — never state the wrong metric moved (verdict B2) — DEMO-CRITICAL

- **Source:** verdict B2. **Status:** open — demo-critical (main loop 4/5 shows cards).
- **Intent:** an object-endpoint-only signal can enter `agree` and render "your <subject> shifted" when
  only the object metric moved (reproduced: an `hrv_sdnn` up signal → *"Your sleep duration data shifted
  upward today"*). Directional cards must not reverse an edge: only a **subject-endpoint** signal drives
  the directional template; object-only signals → context/gap. Prefer an orientation-aware composed
  payload/template keyed on the **observed** metric.
- **Locked decision:** a card states the metric that ACTUALLY fired — never the other endpoint.
- **Testing gate:** subject-only, object-only, both-consistent, both-inconsistent × increases/decreases.
- **Gates:** safe card serving (main loop 4/5). A wrong-metric card is a demo-killer.

## O17 · Servable band requires a passing quote check (verdict B3)

- **Source:** verdict B3. **Status:** open — trust/demo-relevant. **Touches shared/ → B8 retro-review.**
- **Intent:** the shared verification schema lets a `partial`/`supported` with a failed zero-span quote
  check (`{spansFound:0, spansTotal:0, allPresent:false}`) load into the `mid` band. Require, in the
  SHARED schema, that any servable verdict has ≥1 span AND `allPresent===true` (make it conditional on
  verdict if zero-span `uncertain` records are intentionally retained).
- **Testing gate:** a loader test asserting a failed quote check → validation failure or `hold`.
- **Gates:** truth-artifact projection boundary (hand-authored/legacy/imported artifacts can bypass the
  producer today).

## O18 · Resolve `research-context`: gap-only (verdict H1) — DECIDED (a), Jayden 2026-07-24

- **Source:** verdict H1. **Status:** open — **DECISION MADE: (a) gap-only.**
- **Intent:** the authoritative architecture + the `composed_insights` migration comment say
  `research-context`/`contradiction` are **gap-only, never surfaced**; the handler surfaces
  `research-context` coincidence cards. Two incompatible truths. `correlates`/`modulates` are
  context-only (no direction) yet can decorate a user card with research authority.
- **Locked decision (Jayden 2026-07-24) — do NOT re-decide:** **(a) follow the architecture** — store
  the composed row + gap event, do **NOT** produce a user card for `research-context` (or
  `contradiction`). Make handler + tests agree with the architecture/SQL comment (no amendment to the
  architecture needed — the code changes to match it). `correlates`/`modulates` never decorate a card.
- **Gates:** card semantics correctness.

## O19 · Baseline projection lifecycle — prune + freshness (verdict H2)

- **Source:** verdict H2. **Status:** open.
- **Intent:** `compute-baselines` upserts snapshots but never prunes rows absent from the current S2
  projection, and `generate-insights` includes users found only in `baseline_snapshots` → stale snapshots
  keep firing after raw deletion / metric deprecation, violating rebuildable-projection (two-tier truth).
  Implement scoped **upsert-and-prune** with an explicit successful-empty-input policy; defense-in-depth:
  reject snapshots older than the current successful baseline run.
- **Testing gate:** last-row deletion, metric deprecation, partial user loss.

## O20 · Copy-gate `RelationshipClaim.derivation` at production + load (verdict H3)

- **Source:** verdict H3. **Status:** open (matters for nao/evidence panels — feature b).
- **Intent:** the contract says `derivation` is copy-gated before storage, but neither synthesis
  post-process nor the loader calls `validateCopyString`. Copy-gate the synthesized derivation before
  artifact append AND re-check at loader ingestion.
- **Testing gate:** forbidden-language + benign-word tests.

## Verdict debt notes (not new O-items; fold into existing work)

- **Baseline-confidence truth drift:** runtime uses **3/7/14**, architecture + migration comment say
  **3/5/14**, config decision says 3/7/14, research RU5 recommends keeping **7**. Fix the truth hierarchy
  (align with O1's reconciliation discipline) — pick 3/7/14 and amend the architecture/migration.
- **`derived_metrics` still user-writable** → already **O4** (select-only before consumption).
- **Decorrelation configured, not attested at execution** → already **B5/O7**; a real route must record
  the provider-returned model and reject family mismatch (relaxed this cycle per O15's OpenAI-only posture).
- **M6 `InsightFiredEvent` not emitted** by `generate-insights` (only upserts composed insights/cards) —
  integration gap; treat as out-of-slice unless M6 is exercised by the demo.
