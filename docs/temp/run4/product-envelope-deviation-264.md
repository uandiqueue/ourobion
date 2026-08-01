---
title: Run 4 product-envelope deviation (issue #264)
summary: Records the owner-approved deviation that accepts Run 4's whole-product union exceeding the original product cap, while the per-unit landing gate stays at 115 paths / 8,500 added lines and fail-closed.
type: decision-register
scope: run4
status: accepted
updated: 2026-08-01
---

# Run 4 product-envelope deviation (issue #264)

This is a **truth/attestation record, not a cap change** (issue #264's own framing). It exists so the
gap between "the per-unit gate is green" and "the whole Run 4 product stayed inside its original
envelope" is never blurred in later sessions.

## Owner decision (2026-07-30)

The owner explicitly accepted that Run 4's product-union size exceeds the original product cap, and
directed that this be recorded plainly rather than fixed by trimming already-landed work or by
quietly raising the cap. See [issue #264](https://github.com/uandiqueue/ourobion/issues/264).

## Measurement

The immutable product union is measured from the fixed product base
`RUN4_PRODUCT_BASE_SHA = 77c98213e23ad56ae37c86201b39ef4e7543a543` (see
[`tools/run4_release_gate.mjs`](../../../tools/run4_release_gate.mjs), which excludes the MT4
model-training merge through its exact first-parent delta) to a given integration head, with the same
identity-kit binary allowlist and caps used for per-unit landings (D-231-PRODUCT-BINARY-ACCOUNTING in
[`decisions-signoff.md`](./decisions-signoff.md)).

| Measurement point | Head | Changed paths | Added lines | Over the 115/8,500 cap by |
|---|---|---|---|---|
| PR #270 merge (integration head at time of this record) | `d880ed04091f8aa920294eb70db4a20263ddae4e` | 511 | 71,762 | 396 paths / 63,262 lines |
| #290/#296 merge ([issue #290](https://github.com/uandiqueue/ourobion/issues/290)) | `f8cb75251f0602395bdf88285e18d00525b88db4` (advanced per-unit base to `d880ed04091f8aa920294eb70db4a20263ddae4e`) | 512 | 71,841 | 397 paths / 63,341 lines |
| Submission-audit base | `253e0ad6db31bb2a134e47546ddaba84bf284639` | 533 | 75,645 | 418 paths / 67,145 lines |
| Session A / PR #292 integration merge | `dea055c8155c1e9c6851931f4de9816a88d66b2d` | 536 | 76,360 | 421 paths / 67,860 lines |
| #300 / PR #306 integration merge | `abcba95f8386d31c49f62f20f4b623de180e29c0` | 544 | 79,125 | 429 paths / 70,625 lines |
| #307 task 1 / PR #312 integration merge | `aef9bc1c6b534d784f229fef06010f79a1ff6a22` | 545 | 79,288 | 430 paths / 70,788 lines |
| #307 flow fixes / PR #322 integration merge | `226bfef0e7e661873c0f51168cc968e758651b94` | 568 | 84,397 | 453 paths / 75,897 lines |
| #307 D1 projection / PR #326 integration merge | `d97a686e461ab0aa265d11f733d724c87ea8415c` | 583 | 86,031 | 468 paths / 77,531 lines |
| PR #305 committed measurement | `82d6c9350bf41c5163c0b38b6f4727cef9af5c56` | 588 | 86,528 | 473 paths / 78,028 lines |

At each listed measurement the release-gate command reported 28 MT4 paths excluded, 15 allowlisted
binary paths, and 837,194 allowlisted binary bytes. Those are reproducible outputs of
`node tools/run4_release_gate.mjs product-cap --head <head>`; do not assume they remain unchanged at a
later integration head.

**These figures are point-in-time measurements of a moving integration head, not different
policies.** The product base and the cap are fixed; only the head being measured advances as more
units land. Re-measure at whatever head is current before treating any number as live. The exact
#290 base-advance posture and command are recorded in
[`per-unit-release-base-290.md`](./per-unit-release-base-290.md).

## Required posture (do not drift from this)

- **The original product envelope was exceeded and is accepted as an explicit owner deviation
  (owner decision 2026-07-30).** It is not a bug to fix by shrinking the diff.
- **The per-unit landing gate stays at 115 changed paths / 8,500 added lines, fail-closed, per unit.**
  This deviation does not touch `RUN4_MAX_CHANGED_PATHS` / `RUN4_MAX_ADDED_LINES` in
  `tools/run4_release_gate.mjs`, and every unit continues to be measured and blocked by that gate
  exactly as before.
- **A per-unit pass is NOT a whole-product cap pass.** Nothing about a unit's green `Run 4 release
  evidence` / `Run 4 Gate` check should ever be read as evidence that the aggregate product stayed
  under 115/8,500 — it never did, and the per-unit gate does not measure that question.
- **The original product cap did NOT pass.** The measurements above are both well over the cap. This
  record does not claim, and no downstream doc or PR description should claim, that it did. The cap is
  not retroactively raised to make it appear to pass — it remains 115/8,500 in the code, and this
  document exists only to record the accepted exception, not a new number.
- **No already-landed functionality is being trimmed** to bring the product union back under the
  cap. Everything that has merged into `dev-phase2-run4` stays merged.
- **Final promotion from `dev-phase2-run4` to `dev-phase2` remains deferred and owner-only.** This
  record does not authorize that merge, and it carries no instruction to open one. `main` is never
  touched by any Run 4 work, this record included.
- **`productCapAcceptanceClaimed` stays `false`** in the generated
  [`supabase/deploy-attestation.json`](../../../supabase/deploy-attestation.json) and in
  `tools/run4_release_gate.mjs`'s `record-attestation` output. This document is the human-facing
  explanation of *why* that flag is false and stays false: the deviation is accepted as an owner
  exception, which is a different thing from the machine attestation claiming the cap was met.

## Alternatives rejected

- **Raise `RUN4_MAX_CHANGED_PATHS`/`RUN4_MAX_ADDED_LINES` (or a separate whole-product cap) to a
  number the current union satisfies.** Rejected: issue #264 is explicit that this is not a cap
  change, and a cap redefined after the fact to match whatever already landed is not a control.
- **Trim landed units to fit back under 115/8,500 in aggregate.** Rejected: the owner explicitly
  directed that no already-landed functionality be cut to manufacture a passing product measurement,
  and the same instruction already governs the full-UI unit exception in
  [`decisions-signoff.md`](./decisions-signoff.md) ("UI CAP").
- **Flip `productCapAcceptanceClaimed` to `true` now that an owner deviation exists.** Rejected: an
  owner-approved deviation from the cap is not the same claim as "the product measurement satisfied
  the cap." The attestation is a measurement record; conflating the two would make the generated
  artifact assert something false.
- **Treat this deviation as authorization to promote `dev-phase2-run4` into `dev-phase2`.** Rejected:
  issue #264 says explicitly that it does not authorize that merge; promotion timing is a separate,
  still-deferred, owner-only decision.

## Why

The per-unit cap exists to bound the size of any single reviewable landing, not to bound the total
size of a multi-week run assembled from many accepted units. Once enough units land, their union is
mechanically larger than any one unit's cap — that is expected, not a control failure. Recording the
owner's explicit acceptance of that outcome, while leaving the per-unit gate exactly as strict as
before, keeps both facts true at once: no single landing was allowed to be reviewed at a dangerous
size, and the aggregate result is honestly reported as over the original whole-product envelope rather
than silently redefined to look compliant.

## Relationship to other Run 4 records

- [`decisions-signoff.md`](./decisions-signoff.md) — CAP and UI CAP rows record the per-unit gate and
  the full-UI unit exception; D-231-PRODUCT-BINARY-ACCOUNTING records the binary-accounting rule this
  document's measurement reuses. This document does not restate or supersede those rows.
- [`unit-signoff-index.md`](./unit-signoff-index.md) — per-unit `built`/`merged`/`done` state is
  tracked there; this document only concerns the aggregate product union, not any individual unit's
  disposition.
- [`run-envelope.json`](./run-envelope.json) — machine-readable snapshot of per-unit state; it does
  not currently carry the whole-product measurement, which lives in `tools/run4_release_gate.mjs` and
  the generated `supabase/deploy-attestation.json`.
