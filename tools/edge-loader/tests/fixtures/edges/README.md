# FIXTURE edge artifacts — hand-authored, NEVER synthesized

These JSONL files are **hand-authored test fixtures** for `tools/edge-loader` (session U8),
mirroring the R2 `edges/` prefix layout (`claims.jsonl` + `verifications.jsonl`,
insight-engine-architecture §A8/§A10/§A11). They validate against the real `shared/brain`
contract, but every record is fake:

- `synthesisModel` / `verifierModel` say `fixture:hand-authored (NOT a ... model)`.
- Every `paperId` / `title` is prefixed `fixture:` / `FIXTURE (...)` — none is a real paper.
- `derivation` states the record is a fixture and which loader path it exercises.

They must never be loaded into a non-test database as if they were real edges, and never be
moved under `data/` (real artifacts live in R2, not in git — two-tier truth, memory 0001).

Coverage by design:

| edge | verifications | expected serving |
|---|---|---|
| `sleep_duration_min\|increases\|hrv_sdnn_ms` | 2 active (2026-07-11, 2026-07-12) — loader supersedes the older | newest wins: score 0.900, band `high` |
| `sleep_duration_min\|decreases\|resting_hr_bpm` | 1 active, verdict `partial` | score 0.560, band `mid` |
| `step_count\|increases\|sleep_duration_min` | 1 active, verdict `uncertain` (no independent retrieval) | score 0.000, band `hold` — never served |
| `stool_form\|correlates\|gut_comfort_score` | none | claim row only; absent from `verified_edges` |
