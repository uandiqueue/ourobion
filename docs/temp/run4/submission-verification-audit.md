---
title: Hackathon submission evidence audit
summary: Claim-by-claim evidence audit of the existing hackathon write-up and connection map; #300 is built, but final narrative work remains blocked until #307 reports the measured full-flow outcome.
type: audit
scope: run4
status: draft
updated: 2026-08-01
---

# Hackathon submission evidence audit

This is the submission defect ledger, **not final submission prose**. The initial audit used
`253e0ad6db31bb2a134e47546ddaba84bf284639`; implementation-sensitive findings were refreshed after
Session A landed at integration merge `dea055c8155c1e9c6851931f4de9816a88d66b2d`, then refreshed
again at the post-#300 integration head `abcba95f8386d31c49f62f20f4b623de180e29c0`. Re-run every
result-bearing command after #307's full-flow test. Do not promote any model-training or evaluation
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
| Rule blueprints | [`supabase/functions/generate-insights/data_rules.ts`](../../../supabase/functions/generate-insights/data_rules.ts) | Load the exported blueprint array → **8** entries; every entry has `verificationTier: 'hand_authored'` and `citation: null`. | `verified`: all eight rule blueprints are uncited hand-authored rules. |
| Migration and workflow inventory | [`supabase/migrations/`](../../../supabase/migrations/), [`.github/workflows/`](../../../.github/workflows/) | `find supabase/migrations -maxdepth 1 -type f | wc -l` → **41**; `find .github/workflows -maxdepth 1 -type f` → **5 workflow files** after Session A. | `verified`: the connection map's 39 migrations / 2 workflows is stale. |
| Cloud brain workflow | [`.github/workflows/brain-pipeline.yml`](../../../.github/workflows/brain-pipeline.yml) | GitHub Actions history and the rejected pre-merge dispatch were checked → **no executions**. Its YAML uses `workflow_dispatch`; it hydrates the manifest and runs bounded synthesis/verification/load stages, but does not run `seed-queries`. | `verified`: the pipeline is defined and merged but has never been executed as a workflow. |
| Seeder candidates | [`tools/brain-ingest/src/seeder/candidates.ts`](../../../tools/brain-ingest/src/seeder/candidates.ts), [`tests/seeder.test.ts`](../../../tools/brain-ingest/tests/seeder.test.ts) | Run the candidate enumerator against the real registry and blueprints → `candidates:16 {"derivedFrom":8,"rule_blueprint":2,"static_topic":6}`. | `verified`: only ten metric-pair candidates plus six topics are enumerated; see the #297 audit. |
| Seeder artifact | [`tools/brain-ingest/src/seeder/artifact.ts`](../../../tools/brain-ingest/src/seeder/artifact.ts) | `test -f data/corpus/seed-queries.json` → false at the audited head. | `verified`: ingest cannot consume generated queries that do not exist. |
| Corpus volume | [`tools/brain-ingest/src/cli.ts`](../../../tools/brain-ingest/src/cli.ts) now exposes the R2-to-local `hydrate-manifest` command | The authorized R2 hydration output was **0 → 1,298 records**; the established manifest aggregation is **739** records with full text longer than 5,000 characters. | `verified as bounded command output`; final submission still needs a durable machine-readable coverage artifact rather than a copied session total. |
| Live provider acceptance | [`tools/brain-ingest/src/liveAcceptance.ts`](../../../tools/brain-ingest/src/liveAcceptance.ts), [`tests/liveAcceptance.test.ts`](../../../tools/brain-ingest/tests/liveAcceptance.test.ts) | Authorized acceptance output: ordered Anthropic `claude-sonnet-5`, OpenAI provider-attested `gpt-5-2025-08-07`, Agnes `agnes-2.5-flash`; four POST responses were 200; provider-leg cost **$0.0182055**, session total **$0.044**; journal hash chain intact; a fourth invocation refused without dispatch; no `GET /models`. | `verified for provider transport under binding authentication only`. The test proves ordering/refusal offline; the live values must be attached as a durable artifact before final copy. |
| Verification disposition | Live acceptance output from the same bounded run | Verdict: `uncertain`, confidence **0.3**, **0** supporting sources, independent-source stance mentions; edge held and no card emitted. | `overclaim guard`: this is fail-closed transport evidence, not scientific validation of a relationship. |
| Pre-#300 synthesis output | Two authorized live `gpt-5` run outputs on well-matched papers | Both runs: **0 accepted / 0 rejected claims**. | `verified historical baseline`: it proves the passage-prefilter path failed to emit claims, not that the new whole-paper path does. |
| Post-#300 synthesis implementation | [`paperPrompt.ts`](../../../tools/brain-ingest/src/synth/paperPrompt.ts), [`paperRun.ts`](../../../tools/brain-ingest/src/synth/paperRun.ts), [`paperPostprocess.ts`](../../../tools/brain-ingest/src/synth/paperPostprocess.ts), [`blueprintArtifact.ts`](../../../tools/brain-ingest/src/synth/blueprintArtifact.ts) | Code inspection at `abcba95`: `synthesize-papers` sends canonical whole text, gates `ownFinding`, stores an optional verbatim `mechanism:` quote span, batches/resumes/dedupes, and writes `claims.jsonl` + `blueprints.jsonl`. | `verified built, outcome unmeasured`: do not infer a claim, edge, projection, or card until #307 reports its real flow. |
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
| 39 migrations and 2 workflows | `now-wrong`: inventory is 41 and 5 after Session A. |
| Real verifier never ran | `now-wrong`: Agnes ran under the bounded live acceptance. The resulting verdict remained uncertain and held. |
| Provider/model topology | `stale`: it conflates default routing, the older provider run, and acceptance overrides. Draw those as three evidence layers. |
| One accepted/held research edge | `overclaimed`: no synthesis claim survived either pre-#300 live `gpt-5` attempt; no post-#300 live result exists yet. |
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
  locator starts `mechanism:` and passes the same quote-offset gate. Do not relabel `derivation` as
  that mechanism span, and do not claim every output has a mechanism.

## Submission-blocking defect list

1. **P0 — result truth:** replace the old “successful held edge” story with the honest split between
   provider transport acceptance, uncertain fail-closed verification, the pre-#300 zero-claim
   baseline, and whatever #307 actually measures on the new path.
2. **P0 — evidence durability:** land and cite machine-readable provider, synthesis, corpus, and
   lineage outputs. Session prose is not sufficient submission evidence.
3. **P0 — model-claim quarantine:** remove evaluation/training claims pending #277; do not substitute
   new model metrics from another draft.
4. **P0 — measured full flow:** #300 is built; wait for #307's paper-to-card result before drafting
   the final research-pipeline narrative.
5. **P1 — provider identity:** preserve configured model, requested model, and provider-attested model
   as distinct fields; the OpenAI response attested `gpt-5-2025-08-07`, not plain `gpt-5`.
6. **P1 — lineage:** state that only current edge cards carry paper lineage and that eight rule
   blueprints remain uncited hand-authored logic.
7. **P1 — system inventory:** regenerate migration, workflow, test, route, and serving labels from the
   final integration head.
8. **P1 — planned architecture:** remove present-tense claims for `METRIC_TERMS`, `StructuredPaper`,
   queue/callback behavior, and any other design-only component; distinguish the implemented optional
   `mechanism:` quote from the still-non-mechanistic `derivation` field.
9. **P2 — historical docs:** do not use the Run 4 cockpit or older freshness audit as current status;
   consult the dedicated 2026-08-01 freshness sweep.

## Final rewrite gate

The final narrative may begin only after #307 comments its measured post-#300 synthesis,
verification, projection, and card result; #277 clears or excludes model claims; and every
quantitative sentence is reproduced from the then-current integration head. Until then, the warning
banners in the write-up and map are intentional controls.
