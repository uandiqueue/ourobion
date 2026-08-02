---
title: Ourobion — what it is, why it exists, and why it is two systems
summary: The long-form project explainer — the problem that produced Ourobion, what One Health means and why it frames the product, who it is for and who it is not for, what biotope and nao each are and why they are separate, and what the identity and logo encode.
type: reference
scope: repo
status: accepted
updated: 2026-08-02
verified_by: Jayden
verified_at: 2026-08-02T09:57:50Z
---

## The origin

Ourobion began as a side project among friends — Jayden, Alton, and Janson. Jayden has always been drawn to health apps, but found that the category has a gravity toward the generic. Most health apps track weight or steps or sleep and display what you already know. He wanted to build something genuinely interesting — one that would bring attention to signals most consumer health apps ignore: gut and urinary health, the patterns in stool and urine, hydration status.

A hard question followed immediately. A real health-app development lab has an entire team whose job is finding the research and building the evidence that backs the app's claims — the scientific literature, the peer review, the validation. Ourobion is three people. How could three people possibly do that?

The answer became the architecture itself. **The brain is the substitute for a research department.** This is the single most important idea in Ourobion: the system architecture is a response to a resourcing constraint, not a technology showcase. Instead of hiring a team to do research, Ourobion automates the loop — it ingests scientific papers, synthesises relationships between health metrics, and verifies them continuously. The reasoning layer never stops running. This is not an optional feature; it is the reason the product exists.

A second problem shaped it just as much: health apps have a user retention crisis. People abandon them within weeks because no new insight ever surfaces. If an app only collects your data and shows it back to you, it is just a weaker copy of Apple Health. You will stop using it. **Continuous insight generation is therefore not a feature — it is the reason to keep the app open.** Every time a user opens Ourobion, there is something new, something that connects their data to a pattern they did not know existed.

This points to a wider claim. A traditional health app faces an iron triangle: it can either make claims it cannot fully back (reliability), hire the research team to make them solid (cost), or ship something boring that churns users (reach). Ourobion's bet is that an automated research loop breaks the triangle. You pay in none of the three currencies.

The ambition, stated carefully, is larger: paving the way for applications that are *generative* natively — that produce new value instead of serving a fixed feature set. Apps that keep surprising you because they keep learning.

## What One Health means, and why Ourobion is framed by it

**One Health** is the principle that human health, animal health, and the health of the shared environment are one interdependent system rather than three separate fields. The World Health Organization defines it as:

> One Health is an integrated, unifying approach that aims to sustainably balance and optimize the health of people, animals and ecosystems.

The fuller formulation, developed by the One Health High-Level Expert Panel, extends this to recognise that the health of humans, animals, plants, and the wider environment are closely linked and interdependent.

It is not a metaphor. It is the framing behind pandemic preparedness, antimicrobial-resistance policy, and food-system safety, and it is operationalised: on 17 October 2022 the Quadripartite — the Food and Agriculture Organization, the UN Environment Programme, the World Health Organization, and the World Organisation for Animal Health — launched the **One Health Joint Plan of Action (2022–2026)**, whose six action tracks include controlling endemic zoonotic, neglected tropical and vector-borne diseases, food-safety risk, antimicrobial resistance, and integrating the environment into One Health.

Ourobion applies the part of that system an individual can actually observe and act on: their own physiology, their daily behaviour, and the environment they are exposed to. **It does not claim to implement One Health in full.** Animal and ecosystem surveillance are real components of the framework and are not what a consumer phone app does. What Ourobion takes from One Health is the refusal to treat a person's body as a closed system — the recognition that hydration, digestion, air quality, heat, and season are not separate topics.

That framing matters more in ASEAN than it would elsewhere. A tropical, densely populated, rapidly urbanising region has a different baseline: heat and humidity load, vector-borne disease pressure, water and sanitation variation, and food systems in close contact with both livestock and wildlife. A health app designed against temperate assumptions quietly imports the wrong defaults.

**References.** WHO, [One Health](https://www.who.int/health-topics/one-health) (definition quoted above) · FAO, UNEP, WHO and WOAH, [*One Health Joint Plan of Action (2022–2026)*](https://www.who.int/publications/i/item/9789240059139), launched 17 October 2022 — also hosted by [FAO](https://www.fao.org/one-health/resources/publications/joint-plan-of-action/en) and [UNEP](https://www.unep.org/resources/publication/one-health-joint-plan-action-2022-2026).

## Who it is for

Ourobion is a One Health personal ecological health monitor built for the ASEAN market.

**The person it is built for** is someone curious about their own body who has been failed by the generic tracker: they have logged steps and weight, watched the app hand their own numbers back, and stopped opening it. They are interested in signals the mainstream category skips — digestion, stool and urine patterns, hydration — precisely because nobody else is showing them. They are willing to spend thirty seconds a day, and not a minute more.

**The person it is not built for** matters just as much. Ourobion is not for someone seeking a diagnosis, and it is not a clinical instrument. It does not tell you what condition you have and it will not tell you to seek or avoid treatment. Anyone who needs a medical answer needs a clinician; the app is explicit about this rather than hedging around it.

**A second, smaller audience** maintains the evidence layer through nao: the people who inspect what the research pipeline proposed, what the independent reviewer made of it, and what was allowed through. They are operators, not patients, which is why they get a different product entirely.

The logging burden is ruthless: under 30 seconds a day. You record a handful of observations — a quick note on digestion, on energy, on water intake — and the app handles the rest. It never makes a diagnostic claim. Its language is observational only: *your data shows a pattern*, not *you may have X*. This is not evasion; it is a deliberate design choice. The app is a mirror and a guide, not a doctor.

Privacy is structural, not bolted on. Personal health data — yours alone — is isolated from any community aggregate. Consent is granular and real; you control what you see and what gets learned from your patterns.

## Why two systems

The chain is: **Nao → Biotope → you.**

**Nao** is the brain. It is a web dashboard — the reasoning and research layer. Nao ingests scientific papers, synthesises relationships between health metrics, and verifies them. It is the operator's window, for the people tending the system, not for people living in it. It is infrastructure.

**Biotope** is the consumer mobile app, built in Flutter. It is 30-second daily logging, and insight cards that describe patterns in your own data. It is the product you use if you are interested in your health.

They share data, not code. Nao produces the evidence layer; Biotope consumes it. They are separate systems because the audiences are fundamentally different. An operator and an end user need different interfaces, different trust models, different everything. The research layer has to be tended by someone who understands it as infrastructure; the app has to be a delightful daily habit. Keeping them separate also means the research layer can be rebuilt, upgraded, or completely reimagined without touching the app — which matters when science changes, when new evidence arrives, when the evidence model needs to shift.

## The brain, and why its output can be trusted

The origin section makes a large claim: the brain substitutes for a research department. That invites the obvious objection. If a language model is doing the research, why would anyone trust what comes out?

The objection is correct, and it is the design problem. Language models state correlations as causes, reverse which thing came first, and stretch a mouse study onto a person — confidently, in fluent prose. Putting one in front of a health claim is the single most dangerous thing you can do with it. So the goal was never a model good enough to trust. It was an arrangement that does not require trusting any one component.

That arrangement is borrowed from safety engineering. James Reason's **Swiss-cheese model** describes how harm occurs in complex systems: every defensive layer has holes, and something only reaches the end when the holes in successive layers happen to line up. The engineering goal is not a perfect layer, which does not exist. It is layers whose holes sit in *different places*.

Ourobion's brain applies that in two deliberate ways.

**First, the chain alternates deterministic and non-deterministic layers.** A language model and ordinary code fail in unrelated ways, and that is exactly why they are interleaved. A model can hallucinate a quotation that reads perfectly; a string comparison does not care how plausible it reads and simply reports that those words are not in that paper. Code cannot be talked into agreeing. A model, conversely, catches meaning that no rule anticipates. Because their failure modes have almost nothing in common, an error has to survive two fundamentally different kinds of scrutiny — which is much harder than surviving the same kind twice.

| # | Layer | Kind |
|---|---|---|
| 1 | Find and retrieve open-access papers; assign identity | deterministic |
| 2 | Decide which research questions are worth asking | non-deterministic |
| 3 | Draft a relationship between two health measures from one paper | non-deterministic |
| 4 | Check every quoted span really appears in the source | **deterministic** |
| 5 | Independently review the draft, with fresh retrieval, prompted to refute | non-deterministic |
| 6 | Serving gate: serve, serve-with-qualifier, or withhold | **deterministic** |
| 7 | Non-diagnostic language check before anything is shown | **deterministic** |

**Second, the non-deterministic layers are drawn from different companies.** Two models from one family share training data, methods, and therefore blind spots — asking one to check the other's work is theatre, not review. So the drafting model (OpenAI's GPT-5) and the reviewing model (Agnes AI's `agnes-2.5-flash`) must come from different vendors, and the router refuses to start if they do not. This is an enforced invariant rather than a habit or a prompt instruction: there is no configuration path that disables it, and it fails closed. A supporting or contradicting verdict additionally requires the reviewer to have done its *own* retrieval — without fresh grounding, the strongest verdict available to it is "uncertain."

The result is a system whose most useful behaviour is refusal. Of fourteen relationships drafted so far, three never reached a person, because the independent reviewer could not ground them.

### The layers not yet built

Seven layers is where the chain stands today, not where it is meant to end. The honest description of the current state is that **a card can be served on the strength of a single paper.** The serving gate asks whether a claim is faithful to *the paper it cites* — are the quotes real, is the scope right, does the effect size match. It does not yet ask whether the wider literature agrees. Cross-paper corroboration, study-design tier, and venue impact are computed and used to *rank*, but they no longer withhold a card; when they did, a live run showed every check against the cited paper passing while thin other-paper signals banded the result "hold," which amounted to rejection with extra steps.

So a faithfully reported claim from one paper may still be one the field as a whole does not support, and today the only thing carrying that risk to the reader is the verification caveat. Each layer below closes part of that gap. They are ordered roughly by how soon they are reachable.

**Finer-grained deterministic grounding.** Papers are currently handled as extracted text. Splitting them into sections with stable sentence identifiers lets a quote be pinned to *this sentence in this section*, rather than matched anywhere in the document — which makes the quote gate strictly harder to pass, and makes a drifted or stitched-together quotation detectable rather than merely unlikely.

**A citation and evidence chain.** Following a paper's own references turns an isolated claim into a position in a literature: what it builds on, what it contradicts, and whether its supporting citations say what it says they say. This is a deterministic layer — graph traversal, not judgement — and it is the substrate the corroboration work needs.

**Cross-paper agreement.** The most valuable missing layer. When several papers independently support the same relationship, that agreement becomes a reliability signal rather than a second claim — the same slice made thicker, not another slice added. It is not built yet for a plain reason: doing it across the corpus takes far more model calls than the project can currently pay for.

**A more comprehensive reliability score.** Once corroboration and the evidence chain exist, the ranking signals already being computed can be recombined into a single score that a reader can interpret, and that can once again gate rather than only rank — this time without the failure mode that forced the change.

**Custom models taking narrower jobs.** Small trained classifiers are cheaper per call than a frontier model, which is precisely what a corroboration layer needs. Both models trained so far are described below; neither is trusted with product output yet, and neither will be until it earns it.

The pattern is consistent: every item is another layer whose holes sit somewhere new. None of them makes any single layer perfect, because that is not the design.

### Two models trained, neither shipped

Two small specialist models were trained to take narrower jobs off the language models: **Viceroy**, which judges whether a sentence claims a cause or only a correlation, and **Zebra**, which judges whether evidence supports a claim. Viceroy beat its simple baseline comfortably. Zebra missed the minimum score written down before training, and the code refuses to promote it.

Neither is wired into the product. That is the intended behaviour of a layered system rather than a gap in it: a layer was built, measured against criteria fixed in advance, found wanting, and not relied upon. The full reports — including the preregistered gates, the disagreement pilot against a third model, and the limitations we do not think a summary can fairly compress — are in [`hackathon/the_launchpad_challenge/plan/research-models.md`](hackathon/the_launchpad_challenge/plan/research-models.md).

## Identity and logo

The name fuses two ideas: the **ouroboros**, the ancient serpent that swallows its own tail, a symbol of cycles and renewal; and **bion**, from the Greek *bíos*, meaning the fundamental unit of life — the cell.

The mark embodies both. A single serpent coils around a circular ring, weaving over and under itself like a strand of DNA, with a nucleus at the centre. It reads at once as a coiled serpent and as a living cell.

The most important part is the open loop. Unlike the classical ouroboros, Ourobion's serpent never closes on itself. The head reaches toward the tail but a gap remains — the loop stays deliberately open. This is the brand's central idea: in biology, the loop of understanding is never finished. There is always new knowledge, always more to learn. The gap reframes the ouroboros from a closed cycle of repetition into an open spiral of discovery — which is exactly what the research loop does. It is never done.

The geometry carries meaning. The ring is divided into 23 segments, and the serpent makes 23 crossings as it weaves over and under. This is a quiet reference to the 23 chromosomes in a human cell. The number is meaning, not ornament.

The colour is teal — the meeting point of blue and green. Blue carries associations of trust, clarity, and clinical credibility. Green carries life, growth, and health. Together, teal reads as bioluminescence, the cool glow of a cell under fluorescence microscopy, tying the palette to the science itself.

The system uses one master ring and serpent, constant across both products, but each product changes the centre — the nucleus. Nao's nucleus is a knowledge graph, a hub with radiating nodes, drawn in dark teal shifting to violet because it is infrastructure. Biotope's nucleus is a biomechanical bloom, a flower built to machine tolerances, drawn in warm gold on white because it is a consumer surface, a cultivated system — nature, but instrumented and measured.

The family together tells a story: intelligence at the core, an environment around it, a person at the centre of care.
