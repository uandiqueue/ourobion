---
title: Run 4 trust-plumbing attestation and source normalization
summary: Regenerated local-only trust-plumbing attestation from live local probes and normalized the verification dedupe separator source byte without changing runtime identity.
type: session
scope: run4
status: canonical
updated: 2026-07-29
---

# Run 4 trust-plumbing attestation and source normalization

## Attempted

- Regenerate the derived local-only deploy attestation for the R4-U3 trust-plumbing head through its checked-in generator, never by hand.
- Prove all four handlers against the owner-started local stack without changing its lifecycle.
- Correct the release-gate product-cap parser blocker caused by one raw NUL byte in the verification dedupe source, while retaining the runtime delimiter.

## Changed

- Used a detached `/tmp` shim at `ed2e0ab`, differing only in `supabase/config.toml` project ID, to join the existing `supabase_network_biotope` namespace. All `supabase/functions` and `shared` sources were byte-equivalent to the head; the temporary runtime mounts were read-only.
- Probed `compute-baselines`, `evaluate-signals`, `generate-insights`, and `run-pipeline` unauthenticated with `{}`. Each reached the handler and returned `401`, body `Unauthorized`, SHA-256 `d089c8a9fc28e4e50223eb38c9409e362521be9380a37341304fbac7a4cd9e5f`.
- Stopped and removed only the fresh shim runtime, restored the pre-existing exited edge-runtime container name and `edge_runtime` alias, and removed the shim worktree.
- Regenerated `supabase/deploy-attestation.json` through `record-attestation`; only `generate-insights` moved: entrypoint hash `a0d799be…` → `76bcad727d32ba09eee1d7b12cd0f44b3b0849cd436836b0e7252fb366e5d91c`, module graph `3c304bdc…` → `30d8f16a5b6aeae5a912a3c13f934327ba1aec1d92c37f782c744958f58a1499`.
- Replaced exactly one raw `0x00` source byte in `tools/brain-ingest/src/verify/artifact.ts` with the textual `\0` escape, preserving the runtime NUL delimiter. Added a regression test for char code 0 and zero raw source NUL bytes, plus D-241-NUL-SOURCE-NORMALIZATION.

## Decided

- The raw provider/body retention and existing dedupe semantics remain unchanged; this is source representation normalization only.
- Provider calls remain unspent. Issue #240 steps 4–5 (genuine provider-attested verification and live acceptance walk) remain open.

## Left

- Push this bounded attestation/normalization commit and let PR #241 CI run on the real textual head.

## Blockers

- The release-gate product-cap test initially read the old binary artifact blob from committed `base..HEAD`; after committing the textual normalization it must be rerun against the actual head. No product-cap limit was changed.

## Verification

- Live four-route probe: passed as described above.
- Fresh attestation verification: passed with Node 26.5.0, repo Supabase CLI 2.81.2, and repo Deno 2.8.1.
- `tools/brain-ingest`: TypeScript clean; full tests **387/387**; focused verify/raw-retention **42/42**.
- Earlier same-session static gates: llm-router **88/88**, edge-loader **67/67**, rules **172/172**, and Deno check for generate-insights passed.
- `context_sync --check` and `git diff --check` passed before the source-normalization commit; Flutter was not run (no Flutter change).
- The first source-normalization design required a numeric scoped numstat row, but Git still emitted
  `-\t-` because the historical base blob contains NUL. It was replaced by the reviewed, fail-closed
  zero-context scoped-patch recovery. Release-gate tests then passed **13/13** and product-cap
  measured **297/115 paths, 48,783/8,500 additions** (recorded, non-gating; over envelope).

memory: none
