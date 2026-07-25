---
title: Pending-Build Register — where the project's gaps are
summary: The SUPERSET map of everything known-unbuilt or known-gapped across the project (metric expansion, UI, brain/verifier, platform/process, Run-1 carry-forward, Run-2.0 review debt), with what gates each item. A gap RECORD, not a run worklist — items graduate into a run's backlog (next-build-optimizations.md, which is a strict subset of this register) only when Jayden locks a decision for them. Dev aid (docs/temp), not ground truth.
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
open O-items (next-build-optimizations.md), the anchor decisions (docs/memory/0013 et al.),
**everything Run 1 left open** (§E), and **Run 2.0's own review debt** (§F).

## How this register relates to the other two docs

```
pending-build-register.md   ← THIS DOC. Superset: every known gap, no priorities, no locked decisions.
    ├── next-build-optimizations.md   ← Strict SUBSET: gaps Jayden has decision-locked for a run.
    │                                    O1–O8 open · O9–O20 built by Run 2.0 · O21–O23 pending review.
    └── carry-forward-from-run1.md    ← Detail sheet for §E (what Run 1 left open).
```

**Rule:** nothing may exist in `next-build-optimizations.md` or `carry-forward-from-run1.md` without a
row here. Those docs hold the *detail*; this register holds the *complete list*. Every open O-item is
mapped to its row in §G below — check that map before assuming an item is missing.

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
| B-PL10 · **B8 · the two-reviewer rule for `shared/` has no second reviewer** | **blocking, accruing** | Alton is out, so the rule cannot be satisfied as written. Run-2.0 **U2 and U3 both touched `shared/`** and carry `[B8] retro-review` flags. Needs Jayden to grant a solo-review waiver or name a second reviewer. Detail: carry-forward-from-run1.md §2 |
| B-PL11 · ADR amendment intents recorded but NOT applied | open | ADR-0002 is `status: accepted` and immutable to `context_sync --check`, so intents were recorded instead: **D3/F4** (deadbandK) and **D5/F6** (RU4d verify-first) from research-fixes, plus Run-2.0 **D2** (TEST-MODE decorrelation override). Each needs a human to apply it via the ADR 2-reviewer / supersede channel. Ties into B-PL10 |
| B-PL12 · O21 location-fetch trigger config (per-source distance/refresh thresholds) | open — **pending Jayden review** | locked-entry: next-build-optimizations.md O21. Ops/engineering config, explicitly NOT a statistical parameter; gates nothing until env-API collectors exist (see A1 above) |
| B-PL13 · O23 `brain-ingest` → `llm-router` is not a declared package dependency | open — **pending Jayden review** | locked-entry: next-build-optimizations.md O23. 7 files import across the package boundary by relative path; no `workspaces`, no declared dep. Nothing broken today; becomes a **blocker** for any build/publish step, and risks duplicate router module instances (two budget ledgers) |
| B-PL14 · `deno check` cannot run locally | env-gated, structural | no deno on this machine; the CI `deno-check` job is the only type gate for the three edge functions, and it first runs on the PR |
| B-PL15 · run-pipeline mid-sequence failure path never forced live | Run 2.0 carry-forward | straight branch, not exercised on the shared stack (U5/U12); 502 + partial-stage behaviour is untested |
| B-PL16 · run-pipeline stage summaries scale with users × metrics | known, fine at demo scale | flagged in its own header for U6/U8 consumers; revisit before any non-demo load |

---

## E · Run-1 carry-forward — what the first run left open

**Detail sheet: [`carry-forward-from-run1.md`](./carry-forward-from-run1.md).** Run 2.0 executed the
O9–O20 backlog but closed none of the following. Summarised here so the register stays the superset.

| Item | State | Gates / notes |
|---|---|---|
| B-R1-1 · **Run-1 unit sign-off review unfinished** | **open** | Of 24 unit rows in [`run1/unit-index.md`](../run1/unit-index.md), only **U1** is fully cleared; U3 (provisional), U4 (Alton) and U9 are individually signed; **~20 remain pending or deferred**. Authoritative ledger: [`run1/signoff-instructions.md`](../run1/signoff-instructions.md) §6. Stats-bearing rows are ⏸ deferred by design until O2 exists |
| B-R1-2 · Human-gated / external-access blockers **B2–B12** | open | Cloudflare provisioning (B2) · nao Worker secrets + Supabase login user (B3) · GitHub repo secrets (B4) · **API keys for the LLM api-worker route (B5)** · GMI GPU credits (B6) · Apple Developer Program (B7) · B8 → see B-PL10 · hosted Supabase pg_cron (B9) · real Android device (B10) · SJR quartile dataset (B11) · branch-protection required checks (B12). Full detail: [`run1/blocked-register.md`](../run1/blocked-register.md) |
| B-R1-3 · Calibration backlog **B1–B7** (research-fixes) | open | Mechanisms shipped, numbers need data: per-metric medium cutoff · persist edgeScore components · deadbandK intent + fire-rate · deseasonalize day-of-week before lag-7 · faithful xDF effective-N · field-normalized h-index · calibrate `EDGE_GATES`/`EDGE_WEIGHTS` vs GRADE. Several land naturally inside **O2 (MPR)**. Detail: [`run1/research-fixes/blocked-register.md`](../run1/research-fixes/blocked-register.md) |
| B-R1-4 · Register hygiene: **B13 is resolved but still reads open** | trivial | PR #72 merged 2026-07-18 and `b774229` is an ancestor of `dev-phase2`; mark it closed on the next pass |

## F · Run-2.0 review debt

| Item | State | Gates / notes |
|---|---|---|
| B-R2-1 · **Every Run-2.0 unit sign-off is `pending`** | **open — the live task** | 14 rows, U0–U13. The orchestrator never self-signs. Review surface: [`README.md`](./README.md) → [`unit-signoff-index.md`](./unit-signoff-index.md) |
| B-R2-2 · Orientation check not exercised in the decorrelated variant | accepted-as-honest | U13 served 0 edge cards (independent verifier held every directional edge below the servable floor — identical across 2 attempts, a genuine judgment). U12's OpenAI pass is what covers orientation |
| B-R2-3 · PRs #123–#136 are Closed-not-Merged | recorded, not a defect | GitHub refuses to retarget a PR once the new base contains its commits. Content consolidated into `dev-phase2-run2` via `050b296`; no branches deleted |

---

## G · Subset map — every O-item ↔ its register row

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

---

*Update discipline: append/edit rows as gaps close or new ones surface; when an item graduates to a
run backlog, replace its row's State with a pointer to the locked entry, and add a line to §G. When a
gap closes, say which unit/PR closed it rather than deleting the row.*
