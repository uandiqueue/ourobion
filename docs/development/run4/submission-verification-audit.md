---
title: Hackathon submission evidence audit
summary: Claim-by-claim evidence audit of the hackathon write-up and connection map, with a 2026-08-01 measured-state block and a 2026-08-02 direct hosted read that together supersede the earlier point-in-time rows; verification has produced 14 edges of which 11 are servable, two rows and one defect finding are retracted as wrong, and the remaining blockers are the #277 model-claim quarantine and the absence of any card with producer='edge'.
type: audit
scope: run4
status: draft
updated: 2026-08-02
---

# Hackathon submission evidence audit

This is the submission defect ledger, **not final submission prose**. The initial audit used
`253e0ad6db31bb2a134e47546ddaba84bf284639`; implementation-sensitive findings were refreshed after
Session A landed at integration merge `dea055c8155c1e9c6851931f4de9816a88d66b2d`, then refreshed
again at the post-#300 integration head `abcba95f8386d31c49f62f20f4b623de180e29c0`, after the
flow-test defect fixes landed at `226bfef0e7e661873c0f51168cc968e758651b94`, and after the seed,
discovery-filter, product-pin, identifier-conversion, and D1 projection-workflow fixes through
`d97a686e461ab0aa265d11f733d724c87ea8415c`. Re-run every
result-bearing command after #307 completes verification, projection, and cards. Do not promote any model-training or evaluation
claim until issue #277's gate is satisfied.

## Classification

| Status | Meaning |
|---|---|
| `verified` | A code path plus a reproducible command/output supports the bounded claim. |
| `stale` | It described an older repository/run but is no longer current. |
| `overclaimed` | Evidence exists, but the prose asserts a broader scientific or deployment result. |
| `now-wrong` | Current code or output directly contradicts it. |
| `planned` | Design intent exists without a serving implementation or executed workflow. |

Documentation is never used as implementation evidence below. A path is cited only to identify code
or a machine artifact; each accepted fact also names the observation that must be reproducible.

## Reproducible evidence ledger

| Evidence | Code or machine artifact | Command and observed output | Status / safe claim |
|---|---|---|---|
| Active metric registry | [`shared/metrics/registry.ts`](../../../shared/metrics/registry.ts) | Load the exported registry with the repository TypeScript loader and filter `status === 'active'` → **24 keys**. | `verified`: 24 active metrics exist. This does not prove literature coverage. |
| Rule blueprints | [`data/rules/`](../../../data/rules/), loaded by [`tools/rules/lib/blueprints.mjs`](../../../tools/rules/lib/blueprints.mjs) (`RULES_DIR`) | Count the git-tracked blueprint JSON under `data/rules/` → **8** entries; every entry has `provenance.tier: 'hand_authored'` and `provenance.citation: null`. | `verified`: all eight rule blueprints are uncited hand-authored rules. |
| Migration and workflow inventory | [`supabase/migrations/`](../../../supabase/migrations/), [`.github/workflows/`](../../../.github/workflows/) | `find supabase/migrations -maxdepth 1 -type f | wc -l` → **41**; `find .github/workflows -maxdepth 1 -type f` → **6 workflow files** after PR #326. | `verified`: the connection map's 39 migrations / 2 workflows is stale. |
| Cloud brain workflow | [`.github/workflows/brain-pipeline.yml`](../../../.github/workflows/brain-pipeline.yml) | GitHub Actions history and the rejected pre-merge dispatch were checked → **no executions**. Its YAML uses `workflow_dispatch`; it hydrates the manifest and runs bounded synthesis/verification/load stages, but does not run `seed-queries`. | `verified`: the pipeline is defined and merged but has never been executed as a workflow. |
| Seeder candidates | [`tools/brain-ingest/src/seeder/candidates.ts`](../../../tools/brain-ingest/src/seeder/candidates.ts), [`seeds.ts`](../../../tools/brain-ingest/src/seeds.ts), [`tests/seeder.test.ts`](../../../tools/brain-ingest/tests/seeder.test.ts) | `npx tsx src/cli.ts seed-queries --candidates-only` against the real registry and blueprints → `candidates: 36 (derivedFrom=1 rule_blueprint=2 static_topic=33)`. | `verified built seed surface`: 33 balanced topics cover 20 of 21 seedable active metrics; `notes`/`log_completeness` are excluded from discovery. This is not measured corpus coverage; see #297. |
| Seeder artifact | [`tools/brain-ingest/src/seeder/artifact.ts`](../../../tools/brain-ingest/src/seeder/artifact.ts) | `test -f data/corpus/seed-queries.json` → false at the audited head. | `verified`: ingest cannot consume generated queries that do not exist. |
| Corpus volume | [`tools/brain-ingest/src/cli.ts`](../../../tools/brain-ingest/src/cli.ts) exposes the R2-to-local `hydrate-manifest` command; [`sources/idconv.ts`](../../../tools/brain-ingest/src/sources/idconv.ts) contains the repaired identifier crosswalk | The first authorized hydration was **0 → 1,298 records / 739 full-text >5k**. A later discovery pass reached **6,158 metadata records** but 138/138 mixed-ID batches failed, leaving **756 fetched / 739 >5k**; PR #327 fixed mixed identifier batching and numeric-PMID coercion, and a 10-paper-per-seed probe is in flight. | `verified point-in-time outputs, not corpus readiness`: metadata count is not synthesisable coverage; final submission needs the completed post-fix result and a durable machine-readable coverage artifact. |
| Live provider acceptance | [`tools/brain-ingest/src/liveAcceptance.ts`](../../../tools/brain-ingest/src/liveAcceptance.ts), [`tests/liveAcceptance.test.ts`](../../../tools/brain-ingest/tests/liveAcceptance.test.ts) | Authorized acceptance output: ordered Anthropic `claude-sonnet-5`, OpenAI provider-attested `gpt-5-2025-08-07`, Agnes `agnes-2.5-flash`; four POST responses were 200; provider-leg cost **$0.0182055**, session total **$0.044**; journal hash chain intact; a fourth invocation refused without dispatch; no `GET /models`. | `verified for provider transport under binding authentication only`. The test proves ordering/refusal offline; the live values must be attached as a durable artifact before final copy. |
| Verification disposition | Live acceptance output from the same bounded run | Verdict: `uncertain`, confidence **0.3**, **0** supporting sources, independent-source stance mentions; edge held and no card emitted. | `overclaim guard`: this is fail-closed transport evidence, not scientific validation of a relationship. |
| Pre-#300 synthesis output | Two authorized live `gpt-5` run outputs on well-matched papers | Both runs: **0 accepted / 0 rejected claims**. | `verified historical baseline`: it proves the passage-prefilter path failed to emit claims, not that the new whole-paper path does. |
| Post-#300 synthesis implementation | [`paperPrompt.ts`](../../../tools/brain-ingest/src/synth/paperPrompt.ts), [`paperRun.ts`](../../../tools/brain-ingest/src/synth/paperRun.ts), [`paperPostprocess.ts`](../../../tools/brain-ingest/src/synth/paperPostprocess.ts), [`blueprintArtifact.ts`](../../../tools/brain-ingest/src/synth/blueprintArtifact.ts) | Code inspection through `d97a686`: `synthesize-papers` sends canonical whole text, quotes metric keys separately from units, gates `ownFinding`, requires an affirmative pathway declaration before retaining a `mechanism:` label, batches/resumes/dedupes, and writes `claims.jsonl` + `blueprints.jsonl`. | `verified built and synthesis-measured`; this does not prove grounded verification, projection, or cards. |
| Measured post-#300 synthesis | [#307 batch command output](https://github.com/uandiqueue/ourobion/issues/307#issuecomment-5148881245) | 16 papers requested; **15 synthesised, 1 resumably skipped**; **10 claims, 1 blueprint**; one copy-gate rejection; four `no_effect` claims; **US$0.622151** for the batch. Four claims carried verbatim mechanism-labelled spans, but two spans were study limitations rather than biological/behavioural pathways. | `verified measured synthesis, not a successful full flow`: whole-paper reading and deterministic gates emit real claims; the assumed 3–5-blueprint-per-paper yield and mechanism semantics were not demonstrated. |
| Measured Agnes verification | [#307 batch failure](https://github.com/uandiqueue/ourobion/issues/307#issuecomment-5148881245), [bounded diagnostic follow-up](https://github.com/uandiqueue/ourobion/issues/307#issuecomment-5148943783), [`verify/enforce.ts`](../../../tools/brain-ingest/src/verify/enforce.ts), [`verify/verifier.ts`](../../../tools/brain-ingest/src/verify/verifier.ts) | The batch spent **14 Agnes POST starts** and produced zero records because all replies were code-fenced and unparseable; a duplicate-edge `logicalCallId` collision then aborted the run. A separately authorised two-call diagnostic captured the fenced shape and completed one no-corpus verification as `uncertain [full] (fallback)`. PR #322 subsequently landed conservative fence unwrapping and a paper/prompt-bound logical-call identity. | `verified fail-closed transport, diagnosis, and landed fixes only`: the one verdict had zero retrieved sources and is not servable evidence; no grounded post-fix verification, projection, or card result exists. |
| Hosted projection state | [#309 owner recheck](https://github.com/uandiqueue/ourobion/issues/309#issuecomment-5149895762) | Hosted demo DB: `verified_edges 0 · relationship_claims 0 · edge_verifications 0 · insight_cards 1`. | `verified blocking state`: the one existing card is not evidence of a grounded edge-derived flow; Task 4 remains held until one claim → grounded verification → edge load → verified edge → card result exists end to end. |
| Paper lineage in cards | [`supabase/functions/generate-insights/index.ts`](../../../supabase/functions/generate-insights/index.ts) and the eight blueprint records above | Inspect current generated/fixture outputs → only edge-produced cards currently carry paper lineage. Cross-rule code can accept edge references, but no current output demonstrates that path. | `verified bounded claim`: current observed lineage is edge-card-only; do not generalize potential code paths into shipped evidence. |
| Release-envelope facts | [`tools/run4_release_gate.mjs`](../../../tools/run4_release_gate.mjs), [`supabase/deploy-attestation.json`](../../../supabase/deploy-attestation.json) | `product-cap --head f8cb75251f0602395bdf88285e18d00525b88db4` → **512 paths / 71,841 additions**, `withinCap:false`; audited head → **533 / 75,645**, `withinCap:false`. | `verified`: the per-unit base advanced; whole-product acceptance and hosted parity remain false. |

The three same-day CI fixes and the new pipeline commands are now integrated at `dea055c`:

- [`.github/workflows/brain-pipeline.yml`](../../../.github/workflows/brain-pipeline.yml) treats the
  absent `edges/` artifact as the expected empty state only for a dry run, hydrates the local manifest
  before synthesis, and passes provider credentials through the process environment.
- [`tools/brain-ingest/src/cli.ts`](../../../tools/brain-ingest/src/cli.ts) exposes
  `hydrate-manifest` and the `--push-r2` synthesis/verification paths.
- [`tools/brain-ingest/tests/verify.test.ts`](../../../tools/brain-ingest/tests/verify.test.ts)
  exercises the opt-in R2 verification publication and failure behavior.

These paths prove the fixes are built. They do not prove that `brain-pipeline.yml` has executed on
GitHub; it has not.

## Existing write-up claim audit

| Draft claim area | Finding | Required correction before final prose |
|---|---|---|
| OpenAI synthesizer + Anthropic verifier as the executed system | `now-wrong` for the acceptance run. The ordered live legs were Anthropic synthesis, OpenAI synthesis snapshot, then Agnes verification. Configured defaults and executed overrides must be separate sentences. |
| “One full pipeline run / one held edge” | `overclaimed`. The acceptance edge was held with an uncertain 0.3 verdict and no supporting sources; two research synthesis attempts emitted no claims. Say transport exercised and fail-closed, not research pipeline succeeded. |
| Twelve selected passages as the current synthesis design | `stale`. The pair-scoped compatibility path still uses passage selection, but #300's new `synthesize-papers` path sends the whole canonical paper and is the intended submission centrepiece. Its live outcome is still unknown. |
| Cost figures SGD 0.0648 / 0.134 | `stale` historical run. Use the exact acceptance USD figures only if the durable output lands, with provider-leg and whole-session totals kept distinct. |
| Agnes is “not used” | `now-wrong`. Agnes served the live verification leg. Do not infer product serving or scientific quality from that call. |
| Three support models “untrained” alongside two “trained” claims | Internally contradictory and gated. Remove all research-model/evaluation claims from submission scope until #277 resolves. |
| Fixed-edge “20/20 — see logs” | `overclaimed` and improperly sourced to prose/log summaries. Cite a committed machine result plus the command, or omit. |
| Baseline-vs-verifier comparison | `planned`. No admissible result exists. Do not imply an evaluation. |
| R2 corpus is merely configured/unproven | `stale` once the 1,298/739 manifest evidence lands. Keep “configured” separate from a successful cloud workflow; the workflow has never run. |
| Citation-backed cards broadly | `overclaimed`. Only current edge cards have paper lineage; all eight rule blueprints are `hand_authored` with null citations. |

## Connection-map audit

| Component / label | Finding |
|---|---|
| 39 migrations and 2 workflows | `now-wrong`: inventory is 41 and 6 after PR #326. |
| Real verifier never ran | `now-wrong`: Agnes ran under the bounded live acceptance. The resulting verdict remained uncertain and held. |
| Provider/model topology | `stale`: it conflates default routing, the older provider run, and acceptance overrides. Draw those as three evidence layers. |
| One accepted/held research edge | `overclaimed`: no synthesis claim survived either pre-#300 live `gpt-5` attempt. Post-#300 synthesis now emits claims, but no independently grounded verified edge, projection, or card has been demonstrated. |
| R2 target only / no safe corpus count | `stale` when the 1,298/739 durable manifest lands; still do not claim the workflow executed. |
| All support models planned/untrained | `now-wrong` against repository history and prohibited from the submission until #277. Remove rather than replace with ungated performance claims. |
| Test totals such as nao “327” | `stale-unverified`: rerun at final integration head; do not copy forward from an older session. |
| Built-versus-planned A2/A4/A6 components | `overclaimed`; the traps below demonstrate that several design names are not implementations. |

## Explicit architecture traps

- `METRIC_TERMS` is not implemented. The legacy pair-scoped synthesis and verifier retrieval still
  use snake-case splitting in
  [`passages.ts`](../../../tools/brain-ingest/src/synth/passages.ts). The #300 paper-scoped path does
  not call that prefilter: [`paperPrompt.ts`](../../../tools/brain-ingest/src/synth/paperPrompt.ts)
  sends the whole canonical text plus active registry labels. This removes `METRIC_TERMS` from that
  path; it does not make the named map exist.
- `StructuredPaper` is not an implemented shared type. Searching `shared/brain`, `tools`, `apps`, and
  `supabase` finds design/comment mentions, not a type declaration or runtime consumer.
- `derivation` remains a reasoning/provenance trace (“how quotes produce this claim”), not the
  paper's biology. #300 added mechanism evidence separately as an optional verbatim quote whose
  locator starts `mechanism:` and passes the same quote-offset gate. The live batch proved that
  verbatim-ness alone does not establish mechanism semantics: two of four labelled spans were study
  limitations. PR #322 now requires the synthesizer to affirm a pathway and demotes undeclared spans;
  the independent verifier-side `mechanismCheck` remains unimplemented. Do not relabel `derivation`
  or present the current synthesis label as two-pass semantic verification.

## Submission-blocking defect list

1. **P0 — result truth:** replace the old “successful held edge” story with the honest split between
   provider transport acceptance, uncertain fail-closed verification, the pre-#300 zero-claim
   baseline, the measured 10-claim/1-blueprint batch, and the still-incomplete verified-card path.
2. **P0 — evidence durability:** land and cite machine-readable provider, synthesis, corpus, and
   lineage outputs. Session prose is not sufficient submission evidence.
3. **P0 — model-claim quarantine:** remove evaluation/training claims pending #277; do not substitute
   new model metrics from another draft.
4. **P0 — measured full flow:** synthesis is measured; wait for #307's grounded verification,
   projection, and card result before drafting the final research-pipeline narrative.
5. **P1 — provider identity:** preserve configured model, requested model, and provider-attested model
   as distinct fields; the OpenAI response attested `gpt-5-2025-08-07`, not plain `gpt-5`.
6. **P1 — lineage:** state that only current edge cards carry paper lineage and that eight rule
   blueprints remain uncited hand-authored logic.
7. **P1 — system inventory:** regenerate migration, workflow, test, route, and serving labels from the
   final integration head.
8. **P1 — planned architecture:** remove present-tense claims for `METRIC_TERMS`, `StructuredPaper`,
   queue/callback behavior, and any other design-only component; distinguish the implemented optional
   `mechanism:` quote from the still-non-mechanistic `derivation` field and from a two-pass semantically
   checked biological/behavioural pathway, whose verifier-side check remains planned.
9. **P2 — historical docs:** do not use the Run 4 cockpit or older freshness audit as current status;
   consult the dedicated 2026-08-01 freshness sweep.

## Measured state at 2026-08-01 (supersedes the point-in-time rows above)

Every figure here was produced by reading a committed machine artifact or executing a tool in-session at
`e0c6077`. Nothing in this block is carried forward from an earlier session's prose.

| Fact | Measurement | Command / artifact |
|---|---|---|
| Corpus, per tier | **21,823 records = 20,912 `discovered` + 911 `fetched`**; all 911 fetched have extracted full text; **894 over 5,000 chars**, 768 over 20,000 | streamed `data/corpus/papers.jsonl` (60 MB) |
| Manifest integrity | **21,827 physical lines for 21,824 logical records** — one record's title contains raw newlines and spans 4 lines, breaking the one-record-per-line invariant | same stream; 4 lines fail `JSON.parse` |
| Synthesis output | **20 claims, 20 distinct `edgeId`s, 17 distinct source papers**; all `claimKind: correlational` | `data/corpus/edges/claims.jsonl` |
| Claim provenance is mixed | 18 of 20 from `gpt-5-2025-08-07` / `synthesis-whole-paper-2026-08-01.2`; 1 from `gpt-5` on the older prompt; **1 from `claude-fable-5` dated 2026-07-16**. The artifact is not purely today's batch | same |
| Blueprints | **12, every one `provenance.tier: "extracted"` with `citation.paperId` + locator**, over 11 distinct papers | `blueprints.jsonl` |
| Yield | **0.30 blueprints/paper** (12 ÷ 40). The 3–5 design assumption is disproven by ~10× | ledger call count + blueprint count |
| Verification (artifact, at `e0c6077`) | **7 Agnes records + 1 older interim placeholder.** All 7: `verdict: uncertain`, `independentRetrieval {performed: true, sources: []}`, `corroboration {0,0}`. Confidences 0.00–0.95. **Superseded:** this is the pre-#355 artifact state. The hosted result after #355 is 14 verifications, 11 servable, confidence 0.72–0.92 | `verifications.jsonl`; hosted read 2026-08-02 |
| Verifier attestation | `attestedModel: agnes-2.5-flash`, `attested: true`. Model's own reasoning: *"Since no sources were retrieved, I must return 'uncertain'."* | `verification-raw.jsonl` |
| ~~**Zero verified edges is derivable**~~ — **RETRACTED 2026-08-02** | This row asserted that `supported`/`partial` require `corroboration.supporting ≥ 1`, so zero verified edges followed by schema. **That rule no longer exists.** PR #355 removed it and bound the verdict to single-paper fidelity instead (`directionCheck.matchesClaim`). The hosted result is 14 verified edges, 11 servable. The retracted claim was drafted against `e0c6077`, which predates #355 | `shared/brain/relationships.schema.ts:236,245` at `origin/dev-phase2-run4`; hosted read 2026-08-02 |
| Decorrelation | **`Decorrelation: OK — synthesis=openai, verifier=agnes (independent families enforced)`.** The TEST-MODE override block no longer exists in `tools/llm-router/src/` | executed `llm-router check-config` |
| Spend, all time | **US$1.8040535 over 59 calls.** 2026-08-01: synthesis 40 calls US$1.58452 (≈US$0.0396/paper), verifier 10 calls **US$0**, seeder 2 calls US$0.0202325 | `data/llm-router/ledger.json` |
| Agnes pricing | `inputUsdPerMTok: 0`, `outputUsdPerMTok: 0`, `billingMode: "free"`, **`expiresAt: 2026-08-08`** | `tools/llm-router/router.config.json` |
| Free node bounding | Acceptance-only, append-only hash-chained attempt journal reserving every billable POST before dispatch, under a validated `AcceptanceAuthorization`. A USD cap cannot bound a zero-priced node | `tools/llm-router/src/attemptJournal.ts` |
| Migrations | **44 `.sql` files**, `20260313_…` → `20260801091500_…` | `find supabase/migrations -maxdepth 1 -type f` |
| Workflows | **6 files**: `brain-ingest`, `brain-pipeline`, `ci`, `model-inference`, `nao-d1-etl`, `run4-u6b-evidence` | `find .github/workflows -maxdepth 1 -type f` |
| **Two workflows cannot be dispatched** | `brain-pipeline.yml` and `nao-d1-etl.yml` → **`HTTP 404: workflow not found on the default branch`**. `origin/main` carries only `ci.yml` + `brain-ingest.yml` | `gh run list --workflow=…`; `git ls-tree origin/main .github/workflows/` |
| Attestation drift | **3 of 4 entrypoint hashes mismatch** (`generate-insights`, `evaluate-signals`, `run-pipeline`); `compute-baselines` matches | recomputed SHA-256 vs `supabase/deploy-attestation.json` |
| nao surface | **7 sections** (`SubNav.tsx:11-27`); paper detail `notFound()`s on a null `getPaperMeta`; ingest badge is `paused ? 'PAUSED' : 'RUNNING'` over `DEFAULT_INGEST_CONTROL` (`types.ts:131-136`), returned *when no control document exists in R2* | source read |

### Newly found defects

1. **`log_completeness|confounds|anxiety_score` was emitted.** An app-internal bookkeeping metric no paper
   can speak to. Filtered downstream; the synthesis gate should bar the key and does not.
2. **The edge dedupe key is order-sensitive.** `stool_form|correlates|stool_count` *and*
   `stool_count|correlates|stool_form` are both stored. For a symmetric relation these are one edge.
3. **Contradictory relations on one pair are retained.** `sleep_duration_min`↔`resting_hr_bpm` appears as
   `correlates`, `no_effect`, **and** `decreases`; `sleep_duration_min`↔`hrv_sdnn_ms` as both `correlates`
   and `no_effect`. Reconciliation is the advertised job and is not happening.
4. **`Manifest.upsert()` was O(n²)** — full 60 MB rewrite per record, ~21k times. Invisible at 1,232
   records, dominant at 21,823. Patched with batched atomic checkpoints.
5. **Verifier retrieval has no alias map.** Snake_case keys are split on underscores, so `resting_hr_bpm`
   searches "resting"+"hr", never "heart rate". **This is the proximate cause of every zero above** — the
   corroboration counts measure our lexical coverage, not the literature.
6. ~~**The caveat sentences circulating as "real Agnes output" are template strings.**~~ **RETRACTED
   2026-08-02 — this finding was wrong on the substance.** It concluded the caveats were unreachable
   hardcoded strings. Two errors: (a) `chooseCaveat()` returns `source: 'model'` and keeps the model's own
   prose whenever it passes the copy gate and names a limitation that actually fired, so a caveat is not
   necessarily a template at all; (b) PR #355 added `citedPaperAssessed`, which opens the quality-of-backing
   flags when the cited paper's quotes were shown — so population/direction/kind limitations surface **even
   at zero corroboration**, which is exactly the reachability the finding denied. Live examples now stored
   on `edge_verifications`: *"Only one source (S7) addresses both resting HR and anxiety, and its quoted
   passages report that…"*; *"Only S4 supports the claim, and it studies GI-specific anxiety in IBS
   patients…"*. These are quotable as real verifier output. **What survives:** derived template sentences
   do exist and do get used when the model's phrasing is rejected, so a given caveat may be either — check
   `source` before attributing wording to the model.

### Could not verify

- ~~**Hosted table counts.**~~ **RESOLVED 2026-08-02 — read directly from the hosted Supabase project**
  (out of band; this worktree still has no link file or service credential, so the read is not reproducible
  from the repo alone). The `0/0/0/0 + insight_cards 1` figures carried forward from #309 were stale:

  | `relationship_claims` | `edge_verifications` | `verified_edges` | `insight_cards` | `composed_insights` |
  |---|---|---|---|---|
  | 14 | 14 | **14 — 11 servable** (8 `high`, 3 `mid`, 3 `hold`) | **45** — 43 `personal`, 2 `rules`, **0 `edge`** | populated |

  Verdicts: 1 `supported`, 10 `partial`, 2 `uncertain`, 1 `unsupported`; confidence 0.72–0.92. The
  projection workflow is still undispatchable, so CI did not produce this — a local run did.
- **The "Agnes 18 of 50 calls" quota.** The ledger shows 10 Agnes calls; the plan quota is vendor-side and
  unobservable here. Removed from the submission docs rather than restated.
- **The nao test-suite count** (previously "327 tests"). Not re-run at this head, so the number was removed
  rather than copied forward.

## Final rewrite gate

**Partially satisfied as of 2026-08-02.** The measurement precondition is met, and more strongly than the
previous revision recorded: verification has run, produced 14 edges of which 11 are servable, and the hosted
state has been read directly rather than inferred. Two conditions remain unmet:

1. **#277 has not cleared or excluded model claims.** The drafts therefore *exclude* all support-model
   training and evaluation figures rather than restate them in either direction. This also means the
   owner's §8 runbook slide cannot name Zebra and Viceroy.
2. **No card has been produced from an edge.** `insight_cards` has 45 rows and **0 with `producer='edge'`**.
   The chain is real up to `verified_edges` and stops one step short. This is stated as a measured fact in
   all three submission docs, not left as a placeholder.

**A note on how this ledger got it wrong, since the failure is instructive.** The previous revision was
drafted without database credentials and stated hosted state from a stale prior record while the pipeline
was in fact running. It then reasoned *from* that stale zero to a stronger claim — "zero verified edges is
derivable by schema" — using a contract rule that PR #355 had removed. An honest document that understates
is still inaccurate, and a derivation is only as current as the code it cites. Two rows and one defect above
are retracted on that basis.

Quantitative sentences sourced from machine artifacts are reproduced from `e0c6077`; hosted counts are from
a 2026-08-02 direct read; code references are against `origin/dev-phase2-run4`. The corpus is still growing,
so its counts are timestamps: re-measure before any recording or submission.
