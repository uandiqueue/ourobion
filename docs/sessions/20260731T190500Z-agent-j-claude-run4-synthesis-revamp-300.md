---
title: Run 4 synthesis revamp (#300) — whole-paper input, mechanism quote, blueprint output, batch/budget/dedupe
summary: Replaced the keyword prefilter with whole-paper synthesis, made the mechanism a second verbatim quote span, made ownFinding false a rejection, added extracted rule-blueprint emission with a mandatory dedupe key, and gave batch runs budget ceilings plus resumability — scope A-D and G1-G6 landed, E partially, F blocked on territory.
type: session
scope: shared
status: canonical
updated: 2026-07-31
---

# Run 4 synthesis revamp (#300)

Issue: #300; branch: `feat/brain/synthesis-revamp-300`; base and exact head at branch cut:
`ac9c6236be4e07c7258ff5643c7afce2d2df09bc` (then rebased onto the merged
`dev-phase2-run4` = `dea055c8155c1e9c6851931f4de9816a88d66b2d`, PR #292's merge commit);
device: `agent-j`; agent: `claude` (Opus 5, 1M context).

Territory: `tools/**`, `shared/brain/**`, `shared/rules/**`, `data/rules/**`,
`.github/workflows/brain-*.yml`. Session B owns `apps/**` + `shared/metrics/**`; Session C owns
`docs/**` except this log.

## Attempted

- Land PR #292 first (done — merge commit `dea055c`, 21/21 green; see the prior session log).
- Then #300: the synthesis revamp, **including scope G**, stopping at the owner-review
  checkpoint without starting #240, #179, #246, #275, #277 or the two hackathon MVP goals.

## Changed

### §A · Whole-paper input; the prefilter is gone from this path

- **`tools/brain-ingest/src/synth/paperPrompt.ts`** (new) — builds a per-paper prompt carrying
  the **entire canonical text, verbatim and unmodified**, plus the ACTIVE metric catalogue as the
  vocabulary for claim endpoints. `selectPassages` / `defaultTermsForKeys` are not called and not
  imported.
- **`synth/load.ts`** — added `loadActiveMetricCatalogue()` (key + registry `ui.label` + unit) and
  `loadBlueprintValidator()`, both via the house runtime-dynamic-import pattern so `shared/` stays
  out of this package's `tsc` include.
- **No synonym map was added.** The registry's own `ui.label` is included because
  `gut_comfort_score` under-describes the metric in prose, but nothing here is a hand-maintained
  alias list a human must extend before a new pair can be researched. That is the whole point:
  whole-paper input **deletes** the `METRIC_TERMS` problem instead of solving it.

### §B · Mechanism as a second verbatim quote span

- The mechanism rides the **existing** free-text `locator` field as `mechanism:<section>`, so there
  is **no `RelationshipClaim` contract change** and it passes through the **same A9 quote gate** —
  verbatim text at exact offsets in the canonical text.
- `MECHANISM_LOCATOR_PREFIX`, `isMechanismLocator()`, `sectionFromLocator()` in `synth/types.ts`.
- A paraphrased mechanism is therefore impossible to land, and there is a regression test that
  feeds in exactly the plausible-and-wrong sentence the issue names ("gut bacteria produce
  serotonin which crosses the blood-brain barrier") and asserts `quote-not-found`.

### §C · Model-declared section + `ownFinding`

- `ownFinding` must be **exactly `true`**. `false` — and also absent, `null`, `"true"`, `1` — is
  **rejected (`not-own-finding`), never downgraded**. Citing a paper's Introduction restating
  someone else's result would produce a green quote gate over a false attribution, which is worse
  than no claim.
- Interim intro-zone mitigation: an **evidence** quote whose offset falls in the leading
  `INTRO_ZONE_FRACTION` (15%) is rejected. The **mechanism** span is deliberately exempt — papers
  routinely state the pathway they build on up front, and that is still their own sentence at exact
  offsets.

### §D · Rule/personal blueprint emission

- **`synth/blueprint.ts`** + **`synth/blueprintArtifact.ts`** (new). Synthesis is now a producer of
  rule blueprints stamped `provenance.tier: 'extracted'` with `provenance.citation`. Both fields
  already existed in `shared/rules/rule.schema.ts` and had never been written to — same zod gate,
  same `rules:load` loader, same engine.
- **Provenance is stamped by us, never taken from the model**, so a blueprint cannot forge a
  lineage it does not have (tested).
- A rejected blueprint **never costs the claim its acceptance** — a bad rule template must not lose
  us a good edge.
- Blueprints land in `edges/blueprints.jsonl`, deliberately separate from `claims.jsonl` so the
  A11 edge-loader is never handed records it has no schema for.

### §E · Verifier approve-with-caveat — PARTIAL, deliberately

- **Landed:** `caveat?: string | null` added to `EdgeVerification` in `shared/brain/relationships.ts`
  and `relationships.schema.ts`, additive + optional, and **copy-gated** — a caveat is user-facing
  card copy, so it passes `validateCopyString` and cannot smuggle diagnostic language onto a card.
- **NOT done, and flagged rather than done quietly:** §E also asks that independent retrieval stop
  being mandatory. The schema invariant "every SERVABLE verdict requires
  `independentRetrieval.performed`" is the safeguard that makes the second pass non-redundant, and
  it is the operative content of **accepted memory
  [0012](../memory/0012-brain-adversarial-edge-verification.md)** ("no retrieval ⇒ uncertain").
  Removing it is an amendment to an accepted decision, not an implementation detail, so it is
  recorded as **amendment intent** here and on the issue instead of being slipped in. See Left.

### §F · Phrasing in nao — NOT done (territory)

`generate-insights` is Deno and cannot host the Node router, so §F correctly puts the `a`-model
phrasing call in **nao** — which is `apps/nao/**`, **Session B's tree**, not this session's. No
files were written there. Flagged on the issue for Session B.

### Scope G

- **G1** — `synthesize-papers --paper <uid>[,<uid>]`: one process, N papers, **N calls**, serial.
  Parallelism deliberately not added (explicitly not required).
- **G2** — `--max-usd` / `--max-calls` ceilings checked **before** each call, so the run stops
  cleanly with a `stopReason` and every completed paper keeps its artifacts; and resumability skips
  papers already present in `claims.jsonl` **before** any provider call, so a re-run never pays
  twice. USD is computed with the router's **own** `costUsd()` against its **own** configured
  prices — no pricing is invented here, and an unpriced model warns loudly rather than being
  accounted as free.
- **G3** — blueprint dedupe key = **metric pair + condition shape + direction**, ignoring `ruleId`
  and `paperId` (cross-paper collision is the point). Collision policy is **merge corroborating
  papers onto one blueprint**, keeping the first paper as the gated citation. Opposite directions
  and different `lagDays` stay distinct.
- **G4** — the output contract #275 builds against is settled: blueprint record shape
  (`SynthBlueprintRecord`), mechanism span via `locator`, section via `locator`, `ownFinding` as a
  gate (so accepted claims are always own-findings and nothing needs storing), `caveat` on the
  verification.
- **G5** — `synthesizePapers()` is the single entry point; the screened batch and the nao-triggered
  single paper differ only in `paperUids.length`. No separate demo path exists to drift.
- **G6** — manifest metadata is resolved **once per run**, off the per-paper hot path, with a test
  asserting lookups stay flat against a synthetic **3,000-paper** corpus.

## Decided

- **Whole-paper synthesis is PAPER-scoped, not pair-scoped, and the ACTIVE registry replaces the
  pair gate.** G1's "one process, N papers, N calls" and §2's "triggered from nao by selecting a
  paper" both make the paper the unit of work, so there is no pair to scope to. The
  `unrequested-pair` gate is replaced by `inactive-metric-key` (both endpoints must be active
  registry keys, and distinct). **This is an amendment to C9's "pairs are the only source of
  edges"** — recorded as intent, not applied to the ADR.
- **The pair-scoped path was kept, not deleted.** `synthesize` (and its 430 existing tests, and the
  #233 live-acceptance evidence that used it) still work unchanged; `synthesize-papers` is a new
  verb. Deleting the old path would have invalidated merged acceptance evidence for no benefit.
- **The mechanism span is optional, not mandatory.** Requiring one would pressure the model to
  invent a pathway when the paper states none — the exact failure §B exists to prevent. The prompt
  asks for it, says omitting it is correct and expected, and says inventing one is the worst
  available outcome. Consequence to be aware of: not every card will carry a mechanism, which is
  narrower than the MVP definition-of-done wording.
- **Loosening thresholds was not attempted, because it would do nothing.** The two live runs
  returned `0 accepted, 0 rejected` — zero claims *emitted*, so there was never anything for a
  relaxed threshold to admit. The fix is claim emission, which is what §A addresses.

## Verification

All at exact head on the toolchain Node (`v26.3.0`, satisfies the `>=26` pin):

| Gate | Result |
|---|---|
| `tools/brain-ingest` typecheck | clean |
| `tools/brain-ingest` tests | **455/455** (430 pre-existing + **25 new**) |
| `shared` typecheck (`npx tsc --noEmit`) | clean — the contract change compiles |
| `tools/llm-router` tests | **121/121** |
| `tools/rules` tests | **172/172** |
| `tools/edge-loader` tests | **69/69** |
| `tools/metric-view` tests | **20/20** |
| `tools/engine-stats` tests | **49/49** |
| `node tools/context_sync.mjs --check` | passed |
| `git diff --check` | clean |

- The 25 new tests are written to fail if a requirement is reverted, not merely to pass today: the
  `METRIC_TERMS` guard asserts over **comment-stripped source** (both modules discuss the removed
  prefilter in their docstrings, so a naive whole-file regex would match the explanation and never
  fail for the right reason).
- The §A fixture reproduces the measured defect: `comfort` occurs **0** times in it while
  `depressive` does, so a `defaultTermsForKeys(['gut_comfort_score'])` window provably could not
  have surfaced the evidence sentence, and the test asserts whole-paper input does.
- **A fail-open on the budget guard, found by driving the CLI rather than only unit-testing it.**
  `parseArgs` files `--max-usd -5` (and a bare `--max-usd` with no value) under `flags`, not
  `options`, because the next token starts with `-`. Reading only `options` therefore meant a
  malformed ceiling silently became **"no ceiling"** — a spend guard that vanishes when mistyped is
  worse than no guard. Both now **exit 2** with a message naming the `--max-usd=<n>` form, with a
  test driving `main()` for both shapes. The shared `parseArgs` was deliberately **not** changed:
  other verbs and their tests depend on its current behaviour, so the refusal is scoped to this verb.
- One `tools/rules` run showed `A14 empty blueprint set` failing at **1619 ms**; it passes at
  **238 ms** on re-run and **172/172** on the merged base. Cold-start flake, **not** caused by this
  change — recorded rather than quietly re-run.
- **No provider calls were made this session.** Running spend unchanged at **US$0.044** against
  SGD 2 (Anthropic) / SGD 20 (OpenAI) and the 20-call Agnes cap. Every new test drives an injected
  mock router.

## Left

- **§E's retrieval invariant** — dropping mandatory independent retrieval needs an amendment to
  accepted memory 0012 and to the `relationships.schema.ts` superRefine. Recorded as amendment
  intent; **not** applied.
- **§F** — the nao `a`-model phrasing call, plus keeping deterministic templates as the fallback so
  a model outage degrades to plainer copy rather than to no card. **Session B's territory
  (`apps/nao/**`).**
- **A C9 ADR amendment** for paper-scoped synthesis (see Decided).
- **DB surfacing of `caveat`** — the field exists in the contract and artifact; a migration adding
  it to `edge_verifications` is not written, so a caveat does not yet reach a card.
- **Not started, deliberately** (owner-review checkpoint): #240, #179, #246, #275, #277 and both
  hackathon MVP goals.
- Non-provisional pricing for `gpt-5` and `agnes-2.5-flash` expires **2026-08-08**; after that the
  router fails closed, so any live batch run must precede that date or refresh pricing first.

## Blockers

- None for what landed. §F is territory-blocked, not technically blocked.

memory: none
