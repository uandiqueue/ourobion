# HACKATHON_NARRATIVE.md — the submission story (research-backed)

> **Status:** recommendation, 2026-07-13 · Refines the framing in
> [`HACKATHON_DIRECTION.md`](HACKATHON_DIRECTION.md) §3 with an online prior-art + judge-appeal study.
> Raw rules: [`HACKATHON.md`](HACKATHON.md) · Self-judgement: [`HACKATHON_CRITERIA_JUDGE.md`](HACKATHON_CRITERIA_JUDGE.md).
>
> **Bottom line:** lead with the adversarial verifier as *a modest claim proven*; make the
> **withhold / "uncertain"** moment the hero; close with a **schema-checkable** generalization beat —
> **do not coin "Living Apps"** as the headline. This gives the highest floor and a ceiling nearly as
> high as the big-vision framing, without its front-loaded scope-creep risk.

---

## 0 · The "Living Apps" question, answered directly

You were unsure whether to build the story around **"Living Apps"** (nao as a reusable engine powering
any app that needs gated, reliable online-knowledge input — health today, education/finance tomorrow).
The research verdict, converging across four independent angles (prior-art, judge-appeal, generalization,
and buzzword-risk), is: **it is the right *idea* in the wrong *slot*.**

- The governing rule — *"a modest claim proven beats a grand claim asserted"* — is the **axis judges
  score on**, not a tiebreaker. "Living Apps" generalizes from **one** built vertical to "any app." That
  is the textbook *grand claim asserted*, and it forfeits the two most-weighted pillars (Evidence,
  Honesty) the moment a judge files it as overreach — which the VC/judge literature says happens in the
  first ~30 seconds ("platform theater": claiming the platform before the wedge is proven).
- **"living games" is Google's coined term** (Mar 2025), not ours — so leaning on it invites a second
  credibility hit from a games-adjacent judge, and its meaning (*more* generation, emergent novelty) is
  the **opposite** of nao's actual innovation, which is **restraint** (a verifier that *withholds*).
- "Living Apps" as an umbrella is **not** an established term; the 2026 lexicon already has better ones
  (self-evolving software, agentic software), and it collides with Salesforce/IBM's "Quip Live Apps."
  A coined proper-noun you must define is a tax on a skeptical technical audience — a red-flag pattern.

**But the upside is real and we keep all of it** — by demoting the vision to a *trajectory close* that
is a **checkable architectural fact**, not a promise (see §2). The generalization category is genuinely
validated in the market (AWS Bedrock Automated Reasoning checks; Vectara's per-vertical healthcare/
finserv trust layer; Galileo Agent Control, being acquired by Cisco), which we cite as proof the
*direction* is real — while sharpening our delta against it.

---

## 1 · Headline framing — the adversarial verifier, sharpened

**Lead with:** *the delta is a gated, evidence-grounded, adversarially-verified reasoning layer.* Do not
let it read as "just an integration of known parts" (adversarial fact-checking is published prior art —
PROClaim, FC-MAD, Tool-MAD). The defensible, **novel-in-combination** claim is:

> **"The first system to push scientific-claim verification past offline 3-way classification into a
> gated, receipt-bearing, real-time *serve* decision — with a decorrelated, non-Anthropic adversary
> that must independently re-ground each claim and defaults to *uncertain* when it can't."**

Narrow, novel in combination, demonstrable, honest.

### Hook (make judges feel it)
> *"Correlations are cheap — any dashboard will show you ten thousand. The expensive question is which
> ones the science can actually defend. Almost every app that ingests knowledge from the internet just
> trusts it. We don't."*

### Mechanism (one breath)
> *"One LLM reads a paper and proposes a metric-to-metric health relationship. A second, decorrelated
> non-Anthropic model is told to *disprove* it — it must do its own independent retrieval against fresh
> literature, and if it can't ground the claim itself, the verdict defaults to *uncertain* and we
> withhold. Only what survives cross-examination reaches the user — with receipts: quote spans,
> citations, evidence tier."*

---

## 2 · Where "living apps" belongs — the trajectory close

Not the headline, **never a capitalized proper noun**. Attribute "living games" to Google if invoked at
all, lowercase, as an intuition pump only. State generalization as an **observed property of the
architecture** — a judge can open the schema and check that the verifier contract
(`shared/brain/relationships.ts` `EdgeVerification`) is domain-neutral:

> *"One thing worth noting: the verifier never sees a health fact. It sees a claim, a set of sources,
> and a prompt to refute them — you can read it in the schema; the verdict type has nothing
> health-specific in it. Only the corpus and the metric ontology are domain-bound. Swap those and the
> same gate runs on curriculum standards or market filings. AWS, Vectara, and Galileo are all building
> horizontal trust layers, so the direction is real — the difference is ours is adversarial and
> decorrelated, built to *refute* rather than confirm. Health is where we earned it; it's not where it
> ends."*

This captures the vision's entire upside (reusable substrate, market awareness, category-level thinking
→ the "would I hire this person?" signal) while staying inside the modest-claim rule, and it *names the
seams* that change per vertical (corpus, ontology, evidence-tier rubric, expert calibration set) — which
itself scores Constraints + Honesty. **If the demo runs long, cut this beat before cutting evidence — it
is the sacrificial slide.**

---

## 3 · Per-pillar narrative hooks

- **Problem.** Correlations are cheap; served health claims the literature can't defend are dangerous —
  and single-pass RAG makes it *worse* (fabricated citations, misleading confidence, context conflict
  are documented biomedical-grounding failures). The gap: existing benchmarks (SciFact, HealthVer,
  HealthFC) stop at offline 3-way classification — none do fresh retrieval or gate a *served* decision.
- **Approach.** Deterministic everywhere except two LLM roles + phrasing. Propose → decorrelated
  adversarial refutation with mandatory independent retrieval → serve / serve-with-qualifier / withhold.
  Principled, not vibes: the **self-preference-bias** literature explains *why the verifier must be a
  different vendor* (an Anthropic model judging an Anthropic proposal self-enhances); *Neural Diversity
  Regularizes Hallucinations* gives formal tail bounds for why decorrelation lowers joint hallucination
  probability.
- **Evidence.** Show, don't assert: (a) beat the naive single-LLM baseline on a real miss-rate —
  pre-empting the finding that simple baselines often beat complex multi-agent stacks at a fraction of
  the cost; (b) a cost/latency curve; (c) the signature moment — a live case where the verifier
  **refused to serve**. The schema's `superRefine` invariant is the executable proof the gate isn't a
  rubber stamp.
- **Constraints.** Deterministic pipeline; non-determinism quarantined to two model calls + phrasing.
  Named honest limits: decorrelated verifiers retain **residual error correlation** (ρ≈0.38 in the
  literature) — cross-examination *reduces* joint failure, it doesn't eliminate it. Per-vertical
  generalization cost named, not hand-waved.
- **Honesty & Trajectory.** The claim is deliberately bounded: *"adversarial decorrelated verification
  measurably reduces served-claim error — not eliminates it."* **Withhold/uncertain is the hero, not
  the caveat** — a system that says "I don't know" is the strongest evidence of reasoning quality to
  expert judges. Trajectory = the schema-checkable generalization beat, earned by the wedge.

---

## 4 · Top risks → defuse

1. **"Under-differentiated — adversarial fact-checking is prior art."** Don't claim to invent it; claim
   the *specific unoccupied combination* (offline-classification → gated real-time *serve*, decorrelated
   non-Anthropic re-grounding adversary). Cite the prior art yourself to show you know where your delta
   sits.
2. **"Second model = expensive complexity for its own sake" (a live red flag).** Own the baseline
   comparison: show the two-role gate beats a single-LLM pass on served-error, with the cost/latency
   curve. If it didn't beat the baseline, you'd cut it — say so.
3. **Generalization close reads as scope-creep.** Keep it to the scripted ~30 s *after* the proof,
   phrased as an observed property with the schema on screen, seams named. Never capitalize "Living
   Apps." Sacrificial slide if time is short.
4. **A Google-adjacent judge recognizes "living games."** Attribute it explicitly; note the deliberate
   inversion (living games chase *more* generation; nao's innovation is *restraint*). Turn the mismatch
   into a stated design choice.
5. **Judge probes the eval's honesty.** Lead with the limitation before they ask (residual correlation,
   miss-rate, what the verifier still gets wrong). Replace "we didn't have time" with trade-off
   analysis. Transparency reads as confidence; a buried weakness a judge uncovers reads as a red flag.

---

## 5 · Sources (verified during research)

**Mechanism / prior art**
- SciFact — https://arxiv.org/pdf/2402.02844
- HealthVer / MultiVerS — https://ar5iv.labs.arxiv.org/html/2112.01640 · https://github.com/dwadden/multivers
- HealthFC — https://arxiv.org/html/2309.08503v2
- BioRED — https://arxiv.org/abs/2204.04263
- RAG failure modes (biomedical) — https://arxiv.org/html/2506.00054v1 · https://arxiv.org/pdf/2407.12858
- Multi-agent / adversarial verification (PROClaim, FC-MAD, Tool-MAD) — https://www.sciencedirect.com/science/article/pii/S2405959526000883 · https://arxiv.org/html/2510.12697v1
- Neural Diversity Regularizes Hallucinations — https://arxiv.org/abs/2510.20690
- LLM-as-judge self-preference bias — https://arxiv.org/html/2410.21819v1 · https://arxiv.org/pdf/2412.05579

**Baseline / evidence-appropriateness**
- GRADE — https://www.bjanaesthesia.org.uk/article/S0007-0912(19)30643-9/fulltext
- Systematic-review cost/time (~16 mo, >$100k) — https://pmc.ncbi.nlm.nih.gov/articles/PMC11975841/
- Overengineering / simple-baseline-beats-complex — https://blog.trace3.com/the-ai-overengineering-trap

**Judge appeal / sequencing**
- JetBrains "how to win a hackathon" — https://blog.jetbrains.com/ai/2026/06/how-to-win-a-hackathon-notes-from-the-judging-table/
- Devpost judging tips — https://info.devpost.com/blog/hackathon-judging-tips
- Platform vs point ("platform theater") — https://valueaddvc.com/blog/how-to-think-about-platform-vs-point-solution
- ISEF conversation-based judging / negative results — https://www.sciencefair.io/blog/judges-look-for-winning-isef-project

**Generalization / category validation**
- AWS Bedrock Automated Reasoning checks — https://aws.amazon.com/blogs/aws/minimize-ai-hallucinations-and-deliver-up-to-99-verification-accuracy-with-automated-reasoning-checks-now-available/
- Vectara per-vertical trust layer — https://www.vectara.com/business/solutions/verticals/healthcare · https://www.vectara.com/business/solutions/verticals/finserv
- Galileo Agent Control / Cisco acquisition — https://thenewstack.io/galileo-agent-control-open-source/
- "Earn the right to go horizontal" — https://insights.euclid.vc/p/early-stage-vc-in-the-age-of-vertical

**"living apps" term / buzzword risk**
- Google "living games" (coinage, Mar 2025) — https://blog.google/innovation-and-ai/infrastructure-and-cloud/google-cloud/generative-ai-video-games/
- Self-evolving software (established lexicon) — https://cogentinfo.com/resources/ai-driven-self-evolving-software-the-rise-of-autonomous-codebases-by-2026
- Buzzword credibility cost — https://www.inc.com/ben-parr/the-list-of-buzzwords-you-should-never-use-in-a-pitch.html

> **Sourcing caveat (carry into the write-up):** the "~50×-cost simple-baseline" figure and a few
> gated pages (ScienceDirect/ResearchGate/Solyco/Grounded-AI) were seen via search snippets, not full
> fetches — **re-verify exact numbers before citing on-stage.**

---

## 6 · Relationship to `HACKATHON_DIRECTION.md`

This **confirms and sharpens** the direction doc, which already picked the Agentic-Systems track and the
"correlations are cheap" hook. New here: (1) the explicit A-vs-"Living-Apps" ruling with the reasons;
(2) the exact trajectory-close wording that makes generalization checkable rather than asserted;
(3) external prior-art positioning (SciFact/HealthVer/HealthFC, GRADE/Cochrane, RAG failure modes,
decorrelation theory) that the self-judgement round docked Problem/Approach for lacking; and (4) the
consolidated source list. No contradiction with the direction doc's Priority-0 eval plan — that plan is
exactly what turns these hooks from claims into evidence.
