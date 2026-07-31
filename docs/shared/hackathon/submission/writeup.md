---
title: Ourobion — Launchpad 2026 AI Challenge Write-up
summary: The submission-ready write-up (≤1,000 words across the five judging pillars, appendices free) — built from the evidence ledger, not the strategy doc's aspirations; states plainly what is measured (one end-to-end run, one held edge, the verifier's refusal) vs. absent (the baseline-vs-verifier eval, the pre-hackathon-baseline tag).
type: reference
scope: repo
status: draft
updated: 2026-07-30
---

# Ourobion — Launchpad 2026 AI Challenge Write-up

*Track: Agentic Systems*

**"Correlations are cheap. We serve the ones the science can defend."** One AI proposes a health
relationship; a second, adversarial AI has to prove it against fresh literature before you ever see it.

---

## Problem

Health apps surface patterns — *"your gut comfort dips on low-hydration days"* — but the correlations are
generic and unexplained: a user cannot judge coincidence from signal. The obvious upgrade — an LLM that
explains *why* — is the most dangerous thing to put in front of a health claim: LLMs confidently state
correlation as causation, reverse cause and effect, generalise an animal study to a person. The real
problem isn't data or model access; it's **grounding the interpretation**, when the best tool for
grounding is also the least trustworthy component available.

Existing approaches fall short: trusting the model begs the question; the same model asked "are you
sure?" inherits its own blind spots; retrieval-augmented citation still lets a model misread its sources;
manual evidence grading (GRADE, Cochrane) is rigorous but costs experts months per question.

We target the gap: **automated, evidence-grounded verification of LLM-proposed relationships** — cheap at
ingestion, honest enough to refuse when ungroundable. We did not pre-register numeric success
criteria; the operating point was set after our first run, and we say so rather than retrofit a number.
This needs an agent, not one call: verification demands independent retrieval and an adversarial second
pass. We demonstrate on health-metric relationships, where an ungrounded claim harms most; our prebuild
app (*biotope*) is the consumer of this layer, not the contribution.

## Approach

Two decorrelated LLMs, not one clever prompt. A synthesis model (OpenAI) proposes a relationship from a
paper; a second, adversarial model from a different vendor family (Anthropic, in the run we executed) must
refute it via its **own independent retrieval**, defaulting to `uncertain` when it cannot ground the claim
— enforced as a schema invariant (`independentRetrieval.performed`), not a prompt request. A single call
can't cross-examine itself; the same model re-asked "are you sure?" inherits its own blind spots.

We deliberately **cut** agent count rather than grow it. The first sketch over-agentified the pipeline; we
kept only the roles needing judgment — synthesis, adversarial verification, presentation, human curation —
and made extraction, passage selection, and gating deterministic. Cheapest checks run first: a
deterministic `quoteCheck` against the source text before any verifier token is spent. Two evidence
ladders stay uncollapsed — `evidenceTier` (study design) and `impactTier` (venue) — rigor and notability
aren't the same axis. The served graph is a relational `verified_edges` 1-hop lookup, not a graph database;
at our scale a graph DB would be complexity for its own sake (Neo4j considered, dropped).

**Honest weakness:** `edgeScore` weights and `EDGE_GATES` thresholds (0.8/0.5) are uncalibrated —
provisional pending a labelled set, not derived numbers.

## Evidence

The deterministic gate (`quoteCheck`, schema validation) is unit-tested — contract-level, prebuild. On top
of it we ran the full pipeline end to end once: a canonical paper was extracted in full (91,162 characters),
and synthesis reasoned over 12 selected passages, not the whole text. The verifier then ran its own
retrieval and returned `uncertain`, with **zero independent sources found** — the proposed edge was
**held, not served**. That refusal is our strongest artifact: a system saying "I don't know" instead of
rubber-stamping its own synthesis.

Serving integrity was proven separately from paper-authoring: a fixed-edge local harness passed **20/20**,
and cards rendered on a physical Android device from 21 days of **simulated** health data (4 rule-based
cards plus two research cards). Both are real runs; the data is simulated, not from real users.

What we do not have yet: **a baseline comparison.** We have not measured our verifier against a single-LLM
"does this look right?" baseline on labelled good/bad relationships — even 15–25 hand-labelled claims is
the first thing we would run next, turning this from a demonstrated mechanism into a measured one.

## Constraints

Cost is paid once at ingestion, amortised over every later read, so verification spend is tiered — full
independent-retrieval verification is reserved for high-impact, low-corroboration edges, not run on
everything. Budget guardrails fail closed: a hard stop at 95% of any provider quota, per-source token
buckets, a deterministic ~$0.004 OpenAlex cost model. In our one measured run, spend reconstructed locally
was roughly **SGD 0.0648 (OpenAI)** and **SGD 0.1340 (Anthropic)**, including superseded attempts —
provider billing is the authority, not this reconstruction.

Platform limits shaped the design directly: *nao* runs on Cloudflare Workers, whose CPU ceiling can't
sustain a long ingestion job, so it dispatches a GitHub Actions run instead. An earlier R2-based "mailbox"
design was **killed** once we found it couldn't actually invoke a run. A host-memory guard was added after
a real low-RAM failure during a live run, not pre-emptively. Retrieval is OA-first; we do not redistribute
closed-access text. We have no local GPU, so the three planned support models that would cheapen
verification stay roadmap, untrained. We do not claim PDPA compliance or data isolation for the hosted
demo.

## Honesty & Trajectory

**What we did not build, plainly.** *biotope* is prior work — **118 commits** before 3 Jul 2026, versus
**248** since; it's the backdrop, not the delta. The verified graph is **one held edge from one paper** —
small by design, not a knowledge graph. Two research checkpoints **were** trained after this section was
first drafted — Zebra v1 (claim/evidence entailment, SciFact) and Viceroy v0 (causal wording) — but
neither serves anything: both are frozen, privately stored, `validated=false`, `serving_ready=false`, and
have zero imports from `apps/`, `supabase/`, `shared/` or `tools/brain-ingest`, enforced in CI. Zebra
failed two of its three readiness gates (mean macro-F1 0.5991 vs the ≥0.70 bar; every-class minimum-seed
recall ≥0.60 missed on contradicted 0.4348 and supported 0.5796). Only calibration passed. HealthVer and
BioRED remain roadmap data only. Our evaluation is a **single end-to-end run**, not a
labelled study: one refusal observed, zero
baseline comparisons — a demonstrated mechanism, not a measured accuracy rate. The grounding invariant is
**schema-plus-prompt, not proof**: we require an independent-retrieval flag before a supported verdict, but
cannot prove the retrieval was truly independent — cross-model checking reports residual error correlation
in the literature, so decorrelated verification **reduces** joint failure, not eliminates it. Ourobion is
non-diagnostic throughout, not a medical device.

**Two more weeks:** build a hand-labelled gold set (injected direction-flip,
correlation-as-causation, scope-overgeneralisation errors) and run the baseline-vs-verifier comparison
this write-up is missing; measure per-edge cost/latency; run the verifier across more metric pairs; ship
*nao*'s evidence panel and human curation step. `EdgeVerification` has nothing health-specific in it —
corpus and ontology are the only domain-bound parts, checkable in `shared/brain/relationships.ts`. That
portability is a direction, not a claim we're making today.

---

## Appendix A — Claim → file/PR map

| Claim | File / PR |
|---|---|
| Grounding invariant, `EdgeVerification`, `independentRetrieval` | `shared/brain/relationships.ts`, `shared/brain/index.ts`, `shared/brain/relationships.schema.ts` |
| The one end-to-end run (91,162-char extraction, 12 passages, held edge) | PR #190 (merged) |
| Synthesis + passage selection | `tools/brain-ingest/src/synth/` |
| Verification + retrieval | `tools/brain-ingest/src/verify/` |
| Deterministic insight engine | `tools/rules/`, `supabase/functions/generate-insights/` |
| App surface | `apps/biotope/lib/` |
| Ingestion control plane (GitHub Actions dispatch) | `apps/nao/`, `.github/workflows/brain-ingest.yml` |
| Decision log / Approach source | `docs/nao/brain-synthesis-design.md`, `brain-ingestion-design.md`, `nao-app-design.md`, `brain-support-models-design.md` |
| Fixed-edge serving harness (20/20) | see Run-4 cockpit session logs |

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

| Provider | Role | Reconstructed spend (SGD) |
|---|---|---|
| OpenAI | Synthesis | ≈ 0.0648 |
| Anthropic | Verifier | ≈ 0.1340 |

Locally reconstructed, including superseded attempts; provider billing is authoritative. Per-edge,
per-stage latency was not captured in this run — named as the next measurement to take, not invented here.

## Appendix E — The verifier's actual output (the one held edge)

Verdict: `uncertain`. `independentRetrieval.performed: true`, `sources: []` (zero independent sources
found). Edge status: held, not served. This is a refusal, observed once — not a percentage, not a
wrong-accept/wrong-reject miss (that requires the labelled set described in Evidence/Honesty above).

## Appendix F — Prior art (Problem-pillar positioning)

GRADE and Cochrane systematic-review methodology (manual evidence grading, the rigor benchmark this system
automates a narrow slice of); SciFact, HealthVer, HealthFC (offline scientific-claim verification
benchmarks); published adversarial fact-checking work (PROClaim, FC-MAD, Tool-MAD) as prior art for
cross-examining one model with another.

## Appendix G — Attribution (summary; not yet committed as `ATTRIBUTION.md` in the repo root — see below)

- **OpenAI** (GPT family) — synthesis LLM, used.
- **Anthropic** (Claude family) — adversarial verifier, used; this is the verifier that actually ran.
- **Agnes AI**, **GMI Cloud** — not used; no run and no training exists behind either, so neither is
  credited or claimed.
- **SciFact** — training data for the Zebra v1 entailment checkpoint (research-only, frozen, not serving,
  weights not distributed). **HealthVer, BioRED** — roadmap data only; no training performed on either.
- **Yu, Li & Wang causal-language corpus** — training data for the Viceroy v0 causal-wording checkpoint,
  same research-only posture. Its repository is marked GPL-3.0 with no separate data licence, and whether
  those terms propagate to trained weights is **unresolved**; public weight release is blocked pending
  model-specific licence clearance. Base model: Microsoft BiomedBERT (MIT).
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
proven deployed, and that the adversarial verifier's real decorrelated verdict has never run. Like
this write-up, it is a submission-facing projection, not architecture authority; the canonical docs it
links to win any disagreement.

---

*Word count, five pillar sections only (appendices excluded, per the rules): 997 whitespace-delimited tokens.*
