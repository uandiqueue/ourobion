---
title: Regenerate the Run 4 local runtime attestation after the #356 generate-insights change
summary: Re-recorded supabase/deploy-attestation.json through the record-attestation generator against a fresh live `supabase functions serve --debug --no-verify-jwt` probe of all four routes, clearing the generate-insights entrypoint/module-graph staleness that PR #356 introduced and that was failing `Run 4 release evidence` and the downstream `Run 4 Gate` on dev-phase2-run4 ahead of promotion to main.
type: session
scope: shared
status: canonical
updated: 2026-08-01
---

# Regenerate the Run 4 local runtime attestation (post-#356)

Branch: `ci/run4/regenerate-attestation-post356`; detached base and head parent:
`4ff4be3` = `origin/dev-phase2-run4` (merge of PR #356). Host UaNdIQueue, Windows, worktree
`.claude/worktrees/attest`. This is the same procedure as the post-#347 entry
(`20260801T160050Z-agent-j-claude-regenerate-attestation-post347.md`), re-run for a new drift.

No product behaviour changed. This entry only re-records evidence that an already-landed change
invalidated.

## Attempted

- Diagnosed the drift: PR #356 edited `supabase/functions/generate-insights/composer.ts`,
  `render.ts` and `index.ts`, so both `entrypointSha256` (the entrypoint file itself changed) and
  `moduleGraphSha256` (the graph rooted at it changed) for `generate-insights` no longer matched.
  Unlike the post-#347 entry there was **no** second drift: `RUN4_UNIT_BASE_SHA` is still
  `e0c6077dd887fe277a3468130f0c44c909a86875` (`tools/run4_release_gate.mjs:122`), so
  `provenance.unitBaseSha` was already correct and is untouched here.
- Brought up the local stack, ran the pinned local serve command **verbatim**, probed all four
  routes unauthenticated, and re-recorded the manifest through
  `node tools/run4_release_gate.mjs record-attestation`. Nothing was hand-edited.
- Verified the result with the gate itself (`attest`), not with the generator's exit code.

## Changed

- `supabase/deploy-attestation.json` — regenerated. The diff is **exactly two lines**, both inside
  the `generate-insights` record:
  - `entrypointSha256` `df082ee3…` → `d5a2096f870c4f3249fe198be06502b18dabc0eb9bdd58612366febdb4eccd68`
  - `moduleGraphSha256` `409b4c6f…` → `58c17e1a744dde086815d0a62fae3dd2c5579cfb41a919ca7dd306cc60d320bc`

  `configSha256` (`9dcc18f4…`), `lockSha256` (`47cf575c…`), every `provenance.*` field, and every
  hash for `compute-baselines`, `evaluate-signals` and `run-pipeline` reproduce byte-identically —
  independent evidence that only `generate-insights` drifted, which is exactly what a change
  confined to that function's own module subtree should produce. `scope: local-only`,
  `hostedDeployParityClaimed: false` and `productCapAcceptanceClaimed: false` are unchanged; no
  hosted parity and no product-cap acceptance is claimed by this entry.

Nothing else. No constant in `tools/run4_release_gate.mjs`, no workflow, no function source.

## Decided

- **The route evidence is a live probe, not a replay.** The four `bodySha256` values are again
  identical to the previously recorded ones, which could look like a copy — it is not. Each was
  computed from a response body read off this run's listener, and the identity is the designed
  no-oracle property of `_shared/internal_auth.ts` (`UNAUTHORIZED_BODY = "Unauthorized"`, one 401
  for every denial reason). The corroborating evidence that the handlers were actually entered is
  in the serve log: exactly four `[Error] internal auth denied: missing` lines, one per route,
  emitted by the handlers' own `console.error` — a gateway-level rejection could not produce those.
- **The body hash was taken with the gate's own `hashTextEvidence`,** imported from
  `tools/run4_release_gate.mjs` rather than reimplemented, so the CRLF→LF normalisation matches the
  gate's byte for byte. `hashTextEvidence("Unauthorized")` was printed alongside and equals the
  recorded value.
- **`record-attestation` does not generate module graphs; `attest` does.** `graph-hashes` had to be
  run first to populate `--graph-dir`, or `collectCurrentFunctionEvidence` fails on a missing graph.
  The module-graph hashes are therefore produced twice from two separate `deno info --frozen` passes
  (once for the record, once by `attest`'s own `generateGraphs`) and agreed — a free reproducibility
  check that is worth keeping in this order deliberately.
- **`--routes-json` is unusable from PowerShell; `--routes-base64` is the reliable path.** Passing
  the JSON array as a bare argument had its inner double quotes stripped by PowerShell's native-
  command argument handling and the generator rejected it (`invalid route evidence JSON`). The gate
  already accepts `--routes-base64` (base64url) for exactly this reason; the probe writes the array
  to a file and it is encoded from that. This is an encoding change only — the same bytes the probe
  produced reach the generator.

## Verification actually run

Observed tool versions, all matching the pinned constants exactly:

- Repository-local Supabase CLI **2.81.2** (`node_modules/supabase/bin/supabase.exe` — the real
  `.exe`; `execFileSync` cannot invoke the `.cmd` shim). The CLI prints an upgrade notice to
  v2.111.0 on every invocation; the pin is deliberate and was not taken.
- **`deno 2.8.1`** (`node_modules/deno/deno.exe`). Node v26.3.0.
- Serve startup reported `supabase-edge-runtime-1.71.0 (compatible with Deno v2.1.4)` and
  `verifyJWT: false` for all four functions — matching the probe constants
  `edgeRuntimeVersion: 1.71.0` / `compatibleDenoVersion: 2.1.4`.

Serve command, run verbatim from the worktree root so the pinned relative path is correct:
`node_modules/.bin/supabase functions serve --debug --no-verify-jwt`. As before this requires the
local stack to already be up, so `supabase start -x …` was run first (excluding studio, logflare,
vector, imgproxy, storage-api, mailpit, realtime, edge-runtime, supavisor, pgbouncer). The worktree
has no `node_modules` of its own; a directory junction to the main checkout's was created for the
run and removed afterwards.

Unauthenticated `POST {}` to each route, no `X-Ourobion-Internal-Secret` header:

```
compute-baselines  status=401  body="Unauthorized"  sha256=d089c8a9fc28e4e50223eb38c9409e362521be9380a37341304fbac7a4cd9e5f
evaluate-signals   status=401  body="Unauthorized"  sha256=d089c8a9fc28e4e50223eb38c9409e362521be9380a37341304fbac7a4cd9e5f
generate-insights  status=401  body="Unauthorized"  sha256=d089c8a9fc28e4e50223eb38c9409e362521be9380a37341304fbac7a4cd9e5f
run-pipeline       status=401  body="Unauthorized"  sha256=d089c8a9fc28e4e50223eb38c9409e362521be9380a37341304fbac7a4cd9e5f
```

- `node tools/run4_release_gate.mjs attest --graph-dir … --deno … --supabase-cli …` →
  **`run4 local runtime attestation: PASS`**. This is the acceptance signal for this entry;
  `record-attestation` exiting 0 was not treated as one.
- `context_sync.mjs --check` and `git diff --check` clean.
- The serve process was stopped, the orphaned `supabase_edge_runtime_ourobion` container removed,
  and `supabase stop` run to return the host to its as-found state (only two long-exited
  `supabase_vector_*` containers were present before this session, and they are still the only
  ones). Docker Desktop server 29.4.3.
- **No provider calls this session.** Spend unchanged.

## Left

- Open PRs off `dev-phase2-run4` must re-run CI after this lands; `Run 4 release evidence` and the
  downstream `Run 4 Gate` were failing on the branch through the inherited manifest, not through
  their own diffs. Promotion to `main` should wait for a green gate on the branch tip that contains
  this commit.
- Nothing about this entry advances a unit base or accepts a cap. Any future edit to a function
  entrypoint or its module subtree, and any future base advance, will invalidate the manifest again
  and will need its own live probe — it is structurally re-recordable but never inheritable.

## Blockers

- None for this unit.

memory: regenerating the Run 4 attestation is now a recurring chore, not a one-off — any PR touching
a `supabase/functions/*` subtree silently invalidates that function's `entrypointSha256` /
`moduleGraphSha256` and reds the branch gate; pass route evidence as `--routes-base64` because
PowerShell strips the inner quotes from `--routes-json`, and treat only `attest` printing PASS as
the signal.
