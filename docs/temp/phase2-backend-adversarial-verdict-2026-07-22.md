# Ourobion Phase-2 backend adversarial verdict

**Review date:** 2026-07-22  
**Reviewed checkout:** `signoff/phase2`  
**Primary review input:** `docs/temp/phase2-unit-index.md`  
**Review posture:** independent, adversarial, read-only; app user, Ourobion developer, and hackathon judge perspectives

## Executive verdict

**No-go for Phase-2 sign-off, production serving of research-linked cards, or a hackathon claim that the adversarial verifier has been demonstrated.**

This is not a verdict that the repository is generally broken. The reviewed slice is a strong, unusually well-tested scaffold: the metric registry, data-driven rules, signal statistics, loaders, quote matching, deterministic composition, copy gates, budget ledgers, and most lifecycle hardening are coherent. All **529 existing Node tests passed**, all six TypeScript packages type-checked, and the repository context gate passed.

The no-go comes from the difference between code execution and product intent:

1. The operational `brain-ingest verify` command does not supply any corpus or external retrieval adapters. It therefore retrieves zero independent sources. Even when a programmatic caller injects corpus hits, their finding text/abstract is removed before the verifier prompt. The intellectual center of the hackathon delta is not operational.
2. A one-hop edge card can tell the user the wrong metric moved. I reproduced an HRV-only signal producing: **“Your sleep duration data shifted upward today.”**
3. The shared schema and edge loader allow a `partial` verification with a failed zero-span quote check to load into the `mid` serving band. I reproduced this with zero loader errors.
4. The engine surfaces `research-context` coincidence cards even though the authoritative architecture and the table comment say that branch is gap-only and never surfaced.

These are semantic trust failures. Passing tests do not neutralize them; current tests either do not cover the operational seam or explicitly encode the unsafe behavior.

### Verdict by audience

| Audience / claim | Verdict | Why |
|---|---|---|
| App user, current honest L6 personal card | **Conditional pass as an internal demo** | The `uncertain → hold → uncited personal card` posture is honest and non-diagnostic. It is not evidence-backed research serving. |
| App user, research-linked cards | **No-go** | The verifier is not grounded and an object-endpoint signal can produce a false subject-metric statement. |
| Ourobion developer | **Strong scaffold; no sign-off** | Deterministic seams and tests are good, but loader invariants, projection lifecycle, and architecture/code agreement are incomplete. |
| Hackathon judge, “independent adversarial verifier” | **No-go as an observed result** | The CLI cannot retrieve evidence, prompts omit evidence text, and the required ablation/miss/cost-latency/second-labeller artifacts are absent. |
| Full Phase 2 | **Not ready, mostly by declared scope** | L7/L8, real applicability grading, several authoring stages, M3/M4/M7 breadth, UI completion, and statistical calibration remain intentionally incomplete. |

## Intent used for this review

I did not treat “the code runs” as the goal. I used the following product intent before inspecting implementation:

- **App user:** log in about 30 seconds; gain passive breadth over time; receive descriptive, non-diagnostic, privacy-safe patterns; see why a card exists; degrade honestly when evidence/data is missing.
- **Developer:** add metrics through the registry and continuity-based storage without bespoke rewrites; keep raw rows as truth and projections reproducible; run an offline authoring pipeline; keep the serve path deterministic; enforce cross-language contracts.
- **Hackathon judge:** score the post-baseline “brain,” particularly a decorrelated model performing its own retrieval and trying to refute a synthesized claim. The winning evidence is observed ablation, refusal/miss, cost and latency, and independent labelling—not architecture prose.

I evaluated the current checkout as the declared **L0–L6 backend slice**, not as a falsely complete Phase 2. Known future work is listed separately rather than reported as a regression.

## Blocking findings

### B1 — The operational verifier has no retrieval input, and injected evidence text never reaches the model

**Severity:** blocker  
**Affected users:** hackathon judge, developers, eventually app users  
**Status:** newly identified; not resolved by the known B5 API-key blocker

The CLI constructs `runOpts` with claims, edge directory, quote-check text loader, router, and a generic verifier model stamp, but it never assigns `runOpts.retrieve` ([`tools/brain-ingest/src/cli.ts:326`](../tools/brain-ingest/src/cli.ts#L326), especially lines 334–351). `verifyClaim` then calls:

```ts
retrieveForClaim(claim, opts.retrieve ?? {})
```

([`tools/brain-ingest/src/verify/verifier.ts:206`](../tools/brain-ingest/src/verify/verifier.ts#L206)). With `{}`, the corpus is empty and there are no external adapters. A real CLI run therefore retrieves zero verifier-owned sources. Adding an OpenAI/Agnes key cannot fix this wiring gap.

There is a second independent defect. Corpus ranking uses `CorpusDoc.text`, but `corpusHitToCitation()` drops the text ([`retrieval.ts:107`](../tools/brain-ingest/src/verify/retrieval.ts#L107), [`retrieval.ts:157`](../tools/brain-ingest/src/verify/retrieval.ts#L157)). External candidates contain abstracts, but `candidateToCitation()` drops those too ([`types.ts:129`](../tools/brain-ingest/src/types.ts#L129), [`retrieval.ts:187`](../tools/brain-ingest/src/verify/retrieval.ts#L187)). `buildVerifierPrompt()` accepts only `VerifyCitation[]`; its evidence block includes paper ID, year, tiers, and title—not an abstract, finding sentence, passage, or quote ([`prompt.ts:70`](../tools/brain-ingest/src/verify/prompt.ts#L70), [`prompt.ts:97`](../tools/brain-ingest/src/verify/prompt.ts#L97)).

Focused reproduction with a corpus document containing a unique finding sentence produced:

```json
{
  "hitCount": 1,
  "runLogRetainsText": true,
  "promptContainsEvidence": false,
  "promptSourceBlock": "paperId: p1 ... title: Sleep and HRV trial"
}
```

The current end-to-end test succeeds only because it injects `retrieve: { corpus: [...] }` and a mock router that returns the expected stance ([`tools/brain-ingest/tests/verify.test.ts:330`](../tools/brain-ingest/tests/verify.test.ts#L330)). It does not assert that the corpus text appears in the prompt. The test named “claim + retrieved sources embedded” verifies citation metadata, not evidence content.

**Impact:** the verifier cannot assess direction, claim-kind inflation, scope, or effect size from the shown sources. At best it infers from titles or model prior knowledge despite being told to judge only shown evidence. This invalidates “independent retrieval,” “source-grounded refutation,” and any supported/partial result produced through a hand-wired workaround.

**Required gate:** build a concrete verifier evidence type carrying bounded, provenance-addressable passages/finding sentences; wire the CLI to load a real independent corpus and/or external retrieval adapters; render those passages in the prompt; test the actual CLI seam; assert that evidence text and provenance reach the router request. Then run a real non-Anthropic verifier and retain its request/response artifact.

### B2 — An object-endpoint signal renders as if the subject metric moved

**Severity:** blocker for user serving / high code defect  
**Affected users:** app users; judges watching the card demo  
**Status:** newly identified

Edges are indexed under both subject and object ([`generate-insights/index.ts:375`](../supabase/functions/generate-insights/index.ts#L375)). For a fired single-metric signal, `edgeDirectionConsistent()` calls any monotonic edge “consistent” whenever either endpoint state is absent ([`composer.ts:82`](../supabase/functions/generate-insights/composer.ts#L82)). Thus an object-only signal can enter `agree`.

The handler records the actual fired metric as `pattern_metric_label`, but renders `metric_a_label` from `topEdge.subject` ([`generate-insights/index.ts:653`](../supabase/functions/generate-insights/index.ts#L653), lines 693–702). Both edge templates ignore `pattern_metric_label` and state that `metric_a_label` shifted ([`render.ts:120`](../supabase/functions/generate-insights/render.ts#L120)).

Focused reproduction using an `hrv_sdnn_ms: up` signal and the edge `sleep_duration_min increases hrv_sdnn_ms` returned:

```json
{
  "branch": "agree",
  "body": "Your sleep duration data shifted upward today, and published research reports that sleep duration tends to raise HRV. Worth watching, not a verdict."
}
```

No sleep shift was in the input. This is a false first-person health statement, not merely awkward copy.

**Required gate:** directional cards must not reverse an edge. At minimum, only let a subject-endpoint signal drive this template; treat object-only signals as context/gap. Prefer an explicit orientation-aware composed payload and template using the observed metric. Add tests for subject-only, object-only, both-consistent, both-inconsistent, `increases`, and `decreases`.

### B3 — A failed zero-span quote check can still enter a servable band

**Severity:** high  
**Affected users:** developers and app users  
**Status:** newly identified projection-boundary bypass

The shared verification schema checks quote-count arithmetic and consistency of `allPresent`, but it does not require `quoteCheck.allPresent === true` for `supported` or `partial` ([`shared/brain/relationships.schema.ts:155`](../shared/brain/relationships.schema.ts#L155)). The loader relies on that schema and then computes the serving band ([`tools/edge-loader/lib/artifacts.mjs:145`](../tools/edge-loader/lib/artifacts.mjs#L145)).

The repository test explicitly accepts `{spansFound:0, spansTotal:0, allPresent:false}` ([`edge_artifacts.test.ts:144`](../tools/edge-loader/tests/edge_artifacts.test.ts#L144)). A focused loader reproduction changed the fixture `partial` verification to that quote block and produced:

```json
{
  "errors": [],
  "verdict": "partial",
  "servingBand": "mid",
  "quoteCheck": { "spansFound": 0, "spansTotal": 0, "allPresent": false }
}
```

The normal in-repo verifier producer rejects a failed quote check before LLM spend, but the loader is the truth-artifact projection boundary. Hand-authored, legacy, imported, or corrupted artifacts can bypass the producer and serve.

**Required gate:** any servable verdict must require at least one span and `allPresent === true` in the shared schema. If zero-span uncertain records are intentionally retained, make the invariant conditional on verdict. Add a loader test asserting failed quote check always yields validation failure or `hold`.

## High-priority intent and architecture failures

### H1 — `research-context` is surfaced despite the authoritative “gap only” rule

The authoritative architecture says `research-context` and `contradiction` are not surfaced and become gap events only ([`docs/shared/insight-engine-architecture.md:67`](../docs/shared/insight-engine-architecture.md#L67), [`:353`](../docs/shared/insight-engine-architecture.md#L353)). The `composed_insights` migration repeats “never surfaced” ([`20260716050639...sql:35`](../supabase/migrations/20260716050639_create_m5b_composed_insights_and_card_producers.sql#L35)).

The handler explicitly allows both `agree` and `research-context` to render a coincidence rule card ([`generate-insights/index.ts:611`](../supabase/functions/generate-insights/index.ts#L611)). D14 records “suppressed on contradiction,” implicitly preserving the deviation ([`phase2-run-signoff-decisions.md:168`](../docs/temp/phase2-run-signoff-decisions.md#L168)), but the authoritative architecture was not amended.

This matters most for `correlates`/`modulates` edges: they are context-only and can never carry direction, yet they can decorate a user card with research authority. Either behavior could be a defensible product choice, but the current repo contains two incompatible truths.

**Required gate:** make one explicit decision. Recommended: follow the current architecture—store the composed row and gap event, but do not produce a user card. If product owners want research context surfaced, amend the architecture/migration comment and design distinct copy that does not imply the research supports the observed direction.

### H2 — `baseline_snapshots` is upsert-only, so removed source series leave stale projections

`compute-baselines` builds current snapshots and upserts them, but never reads existing keys or prunes rows absent from the current S2 projection ([`compute-baselines/index.ts:203`](../supabase/functions/compute-baselines/index.ts#L203)). `generate-insights` includes users found only in `baseline_snapshots` ([`generate-insights/index.ts:415`](../supabase/functions/generate-insights/index.ts#L415)).

If a user deletes all tall `signals` rows for a metric (deletion is permitted), a sync replaces/removes a series, or a metric stops being baseline-applicable, the old snapshot remains. Trend/threshold rules can continue firing from old values and can be regenerated nightly. This violates the two-tier promise that projections are rebuildable from current raw truth.

**Required gate:** implement scoped upsert-and-prune semantics, with an explicit successful-empty-input policy and tests for last-row deletion, metric deprecation, and partial user loss. As defense in depth, reject snapshots older than the current successful baseline run in `generate-insights`.

### H3 — `RelationshipClaim.derivation` is documented as copy-gated but is not gated

The contract says derivation is copy-gated before storage ([`shared/brain/relationships.ts:135`](../shared/brain/relationships.ts#L135), [`shared/brain/README.md:47`](../shared/brain/README.md#L47)). The schema only requires a non-empty string ([`relationships.schema.ts:95`](../shared/brain/relationships.schema.ts#L95)); synthesis post-processing performs schema, provenance, endpoint, quote, and offset checks but never calls `validateCopyString` ([`postprocess.ts:153`](../tools/brain-ingest/src/synth/postprocess.ts#L153)). The loader does not gate it either.

This field is not currently shown by the biotope card UI, so this is not an immediate exposure. It is nevertheless a false safety guarantee at the truth-artifact boundary and will matter for nao/evidence panels.

**Required gate:** copy-gate the synthesized derivation before artifact append and re-check at loader ingestion; add forbidden-language and benign-word tests.

## Known debt and declared incompleteness

These do not explain the new no-go by themselves, but they limit any release claim:

- **`derived_metrics` remains user-writable despite being a “never hand-edited” projection.** The migration grants insert/update/delete ([`20260715140420...sql:137`](../supabase/migrations/20260715140420_create_continuity_storage_primitives.sql#L137)). This is already accepted as O4. It is latent while the table is unused, but must be select-only before consumption.
- **Model decorrelation is configured, not attested at execution.** Every shipped route is `local_agent`; the mailbox fulfiller’s real family is not bound to `verifierModel`. B5/O7 already acknowledge the key/model work. A real route must record the provider-returned model and reject family mismatch.
- **The real applicability grader is a typed `unknown` stub.** This is honest and safe, not a bug, but no transferability claim should be made.
- **Gap-ledger/L7–L8 loop, A4–A7 authoring support, S9 reporting, human curation, and the demand-side research loop are not built.** U9 is a valid cold-start seeder, not the self-improving loop.
- **M6’s `InsightFiredEvent` contract is not emitted by the audited generator.** The contract says M5b fires it and M6 consumes it without reading cards ([`shared/SHARED-CONTEXT.md:210`](../shared/SHARED-CONTEXT.md#L210)); `generate-insights` only upserts composed insights and cards ([`generate-insights/index.ts:803`](../supabase/functions/generate-insights/index.ts#L803)). Treat this as an integration gap unless explicitly out of this slice.
- **Statistical values remain provisional/deferred.** The engineering implementation is testable, but scientific suitability is not signed. Do not translate a green unit test into validated health inference.
- **Baseline confidence documentation has drifted.** Runtime uses 3/7/14 ([`compute-baselines/index.ts:19`](../supabase/functions/compute-baselines/index.ts#L19)); the authoritative architecture and migration comment still describe 3/5/14 ([`insight-engine-architecture.md:198`](../docs/shared/insight-engine-architecture.md#L198), [`20260715154001...sql:37`](../supabase/migrations/20260715154001_alter_m5a_baseline_snapshots_baseline_v2.sql#L37)). The config decision records 3/7/14. Fix the truth hierarchy before sign-off.
- **Most units remain formally unsigned.** The unit index shows only U1 cleared, U3/U4/U9 individually approved/provisional, and the remainder pending or deferred ([`phase2-unit-index.md:23`](../docs/temp/phase2-unit-index.md#L23)). Shared-contract B8 review/waiver is unresolved.

I did **not** treat unfinished M3 Health Connect, M4 environment, M7 community, metric-wave breadth, UI visual polish, or unavailable API keys as newly discovered code regressions. They make full Phase 2 incomplete, but the unit index already says so.

## What works well

The build has real strengths worth preserving:

- Registry-driven metrics, generated long-format view, data-driven rules, and disjoint producer namespaces are good extensibility choices.
- Raw rows vs rebuildable projections is consistently understood in most loaders and in `personal_signals` lifecycle hardening.
- Quote matching is deterministic, offset-aware, and correctly rejects fabricated synthesis quotes in the normal producer.
- Edge loading is deterministic, validates endpoints, canonicalizes timestamps, supersedes old verifications, and precomputes serving bands from one shared function.
- Signal statistics handle flat sensors, low coverage, ties, autocorrelation, FDR, and stability conservatively at the engineering level.
- Budget ledgers, concurrency handling, retention, 95% stops, and offline testability are strong constraint engineering.
- The L6 decision not to fabricate a supported edge for demo effect is exactly right. The personal “still researching” fallback demonstrates graceful degradation and aligns with the non-diagnostic product principle.
- The existing audit fixed meaningful issues: snooze preservation, stale personal signals, app relationship-card parsing/expiry, Deno/migration CI coverage, timestamp canonicalization, constraint precision, copy word boundaries, and handler secret guards.

## Verification performed

No repository files were changed during inspection before this report. Existing unrelated dirty files were preserved.

### Automated checks

| Check | Result |
|---|---|
| `tools/brain-ingest` tests | 323/323 pass |
| `tools/llm-router` tests | 48/48 pass |
| `tools/rules` tests | 67/67 pass |
| `tools/edge-loader` tests | 45/45 pass |
| `tools/metric-view` tests | 5/5 pass |
| `tools/engine-stats` tests | 41/41 pass |
| **Total Node tests** | **529/529 pass** |
| TypeScript `tsc --noEmit` | 6/6 packages clean |
| `tools/context_sync.mjs --check` | pass |

I did not rerun Flutter, Deno handler checks, database migrations, a local Supabase end-to-end run, or a real paid-model call. The backend unit index and prior session logs contain evidence for several of those, but this verdict does not present them as independently re-executed here.

### Focused adversarial reproductions

1. **Verifier evidence loss:** one corpus hit retained full text in `corpusHits`, while the router prompt contained only citation metadata/title.
2. **Wrong metric:** an HRV-only signal classified `agree` and rendered a sleep-duration shift.
3. **Quote-gate bypass:** a `partial` verification with `{0,0,false}` loaded without errors into `servingBand: "mid"`.

Graphify was used first for repository navigation and seam discovery. Its graph located the main contracts, engine, brain pipeline, and hackathon intent; targeted source reads then verified behavior. A missing graph path was treated as a projection limitation, not evidence that a runtime seam did not exist.

## Minimum path from no-go to conditional pass

1. **Fix B1 completely:** operational retrieval wiring, evidence-bearing passage type, evidence in prompt, CLI integration test, real decorrelated model run, attested model ID.
2. **Fix B2:** orientation-aware signal/edge composition and reverse-endpoint regression tests.
3. **Fix B3:** shared conditional invariant tying servable verdicts to a successful non-empty quote check.
4. **Resolve H1 as a product decision:** gap-only or explicitly redesigned research-context surface; make architecture, SQL comments, handler, and tests agree.
5. **Fix projection lifecycle:** baseline prune/freshness and O4 select-only derived metrics.
6. **Enforce derivation copy safety** at artifact production and loading.
7. **Run the real L6 slice again** with one actual evidence-bearing source set; verify supported/partial and refusal paths; inspect the exact card copy for both endpoint orientations.
8. **For hackathon claims, produce observed artifacts:** held-out baseline-vs-verifier ablation, one verifier miss, per-edge cost/latency, second-labeller disagreement, and a refusal. Until then, use “scaffolded and unit-tested,” not “demonstrated.”

## Final assessment

Claude Code produced a credible foundation and showed good engineering discipline, especially around deterministic boundaries and honest degradation. But the current implementation does not yet fulfill Ourobion’s central trust promise. The verifier does not operationally retrieve or read evidence, a servable artifact can bypass quote grounding, and a generated card can state that the wrong user metric changed.

The appropriate product statement today is:

> Ourobion has a tested deterministic insight and verification scaffold, plus an honest personal-observation fallback. Independent evidence-grounded adversarial verification and safe research-linked card serving are not yet complete.

Anything stronger would overstate what the current build demonstrates.
