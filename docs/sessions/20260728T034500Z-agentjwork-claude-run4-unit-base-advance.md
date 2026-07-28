---
title: Run 4 landing-gate unit base advance
summary: Advanced RUN4_UNIT_BASE_SHA to the R4-U7 unit base, updated CI in lockstep, re-recorded the local-only deploy attestation through the tool, and re-proved the landing gate fails closed.
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Run 4 landing-gate unit base advance

Issue: #195

Branch: `ci/run4-unit-base-advance`

This is Step A of the Run 4 continuation queue. It reconciles the landing gate before the canonical
full-UI unit (PR #191) lands. It changes no product behaviour.

## Attempted

- Verified the primary checkout was clean and exactly at `origin/dev-phase2-run4` = `ff05464`.
- Fetched live GitHub PR/check state and read the exact failing job logs rather than trusting the
  cockpit snapshot.
- Established that the checked-in gate base `c558c04` was charging every open unit for
  already-merged work.
- Advanced the per-unit base, re-recorded the attestation through the generator, and re-ran the
  gate's positive and injected-negative paths.

## Changed

- `tools/run4_release_gate.mjs` — `RUN4_UNIT_BASE_SHA` advanced from
  `c558c04f1b661a59c8987c96770768eeea46e0cc` to `ff0546434f081cadc3e5683217d484f250c19139`
  (the `dev-phase2-run4` tip after the U2 merge #177 and the cockpit refresh #194). The superseded
  value is retained as provenance in the comment block. Caps are untouched at 115 paths / 8,500
  added lines.
- `.github/workflows/ci.yml` — `RUN4_UNIT_BASE_SHA` updated in lockstep.
- Renamed the release-evidence step from `Assert exact landing SHA and U0 unit base` to
  `Assert exact landing SHA and current unit base`, and the matching failure message from
  `accepted U0 unit SHA` to `accepted current unit SHA`. The base is no longer U0's, and the old
  label would have misled the next reader. The name is bound in four places in the tool plus
  `ci.yml`, and the frozen-workflow validator matches step names exactly, so a missed site fails
  loudly rather than silently.
- `tools/run4_release_gate.test.mjs` — the existing wrong-base negative assertion now expects the
  new message. The assertion itself is unchanged in strength.
- `supabase/deploy-attestation.json` — regenerated via
  `node tools/run4_release_gate.mjs record-attestation`, never hand-edited.

## Decided

- **The cap was never the real problem; the stale base was.** PR #191's own diff is 6,334 added
  lines across 45 paths, well inside 8,500 / 115. It measured 13,449 because the base predated the
  U2 merge. `tools/run4_release_gate.mjs:27-39` already documented this exact failure mode and
  instructed advancing the base per unit. Nothing was weakened to go green.
- **Kept the caps at 115 / 8,500.** No unit-specific human decision exists to change them.
- The attestation regeneration reproduced every existing hash byte-identically; the manifest diff
  is exactly one line (`provenance.unitBaseSha`). That is independent evidence that the local
  toolchain matches CI's and that the regeneration is faithful rather than a rewrite.

## Verification actually run

Local, macOS, `deno 2.8.1` (installed pinned to the CI version) and repository-local Supabase CLI
`2.81.2`:

- `node --test tools/run4_release_gate.test.mjs` — 9 pass, 0 fail.
- `node tools/run4_release_gate.mjs config` — `run4 config/workflow gate: PASS`.
- `node tools/run4_release_gate.mjs graph-hashes` — reproduced the committed entrypoint, import-map
  and module-graph hashes for all four functions exactly.
- Live `supabase functions serve --debug --no-verify-jwt` probe of all four routes — each reached
  its handler and returned HTTP 401 `Unauthorized`,
  sha256 `d089c8a9fc28e4e50223eb38c9409e362521be9380a37341304fbac7a4cd9e5f`, matching the recorded
  evidence. Fresh probe, not a replay. Edge runtime 1.71.0 / compatible Deno 2.1.4.
- `node tools/run4_release_gate.mjs attest` against a freshly regenerated graph directory —
  `run4 local runtime attestation: PASS`.
- Landing positive and injected negatives — recorded on the PR.

## Left

- The gate base will need advancing again after each subsequent unit integrates. That is the
  designed per-unit convention, not a defect.
- Issue #171's still-open state is a separate tracking discrepancy and is not resolved here.

## Blockers

- None for this unit.

memory: none
