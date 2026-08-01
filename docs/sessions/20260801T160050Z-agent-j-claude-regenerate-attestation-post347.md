---
title: Regenerate the Run 4 local runtime attestation after the #351 base advance and the #347 generate-insights change
summary: Re-recorded supabase/deploy-attestation.json through the record-attestation generator against a fresh live `supabase functions serve --debug --no-verify-jwt` probe of all four routes, clearing the two independent staleness failures (provenance unitBaseSha behind PR #351, generate-insights entrypoint/module-graph hashes behind PR #347) that were failing the `Run 4 release evidence` job on every PR off dev-phase2-run4.
type: session
scope: shared
status: canonical
updated: 2026-08-01
---

# Regenerate the Run 4 local runtime attestation (post-#347, post-#351)

Branch: `ci/run4/regenerate-attestation-post347`; detached base and head parent:
`f132cc1` = `origin/dev-phase2-run4` (merge of PR #349). Host UaNdIQueue, Windows, worktree
`.claude/worktrees/attest`.

No product behaviour changed. This entry only re-records evidence that already-landed changes
invalidated.

## Attempted

- Diagnosed the two independent drifts the gate was reporting: `provenance.unitBaseSha` still held
  `9867bae92038b33b262732ac8255b9144409f638` while PR #351 advanced `RUN4_UNIT_BASE_SHA` to
  `e0c6077dd887fe277a3468130f0c44c909a86875` (`tools/run4_release_gate.mjs:1046`), and
  `generate-insights`'s `entrypointSha256` was behind PR #347's edit to
  `supabase/functions/generate-insights/index.ts` (`:1061`).
- Brought up the local stack and ran the pinned local serve command **verbatim**, probed all four
  routes unauthenticated, and re-recorded the manifest through
  `node tools/run4_release_gate.mjs record-attestation`. Nothing was hand-edited.
- Verified the result with the gate itself (`attest`), not with the generator's exit code.

## Changed

- `supabase/deploy-attestation.json` — regenerated. The diff is **exactly three lines**:
  - `provenance.unitBaseSha` `9867bae9…` → `e0c6077d…`
  - `generate-insights.entrypointSha256` `76bcad72…` → `df082ee3…`
  - `generate-insights.moduleGraphSha256` `dd923f68…` → `409b4c6f…`

  `configSha256` (`9dcc18f4…`), `lockSha256` (`47cf575c…`) and every hash for `compute-baselines`,
  `evaluate-signals` and `run-pipeline` reproduce byte-identically — independent evidence that only
  `generate-insights` drifted, which is exactly what a change confined to that entrypoint should
  produce. `scope: local-only`, `hostedDeployParityClaimed: false` and
  `productCapAcceptanceClaimed: false` are unchanged; no hosted parity and no product-cap acceptance
  is claimed by this entry.

Nothing else. No constant in `tools/run4_release_gate.mjs`, no workflow, no function source.

## Decided

- **The route evidence is a live probe, not a replay.** The four `bodySha256` values are identical
  to the previously recorded ones, which could look like a copy — it is not. Each was computed from
  a response body read off this run's listener, and the identity is the designed no-oracle property
  of `_shared/internal_auth.ts` (`UNAUTHORIZED_BODY = "Unauthorized"`, one 401 for every denial
  reason). The corroborating evidence that the handlers were actually entered is in the serve log:
  exactly four `[Error] internal auth denied: missing` lines, one per route, emitted by the
  handlers' own `console.error` — a gateway-level rejection could not produce those.
- **The body hash was taken with the gate's own `hashTextEvidence`,** imported from
  `tools/run4_release_gate.mjs` rather than reimplemented, so the CRLF→LF normalisation matches the
  gate's byte for byte. `hashTextEvidence("Unauthorized")` was printed alongside and equals the
  recorded value.
- **`record-attestation` does not generate module graphs; `attest` does.** `graph-hashes` had to be
  run first to populate `--graph-dir`, or `collectCurrentFunctionEvidence` fails on a missing graph.
  This means the module-graph hashes are produced twice from two separate `deno info --frozen`
  passes (once for the record, once by `attest`'s own `generateGraphs`) and agreed — a free
  reproducibility check that is worth keeping in this order deliberately.

## Verification actually run

Observed tool versions, all matching the pinned constants exactly:

- Repository-local Supabase CLI **2.81.2** (`node_modules/supabase/bin/supabase.exe` — the real
  `.exe`; `execFileSync` cannot invoke the `.cmd` shim).
- **`deno 2.8.1`** (`node_modules/deno/deno.exe`).
- Serve startup reported `supabase-edge-runtime-1.71.0 (compatible with Deno v2.1.4)` and
  `verifyJWT: false` for all four functions — matching the probe constants
  `edgeRuntimeVersion: 1.71.0` / `compatibleDenoVersion: 2.1.4`.

Serve command, run verbatim from the worktree root so the pinned relative path is correct:
`node_modules/.bin/supabase functions serve --debug --no-verify-jwt`. It first refused with
`supabase start is not running`, so the local stack was started (`-x` excluding studio, logflare,
vector, imgproxy, storage-api, mailpit, realtime, edge-runtime, supavisor, pgbouncer — five
containers: db, kong, auth, rest, pg_meta).

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
- `context_sync.mjs --check` and `git diff --check` clean (see Left for what was regenerated).
- The serve process was stopped, the orphaned `supabase_edge_runtime_ourobion` container removed,
  and `supabase stop` run to return the host to its as-found state (no containers were running
  before this session). Docker Desktop server 29.4.3.
- **No provider calls this session.** Spend unchanged.

## Left

- Open PRs off `dev-phase2-run4` must re-run CI after this lands; the `Run 4 release evidence` job
  was failing on every one of them through the inherited manifest, not through their own diffs.
- Nothing about this entry advances a unit base or accepts a cap. The next base advance will
  invalidate `provenance.unitBaseSha` again and will need its own live probe — the manifest is
  structurally re-recordable but never inheritable.

## Blockers

- None for this unit.

memory: `functions serve` refuses outright with `supabase start is not running` — the local runtime
attestation cannot be re-recorded without first bringing up the stack (a lean `supabase start -x …`
of db/kong/auth/rest/pg_meta is enough), and a worktree needs `node_modules` present (a directory
junction to the main checkout's is sufficient) because the pinned serve command is a relative path.
