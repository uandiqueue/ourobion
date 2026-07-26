---
title: Run 2.0 — build report, audit surface, and sign-off cockpit
summary: The report on Phase-2 Run 2.0 (demo-slice build, U0–U13, PRs #123–#136, consolidated into dev-phase2-run2). What was built per unit, with pointers to every doc, commit, PR, and session log; what was live-proven and what honestly was not; budget; decisions; and the exceptions Jayden must weigh. Every unit sign-off is PENDING — this doc is the surface Jayden reviews to sign off or reject. Dev aid (docs/temp), not ground truth.
type: log
scope: shared
status: canonical
updated: 2026-07-26
---

# Run 2.0 — build report & sign-off cockpit

**Read this first.** It is the report on everything Run 2.0 did. It is written to be audited: every
claim points at the commit, PR, session log, or doc that backs it, and everything the run did *not*
prove is named rather than implied.

> **Nothing here is signed off.** The orchestrator never self-signs. Every unit's sign-off is
> `pending` until Jayden reviews it. "done" below always means **built**, never **accepted**.

> **Independent audit (2026-07-26):**
> [`adversarial-audit-2026-07-26.md`](./adversarial-audit-2026-07-26.md) recommends **not signing the
> current tip yet**. After exact-cumulative-SHA CI, an explicit internal-demo-only acceptance boundary,
> and resolution of the B8 shared-contract review debt, it recommends conditional Run-2 acceptance and
> a remediation-first Run 3 capped at seven units. It does not alter any pending per-unit sign-off on
> Jayden's behalf.

## Where to put your review output

| You want to record… | Put it in |
|---|---|
| A gap, bug, missing piece, or comment found while auditing | [`../run3/pending-build-register.md`](../run3/pending-build-register.md) — the standing gap map |
| A per-unit sign-off / rejection | [`unit-signoff-index.md`](./unit-signoff-index.md) — the `SIGN-OFF` column |
| A decision that changes locked intent | [`decisions-signoff.md`](./decisions-signoff.md) (D-entries) |

Run 3's [`pending-build-register.md`](../run3/pending-build-register.md) is the **superset**: everything
unbuilt or gapped, from any source. [`next-build-optimizations.md`](../run3/next-build-optimizations.md)
is the **subset** of that register
already decision-locked for a future run, and
[`carry-forward-from-run1.md`](./carry-forward-from-run1.md) covers what Run 1 left open. Both are
pointed to from the register so nothing lives in only one place.

---

## 1 · What Run 2.0 was

| | |
|---|---|
| **Goal** | A working demo-test MVP: PART-1 main loop steps 1–5 plus features (a)–(d), on the existing simple UI |
| **Ran** | 2026-07-24 → 2026-07-25 |
| **Base** | `dev-phase2` @ `e185cf0` |
| **Units** | 14 rows, **U0–U13** |
| **PRs** | **#123–#136**, stacked chain |
| **Backlog consumed** | O9–O20, preserved in the frozen [`next-build-optimizations-run2-snapshot.md`](./next-build-optimizations-run2-snapshot.md) |
| **Launch prompt** | [`orchestrator-prompt.md`](./orchestrator-prompt.md) |
| **Definition of done** | Scripted e2e dry-run passes + demo runbook reproduces from a clean stack |
| **DoD result** | **MET** — dry-run **21/21** (live pass) + **20/20** (clean-reset reproducibility) + [`docs/shared/phase2-demo-runbook.md`](../../shared/phase2-demo-runbook.md) |

**What the demo does end to end:** load simulated health data from nao → analysis runs → trend chart
appears in biotope → load more days → insight cards generate → open any card and see its provenance.
Plus: (a) change model config and see spend vs budget in nao, (b) break a paper into claims and
REJECT one, (c) add a new ingestion seed, (d) see detected knowledge gaps.

### Branch state

Consolidated into **`dev-phase2-run2`** on 2026-07-25 (cut directly from `dev-phase2` @ `e185cf0`):

| Commit | What |
|---|---|
| `f52261a` | Merge `signoff/phase2` — the Run-1 sign-off review line |
| `050b296` | Merge the whole Run-2.0 chain u0→u13 |
| `befbf72` | Merge PR #120 (Alton's proposals, renumbered O21/O22) |
| `854aa47` | Reorganise `docs/temp` into `run1/` + `run2/` |

PRs #123–#136 are **Closed, not Merged** — GitHub refuses to retarget a PR once the new base already
contains its commits. No content was lost; all 31 branches were verified contained, and none deleted.

---

## 2 · Per-unit record

Authoritative verification detail — including the full "what was NOT verified" column — lives in
[`unit-signoff-index.md`](./unit-signoff-index.md). This table is the navigation map.

| Unit | What it built | O-items | PR | Feature commit | Close commit | Session log | Decision |
|---|---|---|---|---|---|---|---|
| **U0** | Run bootstrap: worktree, run inputs carried onto the branch, tracking docs, final worklist + test strategy from a 4-agent assessment | — | #123 | `6398c5f` | `54ad30c` | [u0-bootstrap](../../sessions/20260724T065420Z-agentjwork-claude-run2-u0-bootstrap.md) | D1, D4, D5 |
| **U1** | Router OpenAI-only TEST-MODE posture: labelled decorrelation override, 6 nodes → gpt-5/gpt-5-mini on `api_worker`, C7 caps 1.00 USD/day/node + 60k tok/run, live smoke call | PART 3 / D2 | #124 | `4934459` | `0f5f5fc` | [u1-router-openai](../../sessions/20260724T071456Z-agentjwork-claude-run2-u1-router-openai.md) | D6, C2, D2 |
| **U2** | Verifier grounding: `EvidencePassage` + `Citation.evidence` (shared/, additive), sentence-level evidence extraction (700-char bound), fixture corpus + JSONL loader, CLI `--corpus` wiring, evidence+locator in the prompt | **O15** | #125 | `9f6e347` | `dcc4a2e` | [u2-verifier-grounding](../../sessions/20260724T074529Z-agentjwork-claude-run2-u2-verifier-grounding.md) | D7, D2 AMENDED |
| **U3** | Contract hardening: servable ⇒ passing quote check (`shared/` superRefine); derivation copy-gate at synthesis (typed rejection) + loader (line-numbered hard-fail) | **O17, O20** | #126 | `052b9a2` | `3e07f3d` | [u3-contract-hardening](../../sessions/20260724T080239Z-agentjwork-claude-run2-u3-contract-hardening.md) | D8 |
| **U4** | Orientation-aware cards (subject-endpoint driver + `rendersCard` policy + fired-metric assert); research-context/contradiction gap-only; `pairEdges` fallback removed; `gap_ledger` migration (§A1 verbatim) + `record_gap_events` RPC | **O16, O18, O9-table** | #127 | `de9f79b` | `35425c7` | [u4-card-semantics](../../sessions/20260724T083316Z-agentjwork-claude-run2-u4-card-semantics.md) | D9 |
| **U5** | `run-pipeline` trigger (3-stage, stop-on-failure, service-role gated); `get_insight_provenance` RPC; baseline upsert-and-prune + `SNAPSHOT_FRESHNESS_DAYS=7`; evaluate-signals `config.toml` entry | **O12-backend, O19** | #128 | `8f872ba` | `a1a4f22` | [u5-trigger-provenance-prune](../../sessions/20260724T090500Z-agentjwork-claude-run2-u5-trigger-provenance-prune.md) | D10 |
| **U6** | nao `/loader`: deterministic correlated generator, RLS-scoped upserts, incremental backfill, run-analysis relay; `data_origin` migration; **first-ever nao CI job**; SubNav tab | **O11** | #129 | `37d69e4` | `5de746f` | [u6-nao-data-loader](../../sessions/20260724T094500Z-agentjwork-claude-run2-u6-nao-data-loader.md) | D11, D3 |
| **U7** | biotope TRENDS section (CustomPaint chart, metric picker, 30d) + `MetricSeriesService`; insight provenance screen + `ProvenanceService`; TEST-MODE stamp under every edge verdict; all new strings copy-gated | **O12-app** | #130 | `65200d0` | `55e6ba7` | [u7-biotope-trend-provenance](../../sessions/20260724T102352Z-agentjwork-claude-run2-u7-biotope-trend-provenance.md) | D12 |
| **U8** | `llm_router_status`/spend projections + bounds-checked `cap_overrides` write surface; publish-status script; router override consumption (per-node, replace-not-min, fail-soft); nao `/models` panel | **O10 (a)+(b)** | #131 | `7e836c5` | `e25ec26` | [u8-model-config-spend](../../sessions/20260724T121500Z-agentjwork-claude-run2-u8-model-config-spend.md) | D13, C2.4 |
| **U9** | `edge_human_verdicts` (append-only, reject-only); `verified_edges` + provenance RPC recreated with human columns; generate-insights reject exclusion; nao claims UI + reject route | **O13** | #132 | `3588446` | `3697967` | [u9-claims-human-verdict](../../sessions/20260724T150900Z-agentjwork-claude-run2-u9-claims-human-verdict.md) | D14 |
| **U10** | `ingestion_seeds` table (slug-checked, enabled-only UPDATE grant); fail-soft db-seeds reader + merge (static wins); CLI merged topics feeding discovery + seeder anchors; nao Seeds section; `LlmRouter.create()` adopted | **O14** | #133 | `80be01e` | `08d5d79` | [u10-seeds-as-data](../../sessions/20260724T152525Z-agentjwork-claude-run2-u10-seeds-as-data.md) | D15 |
| **U11** | nao Knowledge-gaps section on `/ingest`: `gap_ledger` aggregate read (§A1 labels, diagnostic-vocabulary ban test, demand DESC, top-50 honest note) + add-as-seed prefill (human-in-the-loop only) | **O9 slice** | #134 | `f84a8eb` | `3416a4f` | [u11-gap-surfacing](../../sessions/20260724T161012Z-agentjwork-claude-run2-u11-gap-surfacing.md) | — |
| **U12** | Scripted e2e dry-run (`scripts/demo-dryrun-run2.ps1`, 21 steps) + [demo runbook](../../shared/phase2-demo-runbook.md) + LIVE OpenAI verify + Anthropic decorrelated leg + emulator visual check (5 screenshots) + a real U7 bug fix found by it | **DoD (v)+(vi), acceptance (iv)** | #135 | `2496da0` | `8271d65` | [u12-demo-dryrun](../../sessions/20260724T165648Z-agentjwork-claude-run2-u12-demo-dryrun.md) | D16, D17 |
| **U13** | `-DecorrelatedFullRun` dry-run variant (verifier → claude-sonnet-5, merged runtime corpus, all 5 claims live, real DB load, full loop, byte-identical config restore) + H2 doc reconciliation (3/5/14 → 3/7/14) | **H1, H2** | #136 | `d0f171e` | `4c72dd4` | [u13-decorrelated-fullrun](../../sessions/20260725T051506Z-agentjwork-claude-run2-u13-decorrelated-fullrun.md) | — |

### Acceptance tests (the binding bar)

| # | Requirement | Unit | Result |
|---|---|---|---|
| (i) | Evidence text + provenance reach the **actual router request** from the real CLI seam | U2 | PASS — fetch-level capture, mutation-checked |
| (ii) | Orientation matrix: subject-only / object-only / both-consistent / both-inconsistent × increases/decreases | U4 | PASS — live on local stack, 0 wrong-metric cards |
| (iii) | A failed quote check never yields a servable band | U3 | PASS — git-stash mutation-proven |
| (iv) | One real end-to-end main-loop run on simulated data with OpenAI, card copy inspected for both orientations | U12 | PASS — 0 mismatches |

---

## 3 · Budget

| Provider | Cap | Spent | Note |
|---|---|---|---|
| OpenAI | 20 SGD | **≈ 0.182 SGD** (US$0.14147) | U1 smoke US$0.00015125 + U12 verify legs US$0.141315. 99.1% under cap |
| Anthropic | 2 SGD | **≈ 0.319 SGD** (US$0.24705) | U12 leg US$0.04266 + U13 full-loop US$0.20439, per Jayden's H1 directive. Config restored to OpenAI-only after each leg |

C7 caps (1.00 USD/day/node, 60k tok/run) were never raised and the hard stops were never approached.
Policy held: fixtures/offline first, live calls only for the essential proofs.

---

## 4 · Decisions and human items

- **[`decisions-signoff.md`](./decisions-signoff.md)** — D1–D17 plus C2 (router config values). Notable:
  **D2** (OpenAI-only = TEST-MODE decorrelation override, recorded as an ADR amendment intent) and its
  **D2 AMENDED** (Anthropic key loaded, ≤ 2 SGD); **D3** (nao writes biotope tables — a deliberate
  design-contract deviation, dev-only + provenance-flagged, flagged for retro-review);
  **D17** (subagent model policy — U13 was the first Sonnet-5 dispatch).
- **[`human-decisions.md`](./human-decisions.md)** — H1 (decorrelation posture) and H2 (baseline-confidence
  truth drift) were **resolved by Jayden 2026-07-25** and executed by U13. **H3** (evaluate-signals has
  no cron schedule) was approved and is in flight as U14 — tracked as `B-PL1` in the register.
- **[`backend-adversarial-verdict-2026-07-22.md`](./backend-adversarial-verdict-2026-07-22.md)** — the
  adversarial review whose verdicts B1–B3 / H1–H3 became O15–O20 and set this run's scope.
- **[`assets/`](./assets/)** — the 5 U12 emulator screenshots (visual evidence).

---

## 5 · Exceptions and honest gaps — what to weigh when signing off

These are stated because they bear on whether the run should be accepted, not because they are defects.

1. **Decorrelation is simulated, not attested.** U12/U13 ran genuine live legs on the Anthropic family,
   but the run labels this **"decorrelated but NOT attested/ablated"**. A real claim needs B5: attestation
   of the provider-returned model, family-mismatch rejection on the live route, and ablation artifacts.
   → register `B-BR1`, `B-BR2`.
2. **U13 served 0 edge cards — twice, identically.** The independent verifier held every directional edge
   below the servable floor. The run recorded this as a **genuine independent judgment, not a bug**
   (verdicts were identical across two attempts; a DB-level `verifierModel` trace proves persistence).
   The consequence: **the orientation check was not exercised in that variant** — U12's OpenAI pass is
   what covers it. Worth your judgement.
3. **`shared/` was touched by U2 and U3** and the **B8 two-reviewer rule cannot be satisfied** (Alton is
   out). Both carry an explicit `[B8] retro-review` flag. → `carry-forward-from-run1.md` §2.
4. **Verifier grounding is fixture-based.** O15 shipped evidence-bearing citations and a fixture corpus;
   **live web retrieval was deliberately scoped out** to the next cycle. → `B-BR3`.
5. **O10(c)** (ingestion-progress read boundary) was **deliberately deferred** — the existing nao Overview
   covers the demo. → `B-UI8`.
6. **Deno typecheck never ran locally** (no deno on this machine); the CI `deno-check` job is the type
   gate for the three edge functions, and it first runs on the PR.
7. **Environment-blocked, documented not proven:** Windows-desktop Flutter launch (Dev Mode off →
   `B-UI4`), nao `/login` browser click-path (`B-UI5`), nao production/OpenNext build (`B-UI7`).
8. **`humanVerdict` ships as data but is unrendered** in biotope's provenance screen. → `B-UI3`.
9. **Verifier verdicts are non-deterministic** — the runbook warns about this; a re-run may differ.
10. **Two units needed recovery:** U8 died on a transient ENOTFOUND before any write (clean re-run);
    U9 hit a session limit halt mid-unit, and the second agent audited the inherited work, found and
    fixed a real containment-serialization bug, and redid the full gate.

**Carry-forwards recorded at run close:** `contradiction` → `needsReview()` edge-flag not wired;
run-pipeline stage summaries scale with users×metrics (fine at demo scale); run-pipeline
mid-sequence-failure path never forced live.

---

## 6 · How to audit this

1. Read §2 and open the session log for any unit you want to inspect — each log records the reasoning,
   the gate output, and the live proof for that unit.
2. Check the claims in [`unit-signoff-index.md`](./unit-signoff-index.md), especially the
   **"what was NOT verified"** notes — that column is where the run was deliberately honest.
3. Reproduce the demo from a clean stack with
   [`docs/shared/phase2-demo-runbook.md`](../../shared/phase2-demo-runbook.md).
4. Record every gap, bug, or comment you find in
   [`../run3/pending-build-register.md`](../run3/pending-build-register.md).
5. Sign off (or reject) per unit in the `SIGN-OFF` column of `unit-signoff-index.md`.
