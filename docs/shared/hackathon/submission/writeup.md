---
title: Ourobion — Launchpad 2026 AI Challenge Write-up
summary: A submission draft whose every quantitative claim was re-measured on 2026-08-01 and whose hosted figures were read from Supabase on 2026-08-02; the research pipeline has produced 14 verified edges of which 11 are servable, but it is not yet submittable, because model claims remain quarantined behind issue #277 and no insight card yet carries producer='edge'.
type: reference
scope: repo
status: draft
updated: 2026-08-02
---

# Ourobion — Launchpad 2026 AI Challenge Write-up

> **DO NOT SUBMIT THIS DRAFT.** Every quantitative sentence below was re-measured, and the hosted
> figures were read directly from the Supabase demo project on **2026-08-02**. Two blockers remain, and
> neither is a missing measurement:
>
> 1. **Model-training and evaluation claims are still quarantined behind issue #277.** This draft
>    therefore states only that the support models are research-only and non-serving; it publishes no
>    training or evaluation figure.
> 2. **The pipeline now produces servable verified edges, but no card has been made from one.** Hosted
>    `verified_edges` holds 14 rows, 11 of them servable. `insight_cards` holds 45 rows and **0 of them
>    have `producer='edge'`**. The last mile — servable edge to rendered card — has not run. That is a
>    narrower and more accurate blocker than the "zero verified edges" this draft previously carried.
>
> **A correction to the previous revision of this file, recorded rather than quietly overwritten.** It
> stated `verified_edges = 0`, called that "derivable by schema", and described the card caveats as
> unreachable template strings. All three are now false. The pipeline ran between that revision being
> drafted and being committed; the `supporting >= 1` contract rule it relied on was removed by PR #355,
> which rebound verdicts to single-paper fidelity. An honest document that understates is still
> inaccurate, and those specific claims understated.
>
> Use [`submission-verification-audit.md`](../../../temp/run4/submission-verification-audit.md) as the
> current defect ledger; it is an audit, not replacement submission prose.

*Track: Agentic Systems*

**"Correlations are cheap. We serve the ones the science can defend."** One AI proposes a health
relationship; a second, adversarial AI has to prove it against fresh literature before you ever see it.

---

## Problem

Health apps surface patterns — *"your gut comfort dips on low-hydration days"* — but they are generic
and unexplained: a user cannot tell coincidence from signal. The obvious upgrade, an LLM that explains *why*, is
the most dangerous thing to put in front of a health claim: LLMs state correlation as causation, reverse cause
and effect, generalise an animal study to a person. The real problem isn't data or model access; it's
**grounding the interpretation**, when the best tool for grounding is the least trustworthy component available.

Existing approaches fall short: trusting the model begs the question; the same model asked "are you sure?"
inherits its blind spots; retrieval-augmented citation still lets a model misread sources; manual grading
(GRADE, Cochrane) costs experts months per question.

We target the gap: **automated, evidence-grounded verification of LLM-proposed relationships** — cheap at
ingestion, honest enough to refuse when ungroundable. We did not pre-register success criteria; the operating
point was set after our first run. This needs an agent, not one call. *biotope* is prebuild — the consumer of
this layer, not the contribution.

## Approach

Two decorrelated LLMs, not one clever prompt. A synthesis model (OpenAI `gpt-5`) proposes a relationship from a
paper; a second, adversarial model from a different vendor (Agnes `agnes-2.5-flash` — the verifier that actually
ran) judges whether the claim is faithful to that paper, on quote spans a deterministic gate already proved
verbatim. Independent retrieval stays mandatory but, since PR #355, informs the caveat rather than the verdict.
`llm-router check-config` at head reports `Decorrelation: OK — synthesis=openai, verifier=agnes`.

We deliberately **cut** agent count rather than grow it: we kept only the roles needing judgment — synthesis,
adversarial verification, presentation, curation — and made extraction and gating deterministic. Cheapest checks
run first: a deterministic `quoteCheck` against the source text before any verifier token is spent. Two evidence ladders stay uncollapsed — `evidenceTier` (study design)
and `impactTier` (venue) — because rigor and notability aren't the same axis.

**Honest weakness:** `edgeScore` weights and `EDGE_GATES` thresholds (0.8/0.5) are uncalibrated — provisional
pending a labelled set, not derived.

## Evidence

Machine artifacts re-measured **2026-08-01**; hosted tables read **2026-08-02** (Appendices D, E, I).

**Corpus: 21,823 records — 20,912 `discovered`, 911 `fetched`, 894 with usable full text.** Only *usable full
text* can ground a claim, so calling 21,823 a corpus of readable papers overstates our synthesisable base by
roughly 24×.

**Synthesis: 40 papers sent whole** — we deleted the keyword prefilter rather than tune it — yielding **20 claims
over 20 distinct edges and 12 cited rule blueprints**, the first not hand-authored, at **~US$0.04 per
paper**. We designed for 3–5 blueprints per paper; we measured **0.3**.

**Verification: Agnes checked 14 edges**, judged on fidelity to the cited paper. Verdicts: **1 `supported`, 10
`partial`, 2 `uncertain`, 1 `unsupported`**, confidence 0.72–0.92. Hosted `verified_edges` holds **14 rows, 11
servable** (8 `high`, 3 `mid`); three are held. Corroboration stays thin — our defect, not the literature's:
retrieval splits metric keys on underscores, so `resting_hr_bpm` never searches "heart rate". It reaches the
reader only as a caveat, and those are real model-written prose (Appendix E).

**No card has yet come from an edge.** `insight_cards` holds **45 rows — 43 `producer='personal'`, 2
`producer='rules'`, 0 `producer='edge'`.** The step rendering a servable edge as a card has not run — and the
app shows that gap rather than hiding it: personal cards are titled *"Still researching"* and state they are
*"an unverified personal observation from your own data only"*. They are real correlations passing the real
serve gate over **60 days of simulated data** labelled `data_origin: 'simulated:run4-demo'`, shaped to satisfy
that gate, not bypass it. No baseline or gold set exists: 14 verdicts are not an accuracy rate.

## Constraints

Cost is paid once at ingestion and amortised over every later read, so verification spend is tiered — full
independent-retrieval verification is reserved for high-impact, low-corroboration edges. Guardrails fail closed:
a hard stop at 95% of any provider quota, plus per-source token buckets. The machine-local ledger records
**US$1.80 over 59 calls** (Appendix D). **Agnes is priced at zero**, so no USD ledger can bound it; an
append-only hash-chained journal reserving every billable POST does. That pricing expires **2026-08-08**.

Platform limits shaped the design: *nao* runs on Cloudflare Workers, whose CPU ceiling can't sustain a long
ingestion job, so it dispatches GitHub Actions instead — an earlier R2 "mailbox" design was **killed** once we
found it couldn't invoke a run. Retrieval is OA-first; we don't redistribute closed-access text. No local GPU, so
the support models are not in what we submit, and we claim no PDPA compliance for the hosted demo.

Two workflows this run added **cannot be dispatched at all**: `workflow_dispatch` resolves from the default branch
and neither file is there (Appendix I). So the hosted projection cannot be refreshed from CI, and the
deployed console still shows an earlier pass's figure.

## Honesty & Trajectory

**What we did not build, plainly.** *biotope* is prior work — **118 commits** before 3 Jul 2026 versus **248**
since; the backdrop, not the delta. **The verified graph is small and serves nothing: 14 edges, 11 servable,
0 cards from one.** Support-model checkpoints are frozen and non-serving, CI-enforced against import;
**all their training and evaluation figures are excluded pending issue #277**, in either direction. The batch
surfaced four real defects, in Appendix I. Our evaluation is **not a labelled study**: 14
verdicts, zero baselines. The grounding invariant is **schema-plus-prompt, not proof** — we require an
independent-retrieval flag before a servable verdict but cannot prove that retrieval was truly independent, and
cross-model checking reports residual error correlation, so decorrelation **reduces** joint failure rather than
eliminating it. Ourobion is non-diagnostic, not a medical device.

**Two more weeks:** the edge-to-card projection, the only reason 11 servable edges show a user nothing; a metric
alias map, so `resting_hr_bpm` actually searches "heart rate" and corroboration stops measuring our vocabulary;
the two undispatchable workflows onto the default branch; the four Appendix I defects; then a hand-labelled gold
set and the missing baseline-vs-verifier comparison. `EdgeVerification` has nothing health-specific in it, but
portability is a direction.

---

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
| Decision log / Approach source | `docs/nao/brain-synthesis-design.md`, `brain-ingestion-design.md`, `nao-app-design.md`, `brain-support-models-design.md` |

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

[`system-connection-map.md`](./system-connection-map.md) — how Biotope, Supabase, *nao*, the brain
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
