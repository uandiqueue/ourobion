---
title: "Run 2.0 U3 — contract hardening: servable band requires passing quote check (O17) + derivation copy-gate (O20)"
summary: "Added the O17 superRefine clause to the shared edgeVerificationSchema (servable verdicts require spansFound >= 1 && allPresent === true), copy-gated RelationshipClaim.derivation at both the synthesis post-process and the edge-loader ingestion seam (O20), with loader-seam acceptance tests proven by mutation check. Gates green: shared/brain-ingest/edge-loader tsc, 340 + 50 tests, context_sync."
type: session
scope: shared
status: canonical
updated: 2026-07-24
---

# Run 2.0 U3 — contract hardening (O17 + O20; verdict B3 + H3)

Branch `feat/phase2-run-2/u3-contract-hardening` off `feat/phase2-run-2/u2-verifier-grounding`
(stacked PR chain). Executes the locked decisions in
`docs/temp/next-build-optimizations.md` §O17 and §O20.

## What was done

### O17 — servable band requires a passing quote check [B8: touches shared/]

- `shared/brain/relationships.schema.ts` — new `edgeVerificationSchema.superRefine` clause: a
  SERVABLE verdict (`supported` / `partial`, mirroring `shared/brain/index.ts` SERVABLE_VERDICTS)
  requires `quoteCheck.spansFound >= 1 && quoteCheck.allPresent === true`. Conditional on the
  verdict, so zero-span `uncertain` / `unsupported` / `contradicted` records remain valid
  (intentionally retained, per A3).
- Band side NOT touched: the edge-loader validates every verification line through
  `validateVerification` before `servingBand` ever runs, so the schema clause makes a
  quote-check-failed servable record unloadable — the primary fix per the brief's condition
  ("only touch index.ts if a quote-check-failed record can still reach a servable band through
  the loader path" — it cannot).
- Acceptance (iii) loader-seam tests in `tools/edge-loader/tests/edge_artifacts.test.ts`:
  `partial` + `{0,0,false}` and `supported` + `{1,3,false}` both fail validation with a
  line-numbered error AND produce zero verification rows (a fortiori never a servable band row);
  a passing-quoteCheck servable fixture still bands `mid` (no over-blocking).
  **Mutation check:** with the schema clause + loader copy-gate stashed, the three new
  hard-fail tests fail (0 errors where 1 expected); restored, all pass.
- The pre-O17 A3 zero-span-accept test was retargeted from the `partial` fixture record to the
  `uncertain` one — the `{0,0,false}` encoding must still validate, but (since O17) only on a
  non-servable verdict. No invariant weakened; A3's producer-encoding guarantee is preserved on
  its honest carrier.

### O20 — copy-gate `derivation` at production AND load

- Production seam (`tools/brain-ingest/src/synth/`): `postprocess.ts` gains gate step (8) —
  after the zod hard-gate and A9 quoteCheck, `derivation` must pass the shared
  `validateCopyString`; failure rejects the claim with new `RejectionReason` `'copy-gate'`
  (flows to the existing rejected-claims log like every other rejection). The validator is
  injected via `ProcessContext.validateCopy`, loaded at runtime by `load.ts loadCopyValidator()`
  (house pattern: shared/ stays out of the package's static type graph, mirror of
  `loadClaimValidator`). `synth/index.ts` wires the default + `SynthesizeOptions.validateCopy`
  injection point and re-exports both.
- Load seam (`tools/edge-loader/lib/artifacts.mjs`): `parseClaims` re-checks
  `validateCopyString(record.derivation)` and pushes a line-numbered HARD-FAIL error (the
  loader's existing invalid-artifact convention), import via the existing `sharedUrl` tsx
  runtime-import (same as `tools/rules/lib/blueprints.mjs`).
- Tests at BOTH seams: forbidden-language derivation rejected; benign boundary words
  ("preconditioning", "stillness", "mistreatment" — words containing banned substrings that
  word-boundary logic must allow, mirroring `tools/rules/tests/copy_guidelines.test.ts`
  TRUE_NEGATIVES) pass.

### Parity

- No Dart mirror of the brain contract exists (re-verified: no `edgeVerification` /
  `relationshipClaim` hits under `apps/biotope`), so nothing to sync for O17.
- `shared/constants/copy_guidelines.{ts,dart}` untouched — the Dart parity guard is unaffected.

## Gate summary (all green)

- `shared`: `npx tsc --noEmit` — exit 0
- `tools/edge-loader`: `npx tsc --noEmit` exit 0; `npm test` 50/50 pass
- `tools/brain-ingest`: `npx tsc --noEmit` exit 0; `npm test` 340/340 pass (baseline 338 + 2 new)
- repo root: `node tools/context_sync.mjs --check` — passed
- NUL-byte check on all written files: clean; `git diff --stat` shows no Bin entries

memory: U3 shipped O17 (servable verdict ⇒ passing quoteCheck, in the shared schema [B8]) + O20 (derivation copy-gate at synth post-process AND edge-loader ingestion); loader-seam tests mutation-proven; band side (shared/brain/index.ts) intentionally untouched — loader validation makes bad records unloadable.
