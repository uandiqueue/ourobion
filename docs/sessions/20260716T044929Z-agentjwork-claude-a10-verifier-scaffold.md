# Session 20260716T044929Z — agentjwork — claude — a10-verifier-scaffold

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (Fable 5, build session U11) · **Branch:**
  `feat/brain/a10-verifier-scaffold` (cut from `feat/brain/a8-synthesis`) ·
  **Issue:** run chain (orchestrator opens PR)
- **Type:** brain pipeline — **A10 adversarial verifier scaffold** (insight-engine-architecture §A10;
  docs/memory/0012; brain-synthesis-design). The decorrelated second-LLM pass that re-checks every
  synthesised `RelationshipClaim` (U10) against **freshly, independently retrieved** evidence and
  emits schema-enforced `EdgeVerification` artifacts (`edges/verifications.jsonl`, the A11 edge-loader
  input, U8). **Real verifier runs are BLOCKED** on a non-Anthropic API key (run decision D4,
  register B5) — this session ships the COMPLETE scaffold (fixture/unit-tested) plus the
  deterministic retrieval half, and proves the artifact end-to-end through the live loader with a
  clearly-labelled MOCK verdict.

## Attempted
- New verifier surface inside the existing `tools/brain-ingest/src/verify/` module (which already held
  the U4 A9 `quoteCheck`): deterministic verifier-owned retrieval (corpus BM25-lite + injectable
  external-fresh via the tested discovery adapters), C7 budget triage, the refute-first versioned
  prompt, strict post-enforcement of the schema invariants over the UNTRUSTED LLM reply, the
  append-safe `edges/verifications.jsonl` artifact, a `verify` CLI verb, a 21-test suite, and a live
  loader-join proof into a real local Postgres using a MOCK verdict (LLM mocked; no API key spent).

## Changed
- `tools/brain-ingest/src/verify/` (extended — the A9 `quoteCheck.ts` was already here from U4):
  - `types.ts` (NEW) — structural mirrors of the verification half of `shared/brain/relationships.ts`
    (`VerifyRecord`/`VerifyCitation`/verdict+tier enums) + module types (`TriageConfig`/`TriageDecision`,
    `CorpusDoc`/`RankedDoc`/`RetrievalResult`). House pattern: NO static `shared/` import; the REAL zod
    gate is loaded at runtime.
  - `triage.ts` (NEW) — C7 budget triage. `decideTriage(claim, config)` → `full` when the claim is
    **high-impact OR low-corroboration**, else `quoteCheck-only`. `DEFAULT_TRIAGE_CONFIG` =
    `{ fullRetrievalImpactTiers:['high'], lowCorroborationThreshold:2 }`. Pure/deterministic.
  - `retrieval.ts` (NEW) — the verifier's OWN search. (1) corpus-internal **BM25-lite** rank over
    `CorpusDoc` texts (`rankCorpus`, deterministic: score desc, paperId tie-break); `claimQueryTerms`
    builds the query from metric tokens (via synth `defaultTermsForKeys`) + population keywords.
    (2) external-fresh `retrieveExternal` reuses the tested Crossref/Europe PMC `DiscoverFn` adapters
    through a live `SourceCtx` (rate-limited), injectable so tests stay offline. Both rungs
    **echo-controlled** (the claim's own citations are excluded). `retrieveForClaim` assembles the
    `independentRetrieval` block; retrieval is **stance-neutral** (candidates carry `stance:'mentions'`
    — support/contradiction is the LLM's call, re-derived in enforcement).
  - `prompt.ts` (NEW) — `VERIFIER_PROMPT_VERSION` `verifier-2026-07-16.1`; refute-first system prompt
    (judge ONLY the retrieved sources, hunt contradiction, default `uncertain`), full strict-JSON
    contract restated inline.
  - `enforce.ts` (NEW) — post-enforcement over the untrusted reply. Applies LLM stances ONLY to
    retrieved sources (cannot invent one), re-derives corroboration, and enforces: no retrieval ⇒
    verdict FORCED `uncertain`; `supported`/`partial` with 0 supporting ⇒ REJECT; `contradicted` with
    0 contradicting ⇒ REJECT; then the shared zod `validateVerification` hard-gate. `evidenceTier` =
    strongest supporting source's tier (structural, not LLM-trusted). `buildQuoteOnlyRecord` = the
    cheap uncertain rung.
  - `load.ts` (NEW) — runtime `loadVerificationValidator` (dynamic `import()` of shared, mirrors
    `synth/load.ts`).
  - `artifact.ts` (NEW) — append-safe `edges/verifications.jsonl` (local mirror + opt-in R2). Dedupe
    key = `(edgeId, verifiedAt)` — EXACTLY the loader's `on conflict (edge_id, verified_at) do nothing`.
  - `verifier.ts` (NEW) — orchestration + barrel: A9 quoteCheck (embedded verbatim) → triage →
    [full] retrieval → prompt → router node `verifier` → parse → enforce (with one retry → uncertain
    fallback, §A10 failure mode 7) → append. Injectable router/loader/validator/clock. `verify()` full
    run + `loadClaimsFromText/File`.
- `tools/brain-ingest/src/cli.ts` — `verify [--from-claims <path>] [--edge <edgeId>] [--dry-run]
  [--triage-only]` verb (`--triage-only`/`--dry-run` make no LLM call; a real run constructs the
  `LlmRouter` whose config enforces the non-Anthropic decorrelation invariant).
- `tools/brain-ingest/tests/verify.test.ts` (NEW) — 21 tests (see Blockers).

## Decided
(design-doc-silent points, per session spec)
- **Retrieval is interim (pre-A6), recorded.** A6's co-occurrence index + `refGraph` citation-root
  clustering don't exist yet. The corpus-internal rung is a deterministic BM25-lite over
  caller-supplied `CorpusDoc`s (title+text), and corroboration counts are raw stance tallies (NOT yet
  clustered by independent citation lineage — that lands with A4b/A6). External-fresh reuses the
  existing discovery adapters as designed. The pure ranking + enforcement are what this session
  fixture-tests; real corpus wiring (manifest→CorpusDoc) and live external calls await A6 + the key.
- **Retrieval decides SEARCH, not STANCE.** Retrieved candidates are `stance:'mentions'`; the verifier
  LLM assigns support/refute, and enforcement re-derives corroboration from those stances **only over
  sources we retrieved** — the LLM cannot invent a source to justify a verdict.
- **Enforcement REJECTS rather than silently downgrades** a verdict unsupported by the recomputed
  corroboration (`supported`-with-0-supporting, `contradicted`-with-0-contradicting); the orchestrator
  retries once then writes the safe `uncertain` fallback. No-retrieval is the one case that is
  force-mutated to `uncertain` (the core §A10 grounding invariant).
- **`quoteCheck`-only rung is a real, cheap record** — `verdict:uncertain`, `performed:false`, empty
  corroboration, no LLM spend — the correct safe default for a well-corroborated, low-impact edge
  (never served; re-run when budget/impact warrants).
- **MOCK provenance handling (route constraint, memory 0012/0013).** The verifier MUST NOT run via the
  local-agent (Anthropic-family) route in production semantics — decorrelation. This session issued NO
  local-agent verifier smoke; the live proof used a **mocked router** (no route dispatched, no key),
  and the produced verification's `verifierModel` is stamped
  `MOCK:mock-router (NOT a real verifier verdict)`. It was written ONLY to a scratchpad temp edges dir
  (NEVER `data/corpus/edges/`) and pruned from the DB after the proof — no mock verdict persists in the
  truth tier or the artifact dir.

## Live loader-join proof (real Postgres; LLM mocked)
- Local Supabase up; DB `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Cleaned the edge
  tables to a **claims-only baseline** (`truncate public.relationship_claims cascade` → claims 0,
  verifications 0, verified 0) — equivalent clean state to a db reset without reseeding the whole stack.
- Generated ONE MOCK `EdgeVerification` for U10's **real** claim `gut_comfort_score|correlates|mood_score`
  via `verifyClaim` with a mocked router (verdict `supported`, one retrieved corpus source marked
  `supports`, quoteCheck passed against synthetic text carrying the real quotes).
- `edge-loader --from-dir <tmp> --dry-run` →
  `✓ 1 claim(s) + 1 verification(s) valid` · `gut_comfort_score|correlates|mood_score → mid @ 0.576
  (supported, 2026-07-16T12:00:00.000Z)`.
- **State 1 (load claim + MOCK verification):** loader `store now holds 1 claim(s), 1 verification(s),
  1 verified edge(s)`. `select … from public.verified_edges` →
  `{ edge_id: gut_comfort_score|correlates|mood_score, verdict: supported, edge_score: 0.576,
  serving_band: mid, verifier_model: "MOCK:mock-router (NOT a real verifier verdict)" }`.
- **State 2 (remove MOCK verification, reload):** emptied `verifications.jsonl` → loader
  `pruned 0 claim(s) + 1 verification(s)` · `store now holds 1 claim(s), 0 verification(s), 0 verified
  edge(s)`. `verified_edges` count = **0**; the claim row **remains** in `relationship_claims`
  (claims-only, `no active verification — not servable`). The edge drops out exactly as designed.

## Left
- **Real verifier runs need: (a) the non-Anthropic API key (B5) provisioned + the `verifier` node
  flipped to `api_worker`, and (b) a chosen model id.** The config already pins `verifier: gpt-5`
  (OpenAI family) and the loader-time decorrelation invariant refuses any same-family/Anthropic
  verifier — so the only unblockers are the key + confirming/adjusting the model id. Route is
  `local_agent` in the checked-in config today; a real run requires the one-line flip to `api_worker`
  AND the key (the local-agent route would violate decorrelation, so it is deliberately NOT used).
- **A6 corpus index + A4b refGraph:** replaces the interim BM25-lite corpus rung and enables
  independent-citation-root corroboration clustering (echo control beyond exact-id).
- Manifest→`CorpusDoc` wiring + live external retrieval are implemented behind injectable seams but
  not exercised for real this session (no A6 index; external calls await a metered run).
- CI does not run node tool-package tests (same known gap as brain-ingest/synth/rules) — orchestrator note.

## Blockers
- None for the scaffold. Gate: brain-ingest **320/320** (299 prior + 21 new) + `tsc --noEmit` clean ·
  shared `npx tsc --noEmit` clean · edge-loader **21/21** + accepts and joins the MOCK artifact to the
  real claim (dry-run + live DB, both serving states) · `flutter analyze` clean + `flutter test`
  **46/46** · `context_sync --fix-index` + `--check` pass · flutter generated-file churn reverted.
- New verify tests cover: retrieval determinism + BM25 ranking sanity + echo control; `claimQueryTerms`;
  triage boundaries (high-impact / low-corroboration / threshold=0 / threshold==count); refute-first
  prompt assembly (+ zero-source path); post-enforcement (no-retrieval⇒uncertain;
  supported-with-0-supporting⇒reject; contradicted-with-0-contradicting⇒reject; LLM-can't-invent-sources;
  quoteCheck embedded verbatim; valid supported passes with strongest-supporting evidenceTier);
  quoteCheck-only rung; quoteCheck-fail rejects with no LLM spend; full mocked-router end-to-end through
  the REAL shared `validateVerification`; artifact `(edgeId, verifiedAt)` dedupe.

memory: none
