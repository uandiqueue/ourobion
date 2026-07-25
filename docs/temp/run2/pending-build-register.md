---
title: Pending-Build Register — where the project's gaps are
summary: The standing map of everything known-unbuilt or known-gapped across the project (metric expansion, UI, brain/verifier, platform/process), with what gates each item. A gap RECORD, not a run worklist — items graduate into a run's backlog (next-build-optimizations.md style) only when Jayden locks a decision for them. Dev aid (docs/temp), not ground truth.
type: plan
scope: shared
status: canonical
updated: 2026-07-25
---

# Pending-Build Register

**Purpose (Jayden 2026-07-25):** one place recording *where the gaps are*, so nothing known-missing
is only in someone's head or a closed run's carry-forward list. **Not everything here is Run 3.0** —
this register has no priorities and no locked decisions; when an item is chosen for a run, it gets a
decision-locked entry in that run's backlog doc and a pointer back here.

Sources folded in: the 100-metric integration analysis (2026-07-25), Run 2.0 carry-forwards
(docs/temp/run2/orchestration-log.md), the Run 2.0 OUT-scope list (launch prompt PART 4),
open O-items (next-build-optimizations.md), and the anchor decisions (docs/memory/0013 et al.).

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
| B-UI1 · Porcelain-luxury theme re-skin (ai-assets) | not started — deliberately | HUMAN-SUPERVISED phase (Jayden on-site with the running app); explicitly OUT of Run 2.0 (PART 4) |
| B-UI2 · Formal user testing | not started | demo runbook (docs/shared/phase2-demo-runbook.md) is the entry point |
| B-UI3 · `humanVerdict` field unrendered in biotope provenance screen | data shipped (U9), UI gap (U12/U13 carry-forward) | small Flutter change + copy-gate |
| B-UI4 · Windows-desktop Flutter launch | blocked | OS Developer Mode needed (non-admin); Android emulator is the working path; manual step in runbook |
| B-UI5 · nao /login browser click-path | documented-only | never driven end-to-end in a browser (routes proven via cookie sessions) |
| B-UI6 · nao Run-now dropdown ignores db seeds | deliberate U10 deferral | wiring drags the R2-control-doc + GH-Actions dispatch contract in; pairs with O10(c) |
| B-UI7 · nao production build (next build / OpenNext / CF Worker secrets) | unverified | local dev proven; prod path incl. SUPABASE_SERVICE_ROLE_KEY delivery via Worker secrets untested |
| B-UI8 · O10(c) ingestion-progress read boundary | deferred (D13) | full boundary next cycle; nao Overview covers demo needs |

## C · Brain / verifier / LLM

| Item | State | Gates / notes |
|---|---|---|
| B-BR1 · Real attested decorrelated verifier | partially simulated | U12/U13 ran live decorrelated legs ("decorrelated but NOT attested/ablated"); full claim needs B5: attestation of provider-returned model, family-mismatch rejection on the real route, ablation/miss/cost-latency/second-labeller artifacts |
| B-BR2 · O7 general decorrelation invariant (family(verifier) !== family(synthesis), no hardcoded vendor) | open | lands WITH B5 key integration; TEST-MODE covers this cycle |
| B-BR3 · Live web retrieval for the verifier | open (O15 scoped it out) | fixture corpus is this cycle's grounding; live retrieval adapter next cycle |
| B-BR4 · **Custom support models (the 0013 roster)** | NOT trained — see "current stand-ins" below | training gated on GMI credits + GPU (0013 execution note); `no_effect` has NO public training source (known gap: source in-house or leave to the LLM) |
| B-BR5 · Presentation agent (haiku-tier phrasing of card copy) | not wired | engine cards are deterministic templates (memory 0007: LLM summarization is a LATER ADDITIVE phase); phrasing_card router node exists, unused by the engine |
| B-BR6 · Autonomous gap→research loop (A3 queue, dispatch, weekly A1 classifier) | detection+surfacing shipped (Run 2.0); auto-acting NOT | B5 + U16 gated (locked in O9); human add-as-seed is the current bridge |
| B-BR7 · Un-reject/restore on edge_human_verdicts | deliberately not invented (U9) | append-only, reject-only CHECK; semantics need a decision |
| B-BR8 · O8 router-config calibration (maxOutputTokens, caps rationale) | open | with B5 real-run data |
| B-BR9 · M6 InsightFiredEvent not emitted by generate-insights | integration gap (verdict debt note) | out-of-slice unless M6 is exercised |

### B-BR4 detail — current stand-ins for the planned custom models

| Planned model (0013) | Job | What replaces it TODAY |
|---|---|---|
| (a) NLI claim-support | verdict pre-filter before the LLM verifier | **Nothing** — no pre-filter stage exists; the verifier LLM (router `verifier` node, gpt-5 api_worker this cycle) does the whole judgment on grounded evidence (U2) |
| (b1) study-design classifier | per-citation `evidenceTier` | **The synthesis LLM assigns it in-prompt** (synth/prompt.ts) with deterministic sanity enforcement at verify (verify/enforce.ts) — an LLM judgment, not a trained classifier |
| (b2) venue lookup | `impactTier` | **IMPLEMENTED deterministically** (tools/brain-ingest/src/venue/: OpenAlex+SJR lookup, banding, cache) — never needed training; heuristic limits documented in docs/research-fixes (PR #113) |
| (c) relation/direction/claim-kind cross-check | catch synthesis self-inconsistency | **Deterministic contract checks** (zod schema + C9 pair-only gate at postprocess + monotonic/orientation invariants in the engine) + the verifier prompt judging stance — no separate model |

Net: every planned-custom slot is currently absorbed by (i) the two big LLM nodes on the router
(OpenAI this cycle, TEST-MODE), (ii) deterministic code where determinism was safe, or (iii) simply
not existing yet (the NLI pre-filter — its absence costs verifier tokens, not correctness).

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

---

*Update discipline: append/edit rows as gaps close or new ones surface; when an item graduates to a
run backlog, replace its row's State with a pointer to the locked entry.*
