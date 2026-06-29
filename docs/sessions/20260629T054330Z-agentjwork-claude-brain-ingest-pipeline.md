# Session 20260629T054330Z — agentjwork — claude — brain-ingest-pipeline

> Session log format: **Attempted / Changed / Decided / Left / Blockers**.
> First step of any session: read the latest `docs/sessions/` files + run `node tools/context_sync.mjs --session-start`.

- **Device:** agentjwork · **Agent:** Claude Code (claude-opus-4-8[1m]) · **Branch:** feat/brain-ingest/pipeline-scaffold (cut from dev-phase2) · **Issue:** #23
- **Type:** Tooling. Build the paper-ingestion pipeline `tools/brain-ingest/` (design `docs/BRAIN-INGESTION-DESIGN.md` §10). Track B / W2 prerequisite ("once papers arrive").

## Attempted
Owner asked to (1) provision all ingestion prereqs (API keys, object storage), (2) lock the cost model,
(3) write the build plan, then (4) build the pipeline via an ultracode multi-agent workflow.

## Changed
- **`docs/BRAIN-INGESTION-DESIGN.md`**: added **§5.1 budget guardrails** (95% hard-stop on metered
  sources — OpenAlex $0.95/day, CORE 950/1000 tokens/day; persisted `usage.json`, UTC reset, resume-not-fail);
  corrected the **OpenAlex 2026 cost model** (OA-location is a $0 singleton / $0.0001 list call, NOT the
  $0.01 content endpoint — verified 2026-06-29); documented **bulk batched OA-location** (≤50 DOIs/list
  call, ~$0.004 for the whole corpus) with Unpaywall as the free fallback, and recorded that the CC0
  snapshot is deliberately *not* used at this scale; added **§10 Build sequence** (10.1–10.7).
- **`tools/brain-ingest/.env.example`**: committed template for every key + R2 creds (least-privilege
  Object R/W token; the standalone Cloudflare "Token value" is unused — S3 path uses key id + secret).
- **`tools/brain-ingest/` implementation** — built via a 24-agent ultracode workflow: 22 source files
  (config, types, CLI, `limits/{rateLimiter,budget}`, 5 discovery + 2 OA + 4 retrieval adapters,
  `identity`, `storage/r2`, `extract`, `seeds`, `manifest`, `run` orchestrator, `capture`), 24 test files,
  22 fixtures. Verified clean: `tsc --noEmit` 0 errors, **169/169 tests pass**, no live network (fixtures only).
  - **Adversarial review caught a critical `identity.ts` dedup bug** — the content fingerprint was added
    unconditionally, so two distinct papers sharing title+author+year but with different DOIs could be
    falsely merged into one `paper_uid`. Fixed (fingerprint only when no external id) + regression test.
  - Stripped a stray NUL byte an agent left in `identity.ts` (made ripgrep treat it as binary); re-verified clean.

## Decided
- Ingestion keys are **backend secrets** → live in gitignored `tools/brain-ingest/.env`, NEVER in
  `src/.env.public` (bundled into the APK). Template is `.env.example`, mirroring the `supabase/.env` pattern.
- **Bulk = batched API queries, not the snapshot.** OpenAlex list filters (≤50 DOIs/call) + Unpaywall
  fallback; per-request OpenAlex pricing is deterministic so the budget tracker sums real costs.
- Build via ultracode workflow produces **code + fixtures + tests, no live external calls**; verified
  with `tsc --noEmit`. Live smoke runs are an owner follow-up with real keys.
- `PaperRecord` stays a local `types.ts` interface until a DB/app consumes the manifest (§9 deferral).

## Left
- Owner to run live smoke runs (10.3/10.5 "Done when") with the real `.env` keys.
- Open PR into `dev-phase2` (not `main`) after review, linking #23.

## Blockers
- None. All required keys present (OpenAlex + R2); S2/Lens absent → those sources run anonymous/skipped.
