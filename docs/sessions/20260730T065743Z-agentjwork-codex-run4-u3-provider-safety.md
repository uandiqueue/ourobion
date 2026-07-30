---
title: Complete Run 4 U3 provider-safety acceptance plumbing
summary: Adds the acceptance-only Agnes adapter, conservative cross-process attempt reservations, unified retry identities, and synthesis provider evidence without changing production model assignments or calling providers.
type: session
scope: m5b
status: canonical
updated: 2026-07-30
---

# Complete Run 4 U3 provider-safety acceptance plumbing

Issue: #240; branch: `feat/m5b/run4-u3-provider-safety`; exact base: `4af48d00965209688a25c7011f5207b6d9308842`

## Attempted

- Implement audited provider-safety spec sections 1–4 only: bounded Agnes acceptance, durable attempt accounting, stable retry identities, and synthesis provider evidence.
- Preserve production assignments and synthesis-versus-verifier provider-family decorrelation.
- Prove concurrency and fail-closed behavior offline without provider, hosted storage, database, deployment, paper, runner, or BPL15 work.

## Changed

- Registered Agnes and implemented its exact acceptance-only Chat Completions POST adapter. Production node assignments remain OpenAI synthesis and Anthropic verification; Agnes is assigned to no production node.
- Added fixed 24,000-byte exact-wire-content and 3,072-token ceilings, authoritative-price enforcement, provider-returned identity/raw-evidence enforcement, journal-wide stable-logical-call limits of three Anthropic or ten Agnes POST starts, and a journal-global US$5 reservation ceiling.
- Added one router-owned, gitignored append-only hash-chained JSONL reservation journal with an adjacent exclusive lock, replay-before-cap accounting, per-line append/fsync, nonce-safe stale recovery, live-PID protection, path/symlink/junction confinement, redacted errors, and conservative accounting for crashes, stream failures, and unknown attempts.
- Reused stable bounded SHA-256 ids derived from real synthesis pair and verifier edge identities across transport, parse, schema, and enforcement retries. Valid adverse/empty results return immediately without retry or fallback.
- Added the local-only `synthesis-raw.jsonl` sidecar with pair/attempt-scoped provider-returned identity and raw response evidence for accepted, adverse/empty, parse-error, and terminal enforcement-rejected results. R2 publication and the serving loader do not consume it.
- Changed both existing usage ledgers so only `ENOENT` initializes clean state; corrupt, unsupported, or unreadable historical accounting now fails closed.
- Replaced two legacy literal NUL source bytes in `synth/artifact.ts` with equivalent `\0` escapes and added a narrow `-text diff` attribute so the transition remains measurable by numstat and release caps.

## Decided

- Acceptance limits are compiled policy rather than caller-supplied settings.
- Acceptance price rows must be explicit and non-provisional. The checked-in config intentionally has no Agnes price/assignment, so it cannot accidentally run the acceptance leg.
- The journal reserves before each possible POST and counts the full reservation after a crash or ambiguous network outcome. Append plus fsync is conservative accounting, not a claim of stronger filesystem power-loss atomicity.
- No `GET /models` discovery is used. Provider identity comes only from the returned completion body.

## Left

- A future explicitly authorized runner may supply audited Agnes model/pricing configuration and invoke the two acceptance legs. This session does not add or execute that runner.
- Provider results, hosted/R2 artifacts, database state, deployment state, papers, and BPL15 remain untouched.

## Blockers

- None for the offline implementation. Live acceptance remains intentionally unavailable until authoritative Agnes model/pricing inputs and explicit execution authorization exist.

memory: none
