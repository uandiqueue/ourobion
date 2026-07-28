---
title: Run 4 provider-backed paper and Biotope insight test
summary: Local-only issue-189 evidence for OpenAI synthesis over selected passages from a fully extracted paper, Anthropic verifier-only abstention, fixed-edge matched health data, and physical-Android rendering.
type: test-report
scope: shared
status: canonical
updated: 2026-07-28
---

# Run 4 provider-backed paper and Biotope insight test

Issue: #189
Branch: `test/brain/run4-provider-e2e`
Worktree: `C:\project\ourobion-run4-provider-189`

## Verdict

- **Provider-backed paper authoring: partial / fail-closed.** The complete 91,162-character paper was
  extracted and canonicalized locally. The checked-in synthesis path then selected 12 evidence passages
  and sent those passages—not the complete text—to OpenAI. OpenAI produced one claim that passed the
  implemented schema, active-metric, exact-quote, offset and non-diagnostic-copy gates. Anthropic then
  performed the only verifier role and returned `uncertain`. The sole paper was echo-excluded from
  independent retrieval, leaving zero independent sources; the paper-derived edge therefore remains
  non-servable and produced no Biotope card.
- **Fixed-edge health-to-insight flow: PASS.** The local reset, fixture-edge load, 21-day Nao loader,
  baselines, 120 personal signals, five fired patterns, insight generation, provenance, human rejection,
  seeds and gaps completed **20/20**.
- **Physical Android rendering: PASS, observational only.** The already-installed Biotope build signed
  into the disposable local user, rendered the 21-day gut-comfort trend, rule cards, both relationship
  cards and an expandable research-basis panel. UI source remains externally owned and was not edited.
- **Sentence-provenance tranche: NOT RUNNABLE.** `StructuredPaper`, retained sentence IDs/roles/sections,
  A4b reference mapping, A6 co-occurrence/root graph, A7 assertion flags and NLI are planning-only under
  B-PL22. The configured `extract_assist` node has no production caller.

## Provider roles and spend

The user corrected provider ownership during the run: **OpenAI is the main paper-synthesis driver;
Anthropic is verifier-only.** The first reversed-role experiment is retained as superseded evidence and
counted because it incurred spend.

Repository price rows are provisional. SGD conversions below use the harness's declared 1.29 SGD/USD
assumption; provider billing remains authoritative.

| Call | Role | Input | Output | Estimated USD | Disposition |
|---|---:|---:|---:|---:|---|
| Anthropic attempt 1 | reversed-role synthesis | 8,008 | 1,600 | 0.048024 | superseded; truncated |
| Anthropic attempt 2 | reversed-role synthesis | 8,059 | 1,723 | 0.050022 | superseded |
| OpenAI exploratory | reversed-role verifier | 651 | 758 | 0.00839375 | superseded |
| OpenAI official | main synthesis over 12 selected passages | 17,558 | 1,989 | 0.0418375 | accepted test evidence |
| Anthropic official | verifier-only | 1,099 | 170 | 0.005847 | accepted test evidence |

- OpenAI locally reconstructed total: **US$0.05023125 / ~SGD 0.0648**, versus the SGD 20 ceiling.
- Anthropic locally reconstructed total: **US$0.103893 / ~SGD 0.1340**, versus the SGD 2 ceiling.
- These are estimates from returned token counts and provisional repository price rows—not invoice or
  provider-console totals. The SGD ceilings were operator limits, not aggregate router-enforced caps;
  the router enforced its separate per-node USD/token limits.
- No provider retries remain pending and no further provider call is required for this test.

## Paper-derived relationship

- Paper: `doi:10.1016/j.isci.2026.116224`
- Edge: `gut_comfort_score|correlates|mood_score`
- Claim kind: `correlational`; effect size: absent.
- Population emitted by OpenAI: IBS patients comorbid with anxiety and depression.
- Exact quote gate: 1/1 present at canonical-text offsets `53297..53591`.
- Anthropic verification: `uncertain`, confidence `0.95`, supporting `0`, contradicting `0`, retrieved
  sources `0`, no fallback. High confidence here means confidence that the evidence is insufficient.
- Expected serving result: **hold / zero paper-derived cards**. With one paper, verifier echo-control
  correctly prevents that same paper from masquerading as independent corroboration.

Scientific-quality finding: OpenAI described the evidence as an RCT but emitted citation
`evidenceTier: 5`; the prompt defines RCT as tier 4 and review/meta-analysis as tier 5. The current
postprocessor validates the numeric range but does not enforce study-design-to-tier semantic agreement.
Do not promote this edge without fixing/rechecking that gate.

## Synthetic health data loaded

The disposable user `u12-demo@ourobion.local` received 21 backdated days, 2026-07-08 through
2026-07-28, with `data_origin/source = simulated:run2-demo`. Every day contains one raw gut row and one
wearable row.

| Metric | Exact range / aggregate |
|---|---|
| Gut comfort | 2..5, mean 3.52 |
| Mood | 3..5, mean 4.00 |
| Energy | 2..5, mean 3.86 |
| Urine colour | 1..5, mean 2.90 |
| Stool form | 2..6, mean 4.10 |
| Sleep | 286..503 minutes, mean 430.52 |
| HRV SDNN | 35.9..69.8 ms, mean 54.52 |
| Resting heart rate | 56..69 bpm, mean 62.19 |
| Steps | 4,167..13,512, mean 8,398 |
| SpO2 | 96.9..98.1%, mean 97.49 |
| Body temperature | 36.4..37.2 C, mean 36.70 |
| Other truth | bloating on 7 days; standing water on 4; antibiotics on 0; completeness 62.71..100%, mean 84.51% |

The final seven days (2026-07-22..28), which make the fired patterns easy to inspect, were:

- gut comfort: `3, 3, 4, 4, 2, 2, 3`
- energy: `4, 4, 4, 5, 2, 3, 3`
- urine colour: `2, 3, 4, 3, 3, 4, 5`
- stool form: `4, 4, 5, 3, 6, 5, 5`
- sleep minutes: `448, 380, 448, 463, 286, 379, 396`
- HRV SDNN: `52.5, 49.3, 64.2, 59.1, 35.9, 47.1, 54.9`
- resting heart rate: `62, 67, 60, 57, 69, 64, 63`

## Insights returned and rendered

Rule cards:

1. `Energy pattern this week` — declining energy over the past week.
2. `Gut comfort pattern` — declining gut comfort over the past week.
3. `Gut consistency pattern` — notably stable stool consistency.
4. `Hydration pattern this week` — rising urine-colour pattern.

Research-linked cards from fixed test relationships:

1. Sleep duration shifted down; fixed research edge reports sleep tends to raise HRV SDNN.
   Payload branch `agree`, edge band `high`, edge score `0.9`, 21/28 days present. It rendered as
   `Medium confidence` in the installed UI.
2. After human rejection of the first serving edge, the next pipeline run produced the alternate sleep
   duration -> lower resting-heart-rate card. Payload branch `agree`, band `mid`, edge score `0.56`,
   21/28 days present. It rendered as `Low confidence`.

The research-basis panel rendered and expanded, but currently exposes the raw snake-case edge ID and
verification date rather than a complete human-readable citation. This is observational UI evidence,
not a UI patch request.

## Remaining blockers / next actions

1. Checked-in routing is still OpenAI synthesis + OpenAI verifier under single-provider `testMode`.
   The user-authorized OpenAI-main/Anthropic-verifier roles were exercised through an isolated in-memory
   config only. A durable routing change must reconcile `config.ts`'s current prohibition on Anthropic
   verification and replace the inaccurate fixed test-mode label.
2. The standard synthesis path currently sends at most 12 deterministically selected passages, not the
   complete canonical text. Treat complete-paper extraction/storage and provider prompt coverage as
   separate facts; change and re-test prompt coverage before claiming full-paper LLM synthesis.
3. Implement B-PL22 before claiming sentence-level provenance, JATS sections, citation roots, assertion
   status or NLI execution.
4. Add at least one independent corroborating paper before expecting a paper-derived edge to serve.
5. Add a deterministic study-design/tier agreement gate; the provider run exposed RCT -> tier-5 drift.
6. Re-run Android rendering after the separately owned final UI lands. No UI files were changed here.
7. No hosted write, deployment, training, model promotion or scientific-validation claim occurred.
