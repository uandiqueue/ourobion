---
title: Run 4 Pending-Build Register — where the project's gaps are
summary: Run 4's living gap superset with a current overlay distinguishing merged, built-unmerged, partial, startable, and deferred work.
type: plan
scope: shared
status: canonical
updated: 2026-07-28
---

# Run 4 Pending-Build Register

**Purpose (Jayden 2026-07-25):** one place recording *where the gaps are*, so nothing known-missing
is only in someone's head or a closed run's carry-forward list. This register was promoted from Run 3
during issue #150 because Run 3 is closing without an accepted implementation unit. **Not everything
here is Run 4** — this register has no authority to launch work; the reviewed Run 4 scope and
orchestrator preflight decide what enters the run.

PR #144 is not an accepted implementation of O24. At Run 4 entry, O24-O29 are all unfinished. Their
original IDs are preserved for traceability; the former Run 3 register remains available in Git
history.

## Current Run 4 overlay — 2026-07-28

The sentence above is historical entry state. Current delivery is:

| Item | Current state |
|---|---|
| O24 / U0 | merged in #161; per-unit base convention #172; next base reconciliation pending |
| O35/O36 / U1 | built but unmerged; #180 remediates #170 and still fails secret scanning + Run 4 gates |
| O25 / U2 | merged in #177; corrections #185/#186 need one reconciled landing |
| O26 / U3 | built on #184; unmerged; gate base, LoaderPanel target and full HTTP walk pending |
| O27/O38 / U4 | startable; Jayden + Alton are named reviewers; not built |
| U5 / B-PL22 | partial: paper authoring branch #176 exists, but sentence provenance and fully connected arbitrary-paper command remain open |
| U7 / B-UI1 | canonical full UI #191 exists and contains #175; unmerged/reconciliation required |
| O28 | partial UI/accessibility work exists; ordinary-user provenance remainder open |
| O29 | general promotion deferred; bounded issue-189 provider test complete, not a general unblock |

Operational details and PR checks live in [`continuation-status.md`](./continuation-status.md). This
register remains the gap superset, not merge authority.

Sources folded in: the 100-metric integration analysis (2026-07-25), Run-2 carry-forwards and
OUT-scope list, open O-items, anchor decisions (docs/memory/0013 et al.), **everything Run 1 left
open** (§E), **Run 2's own review debt** (§F), and the 2026-07-26 independent audit (§§G–H). The
Run-1/Run-2 source records are now frozen at `docs/archive/runs/`; all actionable content is repeated
here so this live register never depends on an archive.

## How this register relates to the other two docs

```
pending-build-register.md   ← THIS DOC. Superset: every known gap, no priorities, no locked decisions.
    ├── next-build-optimizations.md   ← Strict SUBSET: gaps Jayden has decision-locked for a run.
    │                                    O1–O8 open · O9–O20 built by Run 2.0 · O21–O23 pending review
    │                                    · O24–O27 reviewed as the Run 4 priority tranche
    │                                    · O28–O29 deferred by default pending gates and capacity.
    └── docs/archive/runs/             ← Provenance only; never an execution source.
```

**Rule:** nothing may exist in `next-build-optimizations.md` without a row here. Archived run records
may explain provenance, but this register must carry the complete actionable detail. Every open O-item is
mapped to its row in §I below — check that map before assuming an item is missing.

---

## A · Metric expansion (committed 100-wave; analysis 2026-07-25)

Current: **19 registered** (13 daily_gut_rows + 6 wearable_daily). Of the 81 remaining:
**~15 EASY** (daily self-report scalars; existing primitive + form pattern) · **~35 MEDIUM** (events/
states/phone-sensors/wearable datatypes — new collectors + view extension) · **~31 CHALLENGING** —
gated by the four structural gaps below, which collapse most of the challenging bucket once built:

| Gap | Blocks | What's needed |
|---|---|---|
| A1 · `env_daily` table does not exist (dangling in the registry type union) | all 18 W3 env/api metrics (incl. water-cover-style layers) | migration + external-API ingestion keyed on GPS+time + guard |
| A2 · `derived_metrics` has ZERO writers/readers and is NOT in metric_daily_values | ~16 derived metrics (hydration_status, recovery_readiness, gut_transit_estimate…) | one computation-writer pattern + view change + O4's select-only RLS fix first |
| A3 · No static/T5 storage table (`continuity:'static'` is schema-legal but homeless) | known_conditions, allergies_known (+ future profile metrics) | new-primitive decision (surface via O5, do not invent autonomously) |
| A4 · `events`/`state_bands` exist but are NOT in metric_daily_values | 17 metrics collectible but dashboard-invisible | view extension (per-primitive unpivot branches) |
| A5 · `daily_log` not generalized (daily_gut_rows is the grandfathered instance, D9) | the ~15 EASY metrics ride the gut table meanwhile | O5's deliberate build-vs-defer call; trigger per session log: "when a non-gut daily metric ships" |

Also: CGM (glucose_cgm) needs hardware; several wearable datatypes need a real device + platform
testing; iOS remains Mac + paid-Apple-account gated (memory 0010).

## B · UI / app surface

| Item | State | Gates / notes |
|---|---|---|
| B-UI1 · Porcelain-luxury theme re-skin (ai-assets) | built, open-unmerged on canonical #191 | #191 contains predecessor #175; reconcile final data shapes, shared review, Flutter/U2/device evidence; do not merge both |
| B-UI2 · Formal user testing | partial | physical Android rendered the fixed-flow cards; full canonical-UI traversal after #191 reconciliation remains |
| B-UI3 · Expert `humanVerdict` is not parsed/rendered in biotope provenance | data shipped (U9), client truth gap | show current expert disposition + timestamp prominently; retain the machine result only as labelled, superseded history; test accepted/rejected/pending/unavailable |
| B-UI4 · Windows-desktop Flutter launch | blocked | OS Developer Mode needed (non-admin); Android emulator is the working path; manual step in runbook |
| B-UI5 · nao /login browser click-path | partial — **issue #226** | The unauthenticated half (gate redirect, form render, keyboard reach, error surface, desktop + narrow screenshots) is now driven in real Chromium by the #223 identity unit. The **authenticated** traversal is still unproven: Docker is not running on the dev machine, so there is no local Supabase to sign into, and hosted projects stay out of bounds (B-PL19) |
| B-UI6 · nao Run-now dropdown ignores db seeds | deliberate U10 deferral — **issue #228** | Cost is now written down: the dropdown reads the static `INGEST_SEED_TOPICS`, but `ingestControl.ts` also *rejects* any seed outside that list before dispatch, so wiring it is an authz'd control-plane contract change (read `ingestion_seeds` under `guardRole('curator')`, preserve static-wins-on-collision, confirm the workflow input accepts arbitrary slugs), not a UI edit. Deliberately kept out of the #223 identity PR |
| B-UI7 · nao production build (next build / OpenNext / CF Worker secrets) | partial — **issue #227** | The #223 identity unit ran the real path locally: `next build` clean over all 19 routes + middleware, `opennextjs-cloudflare build` produced `.open-next/worker.js`, and no server-only secret name (`SUPABASE_SERVICE_ROLE_KEY`, `GH_ACTIONS_TOKEN`, `NAO_INTERNAL_SECRET`) appears anywhere in the client bundle while `NEXT_PUBLIC_*` does. Still untested: actual deployment and Worker-secret delivery. **A green local production build is not deployment evidence** |
| B-UI8 · O10(c) ingestion-progress read boundary | deferred (D13) | full boundary next cycle; nao Overview covers demo needs |
| B-UI9 · Artifact-derived demo / fixture / verifier posture | open — **Run 4 priority O27** | card-level “demo fixture” + simulated-data disclosure before the claim; derive fixture/live, verifier identity/version and decorrelation/attestation from each artifact; production fails closed on fixtures/missing required attestation |
| B-UI10 · Client-safe provenance language and states | open — **O28 deferred by default** | registry-backed labels/units/abbreviation expansions; no snake_case, raw enums, fixture ids or unexplained `rho`/`nEff`/`q` in ordinary UI; progressive disclosure; distinguish loading/empty/stale/error; validate typed enums and UTF-8 round-trip |
| B-UI11 · Trends / insights accessibility baseline | open — **O28 deferred by default** | chart semantic summary + values alternative; labelled roles/states and hit targets; contrast/text-scale/focus checks; automated semantics tests + one manual TalkBack pass |

## C · Brain / verifier / LLM

| Item | State | Gates / notes |
|---|---|---|
| B-BR1 · Real attested decorrelated verifier | partially simulated — **O29 deferred by default** | require provider-returned model/version and usage fields, response-schema validation, family-mismatch fail-close, run trace, ablation/miss/cost-latency/human-label artifacts; a configured model id is not attestation |
| B-BR2 · O7 general decorrelation invariant (family(verifier) !== family(synthesis), no hardcoded vendor) | open — **O29 deferred by default** | land with live key integration; family separation mitigates self-preference but does not prove independent errors |
| B-BR3 · Live web retrieval for the verifier | open — **O29 deferred by default** | fixture corpus proves plumbing only; add bounded live retrieval, evidence snapshots and echo/source isolation; do not call the result scientifically validated without labelled evaluation |
| B-BR4 · **Custom support models (the 0013 roster)** | open product capability; isolated workstream **outside Run 4** | [`zebra-nli-shadow-v0`](../model-training/zebra-nli-shadow-v0-training-plan.md) is a research pilot with no serving influence and does not close this product gap by itself; active short-circuit and models (b)/(c) remain backlog |
| B-BR5 · Presentation agent (haiku-tier phrasing of card copy) | not wired | engine cards are deterministic templates (memory 0007: LLM summarization is a LATER ADDITIVE phase); phrasing_card router node exists, unused by the engine |
| B-BR6 · Autonomous gap→research loop (A3 queue, dispatch, weekly A1 classifier) | detection+surfacing shipped (Run 2.0); auto-acting NOT | B5 + U16 gated (locked in O9); human add-as-seed is the current bridge |
| B-BR7 · Human-verdict write and revision semantics | partially built; security slice in **O25**, presentation slice in **O27** | direct authenticated inserts bypass route existence checks; verdict is relation-key-only and can poison a future/rebuilt claim; revoke direct writes, use curator RPC, bind disposition to artifact revision/hash or explicitly decide relation-wide semantics, add re-review/restore + audit history |
| B-BR8 · O8 router-config calibration (maxOutputTokens, caps rationale) | open | calibration remains here; concurrency/atomic enforcement is owned separately by B-COST1 |
| B-BR9 · M6 InsightFiredEvent not emitted by generate-insights | integration gap (verdict debt note) | out-of-slice unless M6 is exercised |
| B-BR10 · `contradiction` → shared/brain `needsReview()` edge-flag not wired | Run 2.0 carry-forward (U4 report) | never picked up by U9's serving-layer work; needs an owner |
| B-BR11 · O22 known-venue override table for impactTier banding | open — **pending Jayden review** | locked-entry: next-build-optimizations.md O22. Needs a cited-source research pass (no LLM in the runtime lookup path); also gated on B11 (SJR dataset) |
| B-BR12 · Verifier verdicts are non-deterministic across runs | inherent, documented | the demo runbook warns; matters for anyone treating a re-run as a regression check |

### B-BR4 detail — current stand-ins for the planned custom models

| Planned model (0013) | Job | What replaces it TODAY |
|---|---|---|
| (a) NLI claim-support | verdict pre-filter before the LLM verifier | **Nothing** — no pre-filter stage exists; the verifier LLM (router `verifier` node, gpt-5 api_worker this cycle) does the whole judgment on grounded evidence (U2) |
| (b1) study-design classifier | per-citation `evidenceTier` | **The synthesis LLM assigns it in-prompt** (synth/prompt.ts) with deterministic sanity enforcement at verify (verify/enforce.ts) — an LLM judgment, not a trained classifier |
| (b2) venue lookup | `impactTier` | **IMPLEMENTED deterministically** (tools/brain-ingest/src/venue/: OpenAlex+SJR lookup, banding, cache) — never needed training; heuristic limits documented in docs/research-fixes (PR #113) |
| (c) relation/direction/claim-kind cross-check | catch synthesis self-inconsistency | **Deterministic contract checks** (zod schema + C9 pair-only gate at postprocess + monotonic/orientation invariants in the engine) + the verifier prompt judging stance — no separate model |

Net: every planned-custom slot is currently absorbed by (i) the two big LLM nodes on the router
(OpenAI this cycle, TEST-MODE), (ii) deterministic code where determinism was safe, or (iii) simply
not existing yet. The absent NLI pre-filter removes a potential token-saving and disagreement signal;
it is not itself proof for or against correctness, because the LLM verifier still owns the verdict.

### C.1 — the Run-4 stand-in contract (target state for the single-paper run)

The table above records what fills each slot **today**. This one records what candidate unit **R4-U5**
must fill it with, so the single-paper ingestion run finishes with **no empty checkpoints**:

| Checkpoint | Planned model | Run-4 stand-in |
|---|---|---|
| Claim/evidence verdict pre-filter | (a) Zebra NLI | lightweight OpenAI model, prompted — **the slot that is currently nothing at all** |
| `Citation.evidenceTier` | (b1) Giraffe | deterministic A5 rules first, LLM only on the inconclusive residue |
| `impactTier` | (b2) | **already deterministic** — OpenAlex + SJR; needs nothing |
| `directionCheck` / `claimKindCheck` | (c) Salmon / Viceroy | lightweight OpenAI model, prompted, alongside the existing deterministic contract checks |
| A4 sentence roles | Leafcutter | existing Haiku cold-start path |

Two constraints on that unit:

> **A stand-in is an LLM call, not a custom model.** It reduces no tokens and proves no model works.
> Its only job is that the pipeline has no empty checkpoints end to end on one real paper, so every
> artifact it produces carries an `INTERIM:` provenance marker under the existing convention.

> **Single-provider conflict.** `router.config.json` runs `testMode` ON with all six nodes on OpenAI
> because only `OPENAI_API_KEY` is provisioned, so the synthesis↔verifier decorrelation invariant is
> deliberately off. R4-U5 therefore **cannot** also satisfy `B-BR1`/`B-BR2`; scope it to pipeline
> completeness only. GMI **serverless inference** is one cheap route to a second family and is *not*
> behind the container entitlement that is currently delayed.

## D · Platform / process

| Item | State | Gates / notes |
|---|---|---|
| B-PL1 · evaluate-signals nightly cron (18:15) | IN FLIGHT (H3 approved 2026-07-25 → U14) | prod additionally needs dashboard app.supabase_url/app.service_role_key (memory 0005) |
| B-PL2 · O1 deadbandK doc reconciliation · O1a drift guard (via O3) | open | doc-only + generated-register property |
| B-PL3 · O2 Method & Parameter Register (MPR) | open — HARD GATE on all stats sign-offs | enabling artifact for external stats review + B1–B7 calibration |
| B-PL4 · O3 registry catalog + review surface | open | generated views in docs/shared/registries/ |
| B-PL5 · O4 derived_metrics select-only RLS | open | prerequisite to A2 above |
| B-PL6 · O5 storage-primitive coverage pass + CI guard | open | owns decisions A3/A5 above; matrix from the 100-wave |
| B-PL7 · O6 CODEOWNERS + branch protection | open | needs Alton's GitHub handle |
| B-PL8 · shared/brain has no own typecheck (verified via edge-loader consumer) | U2 finding | consider a tsc target in retro-review |
| B-PL9 · iOS build/test path | env-gated | Mac + paid Apple account + real device (memory 0010) |
| B-PL10 · **B8 · satisfy the two-reviewer rule for `shared/` on actual PRs** | **precondition satisfied; review remains per-PR** | Jayden and Alton are the named reviewers, so this no longer blocks starting U4 or reconciling the UI shared-status change. Their review must still be recorded on every actual `shared/` PR; the naming decision does not waive review or retroactively clear older `[B8] retro-review` flags. Detail: carry-forward-from-run1.md §2 |
| B-PL11 · ADR amendment intents recorded but NOT applied | open | ADR-0002 is `status: accepted` and immutable to `context_sync --check`, so intents were recorded instead: **D3/F4** (deadbandK) and **D5/F6** (RU4d verify-first) from research-fixes, plus Run-2.0 **D2** (TEST-MODE decorrelation override). Each needs a human to apply it via the ADR 2-reviewer / supersede channel. Ties into B-PL10 |
| B-PL12 · O21 location-fetch trigger config (per-source distance/refresh thresholds) | open — **pending Jayden review** | locked-entry: next-build-optimizations.md O21. Ops/engineering config, explicitly NOT a statistical parameter; gates nothing until env-API collectors exist (see A1 above) |
| B-PL13 · O23 `brain-ingest` → `llm-router` is not a declared package dependency | open — **pending Jayden review** | locked-entry: next-build-optimizations.md O23. 7 files import across the package boundary by relative path; no `workspaces`, no declared dep. Nothing broken today; becomes a **blocker** for any build/publish step, and risks duplicate router module instances (two budget ledgers) |
| B-PL14 · Exact-tip CI / Deno release evidence needs current per-unit reconciliation | **delivery merged as U0 #161; reconciliation-required** | O24's release-gate implementation is present and PR #172 added the per-unit base convention. The checked-in `RUN4_UNIT_BASE_SHA` still predates merged U2, so the next orchestrator must advance CI and attestation in lockstep to the exact accepted integration tip, rerun positive and injected-negative evidence, and evaluate each PR's distinct immediate failure. Do not rebuild or silently bypass U0. |
| B-PL15 · run-pipeline mid-sequence failure path never forced live | open — **Run 4 priority O26** | this row owns forced stage-failure/partial-result verification only; B-DATA2 owns idempotency, demand semantics and transactional publication so the two rows do not duplicate |
| B-PL16 · run-pipeline stage summaries scale with users × metrics | known, fine at demo scale | flagged in its own header for U6/U8 consumers; revisit before any non-demo load |
| B-PL17 · Semantic graph freshness is not mechanically enforced at session end | partially mitigated — backlog | The latest refresh validated every manifest entry with a semantic hash, zero pending/deleted files, and zero dangling pair-edge or hyperedge endpoints. The remaining gap is enforcement: Graphify 0.8.40 `graphify update .` / `scripts/graphify-build.ps1` performs structural extraction, while the host-model semantic pass cannot run in CI. Keep the fast/low-effort semantic session convention, then add a local session-end checker for zero pending/deleted files, a current revision stamp, valid schema, and complete endpoints; do not treat silent `graphify check-update .` as proof of semantic freshness. |
| B-PL18 · Semantic graph broad-query ranking is noisy | open — backlog | post-bootstrap exact-ID/source navigation passes, but vocabulary-expanded BFS over-ranks generic AST symbols. Add a representative ranked-query benchmark, node-type-aware semantic/AST hybrid filtering, generic-node suppression and relevance regression gate; freshness proves coverage, not retrieval quality |
| B-PL19 · Hosted Supabase schema + brain-artifact release/promotion isolation | **production blocker — O29 deferred by default** | The 2026-07-26 read-only probe reached Auth/PostgREST on demo `bewwvcksgpxoomyjavjp`, but the Run-2 brain tables were absent; clean production reserve `jscxvnettbvkboijczav` has not been migration/promotion rehearsed. R2 corpus/edge artifacts are canonical: the pinned corpus manifest rebuilds the D1 search index, while pinned edge JSONL rebuilds the Supabase serving projection. Today `edge-loader --from-r2` reads mutable keys and there is no exact migration ledger, explicit release selector, immutable namespace/manifest, checksummed promotion, target-load provenance, rollback, or cross-environment verdict policy. Apply append-only migrations to a clean target, freeze one reviewed corpus/claim/verification/run manifest, promote identical source bytes without another LLM run, rebuild each projection independently, and mechanically exclude auth users, simulated/personal rows, cards/job state and other demo-only data. Hosted writes require Jayden's separate approval of named isolated rehearsal resources; default evidence is local/offline |
| B-PL20 · Canonical orientation docs lag long-horizon builds | open — **Run 4 preflight prerequisite** | The [2026-07-26 freshness audit](../documentation-freshness-audit-2026-07-26.md) found materially stale current-state claims in `next-steps`, `phase-2-plan`, M1/M2 context, nao design/README, architecture/table inventory and shared/brain prose. Run one bounded docs-only reconciliation against the integration SHA before unattended Run 4 work; add active-link and status-freshness automation. This is preflight, not a product unit |
| B-PL21 · `PaperRecord` crosses the ingestion/nao boundary without a shared contract | open — **contract integrity outside the priority tranche** | `tools/brain-ingest/src/types.ts` and `apps/nao/src/lib/types.ts` independently define the manifest record that nao consumes. Promote one additive, versioned `PaperRecord` contract through `shared/brain/`; generate or map TS consumers from that source; add ingestion-to-nao fixture/parity tests and migration compatibility; then remove the duplicate definitions. Because this changes `shared/`, B-PL10's two-reviewer rule applies. Do not fold this engineering work into the B-PL20 docs-only reconciliation |
| B-PL22 · **no single production-shaped command connects ingestion → insights** | partial/open — U5 #176 and provider evidence #190 exist but are unmerged | Full canonical extraction and selected-passage synthesis were exercised; a one-paper edge correctly remained held. Sentence-level StructuredPaper/JATS/citation-root/assertion/NLI stages and a single arbitrary-paper command remain absent. The fixed-edge local harness passed 20/20 with 21 simulated days and Android rendering, which proves API/serving integrity separately from servable real-paper authoring |

---

## E · Run-1 carry-forward — what the first run left open

Run 2.0 executed the O9–O20 backlog but closed none of the following. Historical detail is frozen under
`docs/archive/runs/run1/` and `docs/archive/runs/run2/`; the rows below are deliberately self-contained.

| Item | State | Gates / notes |
|---|---|---|
| B-R1-1 · **Run-1 unit sign-off review unfinished** | **open** | Of 24 unit rows, only **U1** is fully cleared; U3 (provisional), U4 (Alton) and U9 are individually signed; **~20 remain pending or deferred**. Stats-bearing rows are ⏸ deferred by design until O2 exists. Historical ledger: `docs/archive/runs/run1/signoff-instructions.md` §6 |
| B-R1-2 · Human-gated / external-access blockers **B2–B12** | open | Cloudflare provisioning (B2) · nao Worker secrets + Supabase login user (B3) · GitHub repo secrets (B4) · **API keys for the LLM api-worker route (B5)** · GMI access/cost approval (B6, transferred to the [separate Zebra plan](../model-training/zebra-nli-shadow-v0-training-plan.md#31-human-owned-gmi-setup-checklist), not a Run-3 blocker) · Apple Developer Program (B7) · B8 → B-PL10 · hosted Supabase pg_cron (B9) · real Android device (B10) · SJR quartile dataset (B11) · branch-protection required checks (B12) |
| B-R1-3 · Calibration backlog **B1–B7** (research-fixes) | open | Mechanisms shipped, numbers need data: per-metric medium cutoff · persist edgeScore components · deadbandK intent + fire-rate · deseasonalize day-of-week before lag-7 · faithful xDF effective-N · field-normalized h-index · calibrate `EDGE_GATES`/`EDGE_WEIGHTS` vs GRADE. Several land naturally inside **O2 (MPR)**. Historical detail: `docs/archive/runs/run1/research-fixes/blocked-register.md` |
| B-R1-4 · Register hygiene: **B13 is resolved but still reads open** | trivial | PR #72 merged 2026-07-18 and `b774229` is an ancestor of `dev-phase2`; mark it closed on the next pass |

## F · Run-2.0 review debt

| Item | State | Gates / notes |
|---|---|---|
| B-R2-1 · **Every Run-2.0 unit sign-off is `pending`** | **open — human review debt** | 14 rows, U0–U13. The orchestrator never self-signs. Historical evidence is frozen at `docs/archive/runs/run2/README.md` and `unit-signoff-index.md`; this row owns the actionable debt |
| B-R2-2 · Orientation check not exercised in the decorrelated variant | accepted-as-honest | U13 served 0 edge cards twice; treat this as a conservative cross-family model judgment and fail-closed plumbing proof, **not** statistically independent or scientific validation. U12's OpenAI pass is what covers orientation |
| B-R2-3 · PRs #123–#136 are Closed-not-Merged | recorded, not a defect | GitHub refuses to retarget a PR once the new base contains its commits. Content consolidated into `dev-phase2-run2` via `050b296`; no branches deleted |

---

## G · Security, privacy, raw-truth, and cost-control gaps (independent audit 2026-07-26)

| Item | State | Gates / notes |
|---|---|---|
| B-SEC1 · nao RBAC/RLS and global-job privacy boundary | **delivery merged as U2 #177; correction reconciliation-required** | U2 added the explicit membership/role boundary, restricted writes, redacted global-job responses, and the role-matrix/direct-REST harness. PR #186 carries a truthful control-audit correction that overlaps U2 sanitization/logging and must be reconciled with #185 from the current integration tip; rerun all 443 authorization assertions and nao/internal-auth tests before calling this done. |
| B-SEC2 · Legacy `service_role` Bearer dependency and server-key rotation | **delivery merged as U2 #177; correction reconciliation-required** | U2 added the named server-secret boundary and negative header/client-surface coverage. PR #185 carries replacement-key support but currently fails the runtime-attestation config/lock hash check; combine it with #186, preserve backend-only storage and explicit internal/admin authorization, then rerun rotation, leak, header, and 443-assertion evidence before legacy-key retirement. Never expose either key to Flutter or `NEXT_PUBLIC_*`. |
| B-DATA1 · Simulated loader can corrupt the raw truth layer | **production blocker — Run 4 priority O26** | date plan reads gut only, then gut/wearable commit separately; can overwrite wearable-only real dates, strand partial loads, mishandle holes, and retain simulated provenance/stale fields after a real edit. Hard demo-environment/tenant gate, atomic two-table RPC, non-sim conflict refusal, cleanup/repair, explicit real-writer provenance replacement, forced-failure tests |
| B-DATA2 · Pipeline idempotency, gap-demand semantics, and atomic publication | open — **Run 4 priority O26** | repeated/retried unchanged runs inflate demand; JS keys by pair+status while DB keys by pair and last status wins; gap write can commit before card failure. Add durable run/idempotent pipeline runs, input watermark, single-flight, stable per-user/pair/evaluation event, per-status aggregation, retryable stage state and concurrency/failure tests |
| B-COST1 · Router budget enforcement is not atomic or globally capped | open — outside the Run 4 priority tranche | concurrent callers can all pass stale prechecks; file merge/temp path is not locked; corrupt ledger resets to zero; six raiseable 5-USD node caps imply 30 USD/day, not the stated run ceiling. Add central atomic reservation/reconciliation, true global cap, unique call IDs, fail-closed corruption, timeouts/schema validation/ambiguous-call accounting and concurrent stress tests. B-BR8 owns values, not enforcement |

## H · Scientific-semantics gaps (independent audit 2026-07-26)

| Item | State | Gates / notes |
|---|---|---|
| B-SCI1 · Claim-kind loss permits causal inflation | **client-trust blocker — Run 4 priority O27** | `claimKind` is dropped before card rendering, so correlational `increases/decreases` becomes “tends to raise/lower”; the fixture turns “associated with higher” into causal language. Carry source + verifier claim kind through serving/provenance, use distinct correlation/mechanism/causal copy, add relation × kind × verdict tests and a causal-verb copy gate |
| B-SCI2 · Uncalibrated support rank / study-design proxy is presented as confidence / certainty | open — **Run 4 priority O27** for safe vocabulary; O2/B-PL3 for calibration | hide numeric rank from ordinary users or label it “prototype support rank”; rename current evidence tier to study-design tier and say certainty not assessed. Public terminology is owned here; parameter/effect calibration stays in B-PL3/B-R1-3 so the rows do not overlap |

---

## I · Reconciled subset map — every O-item ↔ its register row

### Ownership boundaries after the 2026-07-26 reconciliation

| Boundary | Canonical owner | Explicitly not owned there |
|---|---|---|
| Who may access/mutate nao and what a global job returns | B-SEC1 | claim revision/disposition semantics (B-BR7) |
| Server-to-server key format, header, storage and rotation | B-SEC2 | human/app role authorization and response privacy (B-SEC1) |
| Loading simulated raw rows | B-DATA1 | derived pipeline replay/demand (B-DATA2) |
| Pipeline replay, aggregation and publication | B-DATA2 | forced 502/partial response proof only (B-PL15) |
| Causal vs correlational wording | B-SCI1 | score calibration and evidence appraisal (B-SCI2/B-PL3) |
| Artifact is fixture/live/simulated/attested | B-UI9 | plain terminology/states (B-UI10) and accessibility mechanics (B-UI11) |
| Router limits and token/cap rationale | B-BR8 | atomic enforcement and total cap (B-COST1) |
| Source/type/release checks | B-PL14 | deployed nao bundle/secrets proof (B-UI7) |
| Whether the semantic graph is current | B-PL17 | broad-query relevance/ranking (B-PL18) |
| Whether broad graph queries rank useful context | B-PL18 | freshness/completeness (B-PL17) |
| Hosted schema migration plus immutable science release packaging/cross-environment load | B-PL19 | artifact meaning/disclosure (B-UI9), verdict semantics (B-BR7), or demo/user data (never promoted) |

**Reconciliation result:** 56 canonical row definitions, 56 unique IDs, zero duplicate definitions.
Findings that sharpened an existing root cause were merged into that row (B-PL14, B-PL15, B-BR1,
B-BR4, B-BR7, B-BR8, B-UI3) rather than receiving a second item. F10's provider/Deno/privacy details
are likewise owned by B-BR1/B-PL14/B-SEC1. F13/B-PL19 owns schema and immutable projection promotion,
not deployed-bundle configuration (B-UI7) or verdict meaning (B-BR7); F14/B-SEC2 owns the machine-key
protocol, not human/app authorization (B-SEC1). Cross-references in the O-map are implementation
composition, not duplicate gap ownership; the table above states the boundary where two rows meet.

Proof that [`next-build-optimizations.md`](./next-build-optimizations.md) is fully contained here.
If you add an O-item, add its row above and a line here.

| O-item | Status in the backlog | Register row |
|---|---|---|
| O1 · deadbandK doc reconciliation | open | B-PL2 |
| O2 · Method & Parameter Register (MPR) | open — **hard gate** on all stats sign-offs | B-PL3 (also absorbs much of B-R1-3) |
| O3 · Registry catalog + review surface | open | B-PL4 |
| O4 · `derived_metrics` select-only RLS | open | B-PL5 (prerequisite to A2) |
| O5 · Storage-primitive coverage pass | open | B-PL6 (owns decisions A3/A5) |
| O6 · CODEOWNERS + branch protection | open | B-PL7 (needs Alton's handle; relates to B-PL10) |
| O7 · Generalize the decorrelation invariant | open — lands with B5 | B-BR2 |
| O8 · Router config calibration | open — needs real-run data | B-BR8 |
| O9 · Demand-side gap-driven seeding loop | **demo slice built** (U4+U11); autonomous loop open | B-BR6 |
| O10 · nao control-plane read boundaries | **(a)+(b) built** (U8); **(c) deferred** | B-UI8 for (c) |
| O11 · Simulated health-data loader | **built** (U6) | — (closed) |
| O12 · Serve-pipeline trigger + provenance | **built** (U5 backend, U7 app) | — (closed) |
| O13 · Human verdict override + claims UI | **built** (U9); un-reject not invented | B-BR7 for un-reject |
| O14 · Manual seed-load write path | **built** (U10); Run-now dropdown static | B-UI6 for the dropdown |
| O15 · Ground the adversarial verifier | **built for this cycle**; live retrieval open | B-BR3 |
| O16 · Orientation-aware cards | **built** (U4), live-proven | — (closed) |
| O17 · Servable ⇒ passing quote check | **built** (U3); B8 retro-review outstanding | B-PL10 |
| O18 · research-context gap-only | **built** (U4) per decision (a) | — (closed) |
| O19 · Baseline prune + freshness | **built** (U5) | — (closed) |
| O20 · Copy-gate `derivation` | **built** (U3) | — (closed) |
| O21 · Location-fetch trigger config | open — **pending Jayden review** | B-PL12 |
| O22 · Known-venue override table | open — **pending Jayden review** | B-BR11 (+ B11 SJR dataset via B-R1-2) |
| O23 · brain-ingest → llm-router real dependency | open — **pending Jayden review** | B-PL13 |
| O24 · Exact-tip release gate + complete/reproducible Deno CI | **merged as U0 #161** | B-PL14/O31-O34 delivery present; per-unit gate base needs current-tip reconciliation |
| O25 · nao RBAC/RLS + redacted global-job boundary + named server-key rotation | **merged as U2 #177; corrections open** | Combine #185/#186; rerun B-SEC1/B-SEC2/B-BR7 and 443 auth assertions |
| O26 · Raw-truth-safe demo loader + retry-safe pipeline | **built/open as U3 #184** | B-DATA1/B-DATA2/B-PL15; current gate + LoaderPanel target + full HTTP walk pending |
| O27 · Scientific provenance semantics + artifact trust posture | **startable as U4; not built** | Jayden + Alton named reviewers; B-SCI1/B-SCI2/B-UI3/B-UI9/B-BR7/O38 remain |
| O28 · Plain-language + accessible client insights | **candidate; deferred by default from priority tranche** | B-UI10; B-UI11; O37 |
| O29 · Live verifier/model attestation + migrated immutable release promotion | **candidate; deferred by default pending provider and release gates** | B-BR1; B-BR2; B-BR3; B-PL19 |

## J · Run 4 audit-derived optimisation candidates

These rows make the Run 4 scope document and this superset agree. Their detailed acceptance language
lives in [`next-build-optimizations.md`](./next-build-optimizations.md).

| Item | State | Gates / notes |
|---|---|---|
| O31 · Mechanical landing-delta cap enforcement | merged in U0; base reconciliation pending | Machine gate exists; advance exact per-unit base rather than charging cumulative history |
| O32 · Required-status configuration as recorded state | merged in U0 | Stable aggregate evidence exists; branch intentionally remains unprotected |
| O33 · Fail-closed Supabase function/matrix coverage | merged in U0 | Retain negative fixtures during gate-base changes |
| O34 · Deploy-path dependency attestation | merged in U0 | Regenerate attestation whenever unit base/function graph changes |
| O35 · Import/boundary enforcement | built/unmerged in U1 #170/#180 | Reconcile stacked remediation and rerun bypass fixtures |
| O36 · Secret scanning on push and PR | built/unmerged; current #180 check fails | Fix the real scanner/client-surface failure; do not suppress it |
| O37 · Golden-test determinism prerequisite | candidate; deferred by default | Run 4 defaults to widget + semantics assertions; introduce goldens only with proven cross-platform determinism |
| O38 · Shared trust-label parity | startable in U4; not built | Jayden + Alton named reviewers; use TS/Dart generated or parity-guarded constants, not a cross-language direct import |
| O39 · Dependency update channel | candidate; deferred by default | Separate maintenance policy; do not mix with release-blocker remediation |
| O40 · Documentation status hygiene | Run 4 preflight / closeout candidate | Run 3 closure routing plus a superseding ADR for the accepted/proposed mismatch |

---

*Update discipline: append/edit rows as gaps close or new ones surface; when an item graduates to a
run backlog, replace its row's State with a pointer to the locked entry, and add a line to §I. When a
gap closes, say which unit/PR closed it rather than deleting the row.*
