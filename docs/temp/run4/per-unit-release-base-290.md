---
title: Run 4 per-unit release-base advance (issue #290)
summary: Records the merged issue-290 base advance to d880ed0, its exact local-only attestation posture, and separate point-in-time whole-product measurements without claiming product-cap or hosted-deploy acceptance.
type: decision-register
scope: run4
status: accepted
updated: 2026-08-01
---

# Run 4 per-unit release-base advance (issue #290)

Issue #290 landed through PR #296 at merge commit
`f8cb75251f0602395bdf88285e18d00525b88db4`. It advanced the per-unit release base to
`d880ed04091f8aa920294eb70db4a20263ddae4e`; it did not change the immutable product base, caps, or
acceptance posture.

## Machine record

[`tools/run4_release_gate.mjs`](../../../tools/run4_release_gate.mjs) contains the authoritative
constants:

```text
RUN4_UNIT_BASE_SHA=d880ed04091f8aa920294eb70db4a20263ddae4e
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
| PR #305 rebased head before landing | `46c7e873727a75aa9a0321cee48ec0d5309476cb` | 549 | 79,554 | `withinCap: false` |

Both use the fixed product base. They are moving-head measurements, not new caps. The original
115-path / 8,500-line whole-product envelope remains exceeded under the owner-approved issue #264
deviation, while every new unit still faces the same fail-closed per-unit gate.

## Consequences

- Future unit evidence must measure from `d880ed04091f8aa920294eb70db4a20263ddae4e` until a separately
  reviewed base advance lands.
- A green per-unit check must never be presented as a whole-product cap pass.
- This record does not authorize promotion to `dev-phase2`, deployment, database writes, or any other
  release action.
- Re-run the product measurement at the final integration head; never reuse any row above as a live
  number after the branch moves.
