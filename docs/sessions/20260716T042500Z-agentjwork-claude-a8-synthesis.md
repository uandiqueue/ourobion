# Session 20260716T042500Z — agentjwork — claude — a8-synthesis

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, build session U10) · **Branch:**
  `feat/brain/a8-synthesis` (cut from `feat/brain/agentic-seeder`) ·
  **Issue:** run chain (orchestrator opens PR)
- **Type:** brain pipeline — **A8 synthesis** (insight-engine-architecture §A8; brain-synthesis-design).
  The LLM node that reads paper canonical text and proposes `RelationshipClaim`s (with verbatim
  `quoteSpans` + `derivation`), gated by the deterministic A9 `quoteCheck` (U4) before anything is
  written to `edges/claims.jsonl` (the A11 edge-loader's input, U8).

## Attempted
- New `tools/brain-ingest/src/synth/` module: deterministic input assembly (candidate pair + paper
  uid(s) → load `text/<uid>.txt` → cheap passage prefilter → versioned prompt) → `synthesis` router
  call (local_agent mailbox) → post-processing GATE (validateClaim + A9 quoteCheck + pair /
  foreign-paper checks; edgeId normalization; offset backfill) → append-safe `edges/claims.jsonl`.
  A `synthesize` CLI verb, tests, and a REAL local-agent run fulfilled by this session over real R2
  paper text, then proven through `edge-loader --from-dir --dry-run`.

## Changed
- `tools/brain-ingest/src/synth/` (NEW):
  - `types.ts` — structural mirrors of `shared/brain/relationships.ts` (`SynthClaim`/`SynthCitation`/
    `SynthQuoteSpan`) + module types (`SynthPair`, `Passage`, `AssembledSynthesisInput`,
    `RejectionReason`, `ProcessResult`). House pattern: this package does NOT statically import
    `shared/` (matches `verify/quoteCheck.ts` + `seeder/`); the REAL zod gate is loaded at runtime.
  - `passages.ts` — PURE `segmentSentences` (offset-carrying) + `selectPassages(text, terms)`:
    sentence hits by term match → ±1 context → merge overlaps → rank by term-coverage → cap →
    re-sort by position. Offsets slice back verbatim so a copied quote round-trips A9. Plus
    `defaultTermsForKeys` (snake_case tokens minus a unit/suffix stoplist) as a weak fallback.
  - `prompt.ts` — `PROMPT_VERSION` `synthesis-2026-07-16.1`; strict adversary-aware contract
    (propose ONLY the asked pair; ground EVERY claim in a verbatim quote; cite ONLY provided uids;
    weakest relation/claimKind the quote licenses; empty array when unsupported), full JSON shape
    restated inline (self-describing request file).
  - `load.ts` — runtime loaders (dynamic `import()`, mirrors `seeder/load.ts`): `loadClaimValidator`
    (shared `validateClaim`) + `loadActiveMetricKeys` (shared/metrics active set, fail-fast on a bad
    `--pair` endpoint).
  - `postprocess.ts` — the GATE (untrusted reply; first failure wins, logged): parse → force
    `edgeId = subject|relation|object` → unrequested-pair reject (C9) → foreign-paper reject →
    backfill charStart/charEnd from A9's computed offsets → shared `validateClaim` → A9 `quoteCheck`
    `allPresent` reject. Provenance stamped by the pipeline, never the model.
  - `artifact.ts` — append-safe `edges/claims.jsonl` (local mirror `data/corpus/edges/`, same
    basename as R2 `edges/claims.jsonl`) + `appendClaimsToR2` (opt-in dual-mode). Dedupe key =
    `edgeId ⊕ promptVersion ⊕ sorted-citation-paperIds`.
  - `index.ts` — pair resolution (`--pair` / `--from-seed-artifact`), `loadPaperTexts`,
    `assembleSynthesisInput`, `synthesize` (injectable router/loader/validator/active-keys/clock),
    barrel.
- `tools/brain-ingest/src/cli.ts` — `synthesize (--pair a,b | --from-seed-artifact) --paper
  <uid>[,<uid>] [--terms t1,t2] [--dry-run] [--push-r2]` verb.
- `tools/brain-ingest/tests/synth.test.ts` — 13 tests (assembly determinism + offset round-trip;
  post-processing: valid pass / edgeId-normalize / offset-backfill / fabricated-quote reject /
  unrequested-pair reject / foreign-paper reject / schema-invalid reject / unparseable-throw +
  empty-array-ok; artifact dedupe + append idempotency; mocked-router end-to-end using the REAL
  shared `validateClaim`; inactive-endpoint reject).

## Decided
(design-doc-silent points, per session spec)
- **Interim scope (recorded):** A4–A7 (structure v2, tiering, mention tagging, assertion gate) are
  LATER sessions. A8 here reads the extracted canonical text directly (`text/<uid>.txt`) and does a
  **cheap deterministic passage prefilter** (sentence windowing over caller-supplied `terms`). The
  proper mention tagging — A6's `METRIC_TERMS`-driven co-occurrence over `finding`+`asserted`
  sentences — replaces it later; until then the prefilter is only as good as `--terms`, and the
  synonym expansion a snake_case key can't provide is supplied by the operator.
- **Seed-artifact candidate pairs aren't literature-groundable physiological edges yet.** The U9
  `seed-queries.json` pairs are `derivedFrom` (self-report adherence/variability meta) + static
  topics (empty metricKeys) — none maps to two distinct registry metrics with real cross-metric
  literature. That's expected: A6's mention-driven candidate enumeration (later) is what surfaces
  real metric pairs. So the A8 REAL run drove synthesis via an explicit **`--pair` curated-prior**
  gut-brain edge the corpus genuinely supports (C9 allows curated priors; the gut-brain axis is a
  C10 headline pairing). `--from-seed-artifact` is implemented + tested for when A6 lands.
- **edgeId is FORCED, never trusted** — normalized to `subject|relation|object` (index.ts:20-22)
  post-hoc; the model's edgeId is discarded.
- **Dedupe semantics:** union of the design's `(edgeId, promptVersion)` idempotency (§A8.6) and the
  brief's "edgeId + paper set" → same edge + same papers + same prompt = no-op; a promptVersion bump
  or new supporting paper appends a fresh line (loader upserts last-line-wins per edgeId).
- **Artifact home:** `data/corpus/edges/claims.jsonl` — the R2 `edges/` local mirror (gitignored
  under `data/corpus/`); a rebuildable projection (two-tier-truth), never committed. R2 write is
  **opt-in** (`--push-r2`) so a terminal/prepopulation run doesn't silently mutate the shared truth
  tier; kept local for this session (loader dry-run proof over the local dir).
- **Conservative synthesis call (C6/C9):** the accepted edge is `correlates` / `correlational`
  (weakest the bidirectional-review evidence licenses), population kept narrow (`IBS patients
  comorbid with anxiety and depression`), no fabricated effect size.

## R2 status
- `--check-config` OK (all required keys present); R2 **reachable** — pulled real `text/<uid>.txt`
  for several papers (constipation TCM, gut-brain iScience review, sleep-HRV RCTs, "Microbes in the
  Moonlight"). Manifest has 1232 records, ~56 with extracted text on the gut/microbiome/sleep-HRV
  topics. The real run used real R2 text (NOT fixtures).

## Real local-agent run (REAL exercise of the route)
- `npx tsx src/cli.ts synthesize --pair gut_comfort_score,mood_score --paper
  "doi:10.1016/j.isci.2026.116224" --terms "gut,IBS,gastrointestinal,abdominal,mood,anxiety,
  depression,microbiota"` wrote a `synthesis` mailbox request (12 passages, model hint
  `claude-sonnet-5`); THIS session fulfilled it (atomic tmp+rename, `model: claude-fable-5`) with
  two candidate claims — one carefully grounded, one deliberately over-reaching.
- **Gate outcome: 1 accepted, 1 rejected.**
  - REJECTED `gut_comfort_score|decreases|mood_score` → `quote-not-found: quoteCheck 0/1 present —
    span#1(doi:10.1016/j.isci.2026.116224): not-found` — a `causal` overstatement resting on a
    **paraphrased** quote ("CORT" rendered as "cortisol"). A9 caught the fabrication on real text
    before any verifier spend — exactly the cheap hallucination catch the design promises.
  - ACCEPTED `gut_comfort_score|correlates|mood_score` (pretty-printed, offsets backfilled by A9):
    ```json
    {
      "edgeId": "gut_comfort_score|correlates|mood_score",
      "subject": "gut_comfort_score", "object": "mood_score",
      "relation": "correlates", "claimKind": "correlational",
      "effect": { "size": null, "unit": null, "ci": null },
      "population": "IBS patients comorbid with anxiety and depression",
      "citations": [{
        "paperId": "doi:10.1016/j.isci.2026.116224",
        "title": "Unraveling the gut microbiota-brain axis: Mechanisms, pathophysiology, and therapeutic opportunities.",
        "year": 2026, "population": "IBS patients comorbid with anxiety and depression",
        "evidenceTier": 4, "impactTier": "high", "stance": "supports"
      }],
      "quoteSpans": [
        { "paperId": "doi:10.1016/j.isci.2026.116224",
          "quote": "In IBS, psychological stress activates the HPA axis, releasing CORT which affects gut motility and sensitivity, while dysbiotic microbiota independently generates neuroactive metabolites acting on the ENS, illustrating the bidirectional gut-brain nature of IBS pathophysiology.",
          "locator": "gut-brain axis / IBS pathophysiology", "charStart": 52301, "charEnd": 52578 },
        { "paperId": "doi:10.1016/j.isci.2026.116224",
          "quote": "A parallel RCT in IBS patients comorbid with anxiety and depression demonstrated that 12 weeks of oral FMT capsules significantly reduced both IBS severity scores and anxiety/depression scores compared to empty capsule controls, reinforcing the gut-brain-behavior connection in this population.",
          "locator": "therapeutic opportunities / FMT RCT", "charStart": 53297, "charEnd": 53591 }
      ],
      "derivation": "The review states the bidirectional gut-brain nature of IBS (Q1) and reports a parallel RCT in which an FMT intervention reduced both IBS severity scores and anxiety/depression scores together (Q2)... asserted as a correlation rather than a directed causal claim between the two subjective metrics... Strongest supporting evidence described is an RCT (tier 4), reported within a narrative review; scope kept narrow to the studied IBS population.",
      "synthesisModel": "claude-fable-5", "promptVersion": "synthesis-2026-07-16.1",
      "synthesisedAt": "2026-07-16T04:20:42.373Z"
    }
    ```
- Router **ledger line** (`data/llm-router/ledger.json`, gitignored):
  `days["2026-07-16"].synthesis = { calls: 1, inputTokens: 17445, outputTokens: 767, usd: 0.06384 }`
  (provisional sonnet-5 pricing; local_agent route).
- **Artifact → loader proof:** `node tools/edge-loader/load_edges.mjs --from-dir data/corpus/edges
  --dry-run` → `✓ 1 claim(s) + 0 verification(s) valid (shared/brain contract + active registry
  endpoints)` · `gut_comfort_score|correlates|mood_score → no active verification — not servable`
  (claims-without-verifications = valid early state per U8; the missing-verifications warning is
  expected).

## Left
- `--from-seed-artifact` yields real physiological metric-pair candidates only once A6's
  mention-driven co-occurrence enumeration lands; today it iterates the U9 derivedFrom pairs (which
  are adherence/variability meta) — implemented + tested, awaiting better candidates.
- Proper passage selection (A6 `METRIC_TERMS`, A7 assertion gate) replaces the cheap keyword
  prefilter in a later session.
- `api_worker` route for `synthesis` — one-line config flip once a key is provisioned (B5); the
  local_agent route is the real path today and was exercised for real.
- A10 verification (the second, adversarial, non-Anthropic pass) is a later session; the claim sits
  in the valid claims-only early state (not servable) until then.
- CI does not run node tool-package tests (same known gap as brain-ingest/rules) — orchestrator note.

## Blockers
- None. Gate: brain-ingest **299/299** (286 prior + 13 new) + `tsc --noEmit` clean · shared
  `npx tsc --noEmit` clean · `flutter analyze` + `flutter test` **46/46** · edge-loader dry-run
  accepts the artifact · `context_sync --fix-index` + `--check` pass · REAL local-agent run
  completed (real R2 text, verbatim-quote-grounded accepted claim + quoteCheck-caught rejection +
  ledger evidence).

memory: none
