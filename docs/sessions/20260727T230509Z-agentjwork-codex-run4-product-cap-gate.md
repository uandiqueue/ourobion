---
title: "Run 4 immutable filtered product-cap gate"
summary: "Replaced the moving unit-window acceptance check with the frozen product landing union and the provenance-bound MT4 exclusion manifest."
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Run 4 immutable filtered product-cap gate

## Attempted

Correct issue #183 on `fix/ci/run4-product-cap-gate`, base/head
`b3867f0f92ce685a86b0c0aaaff0afb164b84224`, without changing Run 4 authority documents.

## Changed

- Bound final acceptance to immutable product base `77c98213e23ad56ae37c86201b39ef4e7543a543` and caps 115 paths / 8,500 additions.
- Bound the sole MT4 exclusion to first-parent provenance
  `66bfde53b0dc388e40af42ab0ff4737ffb2fd8aa` →
  `c558c04f1b661a59c8987c96770768eeea46e0cc`: 27 MT4 paths plus its session log, 28 total, canonical manifest SHA-256 `d848a20c263eae7255c532e358605f17aa07e1f17d3dd526825860d767e5bfd6`.
- The gate now rejects drift in base, provenance, path/status/blob content, count/hash, supplied extra exclusions, shallow history, rename/copy, binary/parse ambiguity, and cap excess. The moving `c558…` value survives only as non-acceptance local-attestation provenance.
- The local runtime attestation schema now explicitly sets `productCapAcceptanceClaimed: false`, separates `localAttestationBaseSha` (`c558…`) from `productCapBaseSha` (`77c…`), and rejects missing/true acceptance claims, swapped bases, or unexpected provenance fields.
- CI fetches and validates all immutable provenance commits; release-gate tests and workflow validation passed locally.

## Decided

- Final Run 4 Gate acceptance is the filtered product union, never a per-unit measurement. No cap was raised and the U1 aggregate/security jobs were not weakened.

## Left

- The primary owns reconciliation of the concurrent Run 4 authority documents, Git/GitHub operations, and integration-level CI evidence.

## Blockers

None.
memory: none
