---
title: Ourobion — Launchpad 2026 AI Challenge Write-up
summary: The judge-facing submission. Five-pillar structure, under the 1,000-word cap, with every quantitative claim re-measured by running a command on 2026-08-02 rather than copied from notes.
type: reference
scope: repo
status: draft
updated: 2026-08-02
---

# Ourobion

*An ouroboros drawn as a living cell, and deliberately left open — because in biology the loop of
understanding never closes. The app is built to keep reading.*

## Problem

Consumer health apps collect diligently and explain almost nothing. People log for a fortnight, see
their own numbers played back at them, learn nothing they did not already know, and stop. The missing
ingredient is not sensors. It is a reason. Telling someone "your gut comfort tracks your sleep" and
meaning it requires pointing at literature that supports it.

In a real health company, a team does that work. We are two people. That constraint — not an interest
in AI — produced this architecture: if we cannot hire a research department, the product has to run
one.

Existing approaches pay for this in one of three currencies. **Reliability**: assert what you cannot
back. **Cost**: hire the team. **Users**: ship a dashboard nobody returns to. We wanted to pay in
none of them.

Success criteria, fixed before we built: every claim a user sees must trace to a named sentence in a
specific paper, and must survive a check by a model that did not write it.

## Approach

Ourobion is two surfaces over one research pipeline. **biotope** is the phone app — under thirty
seconds of logging a day, and cards describing patterns in your own data. **nao** is the operator's
window into the pipeline that produces the evidence. They share data, not code, so the trust work
finishes before anything reaches a person.

The pipeline reads open-access papers, proposes a relationship between two health metrics, and then
checks it.

The check is the real design decision. We ruled out letting one model review its own work. In an
earlier project of ours, every internal check ran on a single model family, shared that family's blind
spots, and one error survived three rounds of same-family fixing — caught only when a different model
on a different platform looked at it. So here, synthesis and verification run on deliberately
different vendors, and the router refuses to start if the two belong to the same family. This is the
Swiss-cheese model from safety engineering (Reason, 1990): many imperfect layers, arranged so their
holes do not line up.

Around the models sit layers that need no judgement at all: a gate requiring verbatim quotes with
character offsets, a gate rejecting diagnostic language, and a gate deciding whether an edge may be
shown.

## Evidence

Measured on 2026-08-02 by running commands, not read from notes.

**Corpus.** 21,824 records discovered, 14,726 open access, 911 with full text extracted, 894 of those
over 5,000 characters.

**Pipeline.** 14 verified relationships; 11 pass the serving gate.

**Decorrelation** is not an assertion — it is a check that prints:
`Decorrelation: OK — synthesis=openai, verifier=agnes (independent families enforced)`

**Tests.** 2,605 passing, 27 skipped, none failing, across Flutter, TypeScript, Deno, Python and SQL.

**Against baselines, not in isolation.** We trained two small classifiers to test whether specialist
models could do parts of this more cheaply:

- *Viceroy*, classifying causal language: macro-F1 **0.8656** (95% CI 0.8327–0.8958), against
  **0.5068** for a cue-lexicon baseline and **0.1535** for majority-class. Its dangerous error —
  reading a correlational statement as causal — occurs in **4.52%** of cases, against **13.57%** for
  the baseline.
- *Zebra*, classifying claim against evidence: macro-F1 **0.5991 ± 0.0081** against its own
  pre-registered bar of 0.70. **It failed.**

**Against a general model.** On 96 real ingested papers, both disagreed with Claude Haiku 4.5 on
roughly 43% and 48% of items (κ ≈ 0.2). Unadjudicated, so this measures disagreement, not correctness.

Neither classifier is wired into the product.

## Constraints

Cost is capped in configuration rather than intention: **US$1 per day per pipeline node**, a hard stop
at 95% of it, and 60,000 output tokens per run. The verifier currently runs on a **free tier that
expires 2026-08-08**; after that this leg stops until it is renewed. That is a real dependency and we
would rather name it than discover it on stage.

**Safety.** All 31 database tables carry row-level security. Personal health data is isolated from
anything shared. Every user-facing string passes an automated non-diagnostic check — the app describes
patterns, and is structurally prevented from suggesting a condition.

**Compute.** Android builds run inside a bounded 1.5 GB heap on a 16 GB machine, serialised, because
that is the hardware we have.

## Honesty & Trajectory

**The last mile is not connected.** One card has been generated from a verified relationship, and it
is archived rather than active. Open biotope today and you will see **no** paper-derived card. Every
card a user currently sees comes from their own data.

**The gate is narrower than it sounds.** It checks whether a claim is faithful to *the paper it
cites* — real quotes, correct scope, matching effect size. It does not ask whether the wider
literature agrees. A card can therefore be served on the strength of a single paper, and a caveat
field is the only thing carrying that risk to the reader. That was a deliberate, recorded decision,
not an oversight.

**Zebra missed its own bar and was not shipped.** The refusal is enforced in code — the runner stops
at its native labels and will not map them onto the product's vocabulary — rather than left to
discipline.

**Next, in order.** Connect the last mile so a verified relationship reaches the active feed;
adjudicate the disagreement pilot against ground truth; replace the free verifier tier before it
expires; and widen the fetch stage, because 911 usable papers out of 21,824 discovered is the real
bottleneck.

We keep a running record of what we got wrong and what caught it. It is in the repository, and it is
the part we would most like you to read.

*What existed before this challenge and what is new is itemised in Appendix B.*

## Appendix A — Claim → file/PR map

| Claim | File / PR |
|---|---|
| Grounding invariant, `EdgeVerification`, `independentRetrieval` | `shared/brain/relationships.ts`, `shared/brain/index.ts`, `shared/brain/relationships.schema.ts` |
| `supported`/`partial` require fidelity to the cited paper (not a corroboration headcount) | `shared/brain/relationships.schema.ts:236,245` — PR #355 removed the former `supporting >= 1` rule |
| Caveat may be model-authored, kept only if it names a measured limitation | `tools/brain-ingest/src/verify/caveat.ts` — `chooseCaveat()`, `corroboratesAFiredFlag()` |
| Personal cards declare themselves unverified to the user | `supabase/functions/generate-insights/render.ts` — `PERSONAL_CARD_TEMPLATE` |
| Whole-paper synthesis (no passage prefilter) | `tools/brain-ingest/src/synth/paperPrompt.ts`, `paperRun.ts`, `paperPostprocess.ts` |
| 20 claims / 12 cited blueprints, 40 papers | `data/corpus/edges/claims.jsonl`, `blueprints.jsonl` (machine artifacts) |
| 14 verifications → 14 verified edges, 11 servable | Hosted `edge_verifications` / `verified_edges`, read 2026-08-02; `verification-raw.jsonl` for provider attestation |
| 45 insight cards, 0 with `producer='edge'` | Hosted `insight_cards`, read 2026-08-02 |
| Corpus counts (20,912 discovered / 911 fetched / 894 usable) | `data/corpus/papers.jsonl` |
| US$1.80 all-time spend | `data/llm-router/ledger.json` |
| Decorrelation enforced (openai vs agnes) | `tools/llm-router/router.config.json`; `llm-router check-config` output |
| Free-priced node bounded by attempt journal | `tools/llm-router/src/attemptJournal.ts` |
| Verification + retrieval | `tools/brain-ingest/src/verify/` |
| Deterministic insight engine | `tools/rules/`, `supabase/functions/generate-insights/` |
| App surface | `apps/biotope/lib/` |
| Ingestion control plane (GitHub Actions dispatch) | `apps/nao/`, `.github/workflows/brain-ingest.yml` |
| Decision log / Approach source | `docs/implemented/nao/brain-synthesis-design.md`, `brain-ingestion-design.md`, `nao-app-design.md`, `brain-support-models-design.md` |

## Appendix B — Prebuild / delta split

| | Count | Span |
|---|---|---|
| Prebuild | 118 commits, ending `2214fbb` (merge of PR #38) | through 2026-07-03 |
| Delta snapshot | 248 commits through `547280f` | 2026-07-13 → 2026-07-28, before this write-up commit |

Re-measured directly from `git log` on 2026-07-28: `git rev-list --count 2214fbb..547280f` returns
248. The write-up commit and later reconciliation merges are deliberately outside that frozen
snapshot. No commits exist between 4 and 12 Jul — the delta is ~16 days of work, not four continuous
weeks.

**Action still required before submission:** `git tag -l` returns empty — the `pre-hackathon-baseline` tag
has not been created yet. Until it exists, the sentence "everything before the tag is prior work" is not
independently checkable by a judge; only the commit-date argument above is. Tagging `2214fbb` closes this
gap in one command (see Appendix C).

## Appendix C — Suggested tagging command (not yet run)

```bash
git tag -a pre-hackathon-baseline 2214fbb -m "State before Launchpad 2026 build sprint"
git push origin pre-hackathon-baseline
```

## Appendix D — Cost (measured, aggregate only)

From `data/llm-router/ledger.json`, every LLM call this project has ever made:

| Date | Node | Calls | Spend (USD) |
|---|---|---|---|
| 2026-07-16 | seeder | 2 | 0.041646 |
| 2026-07-16 | synthesis | 1 | 0.063840 |
| 2026-07-25 | verifier | 2 | 0.000725 |
| 2026-07-31 | synthesis | 2 | 0.093090 |
| 2026-08-01 | seeder | 2 | 0.020233 |
| 2026-08-01 | synthesis | 40 | 1.584520 |
| 2026-08-01 | verifier (Agnes) | 10 | 0.000000 |
| **Total** | | **59** | **≈ 1.804** |

Agnes rows are an exact zero, not a missing figure: its plan is priced at zero per token until 2026-08-08.
The 2026-08-01 synthesis batch works out to ≈ US$0.040 per paper. Locally reconstructed; provider billing is
authoritative. Per-edge, per-stage latency was not captured — named as the next measurement to take, not
invented here.

**Two limits on this table, stated rather than smoothed over.** The ledger is **gitignored and
machine-local**, so it is not a repository artifact a judge can re-derive. And it records **10** Agnes
verifier calls on 2026-08-01 against **14** hosted verifications — those do not reconcile from here, most
likely because the verification pass ran on another machine or worktree with its own ledger. The USD total
is unaffected either way, since the Agnes leg is priced at zero; but **do not present 59 as the pipeline's
call count.** It is this ledger's call count.

## Appendix E — The verifier's actual output (all 14 edges)

Read directly from the hosted `verified_edges` / `edge_verifications` tables on **2026-08-02**, after
PR #355 rebound the verdict to single-paper fidelity. Provider-attested `agnes-2.5-flash`.

**Verdict distribution:** 1 `supported`, 10 `partial`, 2 `uncertain`, 1 `unsupported`. Confidence
0.72–0.92. Servable verdicts are `supported` and `partial`, giving **11 servable of 14**.

| Band | Score | Edge |
|---|---|---|
| `high` | 0.779 | `gut_comfort_score \| correlates \| mood_score` |
| `high` | 0.697 | `hrv_sdnn_ms \| correlates \| spo2_pct` |
| `high` | 0.690 | `stool_form \| correlates \| anxiety_score` |
| `high` | 0.680 | `stool_form \| correlates \| mood_score` |
| `mid` | 0.663 | `urine_colour \| correlates \| energy_score` |
| `high` | 0.656 | `stool_form \| correlates \| symptom_flags` |
| `high` | 0.656 | `stool_form \| correlates \| stool_count` |
| `mid` | 0.648 | `anxiety_score \| correlates \| symptom_flags` |
| `high` | 0.637 | `hrv_sdnn_ms \| correlates \| anxiety_score` |
| `mid` | 0.612 | `sleep_duration_min \| correlates \| resting_hr_bpm` |
| `high` | 0.574 | `resting_hr_bpm \| correlates \| anxiety_score` |
| `hold` | 0.000 | `sleep_duration_min \| decreases \| resting_hr_bpm` |
| `hold` | 0.000 | `sleep_duration_min \| correlates \| hrv_sdnn_ms` |
| `hold` | 0.000 | `resting_hr_bpm \| correlates \| hrv_sdnn_ms` |

**What a verdict here does and does not assert.** Since PR #355 it answers one question: *is this claim a
faithful reading of the single paper it cites?* — judged against quote spans the deterministic A9 gate
already proved verbatim. It is **not** a finding that the relationship is true, nor that the wider
literature agrees. Corroboration, impact tier and evidence tier are still computed and stored, but they
reach the user only through the caveat. Three edges sit at `hold` with score 0.000, so the refusal path is
live, not vestigial.

**The caveats are real, and some are the model's own words.** `chooseCaveat()` keeps the verifier's
sentence when it passes the non-diagnostic copy gate *and* names a limitation that actually fired;
otherwise it emits a derived sentence. Both paths occur on the stored records. Verbatim examples:

- *"Only one source (S7) addresses both resting HR and anxiety, and its quoted passages report that…"*
- *"The only source reporting a correlation between resting heart rate and SDNN (S7) studied lung c[ancer patients]…"*
- *"Only S4 supports the claim, and it studies GI-specific anxiety in IBS patients — it does not ad[dress]…"*
- *"Only one other study backed this up. The people studied may not be a close match for you."*

The fourth is a composed *derived* caveat — two template sentences joined — and it is reachable precisely
because corroboration was non-zero on that record. **An earlier revision of this write-up claimed these
sentences were unreachable template strings and must not be quoted as verifier output. That was wrong**,
on two counts: model-authored caveats are kept whenever they qualify, and PR #355's `citedPaperAssessed`
opens the quality-of-backing flags even at zero corroboration.

**What is still not proven.** Nothing about accuracy. 14 verdicts, no labelled gold set, no baseline to
compare against — that is not a rate and not a wrong-accept/wrong-reject measurement. Corroboration counts
also remain depressed by our own retrieval defect (no metric alias map), so they measure our vocabulary
coverage rather than the literature.

## Appendix F — Prior art (Problem-pillar positioning)

GRADE and Cochrane systematic-review methodology (manual evidence grading, the rigor benchmark this system
automates a narrow slice of); SciFact, HealthVer, HealthFC (offline scientific-claim verification
benchmarks); published adversarial fact-checking work (PROClaim, FC-MAD, Tool-MAD) as prior art for
cross-examining one model with another.

## Appendix G — Attribution (summary; not yet committed as `ATTRIBUTION.md` in the repo root — see below)

- **OpenAI** (`gpt-5`, `gpt-5-mini`) — synthesis and seeder LLM, used. 45 calls, US$1.80.
- **Agnes AI** (`agnes-2.5-flash`) — adversarial verifier, used; **this is the verifier that actually ran**,
  producing the 14 verifications in Appendix E, priced at zero. (The local ledger records 10 calls; see
  Appendix D on why that does not reconcile with 14 and should not be quoted as the call count.)
- **Anthropic** (Claude family) — declared in the router's provider table and used by one older synthesis
  call on 2026-07-16 that still contributes one claim on disk. It is **not** the verifier, and earlier
  drafts of this write-up saying so were wrong.
- **GMI Cloud** — not used; no run exists behind it, so nothing is credited or claimed.
- **Support-model training data** — the datasets and checkpoints are excluded from this submission pending
  issue #277, so no dataset is credited here as training a submitted artifact. Nothing in that line
  influences any output described above, and CI enforces that with an import ban.
- **OpenAlex, CORE, PubMed, Semantic Scholar, Lens, Unpaywall** — paper discovery / retrieval, prebuild.
- 25 AI-generated image assets in `apps/biotope/assets/images/generated/` — generator and terms to be
  confirmed and named in the repo's `ATTRIBUTION.md` before submission.
- Coding assistants (Claude Code) used in development — disclosed per the rules; the team remains
  accountable for every claim above.

## Appendix H — System connection map

[`system-connection-map.md`](../plan/system-connection-map.md) — how Biotope, Supabase, *nao*, the brain
pipeline, and CI actually connect, with an explicit evidence label on every component. It is the
companion to Appendix A: where A maps a claim to a file, H maps a *component* to the strength of the
evidence behind it, using a fixed label set that keeps "configured target" separate from "deployed".

Read it before making any infrastructure claim in a submission or demo. Its §9 lists the statements
that are safe to make and the ones that are not — including that no component of this system is
proven deployed. Its verifier row has now been corrected twice: it said the verifier had never run, then
that it ran but promoted nothing, and both are out of date — it has produced 11 servable verdicts of 14
(Appendix E). Like this write-up, it is a submission-facing projection, not architecture authority; the
canonical docs it links to win any disagreement.

## Appendix I — Defects this batch found, stated rather than filtered

Running synthesis at 40 papers surfaced four faults that one paper never would. All four are measured from
the artifacts in Appendix A, not inferred.

1. **A claim was emitted on `log_completeness`** — an app-internal bookkeeping metric measuring how fully a
   user filled in their log. No paper can speak to it. It was filtered downstream, but the synthesis gate
   should have barred the key outright and did not.
2. **The edge dedupe key is order-sensitive.** Both `stool_form|correlates|stool_count` and its mirror
   `stool_count|correlates|stool_form` were stored as distinct edges. For a symmetric relation like
   `correlates`, those are one edge.
3. **Contradictory relations on the same pair are retained side by side.** `sleep_duration_min` against
   `resting_hr_bpm` exists three times — `correlates`, `no_effect`, and `decreases`; `sleep_duration_min`
   against `hrv_sdnn_ms` exists as both `correlates` and `no_effect`. Reconciling disagreeing papers is
   precisely the job we claim to do, and today we store the disagreement instead of resolving it.
4. **The manifest writer was O(n²).** `Manifest.upsert()` rewrote the entire 60 MB manifest per record,
   roughly 21,000 times. Invisible at 1,232 records; the dominant cost at 21,823. Patched with batched atomic
   checkpoints. A related integrity bug survives it: one record's title contains raw newlines, so that record
   spans four physical lines and breaks the one-record-per-line invariant the file's streamability depends on.

**One adjacent caveat, and one retraction.** `supabase/deploy-attestation.json` asserts entrypoint hashes
that no longer match the tree for three of its four edge functions (`generate-insights`, `evaluate-signals`,
`run-pipeline`; `compute-baselines` still matches). Regenerating them needs Docker, which no session had, so
PR #347 merged with that gate red on an explicit owner decision.

**Retracted:** an earlier revision listed a fifth defect claiming the card caveat sentences were unreachable
hardcoded templates that must never be quoted as verifier output. That was wrong — see Appendix E. Caveats
are produced, stored, and frequently the model's own words.

---

*Word count, five pillar sections only: **999** whitespace-delimited tokens against the 1,000-word cap,
counted 2026-08-02. **Method, stated so it is reproducible:** the bodies of `## Problem`, `## Approach`,
`## Evidence`, `## Constraints` and `## Honesty & Trajectory` — excluding the five heading lines themselves,
the banner above them, and every appendix — split on whitespace, with markdown emphasis markers left
attached to their token. Stripping `**`/`*` does **not** change the total, because no token in the pillars
is a bare marker; an earlier revision's note that a looser count "gives fewer" was wrong. One token of
headroom: any further addition must be paid for by a deletion.*
