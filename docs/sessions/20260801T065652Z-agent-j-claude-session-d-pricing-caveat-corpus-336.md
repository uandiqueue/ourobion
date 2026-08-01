---
title: Session D — #336 pricing expiry, the caveat column, and the corpus-selection analysis
summary: gpt-5 pricing re-verified unchanged and its window extended to 2026-09-01; agnes-2.5-flash deliberately left expiring on 2026-08-08 because Agnes publishes no per-token price and the zero rests on an owner account-plan fact, so the verification deadline still stands and is escalated on #336. Adds the missing edge_verifications.caveat column as one forward migration, and records that the field was never actually unreachable (it rides in the verification jsonb) while the edge-loader still does not project it. Offline reproduction of the verifier's deterministic retrieval shows the one live verification ran on the thinnest metric pair in the corpus, with a query that cannot see its own object metric — so its 1-supporting/1-contradicting base is close to uninformative.
type: session
scope: shared
status: canonical
updated: 2026-08-01
memory: none
---

# Session D — #336: pricing expiry, the unreachable `caveat` field, corpus-selection analysis

Device `agent-j`, Claude. Branch `session-d/run4/issue336-pricing-caveat` off `dev-phase2-run4`
@ `c162393` (the integration tip named in the brief; re-checked at branch time).

Territory as carved out on #336: `tools/llm-router/router.config.json` (prices block only) and
one new forward migration under `supabase/migrations/`. Nothing else, plus this log.

**No provider calls this session.** No OpenAI, no Anthropic, no Agnes. Spend unchanged.

---

## 1 · Pricing expiry — gpt-5 renewed, Agnes escalated (NOT renewed)

`gpt-5` re-verified at the primary source already cited in the file
(`developers.openai.com/api/docs/models/gpt-5`): **$1.25 in / $10 out per MTok — unchanged**.
Extended `expiresAt` `2026-08-08` → `2026-09-01`, matching the `claude-sonnet-5` row so the file
carries one renewal date instead of three. `effectiveFrom` left alone (the price row did not
change, only its verification recency). Provenance keeps the original `operator-verified
2026-07-31` clause and adds the re-verification as a separate clause — this session is not the
operator and the record should not read as though it were.

`agnes-2.5-flash` is **deliberately untouched and still expires 2026-08-08.** Agnes publishes no
per-token price: its docs FAQ says "Our core AI models are free to use indefinitely", and its
official model catalog lists `agnes-2.5-flash` without pricing, stating billing "determined by
account and API key permissions". So the config's `inputUsdPerMTok: 0` rests on the owner's
2026-07-30 confirmation of *the account plan*, which only the owner can re-check. Renewing that
window unilaterally would re-assert a zero that fails **open** if stale — the router would reserve
0 USD per verifier call and the per-node ceiling would stop binding.

Escalated on #336 with the exact one-line edit ready to apply on an owner yes/no.
**The deadline is not cleared.** Agnes is the configured verifier and the only decorrelation-legal
one while Anthropic is off-limits, so `priceIsAuthoritativeAt` (`config.ts:82-89`, requires
`effectiveFrom <= now < expiresAt`) still goes false for it on 2026-08-08 and stops verification
entirely. No test pins the `2026-08-08` literal, so nothing else moved.

## 2 · `edge_verifications.caveat` — one forward migration

New: `supabase/migrations/20260801010000_edge_verifications_caveat_column.sql`. Nullable `text`,
no default, no backfill, no CHECK. `shared/**` untouched — the contract at
`relationships.schema.ts:189` is already complete and correct, as the brief said.

Two things the migration documents that are worth repeating here:

- **The three-state contract flattens to two in SQL.** `caveat: "…"` → the string; `caveat: null`
  (approved, no caveat) and *key absent* (producer predates caveats) **both** → NULL. The
  distinction is not lost, but it survives only in the jsonb, via `verification ? 'caveat'`. A
  consumer must not infer "producer predates caveats" from the column alone.
- **No CHECK, deliberately.** `caveat` is card copy and passes `validateCopyString` in the zod
  superRefine at `:201`. That is not expressible in SQL, and a partial CHECK would read as
  equivalent enforcement while catching strictly less.

Correction to the audit's framing, since it changes what is actually broken: **the field is not
unreachable today.** `edge_verifications.verification` is the full zod-validated `EdgeVerification`
jsonb and `load_edges.mjs` stringifies the record whole, so a caveat already lands in the DB and is
already exposed by `verified_edges` (which selects `v.verification`). What is missing is the
first-class column — so it cannot be selected, indexed, or projected the way every other
verification field is. `grep -rn caveat supabase/migrations/` returning nothing was correct; the
inference "can never reach a card" was too strong.

**Flagged, not fixed — outside the carve-out.** `VERIFICATION_COLUMNS` in
`tools/edge-loader/load_edges.mjs:67-83` is the explicit projection list and does **not** include
`caveat`. The column alone therefore stays NULL on every load until that list gains the field.
That file is Session A's territory; per the brief I stopped rather than widen scope.

**Verification gap, stated plainly:** the `Migrations — shadow apply (postgres:17)` job was **not**
run locally. Docker was not to be started on this machine, and there is no local psql. The
migration is two statements (`add column`, `comment on column`) and the doubled-quote escaping in
the comment literal was checked by eye, but the shadow apply on the PR is the first real
execution. Do not merge before that job is green.

## 3 · Corpus selection + verifier calibration (analysis only — no decision taken)

Method: the verifier's corpus-internal retrieval is deterministic (BM25-lite, `verify/retrieval.ts`)
and its query is built by `defaultTermsForKeys` (`synth/passages.ts:178`), so it reproduces offline.
Scripts ranked the local manifest and replayed `edgeScoreComponents`.

**Three limitations, load-bearing for every number below.** (a) Canonical text lives in R2, so the
ranking proxy is `title + abstract`, not full text — counts are *lower bounds*. (b) The local
manifest is 1232 records / 743 fetched / 728 over 5k chars; **R2 is authoritative at 756 fetched
and 739 over 5k** and those are the numbers to cite. (c) The concept regexes are a stand-in for the
`METRIC_TERMS` synonym map that does not exist yet — mine, not the pipeline's.

### The three #233 c24 candidates each fail on their own evidence

| candidate | what it is | disqualifier |
|---|---|---|
| `doi:10.1080/19490976.2026.2693397` | Gut *Proteobacteria* glycine metabolism → cocaine self-administration **in mice** | animal model; speaks to **zero** collectable metric concepts |
| `doi:10.1016/j.bbih.2026.101275` | "**A protocol for** the Teen Bugs study" | a protocol reports no results — there is no finding to quote, so it cannot ground a monotonic claim; population also narrow (adolescents post-adverse-caregiving) |
| `arxiv:2511.02766` | "Microbes in the Moonlight" — narrative **review**, arXiv | unrefereed and second-hand; "gut microbiota" is not a collectable metric (`gut_comfort_score` is a self-reported comfort score) |

The third is the only one that retrieves at all (rank 2 for gut×mood, rank 4 for gut×sleep) and is
the least bad, but "least bad review preprint" is a thin basis for the demo's one real claim.

### The larger finding: the pair matters more than the paper

Corpus capacity by metric pair — fetched papers speaking to **both** sides, and how many carry
directional language (i.e. could ground a *monotonic* claim):

```
both  dir   pair
  18    14   hrv_sdnn_ms x mood_score
   8     7   sleep_duration_min x hrv_sdnn_ms
   4     2   resting_hr_bpm x hrv_sdnn_ms
   2     1   sleep_duration_min x resting_hr_bpm      <- the one LIVE verification
```

No gut pair reaches the top 18. **The live claim was run on the thinnest pair in the corpus.** Only
2 fetched papers speak to both sides, only 1 of those carries directional language, and the other
is a **single-subject feasibility case study** (`doi:10.3389/fdgth.2025.1741400`, home HRV
monitoring in ASD) which could not corroborate a population-level claim anyway. So the corpus holds
effectively **one** usable corroborator for this claim (`doi:10.1371/journal.pdig.0001284`, alcohol
effects on heart rate/sleep/activity).

Against that, `1 supporting / 1 contradicting` is almost exactly what the corpus composition
predicts *whatever the claim's truth* — which is the honest reading of that result.

Compounding it: the shipped query for that claim is `[sleep, duration, resting, hr]` — it contains
neither "heart" nor "rate", because the A6 synonym map does not exist. In the fetched set, token
`hr` appears in 15 docs and `resting` in 6, while the phrase "heart rate" appears in 77. Of the 8
papers that speak to both sleep duration and heart rate, **only 1 carries the token `resting` and
only 1 carries `hr`**. The object metric contributes almost nothing to ranking; the retrieved set is
effectively "sleep papers".

### Scoring counterfactuals (`edgeScoreComponents`, confidence 0.82 as recorded)

- as recorded, `unsupported` → composite **0**, band `hold`, always (non-servable short-circuit).
- had the same evidence produced `supported`, it lands `mid` at **every** evidence tier (0.533–0.697)
  and never `high`.
- `high` at 0.82 needs evidenceTier **5 AND net corroboration ≥ 3** — exactly 0.820.
- **net corroboration ≤ 0 scores identically to no evidence at all:** 1S/1C, 3S/3C and 1S/5C all
  give 0.615. A contradicting source beyond parity is invisible to the composite. Recorded as an
  observation about the scoring form, not fixed — not this session's territory.

### Framing, per the brief

This is **calibration evidence, not a correctness verdict on the claim**. Nothing here says the
verifier was wrong to return `unsupported`. What it says is that the retrieval it judged over was
lexically unable to see its own object metric, over a pair the corpus barely covers — so the result
is close to uninformative about the underlying biology either way. What would make it informative:
the A6 synonym map (or a `--terms` expansion) so the query can see "heart rate", and a pair the
corpus actually covers.

### One scope correction on the brief's dependency chain

#336 states this blocks #240 req 4, #246 and #179. Checked at head: **#179's positive downstream
evidence uses the labelled committed *fixture* edge `sleep_duration_min|increases|hrv_sdnn_ms`**
(#179 body, lines 61-62), not a real-corpus edge, and #246 is scoped to a local-only 14+7
positive-control run. #240 req 4 ("produce or recover one genuinely provider-attested **monotonic**
verification") is the one squarely blocked — and note its wording is already satisfied in form by
the live Agnes run, which *is* monotonic and provider-attested. What is not satisfied is a
*servable* one, since `unsupported` can never leave `hold`.

## Gates

`node tools/context_sync.mjs --check` and the landing-budget measurement were run immediately
before push; results are on the PR. Migration shadow-apply is CI-only this session (see §2).
