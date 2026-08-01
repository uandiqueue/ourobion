---
title: Run 4 per-unit release-base advance (issue #290)
summary: Records issue #290's historical base advance, the later accepted #312 base, exact local-only attestation posture, and point-in-time product measurements without claiming product-cap or hosted-deploy acceptance.
type: decision-register
scope: run4
status: accepted
updated: 2026-08-01
---

# Run 4 per-unit release-base advance (issue #290)

Issue #290 landed through PR #296 at merge commit
`f8cb75251f0602395bdf88285e18d00525b88db4`. It advanced the per-unit release base to
`d880ed04091f8aa920294eb70db4a20263ddae4e`; it did not change the immutable product base, caps, or
acceptance posture. PR #312 later advanced the accepted per-unit base to the PR #306 integration
merge `abcba95f8386d31c49f62f20f4b623de180e29c0`; that later state is what the current gate enforces.

## Machine record

[`tools/run4_release_gate.mjs`](../../../tools/run4_release_gate.mjs) contains the authoritative
constants:

```text
RUN4_UNIT_BASE_SHA=abcba95f8386d31c49f62f20f4b623de180e29c0
RUN4_PRODUCT_BASE_SHA=77c98213e23ad56ae37c86201b39ef4e7543a543
RUN4_MAX_CHANGED_PATHS=115
RUN4_MAX_ADDED_LINES=8500
```

At the #290/#296 landing, [`supabase/deploy-attestation.json`](../../../supabase/deploy-attestation.json)
records `scope: local-only`, `hostedDeployParityClaimed: false`, and
`productCapAcceptanceClaimed: false`. The generator validates those denials; advancing a per-unit base
does not attest a hosted deployment or a whole-product pass.

The read-only product measurement command was:

```text
node tools/run4_release_gate.mjs product-cap --head <head>
```

| Measurement point | Head | Changed paths | Added lines | Result |
|---|---|---:|---:|---|
| #290/#296 merge | `f8cb75251f0602395bdf88285e18d00525b88db4` | 512 | 71,841 | `withinCap: false` |
| Audit-session base | `253e0ad6db31bb2a134e47546ddaba84bf284639` | 533 | 75,645 | `withinCap: false` |
| Session A / PR #292 integration merge | `dea055c8155c1e9c6851931f4de9816a88d66b2d` | 536 | 76,360 | `withinCap: false` |
| #300 / PR #306 integration merge | `abcba95f8386d31c49f62f20f4b623de180e29c0` | 544 | 79,125 | `withinCap: false` |
| #307 task 1 / PR #312 integration merge | `aef9bc1c6b534d784f229fef06010f79a1ff6a22` | 545 | 79,288 | `withinCap: false` |
| #307 flow fixes / PR #322 integration merge | `226bfef0e7e661873c0f51168cc968e758651b94` | 568 | 84,397 | `withinCap: false` |
| #307 D1 projection / PR #326 integration merge | `d97a686e461ab0aa265d11f733d724c87ea8415c` | 583 | 86,031 | `withinCap: false` |
| PR #305 committed measurement | `82d6c9350bf41c5163c0b38b6f4727cef9af5c56` | 588 | 86,528 | `withinCap: false` |

Both use the fixed product base. They are moving-head measurements, not new caps. The original
115-path / 8,500-line whole-product envelope remains exceeded under the owner-approved issue #264
deviation, while every new unit still faces the same fail-closed per-unit gate.

## Consequences

- Current unit evidence must measure from `abcba95f8386d31c49f62f20f4b623de180e29c0` until another
  separately reviewed base advance lands. `d880ed0` remains the historical #290 advance, not the
  current gate base.
- A green per-unit check must never be presented as a whole-product cap pass.
- This record does not authorize promotion to `dev-phase2`, deployment, database writes, or any other
  release action.
- Re-run the product measurement at the final integration head; never reuse any row above as a live
  number after the branch moves.
