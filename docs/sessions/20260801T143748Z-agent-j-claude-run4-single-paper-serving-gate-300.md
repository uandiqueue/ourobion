---
title: Serving gate becomes single-paper faithfulness (#300 §E) — corroboration / impact tier / evidence tier demoted to metadata
summary: A live Agnes run produced edges where every check against the CITED paper passed and only the other-paper signals were thin, yet the composite edgeScore banded them `hold` — a rejection with extra steps, contradicting #300 §E. Added `SINGLE_PAPER_GATE` + `singlePaperGate()` in shared/brain/index.ts; `servingBand()` now reads it, `edgeScore()` keeps its pre-C15 composite bit-for-bit as a RANK only. Corroboration, study-design tier, venue impact tier and the other-paper scopeCheck are still computed, stored and ranked on, but can no longer withhold a card. A card can now be served on the strength of a single paper, and `EdgeVerification.caveat` is the only thing carrying that risk to the user — the owner's explicit, informed choice. 3 of the 7 live edges moved hold → mid.
type: session
scope: shared
status: canonical
updated: 2026-08-01
---

# Single-paper serving gate (#300 §E, C15)

Issue: #300 (§E); branch: `fix/brain/single-paper-serving-gate-300`; base and exact head at branch
cut: `e0c6077` (`origin/dev-phase2-run4`, i.e. after #346/#347/#348); device: `agent-j`; agent:
`claude` (Opus 5, 1M context). Isolated git worktree; the main checkout was not touched (read only).

Territory: `shared/brain/index.ts`, `shared/brain/README.md`, `tools/edge-loader/**`,
`docs/temp/run4/config-decisions.md`, this log.

## The owner's decision (verbatim, 2026-08-01)

> "If impact tier or paper reliability is blocking, then ignore them, ignore b too, we focus on
> single paper verification, your evidence cant shown on UI wont even be surfacing so many info"

"b" is the verifier's second job — independent retrieval over OTHER papers plus
corroboration/impact scoring. The instruction is: **single-paper verification only** — does the
claim faithfully represent the paper it cites.

## Confirmed, before changing anything

The reported symptom reproduced exactly. Running the projection in `--check` mode over the live
Agnes artifacts (7 claims + 7 verifications) put **all seven edges in `hold`**, including
`sleep_duration_min|correlates|hrv_sdnn_ms`, whose record shows:

- `quoteCheck {spansFound: 2, spansTotal: 2, allPresent: true}` — PASS
- `directionCheck {matchesClaim: true}` — PASS
- `claimKindCheck {matchesClaim: true, supportedKind: "correlational"}` — PASS
- `effectSizeCheck {matchesClaim: true, extractedSize: 4.4}` — PASS
- `scopeCheck {mismatch: true, ...}` and `corroboration {supporting: 1, contradicting: 1}` — both
  statements about the **eight retrieved OTHER papers**, not about the cited one.

`hold @ 0.385` came from `confidence 0.550 × [base 0.600 + tier 0.100 + corrob 0.000] = 0.385`,
i.e. the two other-paper terms dragged a fully faithful claim under `EDGE_GATES.mid` (0.5). That is
the mechanism #300 §E forbids: low credibility must be **surfaced via a caveat, never used to
reject**. The caveat field (#348) was already saying the right thing on that same record — "At
least one other study points the other way. Only one other study backed this up." — while the score
was silently converting it into a non-serving band.

## Changed

### `shared/brain/index.ts`

- **`SINGLE_PAPER_GATE`** (new config object, named constants, no inline literals per ADR-0002):
  `relevantVerdicts: ['supported','partial']`, `requireQuoteSpansPresent: true`,
  `requireDirectionMatch: true`, `requireClaimKindMatch: true`, `requireEffectSizeMatch: true`,
  `confidenceFloors: EDGE_GATES`, and `nonGatingSignals: ['corroboration','evidenceTier','impactTier','scopeCheck']`.
- **`singlePaperGate(v)`** (new, pure) — the serving decision. Returns `{passed, faithful, failures, band}`
  with named `SinglePaperGateFailure` codes (`irrelevant-verdict`, `quote-gate-failed`,
  `direction-mismatch`, `claim-kind-mismatch`, `effect-size-mismatch`, `below-confidence-floor`).
  Field reads are optional-chained so a malformed record fails **closed** to `hold` rather than
  throwing or serving.
- **`servingBand(v)`** is now a thin reader of `singlePaperGate`. **`edgeScore(v)` is unchanged
  bit-for-bit** — same composite, same non-servable-verdict short-circuit — and is now documented as
  a RANK only. `servableEdges` still sorts on it, so demoted signals still order edges.
- `EdgeScoreComponents` gained `gate: SinglePaperGateResult`; `band` is now exactly `gate.band`.
- `EDGE_GATES` numbers are **unchanged (0.8 / 0.5)**. What changed is what they floor: `confidence`
  instead of the composite. Docstring rewritten to say so.
- `SERVABLE_VERDICTS` now derives from `SINGLE_PAPER_GATE.relevantVerdicts` (one source).
- `'grounded-but-held'` review reason re-documented to point at `singlePaperGate(v).failures`.

### `tools/edge-loader/load_edges.mjs`

The `--check` printout now separates the two: a `gate (single-paper, decides serving)` line naming
`PASS` or the exact failure codes, and a `rank only (does NOT gate)` line carrying the RU2 component
breakdown that used to be presented as the reason for the band. The active record's `caveat` is
printed too, so an operator can see what the user would actually be told.

### Tests

- `tests/edge_score_components.test.ts` — the `mk()` helper now carries the single-paper fields
  (faithful by default, and `scopeCheck.mismatch: true` by default so the other-paper scope signal
  is *proved* inert). The `edgeScore` regression against the transcribed pre-refactor formula is
  kept verbatim; the old **band** regression against the pre-C15 logic is replaced, because it now
  asserts the exact behaviour this unit removes. Six new C15 units: the shipped
  `SINGLE_PAPER_GATE` values; floors read confidence not composite; each faithfulness check
  individually withholds even at `confidence 0.99` with nine supporting sources; a faithful record
  under the mid floor holds with `below-confidence-floor`; the bleakest possible other-paper picture
  (0 supporting / 3 contradicting / tier 1 / scope mismatch) still bands `high`; and a guard that
  iterates `nonGatingSignals` and asserts mutating each one never moves the band.
- `tests/edge_artifacts.test.ts` + `tests/fixtures/edges/README.md` — updated expected bands.

## Decided

- **A card can now be served on the strength of a single paper.** Stated without softening: nothing
  in the gate asks whether the wider literature agrees, and `EdgeVerification.caveat` (#300 §E) is
  the **only** mechanism carrying that risk to the user. That is the owner's explicit, informed
  choice, recorded as such here and in C15.
- **Demoted, not deleted.** The retrieval machinery still runs and still populates `corroboration`,
  `evidenceTier`, `scopeCheck` and the citation `impactTier`s; they are still stored, still projected
  to `edge_verifications`, still ranked on by `edgeScore`, and still the inputs to the caveat
  producer. `nonGatingSignals` is documentation-as-data with a test behind it, so re-promoting one
  silently is not possible.
- **`effectSizeCheck` as a hard gate is the strictest choice made here, and it is on the record.**
  In every live record where `matchesClaim` is false, `extractedSize` is `null` — "could not
  extract", which the caveat vocabulary calls `effect-size-unconfirmed`. Gating on it therefore does
  convert "we could not check" into a withhold. It is kept because the owner named effect size as
  one of the three cited-paper checks and because a claim asserting a magnitude its cited paper does
  not carry is unfaithful to that paper. It is the first thing to revisit if it over-blocks, and it
  is the sole reason `sleep_duration_min|correlates|resting_hr_bpm` stays `hold`.
- **Two live edges gained a band from the confidence-floor change alone**, not from the demotion:
  the superseded `2026-07-11` fixture row (composite 0.765, confidence 0.85) moved `mid → high`
  because 0.85 clears `EDGE_GATES.high` even though 0.765 did not. Bands are now coarser in that
  sense — a deliberate consequence of flooring confidence.

## Refused to change

- **The deterministic quote gate.** Untouched, and it is a *required* member of the new gate
  (`requireQuoteSpansPresent`). The O17 schema rule (a servable verdict requires a passing quote
  check) is also untouched; both O17 units still pass unmodified.
- **`independentRetrieval.performed` (accepted memory 0012).** Untouched. `enforce.ts` still forces
  `uncertain` when retrieval was not performed, and the gate reads `uncertain` as
  `irrelevant-verdict`. Retrieval is demoted as a *scoring* input only; it is still mandatory for an
  affirmative verdict to exist at all. Dropping that remains an owner-only amendment (§E asks for
  it; the last two sessions declined; so does this one).
- **The non-diagnostic copy gate, the decorrelation invariant, Agnes acceptance-only enforcement,
  and the R4-U4 artifact-trust / model-attestation gate.** None were read, relaxed or routed around.
- **`EDGE_WEIGHTS`.** Zeroing the `tier` and `corroboration` weights would have produced a similar
  banding outcome, and was rejected: it would flatten the ranking (every edge at
  `confidence × 0.6`) and delete the reviewer-facing breakdown instead of demoting it.

## Verified — before/after bands, real artifacts

`node tools/edge-loader/load_edges.mjs --from-dir <scratchpad>/edges3 --check` (no DB write, no
credentials), 7 claims + 7 verifications, all contract-valid both times:

| edge | verdict | conf | before | after | why (after) |
|---|---|---|---|---|---|
| `gut_comfort_score\|correlates\|mood_score` | partial | 0.65 | `hold @ 0.488` | **`mid @ 0.488`** | gate PASS |
| `sleep_duration_min\|correlates\|hrv_sdnn_ms` | partial | 0.55 | `hold @ 0.385` | **`mid @ 0.385`** | gate PASS (the owner's example) |
| `sleep_duration_min\|no_effect\|hrv_sdnn_ms` | partial | 0.55 | `hold @ 0.440` | **`mid @ 0.440`** | gate PASS |
| `sleep_duration_min\|correlates\|resting_hr_bpm` | partial | 0.55 | `hold @ 0.440` | `hold @ 0.440` | `effect-size-mismatch` |
| `hrv_sdnn_ms\|correlates\|spo2_pct` | unsupported | 0.92 | `hold @ 0.000` | `hold @ 0.000` | `irrelevant-verdict`, `direction-mismatch`, `effect-size-mismatch` |
| `sleep_duration_min\|no_effect\|resting_hr_bpm` | unsupported | 0.85 | `hold @ 0.000` | `hold @ 0.000` | `irrelevant-verdict`, `direction-mismatch`, `effect-size-mismatch` |
| `urine_colour\|correlates\|energy_score` | unsupported | 0.92 | `hold @ 0.000` | `hold @ 0.000` | `irrelevant-verdict`, `direction-mismatch`, `claim-kind-mismatch`, `effect-size-mismatch` |

`edge_score` is identical in every row before and after — the composite was not touched. Only the
band moved. The three new `mid` cards each carry a caveat, printed by the loader: e.g. "At least one
other study points the other way. Only one other study backed this up."

## Gates

- `tsc --noEmit` clean in `shared/`, `tools/edge-loader/`, `tools/brain-ingest/`.
- `tools/edge-loader`: **75/75** pass (`--test-concurrency=1`).
- `tools/brain-ingest`: **510/510** pass (`--test-concurrency=1`).
- `node tools/context_sync.mjs --check` passed; `git diff --check` clean.
- `supabase/functions/generate-insights` was not modified: it reads the precomputed
  `serving_band in ('high','mid')` columns and never re-derives gating, so the change reaches the
  serving path through the loader projection alone. Verified by grep that neither `composer.ts` nor
  `index.ts` imports `edgeScore` / `servingBand`.

## Left / blockers

- **This is a `shared/` change**, so promotion needs the two-reviewer PR process
  ([memory 0002](../memory/0002-shared-contract-two-reviewers.md)). No contract *type* was widened —
  the change is gating logic plus a new exported config object and function — but the reviewers rule
  is about `shared/`, so it applies. Not pushed, no PR opened, `main` untouched, per the brief.
- **`EDGE_GATES` is still uncalibrated** (RU2f). Flooring confidence rather than a composite removes
  one contested transformation (the additive quality score — Jüni 1999 / Cochrane) but does not
  calibrate anything. Still backlogged: **phase2-research-fixes B7**, ADR-0003 Open-Q 1–2.
- **Retrieval still has no synonym map** (`resting_hr_bpm` searches "resting"+"hr", never "heart
  rate"). This change makes that defect *less* harmful — a lexical-coverage artifact can no longer
  withhold a card — but the caveat text it feeds is still a statement about what the pipeline found,
  not about what the literature holds.
- **Nothing was re-run through the verifier**, and no artifact line was rewritten. The 7 records are
  the same bytes as before; only the derived projection changed.

memory: C15 — the serving band is now decided by single-paper faithfulness alone
(`shared/brain/index.ts` `SINGLE_PAPER_GATE` + `singlePaperGate()`): verdict relevance + the
deterministic quote gate + direction/claimKind/effectSize against the CITED paper, floored on
`confidence` (EDGE_GATES 0.8/0.5, numbers unchanged, now read against confidence not the composite).
Corroboration, evidenceTier, impactTier and the other-paper scopeCheck are DEMOTED to metadata —
still computed, stored and ranked on by `edgeScore` (unchanged bit-for-bit), but they cannot withhold
a card. **A card can therefore be served on the strength of a single paper, and
`EdgeVerification.caveat` (#300 §E) is the only mechanism carrying that risk to the user** — the
owner's explicit, informed choice, quoted verbatim in C15. 3 of the 7 live Agnes edges moved
hold → mid. No guard deleted: quote gate, O17, copy gate, decorrelation, Agnes acceptance-only and
`independentRetrieval.performed` (memory 0012) are all untouched.
