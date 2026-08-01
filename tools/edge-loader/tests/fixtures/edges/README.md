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

`edge_score` is the composite RANK (unchanged since F3); `serving_band` is the **C15 single-paper
gate** — quote gate + direction/claim-kind/effect-size against the CITED paper + verdict relevance,
floored on `confidence`. The two are independent, so a row can rank low and still serve.

| edge | verifications | expected serving |
|---|---|---|
| `sleep_duration_min\|increases\|hrv_sdnn_ms` | 2 active (2026-07-11, 2026-07-12) — loader supersedes the older | newest wins: score 0.900, band `high`; the superseded 2026-07-11 line scores 0.765 and also bands `high` (conf 0.85 ≥ 0.8) |
| `sleep_duration_min\|decreases\|resting_hr_bpm` | 1 active, verdict `partial` | score 0.560, band `hold` — `effectSizeCheck.matchesClaim` is false (extracted −0.8 vs the claimed effect), a single-paper faithfulness failure. Its `scopeCheck.mismatch` and thin corroboration are deliberately **not** why. |
| `step_count\|increases\|sleep_duration_min` | 1 active, verdict `uncertain` (no independent retrieval) | score 0.000, band `hold` — never served |
| `stool_form\|correlates\|gut_comfort_score` | none | claim row only; absent from `verified_edges` |
