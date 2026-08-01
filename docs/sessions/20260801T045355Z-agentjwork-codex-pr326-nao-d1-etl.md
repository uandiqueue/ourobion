---
title: Run 4 — land the NAO R2-to-D1 exact-projection workflow
summary: Reviewed and completed the manual, fail-closed ETL workflow and snapshot contract; verified the current R2 snapshot locally without exposing credentials or corpus content, but did not mutate remote D1 because the required high-risk approval was rejected.
type: session
scope: nao
status: canonical
updated: 2026-08-01
---

# Run 4 — NAO D1 ETL workflow (#326 / #307)

Issue: #307; PR: #326; branch: `draft/nao-d1-etl-workflow-307`; base: `dev-phase2-run4`;
device: `agentjwork`; agent: `codex`.

## Attempted

- Take over the Session B review and landing of the R2 manifest → D1 exact-projection workflow.
- Generate the current R2 snapshot using the configured NAO `.env` only in child-process memory, then authenticate Wrangler and execute the exact checked SQL against remote D1.

## Changed

- Hardened `.github/workflows/nao-d1-etl.yml` as a manual, main-ref-confirmed workflow that generates once, measures and hashes the SQL, verifies official D1 limits, and only then permits a remote rebuild.
- Made `apps/nao/scripts/etl.mjs` fail closed on malformed, anonymous, duplicate, or empty manifests; it now emits a DELETE-plus-UPSERT exact projection with deterministic content-free metadata and explicit D1 limits.
- Added ETL and workflow contract coverage, including the 6,158-row-scale fixture and CI-environment precedence typing.

## Decided

- R2 remains truth and D1 remains a rebuildable projection. The operation requires an exact, newly measured snapshot and post-write count verification.
- The remote D1 rebuild is deliberately not automated by a schedule: it requires manual dispatch, exact confirmation text, and a main-ref execution context.

## Verification

- `npm run typecheck` — passed.
- `npm test` — passed (339 tests).
- Current local R2 snapshot: 6,158 rows; 6,159 statements; 20,184,521 bytes; 20,049-byte largest statement; SQL SHA-256 `09793f013961e4ff09bd6cd86a954c4214998e0001d818f775480b158b30a756`.
- Configured Wrangler authentication — succeeded; identity withheld.
- Remote D1 execution and count verification — not run: the high-risk shared-database rewrite approval was rejected. No remote D1 data changed.

## Left

- With explicit authorization, apply the exact stored SQL snapshot to `ourobion-nao-index --remote` and verify `papers` equals the measured row count, then record the result.
- Integrate the projection as the final step of the eventual R2-writing ingestion workflow if the product needs freshness without manual dispatch.

## Blockers

- Remote D1 rewrite needs separate explicit approval; this session did not circumvent that control.

memory: none
