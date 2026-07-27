---
title: Run 4 Pending-Build Register
summary: The gap superset for Run 4. Carries forward every open item from the Run-3 register plus the 2026-07-27 audit findings, with original IDs preserved. Sections mirror the Run-3 register so cross-references still resolve; section C is the brain/verifier surface that Run 4 unit U3 must close.
type: plan
scope: shared
status: draft
updated: 2026-07-27
---

# Run 4 Pending-Build Register

The superset of every known open gap entering Run 4. **Original IDs are preserved** — `B-UI3`, `B-PL10`,
`A4` and so on mean exactly what they meant in the Run-3 register, so older sessions and PRs still
resolve. Section letters also mirror Run 3's.

**Read the ID-hygiene warning in §J before citing any short ID.**

## How this relates to the other Run-4 docs

| Doc | Role |
|---|---|
| [`next-build-optimizations.md`](./next-build-optimizations.md) | **Scope authority** — which of these rows Run 4 actually commits to, as locked units |
| This register | **Gap superset** — everything open, including what Run 4 will *not* do |
| [`run3-audit-findings.md`](./run3-audit-findings.md) | The audit that produced the `A#` findings and preconditions `P1`–`P6` |

**What changed on entry to Run 4.** Two capabilities that gated many rows are now available: a **real
Android device** for on-device testing, and a **live local nao**. Rows previously blocked on those are
marked **`UNBLOCKED`** below — this is the single biggest change in the register's shape.

## A · Metric expansion (committed 100-wave)

Currently **19 registered** (13 `daily_gut_rows` + 6 `wearable_daily`) of 100. Of the 81 remaining:
**~15 EASY** (daily self-report scalars) · **~35 MEDIUM** (events / states / phone sensors / wearable
datatypes) · **~31 CHALLENGING** (gated by the structural gaps below).

Run 4 priority 4 targets **EASY + MEDIUM (~50 metrics)**. That is only reachable through these:

| Gap | Blocks | What's needed | Run 4 |
|---|---|---|---|
| `A1` | all 18 W3 env/api metrics | `env_daily` migration + external-API ingestion keyed on GPS+time | **not in scope** (CHALLENGING) |
| `A2` | ~16 derived metrics | one computation-writer pattern + view change; needs O4's select-only RLS first | not in scope |
| `A3` | `known_conditions`, `allergies_known` | new static/T5 primitive decision (O5) | not in scope |
| `A4` | **17 metrics collectible but dashboard-invisible** | `metric_daily_values` view extension, per-primitive unpivot | **REQUIRED for MEDIUM** |
| `A5` | the ~15 EASY metrics ride the gut table | generalise `daily_log` (O5's build-vs-defer call) | **REQUIRED for EASY** |

> **Dependency that must not be missed:** priority 4 cannot ship as written without `A4` and `A5`. They
> are structural schema work, not metric authoring. Sizing the metric unit without them under-scopes it
> by the entire storage-primitive workstream.

Also gated on hardware/accounts: CGM needs a sensor; several wearable datatypes need a real device
(**now partly UNBLOCKED**); iOS remains Mac + paid-Apple gated.

## B · UI / app surface

| ID | Item | State |
|---|---|---|
| `B-UI1` | Porcelain-luxury theme re-skin | **Run 4 priority 5** (was explicitly out of Runs 2–3) |
| `B-UI2` | Formal user testing | **UNBLOCKED** by the Android device; still needs a protocol |
| `B-UI3` | Expert `humanVerdict` not parsed/rendered in biotope provenance | open — O27 slice |
| `B-UI4` | Windows-desktop Flutter launch blocked on OS Developer Mode | open; lower value now a device exists |
| `B-UI5` | nao `/login` browser click-path never driven end-to-end | **UNBLOCKED** by live local nao |
| `B-UI6` | nao Run-now dropdown ignores db seeds | **UNBLOCKED** by live local nao |
| `B-UI7` | nao production build / OpenNext / Worker secrets unverified | open — deliberately out of scope |
| `B-UI8` | O10(c) ingestion-progress read boundary deferred (D13) | open — **relevant to priority 1** |
| `B-UI9` | Artifact-derived demo/fixture/verifier posture | open — O27 slice |
| `B-UI10` | Client-safe provenance language and states | open — O28 slice |
| `B-UI11` | Trends/insights accessibility baseline | **UNBLOCKED** — TalkBack now possible on device |

## C · Brain / verifier / LLM — *Run 4 unit U3 must close this section*

Run 4 priority 3 is a **full single-paper ingestion run with no empty checkpoints**, where the planned
custom models are stood in for by a cheap lightweight OpenAI model.

| ID | Item | State |
|---|---|---|
| `B-BR1` | Real attested decorrelated verifier | open — O29 slice |
| `B-BR2` | O7 general decorrelation invariant, vendor-agnostic | open; see the provider-posture conflict below |
| `B-BR3` | Live web retrieval for the verifier | open — O29 slice |
| `B-BR4` | **Custom support models — every planned checkpoint is currently empty or LLM-absorbed** | **U3 target: fill each with an explicit LLM stand-in** |
| `B-BR5` | Presentation agent (haiku-tier phrasing) not wired | open — `phrasing_card` router node exists, unused |
| `B-BR6` | Autonomous gap→research loop; auto-acting not built | open |
| `B-BR7` | Human-verdict write and revision semantics | open — **and its un-reject/restore slice has no owner** (audit A9) |
| `B-BR8` | O8 router-config calibration | open |
| `B-BR9` | M6 `InsightFiredEvent` not emitted by generate-insights | open |
| `B-BR10` | `contradiction` → `needsReview()` edge-flag not wired | open — **no owner** |
| `B-BR11` | O22 known-venue override table for `impactTier` | open |
| `B-BR12` | Verifier verdicts non-deterministic across runs | accepted-as-honest |

### C.1 — the stand-in contract for U3

Each planned support model has a checkpoint in the pipeline. For the single-paper run, each must be
**explicitly filled and labelled**, never silently skipped:

| Checkpoint | Planned model | Run-4 stand-in |
|---|---|---|
| Claim/evidence verdict pre-filter | Zebra NLI | lightweight OpenAI model, prompted |
| `Citation.evidenceTier` | Giraffe | deterministic A5 rules first, LLM only on the residue |
| `impactTier` | (b2) | **already deterministic** — OpenAlex + SJR lookup, no model needed |
| `directionCheck` / `claimKindCheck` | Salmon / Viceroy | lightweight OpenAI model, prompted |
| A4 sentence roles | Leafcutter | existing Haiku cold-start path |

> **Honesty requirement.** A stand-in is an LLM call, not a custom model. Every artifact it produces
> must carry a provenance marker saying so — the existing `INTERIM:`/`MOCK:` convention. It reduces no
> tokens and proves no model works; its only job is that the pipeline has **no empty checkpoints** end
> to end on one real paper.

> **Provider-posture conflict to resolve before U3.** `router.config.json` currently runs `testMode` ON
> with all six nodes on OpenAI, because only `OPENAI_API_KEY` is provisioned — so the
> synthesis↔verifier family-decorrelation invariant is deliberately off. A single-provider stand-in run
> therefore **cannot** satisfy `B-BR1`/`B-BR2` at the same time. Either accept that U3 proves pipeline
> completeness only (recommended), or provision a second family first. GMI serverless inference is one
> cheap route to a second family and is *not* blocked by the container entitlement.

## D · Platform / process

`B-PL1` evaluate-signals nightly cron · `B-PL2` O1 deadband reconciliation + drift guard ·
`B-PL3` **O2 Method & Parameter Register — hard gate on every statistical sign-off** ·
`B-PL4` O3 registry catalog · `B-PL5` O4 `derived_metrics` select-only RLS (**prerequisite to `A2`**) ·
`B-PL6` O5 storage-primitive coverage (**owns `A3`/`A5`**) · `B-PL7` O6 CODEOWNERS + branch protection
(**overlaps precondition P1**) · `B-PL8` `shared/brain` has no typecheck target ·
`B-PL9` iOS build path · `B-PL10` **B8 two-reviewer rule for `shared/` — blocking and accruing** ·
`B-PL11` ADR amendment intents unapplied · `B-PL12` O21 location-fetch trigger ·
`B-PL13` **O23 `brain-ingest` → `llm-router` not a declared dependency — blocks any build/publish and
creates two budget ledgers** · `B-PL16` run-pipeline summaries scale with users × metrics ·
`B-PL17` semantic-graph freshness unenforced · `B-PL18` semantic-graph query ranking noisy ·
`B-PL19` hosted schema + artifact promotion isolation (**cross-environment verdict slice has no owner**,
audit A10) · `B-PL20` orientation docs lag · `B-PL21` `PaperRecord` duplicated across the ingestion/nao
boundary.

> `B-PL10` gates every `shared/` change. **Run 4 touches `shared/` in at least three places** — auth
> roles (priority 1), the metrics registry (priority 4), and any provenance contract field (priority 2).
> It is a precondition, not a backlog row.

## E–F · Carry-forward and review debt

`B-R1-1` ~20 of 24 Run-1 sign-offs outstanding · `B-R1-2` human blockers B2–B12 (**B10 real Android
device is now UNBLOCKED**) · `B-R1-3` calibration backlog, blocked on `B-PL3` · `B-R1-4` register
hygiene · `B-R2-1` **all 14 Run-2 sign-offs pending** · `B-R2-2`, `B-R2-3` recorded, not defects.

Combined with audit `A14`: **34 outstanding unit sign-offs.** Run 4 should not add more without
changing how acceptance works.

## G · Security, privacy, raw-truth, cost

`B-SEC1` nao RBAC/RLS and global-job privacy boundary (**Run 4 priority 1**; its small-cohort
suppression slice was deferred inside O25, audit A10) · `B-SEC2` legacy `service_role` Bearer dependency
and key rotation (**priority 1**) · `B-DATA1` simulated loader can corrupt raw truth ·
`B-DATA2` pipeline idempotency and atomic publication · `B-COST1` router budget not atomic, no global
cap — six 5-USD node caps imply 30 USD/day against a lower stated ceiling.

## H · Scientific semantics

`B-SCI1` claim-kind loss permits causal inflation · `B-SCI2` uncalibrated support rank presented as
confidence (safe-vocabulary half is O27; **calibration half is blocked on `B-PL3`/O2**).

## I · Audit findings carried in

From [`run3-audit-findings.md`](./run3-audit-findings.md): blockers `A1` (CI not required on any
branch) and `A2` (stale exact-SHA evidence); highs `A3`–`A8`; mediums `A9`–`A18`. Preconditions
`P1`–`P6` are listed in the scope authority.

## J · ID hygiene — read before citing a short ID

- **`B1`–`B13` is two colliding namespaces**: human-gated access blockers (`B5` = provider keys,
  `B10` = Android device, `B11` = SJR dataset) *and* the research-fixes calibration backlog (`B1`–`B7`).
  Always qualify: `B5(access)` vs `B3(calibration)`. `B8` doubles as a human blocker **and** the
  canonical name of `B-PL10`.
- **`A1`–`A5` schema gaps** collide with this audit's `A1`–`A21` finding IDs. Cite as
  `register A4` vs `audit A1`.
- **`O30` is dead** in `docs/temp/` and live in the archive. Run-4 optimisation numbering starts at
  **O31**.
- The Run-3 register's own "56 unique IDs" self-audit was **wrong** (there were 58). Do not trust a
  count without recounting.
