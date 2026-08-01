---
title: "Run 2.0 U2 — ground the adversarial verifier (evidence-bearing citations, fixture corpus, CLI retrieve wiring)"
summary: >
  O15/verdict B1: extended the citation contract with bounded, provenance-addressable evidence
  passages; carried evidence through corpusHitToCitation/candidateToCitation; added a committed
  fixture corpus + a fail-loud JSONL loader; wired `brain-ingest verify --corpus <path>` to feed
  the verifier's own retrieval (and loud empty-corpus warning when omitted); rendered evidence +
  provenance in the verifier prompt (bumped VERIFIER_PROMPT_VERSION); added the mandatory
  integration test on the real CLI seam (fetch-level router stub, offline) plus unit tests.
type: session
scope: shared
status: canonical
updated: 2026-07-24
---

# Run 2.0 U2 — ground the adversarial verifier (O15 / verdict B1)

## Context
Baseline confirmed at the exact lines named in the brief: `runVerify` built runOpts without
`retrieve` (empty corpus, zero sources every real run); `VerifyCitation` had no evidence field;
`corpusHitToCitation`/`candidateToCitation` dropped `doc.text`/abstract; `sourceBlock` rendered
only paperId/year/tier/title; no committed fixture corpus existed. Locked decision (Jayden): the
verifier judges ONLY shown evidence — evidence text + provenance MUST reach the router request.

## What I did
1. **Contract (shared/, B8):** added `EvidencePassage { text; locator }` and an OPTIONAL,
   additive `evidence?: readonly EvidencePassage[]` on `Citation` (relationships.ts) + zod
   `evidencePassageSchema` and `citation.evidence` (relationships.schema.ts) with a new AssertExact
   guard. Optional-with-default discipline: legacy records without `evidence` still validate.
2. **Mirrors:** mirrored `VerifyEvidencePassage` + `VerifyCitation.evidence` in
   verify/types.ts.
3. **Carry evidence through (retrieval.ts):** `extractEvidencePassages()` selects matched-term
   sentences from a CorpusDoc's canonical text, best-first under a char budget
   (`DEFAULT_MAX_EVIDENCE_CHARS_PER_SOURCE = 700`, overridable via
   `RetrieveOptions.maxEvidenceCharsPerSource`), emitting `chars:<start>-<end>` locators into the
   doc text. `corpusHitToCitation` carries them; `candidateToCitation` carries a bounded abstract
   as `abstract:0-<n>` (no abstract → NO evidence, never fabricated).
4. **Fixture corpus + loader (corpus.ts):** committed `fixtures/verify-corpus.jsonl` (5 gut/mood
   CorpusDocs) + `fixtures/verify-claims.jsonl`; `loadCorpusFromFile/Text` parse JSONL fail-loudly
   (line-numbered errors, duplicate-paperId rejection, BOM tolerated). `corpusTexts()` maps
   paperId→text so corpus docs also serve the A9 quoteCheck.
5. **CLI wiring (cli.ts):** `verify --corpus <path>` loads the corpus → `runOpts.retrieve`
   + seeds `runOpts.texts`; without it, logs a loud empty-corpus warning. Added `--edges-dir`.
   `runQuoteCheck` now merges `texts` + `textLoader` (corpus covers held papers, R2 fills the rest).
   Guarded the module auto-run (`isDirectCliRun`) so importing `main` in tests no longer executes.
6. **Prompt (prompt.ts):** `sourceBlock` renders verbatim passages with `[paperId @ locator]`
   provenance; a passage-less source is marked ungroundable. Bumped
   `VERIFIER_PROMPT_VERSION` → `verifier-2026-07-24.1`.
7. **Tests:** acceptance test on the real CLI seam + evidence/loader/prompt unit tests.

## Acceptance test (i)
`tests/verify.cli.integration.test.ts` — "ACCEPTANCE (i): real CLI verify seam puts evidence TEXT +
provenance in the router request". Invokes `main(['verify','--from-claims',…,'--corpus',…,'--edge',
…,'--edges-dir',…])` (real argv → parseArgs → runVerify → `new LlmRouter()` → api_worker route),
stubs global `fetch` (offline), and asserts the captured OpenAI request body's user message contains
(a) retrieved evidence passage TEXT and (b) `corpus:<id> @ chars:<start>-<end>` provenance.
Mutation-checked: stripping evidence from `sourceBlock` makes it fail with
"the request must contain retrieved evidence TEXT".

## Gate output
- brain-ingest `npm run typecheck`: PASS (exit 0).
- brain-ingest `npm test`: PASS — 338/338.
- shared touched → `shared` `tsc --noEmit`: PASS (exit 0). AssertExact guard verified via
  edge-loader typecheck (static consumer of relationships.schema.ts): PASS; edge-loader tests 45/45.
  No Dart mirror exists for the brain contract (relationships.ts documents the deferral; no
  apps/biotope guard references it) → no flutter run needed.
- repo-root `node tools/context_sync.mjs --check`: PASS.
- `git diff --stat`: no `Bin`/NUL files.

## Flags
- **B8 (2-reviewer retro-review):** shared/ citation contract extended — `EvidencePassage` +
  `Citation.evidence` (optional/additive). Files: shared/brain/relationships.ts,
  shared/brain/relationships.schema.ts.

## Scope / not done
- No live web retrieval (next cycle per O15). No supabase/apps/edge-loader/seeder/quote-check-schema
  changes. Verifier still runs OpenAI-only TEST-MODE (U1) — verdicts are scaffolded + unit-tested,
  NOT independently verified.

memory: Run 2.0 U2 done — verifier grounded (evidence-bearing citations + fixture corpus + CLI --corpus wiring + evidence-in-prompt, prompt version verifier-2026-07-24.1); shared citation contract got optional additive `evidence` field → flag B8 retro-review; acceptance test on the real CLI seam (fetch-stubbed) asserts evidence text + provenance in the router request and is mutation-verified.
