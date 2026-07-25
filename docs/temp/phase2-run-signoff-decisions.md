---
title: Phase-2 Run — Decisions for Human Sign-off
summary: Every non-trivial choice the automated Phase-2 run made on Jayden's behalf, with the alternatives rejected and why — the retroactive-review queue for the run. Hard-coded numeric/config values live in phase2-run-config-decisions.md instead.
type: plan
scope: shared
status: canonical
updated: 2026-07-18
---

# Phase-2 Run — Decisions for Human Sign-off

Non-trivial choices made autonomously during the run. Review order: D1 first (it colors everything).
Numeric hyperparameters/config values are in [`phase2-run-config-decisions.md`](./phase2-run-config-decisions.md).

## Sign-off protocol (added 2026-07-20)

Each decision carries a **Review** line (who must approve) and a **Sign-off** line
(✅ approved / ⬜ pending / ⏸ deferred · reviewer · date · comment). A decision is **cleared** only
when every required reviewer has signed. Routing for the two-person team (Jayden + Alton):

- **`shared/` contracts → BOTH** (memory 0002 2-reviewer rule; register B8) — non-negotiable.
- **Agent-related** (LLM router, synthesis, adversarial verifier, seeder, prompts — the hackathon
  deliverable) **→ Jayden.**
- **Build / app / tools / CI / DB migrations / deterministic engine → Alton.**
- **Statistical method or number decisions → DEFERRED (⏸)** until the **Methodology & Parameter
  Register** is built next build (next-build `O2`); a stats team then reviews the science through it.
  Neither teammate signs the *science* now; Alton may still sign a stats unit's **engineering**
  correctness (built as specified, tests green).

**Sign-off git flow:** each unit signs off on its **own branch → PR → merged (CLI) into the
`signoff/phase2` integration branch** (only `dev-phase2` / `main` carry merge protection, so the
integration branch takes CLI merges). Path-based enforcement of the routing is proposed as a
`CODEOWNERS` file (next-build `O6`).

## D1 · Session PRs are self-merged into `dev-phase2`; `shared/` PRs flagged for retro-review
- **Choice:** each session PR is merged by the orchestrator once the testing gate is green
  (`flutter analyze` + `flutter test` + `context_sync --check` + touched package suites). PRs touching
  `shared/` are flagged in the session ledger and register B8 for retroactive 2-reviewer review before
  any fold to `main`.
- **Alternatives rejected:** (a) leave every PR open for human review — the run's dependency spine
  (L0 → engine; router → pipeline) would stall on the first PR, contradicting "keep building everything
  still unblocked"; (b) stack branches on unmerged branches — produces an unreviewable tower and defeats
  the PR-per-session record. `main` remains untouched either way.
- **AMENDED 2026-07-15 (same day):** the permission system denied `gh pr merge` for agent-authored PRs,
  so self-merge is off the table. The run switched to alternative (b) in disciplined form: a **stacked
  chain** — each session branch cut from the previous session's tip, each PR based on its predecessor
  branch so its diff stays session-scoped. Jayden merges the chain in order (bases auto-retarget as
  predecessors merge), or grants a `gh pr merge` permission rule to restore the original policy.

## D2 · No worktrees; sequential sessions in the main checkout
- **Choice:** per Jayden's instruction (2026-07-15), session branches are cut directly off `dev-phase2`
  in the main checkout; sessions run one at a time. Read-only subagents may run in parallel; only one
  writer at a time.
- **Alternative rejected:** AGENTS.md §7 worktree isolation — exists to protect parallel writers on one
  device; pure overhead for a solo sequential run.

## D3 · Build order: L0 → storage primitives → LLM router, then the engine columns
- **Choice:** U1 (L0 contract extension) first — smallest unit gating the most downstream work; then U2
  (storage primitives, Track A's longest pole) and U3 (router, Track B's foundation); deterministic
  right-column engine stages before the LLM-adjacent left column; U12 engine refactor last-but-one,
  U13 one-card slice as the run's finish line.
- **Alternatives rejected:** storage-first (bigger, gates less of the engine); router-first (Track B
  only); waves before primitives (violates plan sequencing).

## D4 · Verifier (A10) built as a fixture-tested scaffold now, real runs deferred
- **Choice:** implement the adversarial verifier against recorded fixtures with the model id + key
  config-gated, since the mandatory non-Anthropic key doesn't exist yet (register B5). Synthesis (A8)
  runs for real via the router's keyless local-agent route.
- **Alternative rejected:** using an Anthropic model as verifier to run "for real" now — violates the
  family-decorrelation invariant (memory 0012/0013); a same-family re-ask is not verification.

## D5 · Registry signal field ships with ADR-0002 semantics (`deadbandK`), not the architecture doc's `deadbandSigma`
- **Choice:** the L0 registry extension is `signal: { deadbandK: number }` (robust σ̂ = MAD/0.6745
  units, default 1.0), following accepted ADR-0002, which supersedes the architecture doc's
  `deadbandSigma: 0.5` (mean/SD).
- **Alternative rejected:** shipping the superseded name/semantics and migrating later — a contract
  field rename is exactly the churn the 2-reviewer rule exists to prevent.
- **Review:** BOTH (shared/ L0 contract — 2-reviewer rule) · lead **Jayden** (brain/agent contract).
- **Sign-off:** ✅ **Jayden 2026-07-20** — approved (contract/semantics): `deadbandK` = ADR-0002
  robust-σ̂ semantics, correctly superseding `deadbandSigma`. Reconciled against live code this review.
  Doc drift in §7/§9/§11 → **O1** (next build); the **method validity + the value `1.0` are statistics
  → ⏸ deferred** (methodology register **O2** / backlog **B3**), not signed here.
  ✅ **Alton 2026-07-20** — approved (naming/semantics call, not the value); co-sign complete.

## D6 · Run-tracking docs live in `docs/shared/` as indexed canonical docs
- **Choice:** the four `phase2-run-*` docs sit in `docs/shared/` with full front-matter, picked up by
  `--fix-index` (taxonomy 0015: process/roadmap docs belong in shared).
- **Alternative rejected:** `docs/temp/` drafts — exempt from index enforcement, but these docs are the
  run's review deliverable and must be as discoverable as `next-steps.md`.
- **SUPERSEDED 2026-07-18:** the four run docs moved to `docs/temp/` (dev-aid tier, index-exempt) —
  they track a run in progress, not canonical ground truth; the `docs/shared/` INDEX entries were
  removed. See the orchestration log's recovery section.

## D7 · Assessment discrepancy surfaced, not silently corrected
- **Choice:** the 2026-07-13 session log's claim that the `main` fold happened is recorded as a
  discrepancy (register B1) rather than edited — session logs are append-only, and the fold stays gated
  on your explicit go.

## D8 · L0 fields shipped as required/nullable, not optional-with-default
- **Choice:** `derivation` is required and `population`/`charStart`/`charEnd` are required-nullable on
  the brain contract, exactly as the architecture specifies — no optionality escape hatch.
- **Rationale:** memory 0002's optional-with-default rule protects existing instances; the build agent
  verified there are zero persisted claim/verification instances and zero constructors in code, so
  strictness is free now and saves a tightening migration later.
- **Review:** BOTH (shared/ brain contract — 2-reviewer rule) · lead **Jayden**.
- **Sign-off:** ✅ **Jayden 2026-07-20** — approved; required / required-nullable is the right call, and
  the zero-persisted-instances + zero-constructors basis was re-verified against live code this review.
  ✅ **Alton 2026-07-20** — approved (required/required-nullable, zero-instance basis is sound); co-sign complete.

## D9 · Storage-primitive schema judgment calls (U2)
- **Choices (full list + rationale in session log `20260715T140420Z-…storage-primitives.md`):** jsonb
  values on `events`/`state_bands`/`derived_metrics`, fixed `double precision` on `signals` (no
  `value_text`); natural composite PK `(user_id, metric_key, ts, source)` on `signals`;
  `daily_log` deliberately NOT created (`daily_gut_rows` is its grandfathered instance); no
  overlap-exclusion constraint on `state_bands` (concurrent courses are legal; collector's problem).
- **The one precedent conflict:** `derived_metrics` got all four RLS policies while `baseline_snapshots`
  is select-only — followed the session spec (client-side derivation already exists in M2; "never
  hand-edit" is a process rule, not an RLS rule). Flag if you'd rather match the select-only precedent.
- **Review:** Alton (build/plumbing — storage primitives; not a shared/ contract change).
- **Sign-off:** ✅ Alton 2026-07-20 — approved. Schema/PK/jsonb judgment calls (D9) confirmed sound:
                 jsonb vs fixed-width value columns, `signals`' natural composite PK, `daily_log`
                 deferral, no overlap-exclusion on `state_bands` — all reasonable engineering calls.
                 The one flagged precedent conflict is resolved: **derived_metrics should be
                 server-side-only** — concur with Jayden's pre-flag and **O4** (revert to select-only,
                 matching `baseline_snapshots`/`personal_signals`/`composed_insights`). M2's on-device
                 derivation writes `daily_gut_rows`, not `derived_metrics`, so D9's client-write premise
                 doesn't actually apply here; nothing writes the table today, so the revert is free.
                 O4 is now unblocked to execute.

## D10 · Rule-blueprint contract judgment calls (U5)
- **Choices where the design doc was silent** (full detail in session log `20260715T152517Z-…rules-as-data.md`):
  `coincidence.lagDays: number | null` on the cross-rule leaf (null = same window; lagged evaluation
  lands with the engine); `minConfidence: low|medium|high` replaces the design's `notInsufficient`
  boolean; `rules` table adds `scope/status/cooldown_days/expiry_days` beyond the doc's column list;
  RLS enabled with zero policies (service-role-only, per design). The 6 MVP rules ported faithfully —
  same conditions, copy, severity `info`, 7-day expiry.
- **Flag for later:** CI does not run any node tool-package tests (brain-ingest / llm-router / rules) —
  queued as worklist U18.

## D11 · S2/S3 judgment calls (U6)
- **View column named `log_date`** (house convention) over the architecture sketch's `day`; signals
  branch aggregates to daily grain as **mean** (UTC bucket) — revisit per-metric aggregation when a
  real high-frequency signal lands.
- **`baseline_snapshots` numeric columns widened** from `numeric(6,3)` to unconstrained `numeric` —
  seeded `step_count` (~7.7k) overflowed 22003; v1 would fail identically. Projection table, safe.
- **Drive-by fixes:** `scripts/seed-test-data.sql` array-literal bug fixed; the `.ps1` seeder fails to
  parse under PowerShell 5.1 (UTF-8-no-BOM) — file left untouched, workaround noted in the session log.

## D12 · S4/S5 judgment calls (U7)
- **`baselineMinDays` re-checked after artifact rejection** (14 raw days containing artifacts are not
  14 clean days — ADR-0002 silent; conservative reading chosen).
- **FiredPatterns are not persisted** — response-JSON transport to the future S7 composer, per the
  architecture's "Store: none" for S4; an additive `suppressed` field carries observability.
- **Interim S5 pair scope**: all active baselineApplicable pairs (105 = C(15,2)) with ≥14 in-window
  days each and ≥10 joint days; BH per user per run. Brain-neighbour pruning replaces this in U12.
- Architecture §S4 now carries a bracketed ADR-0002/`deadbandK` reconciliation note (`updated:` bumped).

## D13 · Edge-store/loader judgment calls (U8)
- **Verifications upsert + prune instead of the doc's `on conflict do nothing`** — do-nothing left a
  stale status column when the newest-active verification changed; upsert+prune makes the Postgres
  tables a pure function of the artifact set (two-tier truth).
- **Hard fail on invalid JSONL lines instead of §A11's quarantine-and-continue** — with no synthesis
  running yet, every line is authored truth; revisit at A8 volume.
- **Loader home `tools/edge-loader/`** (doc ambiguous between tools and nao; nao cron wiring is later).
- RLS: authenticated read + service-role write (recorded deviation from the rules-table
  no-read-policy precedent — biotope must read edges at serve time).

## D14 · S7/S8 engine judgment calls (U12)
- **Branch rules made disjoint** (doc's truth table overlapped): contradiction → agree →
  research-context → idiosyncratic, first match wins; a personal signal failing its serve gate
  (q≤0.05 ∧ N_eff≥10 ∧ stable) is treated as absent.
- **Producer vocabulary** `rules|edge|personal`; coincidence cards stay in the rules namespace but
  carry `edge_refs` + `insight_id`, suppressed on contradiction. Cooldown deferred (all null).
- **FiredPatterns recomputed in-process** by importing evaluate-signals' Deno-free stats/config
  directly (no HTTP hop); lagged leaves use a windowed-baseline replication of compute-baselines math.
- **No LLM phrasing wired** — the deterministic template path is the shipped authority; the
  phrasing_card router node remains for a later additive session (per rules-engine design's phasing).

## D15 · L6 slice ships the honest end-state, not the shiny one (U13)
- **Choice:** the slice's verification carries `verifierModel: INTERIM:pending-real-verifier` and the
  contract-forced verdict `uncertain` (supporting stances may only come from an LLM verifier, which is
  key-blocked) — so the edge holds, and the end-to-end card is the uncited `personal` variant, not an
  `agree` card. The runbook documents exactly what flips when the B5 key lands (band, branch, card
  citation). Note also: this pair's `correlates` relation tops out at `research-context` even when
  served — `agree` requires a monotonic edge (§1.3).
- **Alternative rejected:** hand-marking the verification `supported` for demo effect — would fabricate
  the exact trust signal the adversarial-verification design exists to earn.

## D16 · A1 fix direction: `partial` verdicts also require independent retrieval
- **Choice:** extend the shared-schema safeguard invariant so `partial` verdicts also require
  `independentRetrieval.performed === true` — every servable verdict must be grounded, preserving the
  grounding invariant without shrinking the serving vocabulary.
- **Alternative rejected:** dropping `partial` from `SERVABLE_VERDICTS` — a behavior regression for
  legitimately-partial edges (real, retrieval-backed partial support would stop serving).

## D17 · A18 snooze semantics: snoozed cards skipped at regeneration, indefinitely
- **Choice:** snoozed cards are skipped at regeneration exactly like dismissed ones — a snooze
  persists until the user changes it. The engine stops silently rewriting `status='active'` over a
  user's snooze.
- **Deferred to Jayden:** an N-day auto-reactivation would need a snooze-until column (schema
  addition + product call on N) — not decided autonomously.

## D18 · Dart InsightCard mirror: REVIVE the shared mirror, retire the app-local duplicate
- **Choice:** fix the shared Dart `InsightCard` mirror (id becomes int to match the bigint column;
  add the S8 `producer`/`insight_id`/`edge_refs` fields) and make the app import it, retiring the
  app-local duplicate model — per the "shared/ is the only cross-language seam" rule.
- **Alternative rejected:** retiring the shared mirror and blessing the app-local copy — leaves the
  TRUTH-tier contract dead/misleading and the cross-language seam unowned.

## D19 · A16 + migration policy: shipped-but-unreleased migrations are still append-only
- **Choice:** migrations already in the merged chain are treated as append-only even though they are
  unreleased — audit fixes to schema (A15/A16/A17) ship as NEW additive migrations.
- **Alternative rejected:** editing the historical migration files — rewrites what was reviewed and
  makes the merged chain unreviewable.
- **Also recorded (A10 concurrency):** fix with re-read+merge if the change stays small, else
  document the single-writer assumption — the build agent's call at implementation time.

## D20 · Recovery approach: one merge PR from the chain tip; new units stack on the tip
- **Choice:** recovery from the reverse-cascade merge = ONE PR merging the chain-tip branch
  (`feat/shared/l6-one-card-slice`) into `dev-phase2` (Jayden's click — register B13), while the
  run's new units stack on the chain tip in the meantime.
- **Alternative rejected:** rebasing or re-cherry-picking the 28 chain commits onto `dev-phase2` —
  rewrites reviewed history, breaks the PR-per-session record, and invites conflict churn for zero
  content difference.
