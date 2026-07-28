---
title: R4-U4 attestation re-record and PR #214 auth-survival proof
summary: Merged the dev-phase2-run4 tip (with PR #214's internal-secret authorization rework) into the U4 branch, proved #214's auth changes survived the merge both statically and at runtime, and re-recorded the local-only runtime attestation through the generator against a fresh live serve probe so the last failing check on PR #199 clears.
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# R4-U4 attestation re-record and PR #214 auth-survival proof

Branch: `feat/brain/run4-u4-scientific-semantics` · PR #199 · issue #196

No product behaviour changed in this session. The U4 unit's own O27/O38 work (claim-kind
preservation, artifact trust, revision-bound dispositions, TS/Dart trust-label parity) was already
on the branch; this session integrated the moved base and regenerated the runtime attestation that
the base move and U4's own edge-function edits invalidated.

## Attempted

- Verified the live integration tip independently (`git rev-parse origin/dev-phase2-run4` →
  `da6b11b5df057fe6b5f5f6dcb14f13343805a94b`) rather than trusting a reported value, then **merged**
  it into the U4 branch (never rebased — the branch is pushed and other sessions reference it). The
  merge was clean; git reported no conflicts in any file.
- **Auth-survival verification, run before anything else.** PR #214 had just rewritten all four
  Supabase function entrypoints, `supabase/config.toml`, and `supabase/deploy-attestation.json` to
  move authorization onto the constant-time internal-secret verifier. U4 also edits
  `generate-insights/{index,composer,render}.ts`, so a badly-resolved merge could silently have
  reopened the authorization hole a 468-assertion harness was just run to close. Three independent
  proofs, all below in Verification: a whole-tree diff against the tip, a read of the merged handler,
  and a live runtime probe.
- Re-recorded the attestation through `record-attestation` (never hand-edited) against a **fresh**
  live `supabase functions serve --debug --no-verify-jwt` probe of all four routes.
- Ran the full local verify gate: attest, landing, `context_sync --check`, `flutter analyze`,
  `flutter test`, the `tools/rules` suite (including the four test files this unit adds), the
  TS/Dart trust-label parity guard, and `shared` `tsc --noEmit`.

## Changed

- Merge commit bringing `origin/dev-phase2-run4` @ `da6b11b` onto the U4 branch (38 files from the
  tip, chiefly PR #214's nao authorization / server-key boundary work).
- `supabase/deploy-attestation.json` — regenerated via `record-attestation`. The diff against the
  version #214 recorded is **exactly two lines**, both under `generate-insights`:
  `entrypointSha256` `b30045ad…` → `b5e50844…` and `moduleGraphSha256` `eaff12de…` → `882543db…`.
  `configSha256`, `lockSha256`, and all hashes for `compute-baselines`, `evaluate-signals` and
  `run-pipeline` are byte-identical to the recorded values — independent evidence that nothing but
  `generate-insights` drifted. `scope: local-only` and `hostedDeployParityClaimed: false` unchanged;
  no hosted parity is claimed.

Nothing else. `.github/workflows/ci.yml`, `tools/run4_release_gate*.mjs` and `RUN4_UNIT_BASE_SHA`
were not touched; `RUN4_UNIT_BASE_SHA` remains `2749381a405de882c6d96cdf21a57034e28204ea` as
advanced by PR #225.

## Decided

- **The merged `generate-insights` module graph legitimately moved, and only it.** U4's `render.ts`
  imports `shared/brain/trust_labels.ts`, which enters `generate-insights`'s Deno module graph and
  changes its hash. `run-pipeline` invokes its siblings over HTTP rather than importing them, and
  `evaluate-signals` is imported *by* `generate-insights` and not the reverse, so no sibling graph
  moves. The two-line manifest diff is exactly what the change should produce.
- **Kept the probe genuine, not a replay.** The recorded route evidence comes from an actual serve
  invocation against the merged tree, not from #214's manifest. That matters here beyond
  bookkeeping: it is also the runtime half of the auth-survival proof, because it exercises U4's own
  merged `generate-insights` handler and shows it still denies before doing any work.
- **The identical body hash across all four routes is the designed no-oracle property.** All four
  returned HTTP 401 with body `"Unauthorized"`, sha256
  `d089c8a9fc28e4e50223eb38c9409e362521be9380a37341304fbac7a4cd9e5f` — the same value #214 and prior
  units recorded. Identical bytes mean a caller cannot distinguish "misconfigured" from "wrong
  secret" from "no such gate", which is the point.
- **Card wording does change, in the direction the unit exists to fix — it is not a regression.**
  Recorded here because a demo is imminent:
  - `relationPhrase` used to return `tends to raise` / `tends to lower` for **every** monotonic edge
    regardless of what the research claimed, so a purely correlational finding was stated causally.
    The phrase is now selected by the *effective* claim kind (the weaker of the synthesised kind and
    the kind the verifier independently found supportable): `correlational` →
    `is associated with higher/lower`, `mechanistic` → `has a proposed route to higher/lower`,
    `causal` → `tends to raise/lower` (unchanged). A card that was previously over-claiming now
    reads correctly; a genuinely causal card reads exactly as before.
  - A fixture-derived card's body is now led by
    `Demo fixture — built from stored sample data, not a live source. ` (B-UI9), before the claim.
    A live artifact resolves the disclosure to the empty string, so a live card is byte-identical to
    what it rendered before.
  - Both gates hold simultaneously: `validateCopyString` still runs on the final filled copy, and a
    new causal-verb gate additionally drops any card whose effective claim kind is weaker than
    `causal` but whose copy contains a causal verb. A cited card with no establishable claim kind is
    dropped (`claim-kind-missing`), never rendered on a guessed default.
- **O38 is satisfied without a cross-language import.** `shared/brain/trust_labels.dart` is a
  hand-maintained mirror with no import of the TS file; parity is enforced by an executable guard
  registered in `docs/graph/couplings.yaml`. Confirmed the guard compares parsed string literals
  from both files rather than trusting either side.
- **Scope held to O27 + O38.** O28 stays deferred: no accessibility or provenance-language work was
  added.

## Verification actually run

Windows, host UaNdIQueue. `deno 2.8.1` at `C:\Users\agent-j\.deno\bin\deno.exe` (confirmed exactly
2.8.1 — CI pins it and the module-graph hashes must match), repository-local Supabase CLI `2.81.2`
invoked as `node_modules/supabase/bin/supabase.exe` (the npm `.exe`, because `execFileSync` cannot
invoke the `node_modules/.bin/supabase.cmd` shim — ENOENT then EINVAL).

**Auth survival — PR #214's changes provably intact after the merge:**

1. `git diff --stat origin/dev-phase2-run4` over the whole tree returns exactly U4's 21 files /
   +3,396 −51. Within `supabase/`, only `generate-insights/{composer,index,render}.ts` and U4's own
   migration appear. `git diff origin/dev-phase2-run4 -- supabase/config.toml
   supabase/deploy-attestation.json supabase/functions/_shared supabase/functions/compute-baselines
   supabase/functions/evaluate-signals supabase/functions/run-pipeline` is **empty** — those files
   are identical to the tip. `verify_jwt = false` is still present for all four
   internal-secret-gated functions in `config.toml`.
2. The `generate-insights/index.ts` diff against the tip contains **no** removal or weakening of
   internal-secret verification, no reversion of `verify_jwt`, and no restored anon/JWT bearer path.
   Reading the merged handler: `verifyInternalSecretRequest` is the **first** statement in
   `Deno.serve` (line 322), returning `unauthorizedResponse()` on failure before any database work;
   `resolveServerKey(env, "secret", …)` still resolves the privileged database credential *after*
   that gate, so malformed configuration cannot become an unauthenticated oracle. Both #214 imports
   are present and unchanged.
3. Runtime: the fresh serve probe (see below) shows `generate-insights` — with U4's changes merged in
   — still returning a genuine 401 with the same body bytes as its three siblings.

**Attestation chain:**

- `graph-hashes` against the merged tree — `configSha256` `9dcc18f4…` and `lockSha256` `47cf575c…`
  reproduce the recorded values exactly; `compute-baselines`, `evaluate-signals` and `run-pipeline`
  reproduce all their recorded hashes exactly; only `generate-insights` moved
  (`entrypointSha256` `b5e50844…`, `moduleGraphSha256` `882543db…`).
- Live `supabase functions serve --debug --no-verify-jwt` from the worktree, against the
  already-running local stack (`supabase start` not needed; the four `supabase_*_ourobion`
  containers were already healthy and were left untouched). Startup reported
  `supabase-edge-runtime-1.71.0 (compatible with Deno v2.1.4)` — matching the pinned probe
  constants — and `verifyJWT: false` for all four functions. POST with **no** internal secret:

  ```
  compute-baselines  status=401  body="Unauthorized"  sha256=d089c8a9fc28e4e50223eb38c9409e362521be9380a37341304fbac7a4cd9e5f
  evaluate-signals   status=401  body="Unauthorized"  sha256=d089c8a9fc28e4e50223eb38c9409e362521be9380a37341304fbac7a4cd9e5f
  generate-insights  status=401  body="Unauthorized"  sha256=d089c8a9fc28e4e50223eb38c9409e362521be9380a37341304fbac7a4cd9e5f
  run-pipeline       status=401  body="Unauthorized"  sha256=d089c8a9fc28e4e50223eb38c9409e362521be9380a37341304fbac7a4cd9e5f
  ```

  The serve process was stopped and the orphaned `supabase_edge_runtime_ourobion` container removed
  immediately afterwards; the four stack containers were verified still up and healthy.
- `record-attestation --manifest-path supabase/deploy-attestation.json` → `run4 local-only
  attestation recorded`. Route evidence was passed as `--routes-base64`, because PowerShell mangles
  the double quotes in a `--routes-json` argument (`invalid route evidence JSON`).
- `attest --deno C:\Users\agent-j\.deno\bin\deno.exe --supabase-cli
  node_modules/supabase/bin/supabase.exe --graph-dir <fresh tmp>` →
  **`run4 local runtime attestation: PASS`** (graphs regenerated fresh for the check, not reused
  from the recording run).
- `landing --base 2749381a405de882c6d96cdf21a57034e28204ea --head HEAD --max-paths 115
  --max-added 8500` → `{"changedPaths":61,"addedLines":6274}` — inside the 115 / 8,500 caps.

**Test suites:**

- `npm --prefix tools/rules test` — **140 pass, 0 fail.** The four files this unit adds/extends run
  91 of those: `causal_copy_gate.test.ts` (18, including "rendered fixture-posture copy passes the
  non-diagnostic copy gate too (validateCopyString) — both gates must hold simultaneously"),
  `engine_composer_render.test.ts`, `engine_orientation_gap.test.ts`, `scientific_provenance.test.ts`.
- `flutter analyze` — **No issues found.** (A first run reported `.env.public` missing; that file is
  machine-local and gitignored, so it was copied in from the main checkout — not a code defect.)
- `flutter test` — **369 pass, 26 skipped, 0 fail.**
- `flutter test test/guards/brain_trust_labels_parity_test.dart` — **23 pass, 0 fail**, covering
  every constant across the TS/Dart seam including `RELATION_PHRASES` and `CAUSAL_VERBS`.
- `shared` `npx tsc --noEmit` — clean.
- `node tools/context_sync.mjs --check` — `sessions, memory, decisions, index, and couplings are
  consistent.`
- `tools/rules` needed `npm install --no-save zod` at the repo root (`shared/rules/rule.schema.ts`
  imports `zod`, declared nowhere) — **not committed**; `git status` confirmed no tracked churn.
- The four EOL-only generated-plugin files Flutter dirties under `apps/biotope/{linux,macos}` were
  confirmed content-empty (`git diff --ignore-cr-at-eol`) and discarded, never committed.

## Left

- **PR #199 needs two recorded reviewers, and no agent can supply them.** Nine `shared/` files are
  in this PR (`shared/brain/{index,provenance,relationships,relationships.schema,trust_labels.ts,
  trust_labels.dart,trust_labels.typetest.ts}`, `shared/SHARED-CONTEXT.md`, `shared/tsconfig.json`),
  so the SHARED-CONTEXT two-reviewer rule (memory 0002 / P2) applies: **Jayden and Alton must both
  be recorded as reviewers.** Test evidence does not substitute for review, and this is a wall-clock
  dependency.
- The Windows `execFileSync` `.cmd`-shim failure and the PowerShell `--routes-json` quote mangling
  are still routed around per-session rather than fixed in `tools/run4_release_gate.mjs`; CI runs on
  `ubuntu-latest` and never sees either. Worth a small follow-up if more Windows sessions hit them.
- `supabase/deploy-attestation.json` is a shared single-writer file. Any unit that lands after this
  one and touches `supabase/functions/**`, `supabase/config.toml` or `supabase/deno.lock` will have
  to re-record it again.
- Not merged — merges are human-held.

## Blockers

- None technical. The two-reviewer requirement above is the only thing between PR #199 and merge.

memory: none
