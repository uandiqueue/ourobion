---
title: Run 4 — rebalance the seed pool across metric families and add relation seeds
summary: Replaced a 16-topic gut-anchored seed addition with 27 family-balanced topics plus 5 relation/edge seeds, covering 20 of 21 seedable active metrics instead of concentrating on the 4 gut ones, and added a test that fails if any family goes unseeded or gut ever becomes a majority.
type: session
scope: shared
status: canonical
updated: 2026-08-01
---

# Run 4 — seed pool rebalance (#307 D5 / #297)

Issue: #307; branch: `feat/brain/flowtest-300-batch`; base: `226bfef` (the PR #322 merge);
device: `agent-j`; agent: `claude` (Opus 5, 1M context).

## Attempted

- #307 D5 / MVP goal 1: add ≥20 seed topics to the static pool so ingestion can evidence the app's
  own metric pairs, then run bounded ingestion.

## Changed

`tools/brain-ingest/src/seeds.ts` — **6 → 33 topics**: the 6 originals untouched, 22 new
family-balanced topics, and **5 relation/edge seeds**.

`tools/brain-ingest/tests/seeds.test.ts` — new test
`#307 D5: the pool spans every active metric family, not just gut`, plus the six-domain test
rewritten to assert the originals *survive* rather than that they are the whole pool.

`dbSeeds.test.ts`, `run.test.ts`, `seeder.test.ts` — three assertions that hardcoded the old pool
size (`6`, `7`) now derive from `SEEDS.length`.

## Decided

- **The first pass was a gut monoculture, and I implemented it despite spotting the problem.** I
  wrote 16 topics of which all 16 were gut-anchored — including ones that look like other families
  (`phq9_gastrointestinal`, `cognitive_function_gut_brain`, `social_functioning_gut_symptoms`) but
  route a **non-gut metric through a gut lens**. Against the real registry that is backwards: of 24
  active metrics only **four** are gut, while six are wearable physiology, seven
  mental/cognitive/social and two vector. Ourobion is a One Health monitor, not a gut-health app.
  I flagged the imbalance in my own review note — *"fourteen of sixteen new seeds pair against
  `gut_comfort_score`… the corpus will stay thin on the wearable pairs"* — and then submitted it
  anyway instead of pushing back before implementing. The owner's per-family table is what made it
  undeniable.
- **The root cause was upstream of the audit.** #297's framing said the gap was "subjective
  gut-comfort literature", because its whole diagnosis came from **one pair**
  (`gut_comfort_score × mood_score`). Session C followed that framing faithfully; the audit method
  was sound and the input scope was wrong. Worth recording because the failure is not "C chose
  badly" — it is that a single-pair diagnosis became a corpus-wide seeding strategy without anyone
  re-checking the scope.
- **Balance is also the likeliest lever on blueprint yield**, which is the owner's insight and
  changes how I read the D1 measurement. A blueprint needs a pair of **active** metrics, so a corpus
  that can only evidence gut pairs can only yield gut blueprints — which is exactly what
  1 blueprint per 15 papers looks like when 20 of 24 metrics are not gut. Broadening costs runner
  time, not provider budget, so it is the cheapest available lever.
- **Single-metric seeds do not directly feed the demo's unit of account.** Each seed above deepens
  one metric, but a claim needs BOTH endpoints active and a blueprint needs a PAIR. The 5 relation
  seeds target two measures *together*, chosen by **measured co-occurrence** in the existing corpus
  rather than guesswork — `hrv_sdnn_ms × resting_hr_bpm` (70 papers), `anxiety_score × mood_score`
  (30), `focus_score × mood_score` (30), `anxiety_score × hrv_sdnn_ms` (25), `energy_score ×
  mood_score` (12) — and spread **across** families so they widen the reachable pair surface rather
  than deepening a corner of it.
- **A guard, because the monoculture was invisible for lack of one.** Nothing asserted balance, so a
  16-for-16 skew passed every test. The new test fails if **any** family has an unseeded active
  metric, and separately if gut-anchored seeds ever become a **majority** of the pool. A future
  regression is now a red test rather than something the owner must catch by reading slugs.
- **Boundaries carried over unchanged**: `spo2_pct` left entirely unseeded (broad SpO2 queries pull
  diagnostic literature, outside a non-diagnostic product's scope); `body_temp_c` only via the narrow
  `circadian_body_temperature`; `notes` and `log_completeness` excluded as app-measuring rather than
  person-measuring; every query framed as measurement/association, never diagnosis or treatment
  efficacy; slugs are seed identifiers and register no metric.
- **`topicTags` carry the target registry metric** beside the seed slug (`ibs_sss` tags
  `gut_comfort_score`). This is my addition, not something the pool specified: it gives the screening
  pass a direct paper→metric handle and it is what makes the per-family coverage table computable at
  all. Owner-approved.

## Verification

| Gate | Result |
|---|---|
| `tools/brain-ingest` typecheck / tests | clean / **464/464** |
| topics | **33** (6 original + 22 balanced + 5 relation) |
| gut-anchored share | **7 of 28** non-relation topics — a minority, asserted by test |

Per-family coverage of the 24 active metrics, computed from `topicTags`:

| Family | Active | Covered |
|---|---|---|
| Wearable physiology | 6 | **5** (`spo2_pct` deliberately unseeded) |
| Mental / cognitive / social | 7 | **7** |
| Vector / One Health | 2 | **2** |
| Hydration / diet | 2 | **2** |
| Gut | 4 | **4** |

**20 of 21 seedable active metrics.**

- **Ingestion had NOT run at any point** while the gut-heavy pool existed: manifest stayed at 1,298
  records, and no `ingest`/`resume` process was ever started. Nothing needed undoing.
- **No provider calls for this unit.** Spend unchanged at **US$1.118 OpenAI · Anthropic 0 · Agnes
  18/50**. The one `seed-queries` call earlier in the session confirmed the agentic seeder is
  structurally insufficient on its own: it generates 16 candidates, but **eight of its ten metric
  pairs are product derivation/completeness relationships**, so it asks the literature about our own
  derivation graph. Candidate count is not coverage.

## Left

- **Bounded ingestion** at ~100 papers/seed (33 × 100 ≈ 3,300 papers), runner time only.
- **Re-screen the candidate count** afterwards: the 165 figure was measured on the old corpus *and*
  against bare snake_case metric keys, so #318's `ui.label` additions move it too.
- **Per-family coverage artifact** post-ingestion — measured, not assumed.
- Session C owns revising `docs/temp/run4/seed-coverage-audit-297.md` to report by family.
- Layer 2 of D2 (the verifier-side `mechanismCheck`), A5 (snapshot pin removal), A3 (the full batch).

## Blockers

- None.

memory: none
