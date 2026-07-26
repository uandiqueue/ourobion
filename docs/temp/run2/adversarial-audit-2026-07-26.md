---
title: Run 2.0 independent adversarial sign-off audit
summary: Independent Codex audit of the Run 2.0 sign-off package across architecture, security, privacy, raw-data integrity, UX, accessibility, scientific semantics, model readiness, and delivery evidence. Recommends conditional internal-demo acceptance only after exact-tip CI, and a seven-unit remediation-first Run 3.
type: review
scope: shared
status: canonical
updated: 2026-07-26
---

# Run 2.0 independent adversarial sign-off audit

## Verdict

**Do not sign off the current Run 2 tip yet.** Sign it off only after the three immediate gates below,
and only with the bounded acceptance statement in this section. Then continue to Run 3 as a
**remediation-first, seven-unit maximum** run.

| Decision surface | Verdict |
|---|---|
| Internal, isolated engineering demo | **Conditional accept** after G0–G2 below |
| Production deployment or use with ordinary biotope accounts | **Reject** |
| Privacy/security readiness | **Reject** |
| Scientific validation or “independent verification” | **Reject** |
| Continue to Run 3 | **Yes**, with the locked seven-unit scope in [next-build-optimizations.md](./next-build-optimizations.md) |

### Immediate gates before Jayden signs

**G0 — prove the exact cumulative code in CI.** PR #123, the documentation bootstrap, has 13 green
checks. PRs #124–#136 have **zero** check runs because their bases are other feature branches, while
[CI](../../../.github/workflows/ci.yml) only triggers for PRs targeting `main` or `dev-phase2`. The
consolidated `dev-phase2-run2` push is also outside the push filter. In addition, the Deno matrix omits
the newly added `run-pipeline` function. Run the complete workflow against the final cumulative SHA,
add `run-pipeline` to the Deno matrix, and retain the check URLs/SHA as sign-off evidence.

**G1 — record the acceptance boundary.** Use this wording, or wording no broader than it:

> Run 2 is accepted as an internal architecture and UI demonstration using simulated personal data
> and fixture-backed research records. This acceptance does not validate scientific correctness,
> independent verification, live retrieval, calibrated confidence, accessibility conformance,
> security/privacy readiness, or production serving of research-linked claims.

**G2 — resolve B8 rather than carrying it through sign-off.** U2 and U3 changed `shared/`, while the
repo requires two reviewers. Obtain the second review or record Jayden's explicit, scoped waiver before
accepting those shared-contract changes as governance-compliant.

**Sequencing note:** authorize Run 3 U0/O24 now as the pre-sign-off closure unit. Do not mark Run 2
accepted until its exact-SHA gate is green and G1/G2 are recorded; after that, continue with Run 3
U1–U6. This keeps the CI repair inside the seven-unit half-size cap without pretending the present tip
already passed it.

### Operational boundary until Run 3 closes its first blockers

- Do not deploy nao where an ordinary biotope account can reach it.
- Do not use the simulated loader on an account containing any real or valued data.
- Do not show fixture-backed cards without a card-level “demo fixture” and simulated-data disclosure.
- Do not describe U13 as scientific validation. Its zero-card result is useful fail-closed plumbing
  evidence and a reassuring conservative outcome, not proof of verifier accuracy or independence.

## What I examined

This was a source-and-evidence audit, not a review of the README in isolation. It covered:

- the Run 2 README, all unit sign-off rows, recent session logs, decisions, carry-forwards, and five
  U12 screenshots;
- nao auth/middleware/API routes, Flutter trend and provenance surfaces, shared brain contracts,
  migrations, all four edge functions, the ingestion/verifier/router packages, and demo scripts;
- current GitHub metadata for PRs #123–#136 and the actual CI trigger/matrix;
- the repo’s architectural and product truth documents, especially role boundaries, two-tier truth,
  non-diagnostic language, and the deferred support-model design;
- primary external guidance where the recommendation depends on it: Supabase’s
  [RBAC](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac) and
  [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) guidance, W3C’s
  [text-alternative guidance](https://www.w3.org/WAI/fundamentals/accessibility-principles/), Flutter's
  [mobile accessibility testing guidance](https://docs.flutter.dev/ui/accessibility/accessibility-testing), Cochrane’s
  [certainty-of-evidence framework](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-14),
  and the primary [SciFact](https://aclanthology.org/2020.emnlp-main.609/) and
  [SciFact-Open](https://aclanthology.org/2022.findings-emnlp.347/) papers.

Graphify was stale before the audit. A delegated deterministic refresh first brought its AST/Markdown
projection to Run 2 HEAD `b55ce29`, then a user-requested host-model semantic bootstrap completed
without a paid API or network call. The final projection has 6,872 nodes, 8,905 links, 83 hyperedges,
and 716 communities; all 882 manifest entries have both AST and semantic hashes, with zero pending or
deleted AST/semantic sources, zero schema issues, and zero dangling edges. The semantic cache covers
446 document/paper/image sources, including visual inspection of all 135 images (five initially
unrenderable SVGs were rasterized directly from their source with local Sharp/libvips). Graphify did
not expose host-subagent token telemetry, so its zero-valued token fields are not treated as zero
compute. Exact-node/source navigation passed representative Run 2 queries; broad natural-language
ranking remained noisy and is separately registered as B-PL18. Material audit conclusions were still
verified directly in source and artifacts rather than inferred from graph rank alone.

### Independent verification performed

- Typechecks and offline tests passed for `brain-ingest`, `llm-router`, `edge-loader`, `rules`,
  `engine-stats`, and nao.
- No Anthropic or OpenAI request was made; incremental audit spend was **0 SGD**.
- Flutter analysis in the isolated worktree correctly failed for absent untracked package metadata.
  The dependency-resolved original checkout then stalled without output and was terminated, so this
  audit does **not** claim an independent Flutter pass.
- Deno was unavailable locally. The missing CI coverage in G0 therefore matters rather than being a
  documentation nicety.
- The live provider demo was not rerun: Run 2 already preserves its artifacts, and another paid,
  nondeterministic run would not close the structural gaps below.

## Findings by severity

| ID | Severity | Category | Finding | Canonical register owner |
|---|---|---|---|---|
| F1 | P0 | Delivery / governance | Run 2 feature code has no cumulative CI evidence; `run-pipeline` is absent from Deno checks | B-PL14 |
| F2 | P0 | Security / privacy | Authentication is treated as authorization; any account can mutate global science controls and trigger a cross-user service-role job | B-SEC1 |
| F3 | P0 | Architecture / raw truth | The simulated loader can overwrite or mislabel real rows and can leave a split, unrepaired two-table load | B-DATA1 |
| F4 | P0 | Scientific / UX | Correlational claims can become causal-sounding card copy; fixture/test posture is disclosed too late | B-SCI1, B-UI9 |
| F5 | P1 | Data integrity | Pipeline retries inflate demand; statuses collapse by last write; publication is non-atomic | B-DATA2, B-PL15 |
| F6 | P1 | Scientific curation | Direct writes bypass route validation; verdicts are not revision-bound; expert rejection is not rendered | B-BR7, B-UI3 |
| F7 | P1 | UX / accessibility | Client UI exposes repo identifiers and unexplained statistics; charts and actions lack adequate accessibility evidence | B-UI10, B-UI11 |
| F8 | P1 | Scientific calibration | “Confidence” and “evidence tier” imply more certainty than the current uncalibrated rank and study-design proxy support | B-SCI2, B-PL3, B-R1-3 |
| F9 | P1 | Cost / reliability | Router spend limits are non-atomic under concurrency and have no true global cap | B-COST1 |
| F10 | P2 | Reproducibility / privacy | Provider responses and Deno dependencies fail open in places; exact small-cohort gap counts are exposed | B-BR1, B-PL14, B-SEC1 |
| F11 | P2 | Agent context / process | The documented Graphify update command refreshes AST only; semantic freshness has no session-end or pre-push gate | B-PL17 |
| F12 | P2 | Agent context / retrieval | Graphify exact-node/source navigation works, but broad natural-language BFS over-ranks generic AST symbols | B-PL18 |

### Primary repository evidence anchors

| Finding | Source anchors |
|---|---|
| F1 | [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml); GitHub PR metadata queried 2026-07-26: #123 had 13 successful checks, #124–#136 each had zero check-rollup entries |
| F2 | `docs/nao/nao-app-design.md:75–86`; `docs/shared/biotope-nao-link.md:29–30`; `apps/nao/src/lib/auth.ts:8–19,70–79`; `apps/nao/src/middleware.ts:84–93`; nao mutation/relay routes; Run-2 RLS migrations at `20260724130000`, `20260724150000`, `20260724152525`; `generate-insights/index.ts:474–475,1004–1021` |
| F3 | `apps/nao/src/app/(app)/api/loader/route.ts:117–149`; `apps/biotope/lib/modules/m2_self_report/impl/logging_controller.dart:66–88`; `20260715154000_create_m5a_metric_daily_values_view.sql`; nao `LoaderPanel.tsx:185–186` |
| F4 | `shared/brain` relation/claim-kind contract; `generate-insights/composer.ts`, `index.ts:738–835`, `render.ts:151–163`; [provenance top](./assets/u12-biotope-provenance-top.png) and [citations](./assets/u12-biotope-provenance-quotes-citations.png); edge-loader fixture claims/verifications |
| F5 | `generate-insights/index.ts:447–466,963–994`; `20260724090000_create_a1_gap_ledger.sql:25–41,79–113`; `run-pipeline/index.ts` |
| F6 | `20260724150000_create_o13_edge_human_verdicts.sql`; nao claim-reject route; Flutter `provenance_models.dart:205–265` and `insight_provenance_screen.dart:595–618` |
| F7 | Flutter `metric_series_models.dart:72–88`, `metric_trend_section.dart:231–249`, `insights_tab.dart`, and `insight_provenance_screen.dart:421–779`; [trend screenshot](./assets/u12-biotope-home-trends.png) |
| F8 | `shared/brain/index.ts:24–62`; Flutter `insights_tab.dart:232–237`; provenance screen score/tier labels; `brain-support-models-design.md:101–132`; demo runbook verdict/band explanation |
| F9 | `tools/llm-router/src/budget.ts:125–301`; `router.ts:132–159`; router config; `20260724130000_create_o10_llm_router_boundaries.sql` |
| F10 | `tools/llm-router/src/routes/apiWorker.ts:65–207`; CI Deno command/imports; gap-ledger SELECT policy + nao gaps route |
| F11 | `scripts/graphify-build.ps1`; Graphify 0.8.40 `watch._rebuild_code` + AST manifest behavior; pre-audit `graphify-out/manifest.json` had 882 AST hashes and zero semantic hashes |
| F12 | Post-bootstrap query QA against Run 2 README, pending register, and Serving-Band Gating / Adversarial Edge Verification nodes; exact-ID explanations passed while vocabulary-expanded queries ranked generic `source`, `client`, `FIXTURE`, `pending`, and `quote` nodes above richer semantic matches |

## Detailed audit

### 1. System and architecture

#### F1 — the release gate did not run on the release candidate

The README says local Deno checking was unavailable and CI would first exercise it on a PR. That never
happened for the Run 2 implementation. The workflow’s branch filter admitted PR #123 because it targeted
`dev-phase2`; every later stacked PR targeted another feature branch and has an empty check rollup.
The consolidation branch also does not match the push filter. Even if triggered, the Deno matrix names
only `compute-baselines`, `evaluate-signals`, and `generate-insights`, not `run-pipeline`.

This does not prove the code is broken. It proves the current “DoD met” package lacks the repository’s
non-bypassable evidence for the code that matters. B-PL14 now owns the single reconciled fix: broaden
trigger coverage or add manual dispatch, include every handler, pin Deno resolution, and record a green
exact-SHA cumulative run.

#### F11 — structural graph updates do not maintain semantic freshness

The repo currently says to run `graphify update .` after code changes, but in installed Graphify 0.8.40
that command and `scripts/graphify-build.ps1` rebuild/stamp only the AST/Markdown projection. The
host-model semantic path is the assistant workflow `/graphify . --update`; a headless shell command
would require a separately configured API, Ollama, or Claude CLI backend. `graphify check-update .` is
also not a semantic proof because it reads only a watcher flag.

After this one-time bootstrap, require the active agent to run semantic incremental update at session
end (or after each long-run unit). A machine-local pre-push check can enforce zero semantic pending/
deleted files and `graph.json.built_at_commit == HEAD`; it cannot generate semantics in CI from a
gitignored, host-session projection. This prevents another whole-corpus catch-up without turning derived
graph output into repository truth.

#### F12 — broad semantic retrieval still needs a ranker quality gate

Representative exact-node explanations and source navigation resolved current Run 2 documents and
cross-concept relationships correctly. Broad vocabulary-expanded queries, however, ranked generic AST
symbols such as `source`, `client`, `FIXTURE`, `pending`, and `quote` ahead of more useful semantic
nodes. Freshness therefore proves coverage, not retrieval relevance. Keep exact IDs/source paths as the
reliable workflow; add a benchmark query set, node-type-aware hybrid ranking, generic-node suppression,
and ranked-relevance regression gate before treating broad natural-language retrieval as dependable.

#### F2 — nao’s implemented trust boundary contradicts its canonical architecture

[nao-app-design.md](../../nao/nao-app-design.md) and
[biotope-nao-link.md](../../shared/biotope-nao-link.md) require explicit `viewer` / `curator` / `admin`
authorization. The implementation defaults any authenticated user to viewer and allows that user
through middleware; mutation routes check only `getUser()`. RLS grants all authenticated users direct
write access to cap overrides, edge rejections, and seeds, so adding a UI role check alone would still
leave a PostgREST bypass.

The most serious consequence is the run relay. Any authenticated account can make nao use its server
service key to execute the global all-user pipeline. The edge function returns stage summaries
verbatim, and `generate-insights` summaries can contain other users’ UUIDs plus rule/pair failure
context. This is a concrete cross-user privacy leak, not just a theoretical least-privilege concern.

Use an explicit membership source and enforce the same permissions in route code and RLS/RPCs. Supabase
documents custom claims plus RLS as the intended RBAC pattern, and warns that user-editable metadata is
not suitable for authorization. Return an opaque run ID or redacted aggregates; keep per-user diagnostics
in admin-only server logs. Add negative tests for unprovisioned, ordinary biotope, viewer, curator,
admin, and direct PostgREST access.

#### F3 — the demo loader can damage the raw-data truth layer

The loader plans dates solely from `daily_gut_rows`, then separately upserts both gut and wearable
tables. That creates four failure modes:

1. wearable-only or mismatched-range real dates can be overwritten by simulation;
2. if the gut write succeeds and wearable fails, a retry advances from the new gut range and does not
   repair the original wearable batch;
3. sparse ranges are treated as continuous and holes are not reconciled;
4. a later real self-report update omits `data_origin` and several simulated fields, so the row can
   remain labelled simulated while mixing real and generated values.

The UI’s promise that simulation is never mixed with real logging is therefore false. This conflicts
with the repo’s strongest data rule: raw rows are truth. Restrict the loader mechanically to a dedicated
demo tenant/account, use an atomic transactional RPC, refuse conflicts with non-simulated rows, make
real writers explicitly replace simulation provenance/stale fields, and add cleanup plus forced-failure
tests.

#### F5 — the serve pipeline is retry-unsafe

`generate-insights` deduplicates demand only within one invocation, while `record_gap_events` increments
persisted demand every time. Repeated clicks, retries, or a failure after gap persistence but before card
write count the same unchanged data again. JavaScript aggregates by pair and status, but the database
keys only by pair and aggregate scope; multiple statuses are summed and the last processed status wins.
The displayed reason can therefore describe only the final writer while demand includes incompatible
reasons.

Add durable pipeline runs, idempotency keys/input watermarks, single-flight, retryable stage state, and
a stable demand event identity such as user + pair + evaluated date/data version. Aggregate only after
that event exists, preserve counts per status, and test concurrency and every stage-failure boundary.

### 2. UX and accessibility

#### F4/F7 — provenance is an internal debug object presented as client copy

The screenshots and Flutter source show raw values such as `sleep_duration_min`,
`signal:sleep_duration_min:down`, `Branch: agree`, `rho`, `nEff`, `q`, `serving band`, numeric edge
scores, enum-like evidence tiers, derivation modes, and relation triples. Splitting underscores into
spaces is not a client label system: `hrv_sdnn_ms` becoming “Hrv sdnn ms” still exposes the repository.

Build a client-safe provenance view model backed by the metric registry: approved label, unit,
abbreviation expansion, and short explanation. Use progressive disclosure:

- **What changed for me?**
- **What research was linked?**
- **How directly does it apply?**
- **Source details**
- **Technical details** only behind an expert disclosure, or in nao.

Add guards that reject snake_case, raw internal enums, fixture IDs, and unexplained statistical symbols
from the ordinary client surface. Distinguish loading, empty, stale, and failed states instead of
silently converting a fetch failure into “no patterns.”

The trend chart is a hand-drawn `CustomPaint` without an evidenced semantic summary or data-list
equivalent. W3C guidance explicitly calls for descriptions of data represented in charts. Add a concise
screen-reader summary, an accessible values list, labelled control roles/states, adequate hit targets,
contrast repair, 200% text-scale coverage, and a manual TalkBack pass.

#### F4/F6 — trust posture must be artifact-derived and visible before the claim

The card says “published research reports…” while its backing source is a hand-authored fixture; the
fixture warning appears later in provenance. The TEST-MODE notice is globally hard-coded, so it becomes
false when fixture and live records coexist. Screenshots or recordings can separate the claim from the
presenter’s verbal disclaimer.

Carry `fixture|live`, simulated-data state, provider-returned verifier identity/version, and independence
attestation with each artifact. Render “Demo fixture — not a real paper result” on the card itself.
Production serving must reject fixtures or absent required attestation. Parse and render `humanVerdict`;
if an expert rejected an edge, the machine result may remain in history but must be visibly superseded.

### 3. Scientific integrity

#### F4 — claim kind is lost, allowing association to become causation

The contract permits an `increases`/`decreases` relation with `claimKind: correlational`, but composition
drops claim kind and rendering unconditionally turns those relations into “tends to raise/lower.” The
Run 2 fixture itself says “was associated with higher SDNN” while its derived claim is marked causal and
rendered as raising SDNN. This is causal inflation even if the fixture is only a demo.

Carry source and verifier-assessed claim kind through serving, provenance, and rendering. Correlational
evidence must retain “was associated with”; mechanistic and causal claims need separate wording and an
explicit supporting verdict. Add a relation × claim-kind × verdict test matrix and a copy gate that
rejects causal verbs for correlational artifacts.

#### F8 — current labels overstate calibration and certainty

The score implementation describes its thresholds as provisional and uncalibrated, yet the UI turns the
rank into high/medium/low “confidence” and shows a precision-like number. Until held-out calibration and
a documented interpretation exist, hide it from ordinary users or call it a **prototype support rank**.

Likewise, publication type is a useful **study-design tier**, not evidence certainty. Cochrane’s GRADE
framework considers risk of bias, inconsistency, indirectness, imprecision, and publication bias across
a body of evidence. Rename the current field in user copy and say “certainty not assessed” when those
dimensions are absent. O2/MPR remains the hard gate for numerical scientific sign-off.

#### U13’s correct interpretation

The decorrelated full run used fixture-derived claims/quotes and echo-excluded the fixture paper itself;
the remaining fixed corpus did not independently cover every relation. The verifier serving zero cards
is good evidence of conservative failure behaviour. It is not an accuracy, calibration, or independence
measurement. Family separation reduces one known self-preference risk, but it does not by itself prove
independent errors; model attestation, human labels, repeated runs, and disagreement/error analysis are
still required.

### 4. Curation, cost, and operational safety

Direct authenticated writes bypass the route-level existence checks for human verdicts. Because a
verdict binds only to a relation key, a user can pre-reject a future key, and a scientifically revised
claim with the same relation inherits the historical rejection. Replace direct writes with a
curator-only validated RPC, bind dispositions to an artifact revision/hash (or explicitly decide
relation-wide semantics), and add re-review/restore plus append-only control history.

The router budget ledger is also not a concurrency-safe hard stop. Multiple processes can pass a stale
precheck before recording, the file merge has no lock, all writers share a temp path, corrupt state
resets to zero, and six independently raiseable 5 USD/day caps permit 30 USD/day despite a lower stated
run budget. Use atomic pre-call reservation plus actual-usage reconciliation, a true global ceiling,
unique call IDs, fail-closed corruption, and concurrent stress tests. Provider calls also need deadlines,
validated usage/model fields, retry jitter/`Retry-After`, and ambiguous-outcome reconciliation.

Exact aggregate gap counts from one are not necessarily anonymous in a tiny or known cohort. Keep the
surface staff-only and add a reviewed minimum-cohort/small-cell policy before any external/community use.

## Custom-model advice

Train only **one** model in Run 3: an NLI claim-support pilot, and keep it non-serving.

The primary SciFact claim/evidence annotations are CC BY 4.0, its abstracts are ODC-By 1.0, and its code
is Apache 2.0 according to the project’s
[license file](https://github.com/allenai/scifact/blob/master/LICENSE.md). HealthVer is COVID-focused and
its repository exposes no clear reusable license; do not use it until permission is documented. Remove
the current design assumption that an “unconfirmed” license is acceptable merely because this is a
non-commercial demo.

The Run 3 pilot should:

- train outside this repository in the approved GMI/model environment; do not introduce Python into
  Ourobion;
- pin the encoder, data versions, hashes, license/attribution, preprocessing, seed, and environment;
- split by source paper/claim family to reduce leakage;
- freeze a human-reviewed Ourobion-domain audit set spanning gut, hydration, wearables, and environment;
- report per-class precision/recall/F1, confusion matrix, calibration/Brier/ECE, abstention coverage,
  selective risk, latency, uncertainty intervals, and comparison with a majority baseline and current
  verifier;
- produce only a model card, immutable manifests, evaluation report, and reproducible artifact pointer
  in this repo; no raw third-party data;
- have **no effect** on `RelationshipClaim`, `EdgeVerification`, edge score/band, cards, or UI in Run 3.

This conservative posture follows the evidence: SciFact-Open reports at least a 15-F1 drop when systems
trained on smaller corpora move to open-domain retrieval. A benchmark score alone would not validate
Ourobion’s ASEAN One Health domain. Runtime shadow integration should be a later promotion decision,
after licensing, in-domain evaluation, calibration, and independent review.

## Run 3 recommendation

The reconciled, promoted tranche is in
[next-build-optimizations.md](./next-build-optimizations.md). It contains exactly seven units and is
bounded to approximately half the Run 2 change surface: **at most 7 units, 85 changed files, and 8,650
added lines**. The order is deliberate:

1. restore trustworthy release evidence;
2. close role and cross-user privacy boundaries;
3. make the demo control path safe for raw truth and retries;
4. repair scientific provenance semantics and artifact trust posture;
5. translate the UI and establish accessibility;
6. add live retrieval plus actual verifier/model attestation;
7. train and evaluate one non-serving NLI pilot, then close the run.

If any unit exceeds its allocation, move its non-acceptance work back to the pending register. Do not add
an eighth unit. O1–O8, metric expansion, visual reskinning, production hosting, active support-model
routing, and the broader autonomous research loop remain outside this tranche.

## Strengths to preserve

- The README is unusually candid about fixtures, nondeterminism, missing attestation, deferred retrieval,
  environment gaps, and shared-review debt.
- Two-tier truth is clear and the edge projection remains rebuildable.
- Provenance and historical verification are strong foundations once trust posture and human disposition
  are surfaced correctly.
- Deterministic contract/copy gates already exist and are the right place to prevent semantic regression.
- The run reported the zero-card verifier outcome instead of optimizing the demo around a desired answer.
- Offline package tests are broad and passed independently.

## Reusable-skill decision

No new repo-local audit skill was added in this pass. The workflow is useful, but its durable pieces are
already split across `AGENTS.md`, the session protocol, this report, the superset register, and the locked
run backlog. A new skill now would duplicate changing policy and create another drift surface. Promote a
skill only after a second audit reuses the same sequence; then extract the stable evidence matrix and
register-reconciliation procedure, not this Run 2-specific content.
