---
title: Phase-2 Run — Decisions for Human Sign-off
summary: Every non-trivial choice the automated Phase-2 run made on Jayden's behalf, with the alternatives rejected and why — the retroactive-review queue for the run. Hard-coded numeric/config values live in phase2-run-config-decisions.md instead.
type: plan
scope: shared
status: canonical
updated: 2026-07-15
---

# Phase-2 Run — Decisions for Human Sign-off

Non-trivial choices made autonomously during the run. Review order: D1 first (it colors everything).
Numeric hyperparameters/config values are in [`phase2-run-config-decisions.md`](./phase2-run-config-decisions.md).

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

## D8 · L0 fields shipped as required/nullable, not optional-with-default
- **Choice:** `derivation` is required and `population`/`charStart`/`charEnd` are required-nullable on
  the brain contract, exactly as the architecture specifies — no optionality escape hatch.
- **Rationale:** memory 0002's optional-with-default rule protects existing instances; the build agent
  verified there are zero persisted claim/verification instances and zero constructors in code, so
  strictness is free now and saves a tightening migration later.

## D9 · Storage-primitive schema judgment calls (U2)
- **Choices (full list + rationale in session log `20260715T140420Z-…storage-primitives.md`):** jsonb
  values on `events`/`state_bands`/`derived_metrics`, fixed `double precision` on `signals` (no
  `value_text`); natural composite PK `(user_id, metric_key, ts, source)` on `signals`;
  `daily_log` deliberately NOT created (`daily_gut_rows` is its grandfathered instance); no
  overlap-exclusion constraint on `state_bands` (concurrent courses are legal; collector's problem).
- **The one precedent conflict:** `derived_metrics` got all four RLS policies while `baseline_snapshots`
  is select-only — followed the session spec (client-side derivation already exists in M2; "never
  hand-edit" is a process rule, not an RLS rule). Flag if you'd rather match the select-only precedent.

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

## D6 · Run-tracking docs live in `docs/shared/` as indexed canonical docs
- **Choice:** the four `phase2-run-*` docs sit in `docs/shared/` with full front-matter, picked up by
  `--fix-index` (taxonomy 0015: process/roadmap docs belong in shared).
- **Alternative rejected:** `docs/temp/` drafts — exempt from index enforcement, but these docs are the
  run's review deliverable and must be as discoverable as `next-steps.md`.

## D7 · Assessment discrepancy surfaced, not silently corrected
- **Choice:** the 2026-07-13 session log's claim that the `main` fold happened is recorded as a
  discrepancy (register B1) rather than edited — session logs are append-only, and the fold stays gated
  on your explicit go.
