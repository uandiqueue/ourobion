---
title: Ourobion @ Launchpad 2026 — Direction
summary: The single canonical hackathon-strategy doc — track choice (Agentic Systems), prebuild-vs-delta framing, the "correlations are cheap" hook + adversarial-verifier mechanism, the living-apps trajectory ruling, sponsor integration, and how to win each judging pillar. Owner of all hackathon strategy.
type: process
scope: repo
status: canonical
updated: 2026-07-13
---

# hackathon-direction.md — Ourobion @ Launchpad 2026 AI Challenge

> **Purpose.** The single strategy doc for our submission. `hackathon-rules.md` (sibling file) is the raw
> event rules, copied verbatim from the event page — reference only, **never submitted**. This doc turns
> those rules into a decision: which track, how we position, what counts as prior work vs. the scored
> delta, which sponsor tools we integrate, and how we win each judging pillar.
>
> **Owner:** Jayden · **Status:** direction locked, execution starting · **Window:** 3–31 Jul 2026.

---

## 0 · TL;DR (the direction in one paragraph)

We enter the **Agentic systems** track. The prebuild — the *biotope* self-report app and the
deterministic paper-ingestion pipeline — is declared, out loud, as prior work: it's the backdrop. **The
scored delta is "the brain": a multi-role agentic pipeline** — a **planner/seeder agent** generates
research queries, a **synthesis LLM** proposes edges, small trained models + a deterministic `quoteCheck`
cross-check them, an **adversarial verifier LLM (a decorrelated model family, doing its own retrieval)**
tries to refute each one, and a **human-in-the-loop curator** in *nao* approves what's served. It turns
our 1,200-paper corpus into metric-relationship edges *only* when that second, independent LLM can
re-ground them against fresh literature — graded 0..1, gated into serve / serve-with-qualifier /
withhold, and inspectable edge-by-edge. **The core discipline: exactly two decorrelated adversarial LLMs
on the truth path, deterministic everything else, small trained models offloading cost — every agent
boundary defensible.** Our headline evidence is
a **baseline comparison** (single-LLM "looks right to me?" vs. our adversarial verifier) and a
**cost-accuracy curve of Agnes AI vs. OpenAI on our own verification eval** — one artifact that both
proves the second pass earns its cost *and* wins **Best Use of Agnes AI**. The pitch, the architecture,
and the judging rubric all say the same thing: *evidence appropriate to the claim.*

**Recommended hook:** *"Correlations are cheap. We serve the ones the science can defend."*
**Mechanism line:** *"One AI proposes a health relationship; a second, adversarial AI has to prove it
against fresh literature before you ever see it."*

---

## 0.5 · Self-judgement response (post-adversarial round)

Two internal judging rounds were run (full reports kept for provenance in the archive, not linked here). Round 1 (primed to *"assume the plan works"*) scored **21/25**. An **adversarial round**, scoring the **realistic delta a 2-person team can ship by 31 Jul** (no "assume it works," verified against `git log` — the delta is unbuilt today), scored **16/25**: Problem 3 · Approach 3 · Evidence 3 · Constraints 3 · Honesty 4. **No fundamental flaw survived; Agentic Systems remains correct; the "use a different submission" escape hatch is NOT triggered.** Treat **16/25 as the honest baseline** and the 21↔16 gap as pure **execution risk**.

**The one thing that decides everything: the delta must produce OBSERVED results.** Every point the adversarial round docked traces to one root — the scored delta (verifier, edges, curves, refusals) is unbuilt, so its evidence is *anticipated*, not *run*. A polished design of an unbuilt system is a 16; the same design plus a small real eval is a ~19–20. Priorities are ordered by that leverage.

### Priority 0 — protect the eval, even at the cost of breadth
Ship the depth-first slice **and its measured artifacts** (cut breadth before cutting these):
1. **One isolated baseline-vs-verifier comparison** on a shared held-out set: synthesis+`quoteCheck` → +independent-retrieval → +adversarial, ablated **separately** so the win is attributable to the invariant, not a 3-in-1 bundle. *(Evidence)*
2. **One observed verifier miss** — a wrong-accept/wrong-reject from the brain itself, reported honestly. This single artifact lifts Honesty toward 5 and converts every "anticipated" failure mode into an observed one. *(Honesty, Evidence)*
3. **A compiled per-edge cost + latency table** for the delta (synthesis vs verify), a **pre-registered "acceptable accuracy" operating point**, and a **latency-vs-quality** point — not just cost. *(Constraints)*
4. **A second labeller on a subset** of the ~40–60-edge gold set with disagreement reported, and construct the set **independent of pipeline output** (curated/injected failure modes) to kill selection-bias. *(Evidence)*

### Priority 1 — cheap week-1 discipline (lost points, no build needed)
- **Pre-register success criteria NOW** with committed numbers (fill the §7 N/$X/Ys) in a dated decision-log file. The adversarial round held Problem at 3 *specifically* because these are placeholders — days of desk work, no capacity excuse. *(Problem)*
- **External prior-art survey** — position against GRADE/Cochrane evidence-grading, biomedical claim-verification / relation-extraction systems, and cite-grounded RAG, **as prior approaches** (not as training data). *(Problem)*

### Priority 2 — design corrections (hours–1 day each)
- **Calibrate `edgeScore` weights + `EDGE_GATES` (0.8/0.5)** against a small labelled set (or explicitly declare them provisional-pending-calibration) and add unit tests. These constants decide what reaches users and are currently unjustified magic numbers. *(Approach)*
- **Neo4j is dropped (settled).** The served graph is a relational `verified_edges` 1-hop lookup (`where subject=$k or object=$k`) projected straight into the client force-graph — no graph DB. At ~dozens of edges a graph DB would have been complexity-for-its-own-sake. *(Approach)*
- **Tighten the `independentRetrieval` claim**: bind `performed:true` → `sources.length ≥ 1` and source-ids disjoint from the synthesis citations, or downgrade the "can't be prompted away / structural guarantee" language to "schema + prompt best-effort." It is currently a self-reported boolean. *(Approach, Honesty)*

### Priority 3 — write-up & demo hygiene (capacity-independent, free)
- **Fix the tense.** Nothing unbuilt is "proven/demonstrated." Say *"designed + contract-enforced; verifier run on a small slice; ingestion proven separately."* The "ingestion-proven" phrasing is a flagged overclaim. *(Honesty)*
- **Separate prebuild from delta numbers everywhere.** The CORE / OpenAlex / memory-guard measurements are *prebuild ingestion* — present them as prior-work context, never as the delta's own evidence. Judges score the delta. *(Constraints, Honesty)*
- **Purge the instrumental-honesty voice from the submission.** "Win the Honesty pillar for free / engineered by the story" is *internal strategy voice* (fine here in the direction doc; toxic in the write-up, where it reads as performed humility and scores *below* plain limitation-stating). In the submission, let the artifacts speak. *(Honesty)*
- **Quarantine Claim 3** (a small trained model cheapens/beats the verifier) as **roadmap** unless GMI credits land and the model actually trains; the Agnes-vs-OpenAI LLM cost curve stands on its own. *(Evidence, Constraints)*

### Verdict
**Stay the course — Agentic Systems, this submission.** Both rounds agree the design is genuinely strong (the adversarial floor is 3s, not 1s–2s; Honesty holds a 4 with a clear path to 5). The risk is not the idea — it is **shipping observed delta-side results** and refusing to let prebuild polish or a persuasive write-up stand in for them. Do Priority 0 and the score becomes real; skip it and a sharp judge scores the plumbing, not the brain.

---

## 1 · The rules that shape our strategy (structured digest of `hackathon-rules.md`)

**What it is.** A 4-week open-format AI build sprint that doubles as a redesigned career fair. 100+
professional judges (founders, engineers, researchers, product/domain leaders) are *potential
employers*. Submissions are **algorithmically matched to domain-relevant judges**. Every matched judge
answers a final holistic question — **"Would I want to interview this person?"** (Yes / Lean yes / No) —
**independent of the numeric score**.

**Timeline (SGT).**

| Milestone | Date |
|---|---|
| Challenge begins | **3 Jul 2026** (day 0 — today) |
| Submission deadline | **31 Jul 2026, 23:59** |
| Finalists announced | 7 Aug 2026 |
| Symposium (live @ NUS) | 17–18 Aug 2026 |

**Eligibility.** Students at a Singapore tertiary institution; teams of 1–3; one team & one submission
each. Submit through the challenge platform.

**Tracks** (judged *only within* your own; never cross-category): Applications · **Agentic systems** ·
Embodied AI & robotics · Deep learning research · Infrastructure & tooling.

**Deliverables.** Public / access-granted **repo** · **demo video ≤ 3 min** (mandatory, all tracks) ·
**write-up ≤ 1,000 words** with the five pillars as section headings (appendices don't count) · a
registration **profile** (intro + message to judges + resume) unlocked when a judge opens your submission.

**Five pillars, 1–5 each.** Problem · Approach · Evidence · Constraints · Honesty & Trajectory.
**The one rule:** *evidence appropriate to the claim — a modest claim proven beats a grand claim
asserted.* Judged within your own domain's standards (a product isn't penalised for lacking novel
theory; research isn't penalised for lacking a UI).

**Green flags:** reported negative results & honest limitations · beating the simple baseline before the
complex thing · ablations, trade-off/cost/latency curves · a cheaper/simpler approach chosen *with data*
· knowing exactly what you'd do with two more weeks.
**Red flags:** *"we used the most capable model, so it's accurate"* · 5 cherry-picked demo runs as an
eval · no baseline / no alternatives / no cost discussion · complexity for its own sake · *"it works"*
without defining working. **Judges are told not to be seduced by demo polish.**

**Prizes.** 1st $5k / 2nd $3k / 3rd $2k in **OpenAI credits** · **Best Use of Agnes AI — $500 cash**.
**Partners are also judges:** Agnes AI (powered-by; SG full-modality foundation models), OpenAI
(GPT/Codex + credits), GMI Cloud (NVIDIA GPU infra). Building well with their tools demonstrates skill
to the people who made them.

**The rule that governs *our* whole strategy** (Original-work / Attribution):
> *"Extensions of prior work are allowed, but your write-up must clearly state what existed before and
> what is new. **Judges score the delta.**"* — plus: fabricated/misrepresented results ⇒ **immediate
> disqualification**, and *"if you did not verify it, do not claim it."*

---

## 2 · Track decision — **Agentic systems**

**Decision: enter the Agentic systems track.** Confident, not marginal.

**Why it fits (and why it's the *strongest* pillar-3 story we can tell).** The delta is a multi-step,
tool-using, semi-autonomous workflow: a **synthesis** LLM proposes an edge from a corpus paper → a
deterministic `quoteCheck` → an **adversarial verifier** LLM (different model family) that performs its
*own* retrieval, is prompted to refute, and defaults to `uncertain` → gating → optional
human-in-the-loop curation in nao. The agentic-track rubric asks precisely the questions we're built to
answer:
- *"Why does this task need an agent at all, rather than a single well-prompted call?"* → Because a
  single call can't cross-examine itself: error-decorrelation requires a **second, independent model
  family** doing **independent retrieval**. A same-model "does this look right?" re-ask shares the first
  model's blind spots — it's theatre. This is our Approach thesis and our Evidence baseline in one.
- *"End-to-end task completion on a held-out set, trajectory analysis, comparison against the
  single-call baseline."* → This is exactly our evidence plan (§6, §7). We don't have to retrofit the
  rubric; the rubric describes what we're building.

**Alternatives considered and ruled out** (recording these *is* Approach-pillar hygiene):
- **Applications** — biotope is a real app, but it's **prebuild**, and the delta (the brain) has no live
  end users. Application judges ("operators who ship") score user pain, task-success rates, user
  testing — evidence we can't honestly produce for the brain in 4 weeks. Ruled out.
- **Infrastructure & tooling** — the pipeline *could* be framed as "a data/eval pipeline for AI." But
  infra judges score a *workflow bottleneck and who suffers today* + before/after on that workflow. Our
  contribution is a **reasoning pipeline with a novel verification pattern**, not a developer tool.
  Agentic captures the intellectual center; infra would undersell it. Ruled out (kept as a fallback
  framing only if matching signals push us there).
- **Deep learning research / Embodied AI** — no. (Support-model fine-tunes are roadmap, not the delta.)

**Consequence for how we write:** we will be read by people who recognize agent quality. Lead with the
*why-an-agent* argument and the single-call baseline; don't dress deterministic steps up as "agents"
(we deliberately *cut* the agent count — see §6 Approach).

---

## 3 · Positioning & narrative

### 3.1 The backdrop (prebuild — say so, out loud)
*biotope* is a competent, ordinary self-report health app: 30-second daily logging, non-diagnostic
insight cards. On its own it does what every health app does — **surface correlations in one person's
data**. That's the backdrop, and naming it as prior work in the first 20 seconds is itself an honesty
green flag that pre-empts the "did they just reskin an app?" suspicion.

### 3.2 The sharp, non-obvious problem
A correlation in one person's noisy self-report is statistically fragile (n=1, confounded, multiple
comparisons) **and mechanism-blind**. So health apps face a trust fork: stay vague and useless, or
quietly overclaim toward causation/diagnosis. **The non-obvious turn:** the obvious AI fix — bolt an LLM
on and ask "why?" — is *the single most dangerous thing you can put in front of a health claim.* An LLM
will confidently report correlation as causation, flip cause and effect, and generalize a mouse study to
your body. The naive "AI upgrade" makes the trust problem **worse**. So the real problem isn't
*collecting data* or *model access* — it's **grounding the interpretation, when the best tool for
grounding is also the least trustworthy component you could add.**

### 3.3 The upgrade (the delta, in one line)
**From a correlation engine to an evidence-grounded, adversarially-verified reasoning layer.** We treat
the LLM as an *unreliable witness and cross-examine it*: one LLM proposes a metric→metric relationship
from the literature; a **second, independent LLM of a different family is prompted to refute it**, must
do its **own fresh retrieval**, and **defaults to `uncertain` when it can't independently ground the
claim** — and that last property is a **schema invariant** (`independentRetrieval.performed === true` is
required for any `supported`/`contradicted` verdict), not a prompt wish. The result is graded 0..1 and
gated into serve / serve-with-qualifier / withhold, **with the receipts** (quote spans, citations,
evidence tier, and an honest "we couldn't ground this").

### 3.4 Taglines
1. **"Correlations are cheap. We serve the ones the science can defend."** ← **hook** (leads write-up + video).
2. **"One AI proposes a health relationship. A second, adversarial AI has to prove it against fresh literature before you ever see it."** ← **mechanism sentence** (immediately follows the hook).
3. *"We treat the LLM as an unreliable witness — and cross-examine it."* ← memorable framing of the anti-hallucination stance.
4. *(structural, recurring)* *"The app finds the pattern; the brain decides whether the science backs it."* ← keeps biotope-as-backdrop distinct from brain-as-delta.

### 3.5 The sharpened delta claim (novel-in-combination, not "invented")

Adversarial fact-checking is published prior art (PROClaim, FC-MAD, Tool-MAD) and offline claim
verification has benchmarks (SciFact, HealthVer, HealthFC). Do **not** let the delta read as "an
integration of known parts." The defensible, narrow, novel-in-combination claim is:

> **"The first system to push scientific-claim verification past offline 3-way classification into a
> gated, receipt-bearing, real-time *serve* decision — with a decorrelated, non-Anthropic adversary that
> must independently re-ground each claim and defaults to *uncertain* when it can't."**

Cite the prior art yourself (it shows you know exactly where your delta sits), and lean on the theory
that makes the second model *necessary*, not decorative: **self-preference bias** (a model judging its
own family's output self-enhances → the verifier must be a different vendor) and **decorrelation lowering
joint hallucination probability** (neural-diversity tail bounds). The **withhold / "uncertain"** moment
is the **hero of the demo**, not a caveat — a system that says "I don't know" is the strongest evidence
of reasoning quality to expert judges.

### 3.6 "Living apps" — trajectory, not headline (settled ruling)

We considered building the story around **"Living Apps"** (nao as a reusable engine powering any app
that needs gated, reliable online-knowledge input — health today, education/finance tomorrow). **Ruling:
it is the right *idea* in the wrong *slot* — keep all the upside, but as a trajectory close, never the
headline.** Reasons, converging across prior-art, judge-appeal, generalization, and buzzword-risk:

- The governing rule — *"a modest claim proven beats a grand claim asserted"* — is the **axis judges
  score on**. Generalizing from one built vertical to "any app" is the textbook *grand claim asserted*
  ("platform theater"), and it forfeits the two most-weighted pillars (Evidence, Honesty) the moment a
  judge files it as overreach.
- **"living games" is Google's coined term** (Mar 2025), not ours — and its meaning (*more* generation,
  emergent novelty) is the **opposite** of nao's actual innovation, which is **restraint** (a verifier
  that *withholds*). If invoked at all: lowercase, attributed to Google, as an intuition pump only, with
  the inversion stated as a deliberate design choice.
- "Living Apps" as an umbrella is not an established term and collides with Salesforce/IBM's "Quip Live
  Apps"; a coined proper-noun you must define is a tax on a skeptical technical audience.

**Where the vision belongs — the trajectory close**, phrased as an *observed property of the
architecture* a judge can verify (open the schema: the `EdgeVerification` contract in
`shared/brain/relationships.ts` has nothing health-specific in it; only the corpus and metric ontology
are domain-bound):

> *"The verifier never sees a health fact. It sees a claim, a set of sources, and a prompt to refute
> them — you can read it in the schema. Swap the corpus and the metric ontology and the same gate runs
> on curriculum standards or market filings. AWS (Bedrock Automated Reasoning), Vectara, and Galileo are
> all building horizontal trust layers, so the direction is real — the difference is ours is adversarial
> and decorrelated, built to *refute* rather than confirm. Health is where we earned it; it's not where
> it ends."*

This captures the full upside while staying inside the modest-claim rule, and it *names the seams* that
change per vertical (corpus, ontology, evidence-tier rubric, expert calibration set) — which itself
scores Constraints + Honesty. **If the demo runs long, cut this beat before cutting evidence — it is the
sacrificial slide.**

---

## 4 · Prebuild vs. Delta scope (judges score the delta)

**Established fact:** all 117 commits are dated **on or before 3 Jul 2026**. Essentially the entire
codebase is prebuild. Be scrupulous about the layering — blur it and we risk the DQ line; get it right
and we win the Honesty pillar for free.

### 4.1 PREBUILD — declare as "the floor we built the delta on"
- **biotope MVP** — M1 auth, M2 self-report (gut/behaviour/antibiotic/symptom), M5a baselines, M5b
  (hardcoded) insights, M6 engagement. Working CRUD self-report loop (~May–Jun 2026).
- **Metric platform** — registry v2, tier-aware DQS, TS/Dart parity guards (Jun 22).
- **The brain *contract*** — `shared/brain/` schema + gating (`edgeScore`/`servingBand`, the grounding
  invariants). Truth-tier, 2-reviewer-guarded (Jun 25). *Zero edges exist.*
- **The ingestion pipeline** — `tools/brain-ingest/` discovery/dedup/OA-retrieval/R2 storage (Jun 29),
  **plus** its Jul 2–3 hardening (PR #38: directOa, CORE rate-limit fix, host-memory guard, the GitHub
  Actions control plane). *Conservatively declared prebuild even though dated the boundary day —
  understating is safe; overstating is not.*
- **nao v1 corpus dashboard** — Next.js/OpenNext on Cloudflare, search/facet/inspect paper metadata (Jun 30).
- **All design & decision docs** — `phase-2-plan.md`, `brain-synthesis-design.md`, `brain-ingestion-design.md`,
  `brain-support-models-design.md`, `nao-app-design.md`, the pipeline brief. These are prebuild *designs* — but
  they're also a ready-made **Approach section + decision log** (rubric Pillar 2 gold). Cite them; don't
  claim them as built delta.

### 4.2 DELTA — build 3–31 Jul, claim as "new" (the scored artifact)
Depth-first over a **curated ~30–50 paper slice** of the corpus (the 1,200-paper corpus is prebuild
*input*, never the deliverable). The agent/model roster, with build status:
1. **LLM router** (dual-route: local Claude-Code agent vs. API worker; OpenAI *or* Anthropic *or* Agnes via config) — small, unblocks everything.
2. **Planner / seeder agent** — reads metric registry (`derivedFrom[]`) + biotope needs → targeted research queries. The genuine autonomy in the system (supersedes today's static seed list); a real answer to *"why an agent?"*
3. **Synthesis LLM node (LLM-1)** — paper text → `RelationshipClaim` + `quoteSpans` against the existing contract.
4. **Deterministic `quoteCheck`** + **(b2) venue lookup** (OpenAlex/SJR → `impactTier`, no training) — near-free cross-checks before any verifier token is spent.
5. **Adversarial verifier LLM (LLM-2)** — *decorrelated model family*, independent retrieval, refute-by-default → graded `EdgeVerification`. **The intellectual center of the submission.**
6. **`verified_edges` relational view → client force-graph projection** (1-hop lookup, `where subject=$k or object=$k`; no graph DB).
7. **nao v2 graph + evidence panel** — the visible payoff: click an edge → quote spans, citations, `evidenceTier`/`servingBand`.
8. **nao v3 human-in-the-loop curation** — curator approves/rejects proposed edges (`provenance:'human'`). Strongest *agentic-app* demo angle; cheap on top of v2.

**Stretch delta (only if GMI credits land):** train support **model (a)** (claim-support/NLI on
SciFact/HealthVer) and wire it in as a **cheap first-pass verifier** — this is the Agnes-vs-OpenAI /
small-model cost-accuracy story (§5). If credits don't arrive, **declare (a) + (b1) study-design + (c)
relation/direction as roadmap** — designed and data-prepped (`brain-support-models-design.md`), training
deferred for lack of GPU. *Never claim a trained model you didn't train — that's the DQ line.*

**Explicitly left OUT of the hackathon claim** (real Phase-2 work, but not the AI delta — mention as
roadmap only): Track A app work (M3 Health Connect e2e, M4 env/API, M7 community, metric waves, the
presentation agent). Leaving these out keeps judges scoring the brain, not the CRUD.

### 4.3 Draw the line **in git** so the delta is checkable
Judges do repo spot-checks and read **commit dates** (baked into each commit), not push dates — so a
normal merge preserves the honest timeline; a **squash would collapse months into one day-0-looking
commit** (misleading *and* it throws away our best "what existed before" evidence). Do **not** squash the
prebuild.

```bash
# Tag the pre-hackathon line at the last prebuild commit (draw it AFTER PR #38 merges).
git tag -a pre-hackathon-baseline <commit> -m "State before Launchpad 2026 build sprint"
git push origin pre-hackathon-baseline
# Merge the integration line with history intact (never --squash):
git merge --no-ff dev-phase2      # when consolidating to main
```
- `main` is currently just `first commit` — merging `dev-phase2` in **with history preserved** actually
  helps (a bare `main` shows judges nothing). Keep `dev-phase2` alive as the integration line (deleting
  it is safe for *history* once merged, but breaks the documented workflow — see AGENTS.md §5).
- In the write-up: *"Everything up to `pre-hackathon-baseline` is prior work; the delta is every commit
  after it."* Clean, checkable, and it converts the timeline into a credibility win.

---

## 5 · Sponsor integration (all three, each load-bearing — sponsors are judges)

Integrate only where it's genuinely load-bearing; cosmetic use reads as pandering to judges who *are*
the sponsors.

### 5.1 Agnes AI → the **independent verifier LLM** (+ the winning play)
Our design *already mandates* a decorrelated second model family for verification — Agnes's in-house
"Claw" is genuinely decorrelated from GPT, so it fills a slot we designed, not a bolt-on. It's
**OpenAI-API-compatible** (`https://apihub.agnes-ai.com/v1`) → a **config entry in the LLM router, not
new code** — and `agnes-2.0-flash` is **$0/1M tokens today** with a large context, so the token-heaviest
stage becomes free.
- **The single strongest "Best Use of Agnes AI" play:** make Agnes the adversarial verifier in a
  scientific-integrity pipeline **and publish a real cost-accuracy curve — Agnes vs. GPT-5.4-mini vs.
  GPT-5.5 — on our own held-out verification eval.** This is simultaneously (a) the Best-Use narrative,
  (b) the rubric's "justify your model choice with a curve, not a point," and (c) load-bearing (Agnes is
  on the truth path, not rendering a logo). *You cannot lose the argument: if Agnes wins on
  cost-per-correct-verdict, that's the headline; if OpenAI wins on raw accuracy, the curve explains why
  we route synthesis to OpenAI and verification to Agnes.*
- **Caveat to de-risk first:** Agnes's structured-output/JSON-mode is undocumented (function-calling is
  supported). **Confirm schema-constrained `EdgeVerification` output on `agnes-2.0-flash` before
  committing it to the final structured verdict.** Fallback: Agnes as cheap first-pass / second-opinion
  verifier, OpenAI emits the final structured verdict — we still get the integration *and* the curve.
  Also: free tier is rate-limited (~20 RPM) and likely promotional — budget-guard, don't architect
  around "free forever."

### 5.2 OpenAI → **synthesis LLM + presentation layer** (keep it the visible spine)
Prizes are denominated in OpenAI credits and OpenAI is a judge, so it stays primary. **Synthesis
(LLM-1):** GPT-5.5 — the highest-hallucination-surface step gets the strongest model. **Runtime
presentation phrasing:** a cheap tier (5.4-nano/mini), grounded + copy-gated + cached + degradable.
Routing the token-heavy verifier to *Agnes* protects the OpenAI credit budget — which doubles as a
cost-story talking point.

### 5.3 GMI Cloud → **support-model fine-tuning** (stretch / roadmap)
1:1 fit for the deferred support models (NLI claim-support, relation/direction, study-design) on
public datasets (SciFact/HealthVer/BioRED). A single H100 on CE-BMaaS handles these small-encoder jobs
in credit-hours; host model (a) as a **scale-to-zero serverless pre-filter** that short-circuits before
the verifier LLM spends a token. **If credits don't land in time, declare it as roadmap** — the brief's
sequencing gives us the honest next-steps paragraph for free.

### 5.4 Credits — how to claim
- **OpenAI + GMI Cloud:** register on the **Luma** event page → fill the **Google Form** sent after
  registration (credits keyed to the email you use — keep it consistent). Watch inbox + spam.
- **Agnes AI:** no form — create an account at `platform.agnes-ai.com`; free credits attach on sign-up.
  Docs: `agnes-ai.com/en/docs/cid1` (quickstart), `agnes-ai.com/en/docs/overview`.
- **Attribution:** credit every third-party model/dataset/asset in the repo + write-up (uncredited work
  is a DQ ground).

---

## 6 · Winning each pillar (evidence-appropriate claims + what NOT to claim)

**Pillar 1 — Problem.** *Claim:* health apps turn noisy n=1 data into insights that are either vaguely
useless or quietly overclaiming, and the obvious AI remedy amplifies the harm (LLM = highest
hallucination surface in front of a health claim); the One-Health/ASEAN lens scopes it to specific
under-served surfaces (tropical gut/hydration, vector/dengue, environment). *Don't:* trash competitors
or claim measured user harm. Frame as a **structural trust problem**.

**Pillar 2 — Approach.** *Claim:* two decorrelated LLMs (generative synthesis vs. discriminative,
grounded verification); the verifier earns its cost only via **independent retrieval + adversarial
refutation, enforced as schema invariants**; **cheapest checks first** (`quoteCheck` before any verifier
token; then per-failure-mode checks — `directionCheck`, `claimKindCheck` for correlation-as-causation,
`scopeCheck`, `effectSizeCheck`); **graded trust** (two un-collapsed ladders: `evidenceTier` for study
design, `impactTier` for venue); two-tier truth (contract = truth, edges = rebuildable projection).
**Green flag to feature (the taste story):** the pipeline was over-agentified in the first sketch; we
kept the roles that genuinely need an LLM/agent — **planner/seeder, synthesis, adversarial verifier,
runtime presentation, human-in-the-loop curation** — and made the rest deterministic (text extraction,
projection, the insights engine), because turning those into agents only adds cost, nondeterminism, and
hallucination surface. Every agent boundary is defensible to a colleague — *what we left deterministic is
as considered as what we made agentic.* *Don't:* claim the full
pipeline runs in production — it's designed + contract-enforced + ingestion-proven, demonstrated on a slice.

**Pillar 3 — Evidence (spend the best material here).** In ascending persuasiveness: (a) the pipeline is
real — a live run built **1,200+ papers / ~750 full-text** on R2 across 6 domains; (b) **reality
corrected our own docs** — a *fabricated* CORE rate-limit assumption in our design was caught by live
header inspection, driven to a real 429, and fixed to match measured behavior (textbook "beat your own
baseline assumption with evidence"); (c) gating is deterministic + unit-testable; (d) **the money shot:
show the system REFUSE** (an ungrounded/contradicted edge suppressed or qualified); (e) **beat the simple
baseline** — single-LLM "looks right to me?" rubber-stamps a direction-flip / correlation-as-causation
that our adversarial+independent-retrieval verifier catches, on the *same* claims. *Don't:* report
accuracy % you didn't measure, claim clinical validation, a complete graph, or trained support models.

**Pillar 4 — Constraints (our strongest pillar — the repo overflows with real trade-offs).** Cost paid
once at ingestion, amortized over every read; **tiered verification spend** (full independent-retrieval
only on high-impact/low-corroboration edges); **fail-closed budget guardrails** (hard-stop at 95% of any
quota, per-source token buckets, deterministic ~$0.004 OpenAlex cost model); **platform-limit honesty**
(nao is a Cloudflare Worker with a CPU ceiling → it triggers a GitHub Actions run instead; the first
"R2 mailbox" control design was *killed* when it couldn't actually invoke a run); a **host-memory guard**
added after a real low-RAM incident; OA-first licensing discipline; no-local-GPU → training deferred to
GMI. *Don't:* claim PDPA/data-isolation (deferred past demo) or production scale.

**Pillar 5 — Honesty & Trajectory (win it by going first).** State up front: non-diagnostic always, not
a medical device, not clinically validated; biotope is prebuild; the two-LLM loop is
designed+enforced+ingestion-proven but demonstrated on a deep slice (edges didn't exist at corpus-build
time); support models are roadmap (public-dataset fine-tunes — can't train on in-house data because it
doesn't exist yet, an honest bootstrapping story). **Two-more-weeks plan:** verifier across more metric
pairs; nao v2 evidence-graph; wire the trained NLI model in as a cheap first-pass verifier; human curation
in nao. It's credible because it's **already written down in phases** (nao v1→v4).

**"Would I want to interview this person?"** — engineered by the story itself: identified that *trust*
(not data) is the problem; treated the most powerful tool as untrusted and built schema-enforced checks
around it; ran it for real and let measured reality correct their own docs; *removed* complexity when it
wasn't earning its keep; scrupulous about built-vs-designed-vs-roadmap. Senior mindset, not demo-hacker.

---

## 7 · Evidence plan (instrument from commit #1 — retrofitting in week 4 is painful)

- **Write success criteria in week 1** (Pillar 1 rewards pre-registered criteria; it shows when
  retrofitted). Example targets to fix now: "verifier catches ≥ N% of hand-labelled bad edges the
  single-call baseline serves"; "≤ $X and ≤ Y s per verified edge."
- **Hand-label a small gold set** (~40–60 edges) for the failure modes: direction-flip,
  correlation-as-causation, overgeneralization/scope, effect-size inflation.
- **Baseline vs. treatment:** baseline = synthesis + `quoteCheck` only (or single-LLM re-ask);
  treatment = + adversarial independent-retrieval verifier. Report bad-edges-caught delta.
- **Cost/latency logging from day one:** tokens, $, wall-time per synthesis vs. verify; produce the
  **tiered-spend curve** and the **Agnes-vs-OpenAI cost-accuracy curve** (§5.1).
- **Keep a decision log** (every A-vs-B choice + why) — it *is* the Approach section, pre-written.
- **Save failures** — dead ends become the Honesty section.

---

## 8 · Deliverables & 4-week execution outline

**Submit:** repo (public or judge-access) · demo video ≤ 3 min · write-up ≤ 1,000 words (five pillars as
headings; charts/logs in appendices, which don't count) · registration profile (intro + message to
judges + resume). Ensure all links stay live through judging; **do not contact judges** (they reach out).

**Demo video arc (≤ 3 min)** — name biotope as prior work in the first 20 s, then ~80% on the brain,
and *show one real failure*:
- **0:00–0:20** biotope insight card → "every app shows correlations; should you trust it, and why is it even true?" → the sharp turn (the obvious LLM fix is the most dangerous).
- **0:20–0:35** thesis: "this app is prior work; our build is the brain — it makes the LLM prove itself." (hook line lands)
- **0:35–1:30** architecture concretely: synthesis proposes an edge → adversarial verifier does independent retrieval, defaults to uncertain (flash the invariant on screen) → graded score → serving band.
- **1:30–2:15** evidence: the **money shot** (system refuses an ungrounded claim) → **baseline side-by-side** (single-LLM rubber-stamps what the verifier caught) → cut to real corpus scale in nao (proof the pipeline is real).
- **2:15–2:45** constraints + honesty: cost paid at ingestion, budget guardrails, the rate-limit-assumption-corrected story, non-diagnostic gate; state built vs. designed vs. roadmap.
- **2:45–3:00** two-more-weeks plan → close on the hook.

**Rough sprint plan (adjust to team of 1–3; owners per phase-2-plan §Ownership):**
- **Week 1 (3–9 Jul):** register + claim credits; **tag `pre-hackathon-baseline`**; write success
  criteria + start the decision log; build the **LLM router** (with Agnes route) + synthesis node +
  `quoteCheck`; stand up cost/latency logging.
- **Week 2 (10–16 Jul):** adversarial verifier (independent retrieval, refute-by-default) +
  `EdgeVerification`; `verified_edges` store; hand-label the gold set; first baseline-vs-treatment numbers.
- **Week 3 (17–23 Jul):** nao v2 graph + evidence panel; v3 curation loop; run Agnes-vs-OpenAI curve;
  the "show a refusal" and baseline-loses cases; (stretch) GMI NLI fine-tune if credits landed.
- **Week 4 (24–31 Jul):** freeze scope; record demo; write the 1,000-word write-up from the decision log
  + measured numbers; finalize profile; verify all links; submit **before** the 31 Jul 23:59 deadline
  (no late submissions).

---

## 9 · Risks & how we defuse them

| Risk | Defuse |
|---|---|
| Over-claiming medical accuracy | Lead every surface non-diagnostic; never show a diagnosis; say "evidence-grounded ≠ clinically validated" out loud. |
| **"It's just a wrapper / just RAG"** (biggest reputational risk) | Our architecture *is* the rebuttal: decorrelated families, adversarial refutation, a grounding invariant that can't be prompted away, per-failure-mode checks, rebuildable two-tier truth. "A wrapper *trusts* the model; we structurally *distrust* it." Say it. |
| Implying the full system runs (edges don't exist yet) | Ingestion proven @ 1,200+ papers; verification demonstrated on a deep slice; graph is roadmap. The honesty *is* the pitch; a caught overclaim tanks the pillar we're otherwise strongest on. |
| Cherry-picked demo | Show a refusal + the baseline losing — a demo that includes its own failure mode reads as confidence. |
| Corpus volume mistaken for the achievement | Never lead with "1,200 papers!"; depth beats breadth (our own brief says so). Volume = evidence the pipeline works, framed as such. |
| Over-agentification suspicion | Turn it into a green flag: we kept the genuine agent roles (planner, synthesis, adversarial verifier, presentation, curation) and made the rest deterministic — every boundary defensible. |
| ASEAN / One Health read as gimmick | Keep it genuine problem-scoping (dengue/vector, tropical gut/hydration, env); never let it substitute for the technical story. |
| Agnes structured-output unproven | Verify schema-constrained output early; fallback = Agnes as pre-filter/second-opinion, OpenAI emits final verdict (§5.1). |
| Credits/GMI GPU don't arrive in time | Support-model training is already **roadmap**, not delta — declare it; the pipeline stands without it. |
| Squashing / rewriting git history | Merge with `--no-ff`, never squash; tag the baseline (§4.3) — preserve the honest timeline as evidence. |

---

## 10 · Immediate next actions (this week)

1. **Register on Luma + submit the credits Google Form** (same email throughout); **create Agnes account** for free credits.
2. **Merge PR #38, then `git tag -a pre-hackathon-baseline` + push** — freeze the prebuild line (§4.3).
3. **Write success criteria + open the decision log** (`docs/` — feeds Pillars 1 & 2).
4. **Confirm Agnes `agnes-2.0-flash` schema-constrained output** (go/no-go for the verifier role, §5.1).
5. **Build the LLM router** (OpenAI + Agnes routes) — the foundation everything else needs.
6. **Turn on cost/latency logging** before the first synthesis/verify run.

---

## 11 · Draft write-up sections — Pillar 1 & Pillar 5

Drop-in drafts for the ≤1,000-word submission write-up, implementing the §0.5 fixes: the layered
problem (generic insights → the dangerous AI fix → the missing verified substrate), pre-registered
success criteria, examined prior art, non-diagnostic discipline, and the generalisation parked as
*trajectory, not scope*. **These are submission voice — the instrumental strategist voice ("win it for
free") is deliberately absent.** `[bracketed]` values are placeholders to fill once the Priority-0 eval
artifacts exist; keep each pillar to ~200 words (five pillars, 1,000-word cap). Written in scrupulous
tense: nothing unbuilt is called "proven."

### Pillar 1 — Problem *(draft copy, ~200 words)*

Health apps surface patterns — *"your gut comfort dips on low-hydration days"* — but the insights are
generic, repetitive, and unexplained: users can't tell what a card is *for* or whether to trust it
`[cite market research]`. The obvious upgrade — an LLM that explains *why* and personalises — is the most
dangerous thing you can put in front of a health claim: LLMs confidently state correlation as causation,
reverse cause and effect, and generalise a mouse study to a person. So the real problem isn't data or
model access; it's **grounding the interpretation** — exactly when the best tool for it is the least
trustworthy.

Existing approaches each fall short: trusting the model begs the question; asking the same model *"are you
sure?"* inherits its blind spots; retrieval-augmented citation still lets it misread its own sources; and
manual evidence-grading (GRADE, Cochrane systematic reviews) is rigorous but costs experts months per
question.

We target the gap: **automated, evidence-grounded verification of LLM-proposed relationships — cheap
enough to run at ingestion, honest enough to refuse when it can't ground a claim.** Pre-registered
success: catch ≥`[N]`% of injected bad relationships a single-LLM baseline serves; ≥`[M]`% refusal on
ungroundable claims; ≤$`[X]`/≤`[Y]`s per verified edge. It needs an agent, not one call: verification
demands independent retrieval (tool use) and an adversarial second pass. We demonstrate on health-metric
relationships — where an ungrounded claim does the most harm; our prebuild app is the consumer, not the
contribution.

### Pillar 5 — Honesty & Trajectory *(draft copy, ~200 words)*

**What we did not build, plainly.** The app (biotope) is prior work — backdrop, not delta; this write-up
scores the brain. The graph is **small**: `[K]` relationships over `[P]` papers on a few metric pairs, not
a complete graph. **Support models are roadmap** — designed and data-prepped (SciFact/HealthVer/BioRED),
training deferred for lack of GPU; nothing here uses a model we did not train. Our **evaluation is
limited**: ~`[n]` hand-labelled edges, `[labelling method]`, no expert adjudication — directional, not
statistically powered. The grounding invariant is **schema-plus-prompt, not a hard guarantee**: we require
an independent-retrieval flag before a supported verdict, but cannot prove the retrieval was truly
independent. **Ourobion is non-diagnostic** and not a medical device.

**Where it breaks:** on our metric pairs (hydration, vector exposure, environment) the public verification
datasets are under-represented, so the verifier is weakest exactly where our domain is most novel —
`[worked broken-edge example]`. **Reported negative result:** `[a verifier miss — what it wrong-accepted or
wrong-rejected, and why]`.

**With two more weeks:** run the verifier across more metric pairs; wire the trained NLI model in as a
cheap first-pass verifier (pending GPU credits); ship the nao evidence-graph and human-in-the-loop
curation. The brain is a reusable, self-maintaining evidence substrate — beyond the app, the same
verified-relationship layer could back a non-diagnostic evidence-lookup assistant, a study aid for
biology/medicine students, or a grounding source for a research agent. **Those are directions, not
claims.**

> **Fill-in checklist before submission:** `[N]/[M]/[X]/[Y]` from the pre-registered criteria (§7 · P1);
> `[K]/[P]/[n]` and labelling method from the eval; one real `[broken-edge example]` and one reported
> `[verifier miss]` (Priority 0, §0.5) — the two artifacts that turn this from a design into evidence.

### Source appendix (where each decision is grounded)
- Rules: `docs/shared/hackathon/hackathon-rules.md` (raw event page — reference only, not submitted).
- Prebuild/delta scope + git dates: repo `git log` (117 commits ≤ 2026-07-03); `docs/shared/phase-2-plan.md`;
  session `docs/sessions/20260703T065307Z-agentjwork-claude-nao-corpus-run-plus-controls.md`.
- Architecture / Approach / decision log: `docs/nao/brain-synthesis-design.md`, `brain-ingestion-design.md`,
  `nao-app-design.md`, `brain-support-models-design.md`.
- Contract truth (gating + invariants): `shared/brain/relationships.ts`, `shared/brain/index.ts`,
  `shared/brain/relationships.schema.ts`.
- Non-diagnostic + prebuild framing: `docs/shared/project-context.md`, `README.md`.
- Sponsor APIs/pricing: Agnes (`agnes-ai.com/doc`, OpenAI-compatible `apihub.agnes-ai.com/v1`,
  `agnes-2.0-flash` $0/1M today), OpenAI (`developers.openai.com/api/docs/pricing`), GMI Cloud
  (`gmicloud.ai/pricing`, CE-BMaaS).
