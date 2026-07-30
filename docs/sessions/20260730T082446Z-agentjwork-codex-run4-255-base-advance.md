---
title: Advance Run 4 unit base after PR 254
summary: Advances the per-unit Run 4 gate base to the exact PR 254 merge and re-records local-only attestation from fresh graphs and four local handler denials.
type: session
scope: run4
status: canonical
updated: 2026-07-30
---

# Advance Run 4 unit base after PR 254

Issue: #255; branch: ci/run4-base-advance-255; base: 6020f444a104b734df42e04f262bf19e701d1975

## Attempted

- Advance only the accepted per-unit landing base after PR 254 while retaining all fixed caps and gate invariants.
- Re-record the derived local-only deployment attestation through its repository generator using fresh frozen Deno graphs and real localhost handler probes.

## Changed

- Updated RUN4_UNIT_BASE_SHA and its matching workflow environment value to 6020f444a104b734df42e04f262bf19e701d1975.
- Regenerated supabase/deploy-attestation.json through record-attestation; only provenance.unitBaseSha changed. All four configured handlers were served locally and returned 401 Unauthorized without the internal secret.
- Added this session log.

## Decided

- This is a base advance only. The product base/cap, caps, binary allowlist, required jobs, test suite, and provenance validation remain byte-identical.
- The attestation remains explicitly local-only and does not claim hosted deploy parity or product-cap acceptance.

## Verification

- Release-gate tests: 17/17 passed, including injected stale-base, widened-allowlist, and over-cap negative cases.
- Config gate, fresh graph-hashes, fresh-graph attestation, context check, and diff hygiene passed.
- Authoritative old-base source recovery measured 115 paths / 8,497 added lines; final new-base landing measured 4 paths / 53 added lines.
- Deno 2.8.1 and repository-local Supabase CLI 2.81.2 were used. All four local handlers were reached and returned 401 Unauthorized with SHA-256 d089c8a9fc28e4e50223eb38c9409e362521be9380a37341304fbac7a4cd9e5f.

## Left

- No provider, hosted, deployment, or persistent product-database action was performed.

## Blockers

- None.

memory: none
