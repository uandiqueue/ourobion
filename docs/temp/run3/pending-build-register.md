---
title: Run 3 Pending-Build Register — where the project's gaps are
summary: Run 3's living SUPERSET map of everything known-unbuilt or known-gapped across the project, including Run-2 carry-forwards and adversarial-audit deltas. A gap record, not the locked Run 3 worklist; items enter next-build-optimizations.md only when Jayden locks them for a run. Dev aid (docs/temp), not ground truth.
type: plan
scope: shared
status: canonical
updated: 2026-07-26
---

# Run 3 Pending-Build Register

**Purpose (Jayden 2026-07-25):** one place recording *where the gaps are*, so nothing known-missing
is only in someone's head or a closed run's carry-forward list. **Not everything here is Run 3.0** —
this register has no priorities and no locked decisions; when an item is chosen for a run, it gets a
decision-locked entry in that run's backlog doc and a pointer back here.

Sources folded in: the 100-metric integration analysis (2026-07-25), Run 2.0 carry-forwards
(docs/temp/run2/orchestration-log.md), the Run 2.0 OUT-scope list (launch prompt PART 4),
open O-items (next-build-optimizations.md), the anchor decisions (docs/memory/0013 et al.),
**everything Run 1 left open** (§E), **Run 2.0's own review debt** (§F), and the independent
[Run-2 adversarial audit](../run2/adversarial-audit-2026-07-26.md) (§§G–H).

## How this register relates to the other two docs

```
pending-build-register.md   ← THIS DOC. Superset: every known gap, no priorities, no locked decisions.
    ├── next-build-optimizations.md   ← Strict SUBSET: gaps Jayden has decision-locked for a run.
    │                                    O1–O8 open · O9–O20 built by Run 2.0 · O21–O23 pending review
    │                                    · O24–O30 locked as the seven-unit Run 3 tranche.
    └── ../run2/carry-forward-from-run1.md  ← Historical detail sheet for §E.
```

**Rule:** nothing may exist in `next-build-optimizations.md` or Run 2's
`carry-forward-from-run1.md` without a row here. Those docs hold the *detail*; this register holds the
*complete list*. Every open O-item is
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
| B-UI1 · Porcelain-luxury theme re-skin (ai-assets) | not started — deliberately | HUMAN-SUPERVISED phase (Jayden on-site with the running app); explicitly OUT of Run 2.0 (PART 4) |
| B-UI2 · Formal user testing | not started | demo runbook (docs/shared/phase2-demo-runbook.md) is the entry point |
| B-UI3 · Expert `humanVerdict` is not parsed/rendered in biotope provenance | data shipped (U9), client truth gap | show current expert disposition + timestamp prominently; retain the machine result only as labelled, superseded history; test accepted/rejected/pending/unavailable |
| B-UI4 · Windows-desktop Flutter launch | blocked | OS Developer Mode needed (non-admin); Android emulator is the working path; manual step in runbook |
| B-UI5 · nao /login browser click-path | documented-only | never driven end-to-end in a browser (routes proven via cookie sessions) |
| B-UI6 · nao Run-now dropdown ignores db seeds | deliberate U10 deferral | wiring drags the R2-control-doc + GH-Actions dispatch contract in; pairs with O10(c) |
| B-UI7 · nao production build (next build / OpenNext / CF Worker secrets) | unverified | local dev proven; prod path incl. SUPABASE_SERVICE_ROLE_KEY delivery via Worker secrets untested |
| B-UI8 · O10(c) ingestion-progress read boundary | deferred (D13) | full boundary next cycle; nao Overview covers demo needs |
| B-UI9 · Artifact-derived demo / fixture / verifier posture | open — **Run 3 O27** | card-level “demo fixture” + simulated-data disclosure before the claim; derive fixture/live, verifier identity/version and decorrelation/attestation from each artifact; production fails closed on fixtures/missing required attestation |
| B-UI10 · Client-safe provenance language and states | open — **Run 3 O28** | registry-backed labels/units/abbreviation expansions; no snake_case, raw enums, fixture ids or unexplained `rho`/`nEff`/`q` in ordinary UI; progressive disclosure; distinguish loading/empty/stale/error; validate typed enums and UTF-8 round-trip |
| B-UI11 · Trends / insights accessibility baseline | open — **Run 3 O28** | chart semantic summary + values alternative; labelled roles/states and hit targets; contrast/text-scale/focus checks; automated semantics tests + one manual TalkBack pass |

## C · Brain / verifier / LLM

| Item | State | Gates / notes |
|---|---|---|
| B-BR1 · Real attested decorrelated verifier | partially simulated — **Run 3 O29** | require provider-returned model/version and usage fields, response-schema validation, family-mismatch fail-close, run trace, ablation/miss/cost-latency/human-label artifacts; a configured model id is not attestation |
| B-BR2 · O7 general decorrelation invariant (family(verifier) !== family(synthesis), no hardcoded vendor) | open — **Run 3 O29** | land with live key integration; family separation mitigates self-preference but does not prove independent errors |
| B-BR3 · Live web retrieval for the verifier | open — **Run 3 O29** | fixture corpus proves plumbing only; add bounded live retrieval, evidence snapshots and echo/source isolation; do not call the result scientifically validated without labelled evaluation |
| B-BR4 · **Custom support models (the 0013 roster)** | one bounded pilot promoted — **Run 3 O30** | train/evaluate SciFact-only NLI Shadow v0 under the fixed [GMI training plan](./custom-model-training-plan.md); no serving influence. Every dataset needs explicit licence approval; HealthVer stays excluded until permission is documented; active short-circuit and models (b)/(c) remain backlog |
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
| B-PL14 · Exact-tip CI / Deno release evidence is missing | **release-blocking — Run 3 O24** | PR #123 bootstrap has 13 green checks; #124–#136 have zero because stacked bases miss the workflow filter; consolidated branch also misses push filter; Deno matrix omits `run-pipeline` and uses fresh `--no-lock` resolution. Require full green workflow on the final cumulative SHA with all handlers and pinned resolution |
| B-PL15 · run-pipeline mid-sequence failure path never forced live | open — **Run 3 O26** | this row owns forced stage-failure/partial-result verification only; B-DATA2 owns idempotency, demand semantics and transactional publication so the two rows do not duplicate |
| B-PL16 · run-pipeline stage summaries scale with users × metrics | known, fine at demo scale | flagged in its own header for U6/U8 consumers; revisit before any non-demo load |
| B-PL17 · Semantic graph freshness/integrity is not enforced at session end | open — outside locked Run 3 | Graphify 0.8.40 `graphify update .` / `scripts/graphify-build.ps1` stamps AST only; host-model `/graphify . --update` is the semantic incremental path. The audit's full-endpoint check also found 11 retained hyperedges referencing 31 absent node IDs that a pair-edge-only check missed. Add a session/unit-end convention plus local pre-push gate for zero semantic pending/deleted files, `built_at_commit == HEAD`, valid schema, and zero dangling pair-edge/hyperedge endpoints; do not use silent `graphify check-update .` or pretend CI can regenerate a machine-local host-model projection |
| B-PL18 · Semantic graph broad-query ranking is noisy | open — outside locked Run 3 | post-bootstrap exact-ID/source navigation passes, but vocabulary-expanded BFS over-ranks generic AST symbols. Add a representative ranked-query benchmark, node-type-aware semantic/AST hybrid filtering, generic-node suppression and relevance regression gate; freshness proves coverage, not retrieval quality |
| B-PL19 · Hosted Supabase schema + brain-artifact release/promotion isolation | **production blocker — Run 3 O29** | The 2026-07-26 read-only probe reached Auth/PostgREST on demo `bewwvcksgpxoomyjavjp`, but the Run-2 brain tables were absent; clean production reserve `jscxvnettbvkboijczav` has not been migration/promotion rehearsed. R2 corpus/edge artifacts are canonical: the pinned corpus manifest rebuilds the D1 search index, while pinned edge JSONL rebuilds the Supabase serving projection. Today `edge-loader --from-r2` reads mutable keys and there is no exact migration ledger, explicit release selector, immutable namespace/manifest, checksummed promotion, target-load provenance, rollback, or cross-environment verdict policy. Apply append-only migrations to a clean target, freeze one reviewed corpus/claim/verification/run manifest, promote identical source bytes without another LLM run, rebuild each projection independently, and mechanically exclude auth users, simulated/personal rows, cards/job state and other demo-only data. Hosted writes require Jayden's separate approval of named isolated rehearsal resources; default evidence is local/offline |

---

## E · Run-1 carry-forward — what the first run left open

**Detail sheet: [`carry-forward-from-run1.md`](../run2/carry-forward-from-run1.md).** Run 2.0 executed the
O9–O20 backlog but closed none of the following. Summarised here so the register stays the superset.

| Item | State | Gates / notes |
|---|---|---|
| B-R1-1 · **Run-1 unit sign-off review unfinished** | **open** | Of 24 unit rows in [`run1/unit-index.md`](../run1/unit-index.md), only **U1** is fully cleared; U3 (provisional), U4 (Alton) and U9 are individually signed; **~20 remain pending or deferred**. Authoritative ledger: [`run1/signoff-instructions.md`](../run1/signoff-instructions.md) §6. Stats-bearing rows are ⏸ deferred by design until O2 exists |
| B-R1-2 · Human-gated / external-access blockers **B2–B12** | open | Cloudflare provisioning (B2) · nao Worker secrets + Supabase login user (B3) · GitHub repo secrets (B4) · **API keys for the LLM api-worker route (B5)** · GMI organization/container entitlement, credits, storage, SSH and cost approval (B6; [O30 setup](./custom-model-training-plan.md#31-human-owned-gmi-setup-checklist)) · Apple Developer Program (B7) · B8 → see B-PL10 · hosted Supabase pg_cron (B9) · real Android device (B10) · SJR quartile dataset (B11) · branch-protection required checks (B12). Full detail: [`run1/blocked-register.md`](../run1/blocked-register.md) |
| B-R1-3 · Calibration backlog **B1–B7** (research-fixes) | open | Mechanisms shipped, numbers need data: per-metric medium cutoff · persist edgeScore components · deadbandK intent + fire-rate · deseasonalize day-of-week before lag-7 · faithful xDF effective-N · field-normalized h-index · calibrate `EDGE_GATES`/`EDGE_WEIGHTS` vs GRADE. Several land naturally inside **O2 (MPR)**. Detail: [`run1/research-fixes/blocked-register.md`](../run1/research-fixes/blocked-register.md) |
| B-R1-4 · Register hygiene: **B13 is resolved but still reads open** | trivial | PR #72 merged 2026-07-18 and `b774229` is an ancestor of `dev-phase2`; mark it closed on the next pass |

## F · Run-2.0 review debt

| Item | State | Gates / notes |
|---|---|---|
| B-R2-1 · **Every Run-2.0 unit sign-off is `pending`** | **open — the live task** | 14 rows, U0–U13. The orchestrator never self-signs. Review surface: [`README.md`](../run2/README.md) → [`unit-signoff-index.md`](../run2/unit-signoff-index.md) |
| B-R2-2 · Orientation check not exercised in the decorrelated variant | accepted-as-honest | U13 served 0 edge cards twice; treat this as a conservative cross-family model judgment and fail-closed plumbing proof, **not** statistically independent or scientific validation. U12's OpenAI pass is what covers orientation |
| B-R2-3 · PRs #123–#136 are Closed-not-Merged | recorded, not a defect | GitHub refuses to retarget a PR once the new base contains its commits. Content consolidated into `dev-phase2-run2` via `050b296`; no branches deleted |

---

## G · Security, privacy, raw-truth, and cost-control gaps (independent audit 2026-07-26)

| Item | State | Gates / notes |
|---|---|---|
| B-SEC1 · nao RBAC/RLS and global-job privacy boundary | **production blocker — Run 3 O25** | canonical docs require viewer/curator/admin, but code/RLS admit every authenticated biotope user to global reads/writes; any account can trigger an all-user service-role run whose verbatim summary can expose other users' UUIDs + processing context. Enforce explicit membership/role in routes and DB, revoke broad writes, redact async job responses, add direct-REST and role-matrix negative tests; keep exact small-cohort gap counts staff-only/suppressed |
| B-SEC2 · Legacy `service_role` Bearer dependency and server-key rotation | **production blocker — Run 3 O25** | nao's run relay sends the legacy JWT as both Bearer and `apikey`, while `run-pipeline` compares Bearer directly to `SUPABASE_SERVICE_ROLE_KEY`; Supabase's replacement `sb_secret_…` keys are not JWTs and must travel on `apikey`, so this cannot be fixed by renaming an env value. Following the [Supabase key-migration contract](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys), move every Worker/Edge Function/cron/`pg_net` caller to a supported named-secret flow (`SUPABASE_SECRET_KEYS` or supported server auth) with explicit internal/admin authorization, backend-only storage, staged rotation/revocation and negative leak/header tests before legacy-key retirement; never expose either key to Flutter or `NEXT_PUBLIC_*` |
| B-DATA1 · Simulated loader can corrupt the raw truth layer | **production blocker — Run 3 O26** | date plan reads gut only, then gut/wearable commit separately; can overwrite wearable-only real dates, strand partial loads, mishandle holes, and retain simulated provenance/stale fields after a real edit. Hard demo-environment/tenant gate, atomic two-table RPC, non-sim conflict refusal, cleanup/repair, explicit real-writer provenance replacement, forced-failure tests |
| B-DATA2 · Pipeline idempotency, gap-demand semantics, and atomic publication | open — **Run 3 O26** | repeated/retried unchanged runs inflate demand; JS keys by pair+status while DB keys by pair and last status wins; gap write can commit before card failure. Add durable run/idempotency key + input watermark + single-flight, stable per-user/pair/evaluation event, per-status aggregation, retryable stage state and concurrency/failure tests |
| B-COST1 · Router budget enforcement is not atomic or globally capped | open — outside locked Run 3 after cap reconciliation | concurrent callers can all pass stale prechecks; file merge/temp path is not locked; corrupt ledger resets to zero; six raiseable 5-USD node caps imply 30 USD/day, not the stated run ceiling. Add central atomic reservation/reconciliation, true global cap, unique call IDs, fail-closed corruption, timeouts/schema validation/ambiguous-call accounting and concurrent stress tests. B-BR8 owns values, not enforcement |

## H · Scientific-semantics gaps (independent audit 2026-07-26)

| Item | State | Gates / notes |
|---|---|---|
| B-SCI1 · Claim-kind loss permits causal inflation | **client-trust blocker — Run 3 O27** | `claimKind` is dropped before card rendering, so correlational `increases/decreases` becomes “tends to raise/lower”; the fixture turns “associated with higher” into causal language. Carry source + verifier claim kind through serving/provenance, use distinct correlation/mechanism/causal copy, add relation × kind × verdict tests and a causal-verb copy gate |
| B-SCI2 · Uncalibrated support rank / study-design proxy is presented as confidence / certainty | open — **Run 3 O27** for safe vocabulary; O2/B-PL3 for calibration | hide numeric rank from ordinary users or label it “prototype support rank”; rename current evidence tier to study-design tier and say certainty not assessed. Public terminology is owned here; parameter/effect calibration stays in B-PL3/B-R1-3 so the rows do not overlap |

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
| O24 · Exact-tip release gate + complete/reproducible Deno CI | **Run 3 unit 1 — locked** | B-PL14 |
| O25 · nao RBAC/RLS + redacted global-job boundary + named server-key rotation | **Run 3 unit 2 — locked** | B-SEC1; B-SEC2; B-BR7 direct-write slice |
| O26 · Raw-truth-safe demo loader + retry-safe pipeline | **Run 3 unit 3 — locked** | B-DATA1; B-DATA2; B-PL15 |
| O27 · Scientific provenance semantics + artifact trust posture | **Run 3 unit 4 — locked** | B-SCI1; B-SCI2 safe-vocabulary slice; B-UI3; B-UI9; B-BR7 revision/presentation slice |
| O28 · Plain-language + accessible client insights | **Run 3 unit 5 — locked** | B-UI10; B-UI11 |
| O29 · Live verifier/model attestation + migrated immutable release promotion | **Run 3 unit 6 — locked** | B-BR1; B-BR2; B-BR3; B-PL19 |
| O30 · NLI Shadow v0 training/evaluation, non-serving | **Run 3 unit 7 — locked** | B-BR4(a); all other support-model work remains open |

---

*Update discipline: append/edit rows as gaps close or new ones surface; when an item graduates to a
run backlog, replace its row's State with a pointer to the locked entry, and add a line to §I. When a
gap closes, say which unit/PR closed it rather than deleting the row.*
