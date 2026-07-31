---
title: Hackathon submission evidence audit
summary: Claim-by-claim evidence audit of the existing hackathon write-up and connection map; blocks final narrative work until stale, overclaimed, and now-wrong statements are corrected after the active implementation sessions land.
type: audit
scope: run4
status: draft
updated: 2026-08-01
---

# Hackathon submission evidence audit

This is the submission defect ledger, **not final submission prose**. It audits repository state at
`253e0ad6db31bb2a134e47546ddaba84bf284639` (the fetched `origin/dev-phase2-run4` head at session
start). Re-run every command after the parallel brain/rules and data-rule sessions land. Do not
promote any model-training or evaluation claim until issue #277's gate is satisfied.

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
| Migration and workflow inventory | [`supabase/migrations/`](../../../supabase/migrations/), [`.github/workflows/`](../../../.github/workflows/) | `find supabase/migrations -maxdepth 1 -type f | wc -l` → **41**; `find .github/workflows -maxdepth 1 -type f` → **4 workflow files**. | `verified`: the connection map's 39 migrations / 2 workflows is stale. |
| Cloud brain workflow | [`.github/workflows/brain-ingest.yml`](../../../.github/workflows/brain-ingest.yml) | GitHub Actions history checked for this workflow → **no executions**. Its YAML uses `workflow_dispatch` and does not run `seed-queries`. | `verified`: the pipeline is defined but has never been executed as a workflow. |
| Seeder candidates | [`tools/brain-ingest/src/seeder/candidates.ts`](../../../tools/brain-ingest/src/seeder/candidates.ts), [`tests/seeder.test.ts`](../../../tools/brain-ingest/tests/seeder.test.ts) | Run the candidate enumerator against the real registry and blueprints → `candidates:16 {"derivedFrom":8,"rule_blueprint":2,"static_topic":6}`. | `verified`: only ten metric-pair candidates plus six topics are enumerated; see the #297 audit. |
| Seeder artifact | [`tools/brain-ingest/src/seeder/artifact.ts`](../../../tools/brain-ingest/src/seeder/artifact.ts) | `test -f data/corpus/seed-queries.json` → false at the audited head. | `verified`: ingest cannot consume generated queries that do not exist. |
| Corpus volume | R2 manifest output supplied by the corpus session | Manifest aggregation → **1,298 papers**, **739** with full text longer than 5,000 characters. | `verified for the current session evidence`; make submission-ready only after the parallel session lands a durable machine artifact and the command is rerun from the integration head. |
| Live provider acceptance | [`tools/brain-ingest/src/liveAcceptance.ts`](../../../tools/brain-ingest/src/liveAcceptance.ts), [`tests/liveAcceptance.test.ts`](../../../tools/brain-ingest/tests/liveAcceptance.test.ts) | Authorized acceptance output: ordered Anthropic `claude-sonnet-5`, OpenAI provider-attested `gpt-5-2025-08-07`, Agnes `agnes-2.5-flash`; four POST responses were 200; provider-leg cost **$0.0182055**, session total **$0.044**; journal hash chain intact; a fourth invocation refused without dispatch; no `GET /models`. | `verified for provider transport under binding authentication only`. The test proves ordering/refusal offline; the live values must be attached as a durable artifact before final copy. |
| Verification disposition | Live acceptance output from the same bounded run | Verdict: `uncertain`, confidence **0.3**, **0** supporting sources, independent-source stance mentions; edge held and no card emitted. | `overclaim guard`: this is fail-closed transport evidence, not scientific validation of a relationship. |
| Synthesis output | Two authorized live `gpt-5` run outputs on well-matched papers | Both runs: **0 accepted / 0 rejected claims**. | `verified negative result`: do not claim an end-to-end research edge; issue #300 owns the synthesis revamp. |
| Paper lineage in cards | [`supabase/functions/generate-insights/index.ts`](../../../supabase/functions/generate-insights/index.ts) and the eight blueprint records above | Inspect current generated/fixture outputs → only edge-produced cards currently carry paper lineage. Cross-rule code can accept edge references, but no current output demonstrates that path. | `verified bounded claim`: current observed lineage is edge-card-only; do not generalize potential code paths into shipped evidence. |
| Release-envelope facts | [`tools/run4_release_gate.mjs`](../../../tools/run4_release_gate.mjs), [`supabase/deploy-attestation.json`](../../../supabase/deploy-attestation.json) | `product-cap --head f8cb75251f0602395bdf88285e18d00525b88db4` → **512 paths / 71,841 additions**, `withinCap:false`; audited head → **533 / 75,645**, `withinCap:false`. | `verified`: the per-unit base advanced; whole-product acceptance and hosted parity remain false. |

The established same-day report that three CI defects were fixed and that `hydrate-manifest` was
added is **pending integration evidence** on this base. `--push-r2` is present in
[`tools/brain-ingest/src/cli.ts`](../../../tools/brain-ingest/src/cli.ts); do not describe the other
changes as landed until their owning session merges and the paths/tests can be cited from the target
branch.

## Existing write-up claim audit

| Draft claim area | Finding | Required correction before final prose |
|---|---|---|
| OpenAI synthesizer + Anthropic verifier as the executed system | `now-wrong` for the acceptance run. The ordered live legs were Anthropic synthesis, OpenAI synthesis snapshot, then Agnes verification. Configured defaults and executed overrides must be separate sentences. |
| “One full pipeline run / one held edge” | `overclaimed`. The acceptance edge was held with an uncertain 0.3 verdict and no supporting sources; two research synthesis attempts emitted no claims. Say transport exercised and fail-closed, not research pipeline succeeded. |
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
| 39 migrations and 2 workflows | `now-wrong`: inventory is 41 and 4. |
| Real verifier never ran | `now-wrong`: Agnes ran under the bounded live acceptance. The resulting verdict remained uncertain and held. |
| Provider/model topology | `stale`: it conflates default routing, the older provider run, and acceptance overrides. Draw those as three evidence layers. |
| One accepted/held research edge | `overclaimed`: no synthesis claim survived either current live `gpt-5` attempt. |
| R2 target only / no safe corpus count | `stale` when the 1,298/739 durable manifest lands; still do not claim the workflow executed. |
| All support models planned/untrained | `now-wrong` against repository history and prohibited from the submission until #277. Remove rather than replace with ungated performance claims. |
| Test totals such as nao “327” | `stale-unverified`: rerun at final integration head; do not copy forward from an older session. |
| Built-versus-planned A2/A4/A6 components | `overclaimed`; the traps below demonstrate that several design names are not implementations. |

## Explicit architecture traps

- `METRIC_TERMS` is not implemented. [`tools/brain-ingest/src/synth/passages.ts`](../../../tools/brain-ingest/src/synth/passages.ts)
  tokenizes snake-case metric keys in `defaultTermsForKeys`; a comment or design heading is not a
  curated metric ontology.
- `StructuredPaper` is not an implemented shared type. Searching `shared/brain`, `tools`, `apps`, and
  `supabase` finds design/comment mentions, not a type declaration or runtime consumer.
- `derivation` is currently a reasoning/provenance trace (“how quotes produce this claim”), not a
  demonstrated biological mechanism. Do not relabel it as mechanism evidence.

## Submission-blocking defect list

1. **P0 — result truth:** replace the old “successful held edge” story with the honest split between
   provider transport acceptance, uncertain fail-closed verification, and zero synthesis claims.
2. **P0 — evidence durability:** land and cite machine-readable provider, synthesis, corpus, and
   lineage outputs. Session prose is not sufficient submission evidence.
3. **P0 — model-claim quarantine:** remove evaluation/training claims pending #277; do not substitute
   new model metrics from another draft.
4. **P0 — synthesis revamp:** wait for #300 before drafting the final research-pipeline narrative.
5. **P1 — provider identity:** preserve configured model, requested model, and provider-attested model
   as distinct fields; the OpenAI response attested `gpt-5-2025-08-07`, not plain `gpt-5`.
6. **P1 — lineage:** state that only current edge cards carry paper lineage and that eight rule
   blueprints remain uncited hand-authored logic.
7. **P1 — system inventory:** regenerate migration, workflow, test, route, and serving labels from the
   final integration head.
8. **P1 — planned architecture:** remove present-tense claims for `METRIC_TERMS`, `StructuredPaper`,
   mechanism derivation, queue/callback behavior, and any other design-only component.
9. **P2 — historical docs:** do not use the Run 4 cockpit or older freshness audit as current status;
   consult the dedicated 2026-08-01 freshness sweep.

## Final rewrite gate

The final narrative may begin only after the owning implementation sessions merge, #300 establishes
the synthesis result to report, #277 clears or excludes model claims, and every quantitative sentence
is reproduced from the integration head. Until then, the warning banners in the write-up and map are
intentional controls.
