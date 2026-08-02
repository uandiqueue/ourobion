---
title: Ourobion — project summary
summary: A short plain-prose overview of Ourobion as an agentic research system — the layered pipeline that turns scientific literature into reviewed relationships, why it is built that way, and what it does not claim; the write-up, appendix and references carry the detail and the figures.
type: reference
scope: repo
status: unverified
updated: 2026-08-03
---

# Ourobion — project summary

Ourobion is an agentic research system. A pipeline of language models and deterministic checks reads
open-access scientific literature and turns it into relationships between health measures, each one
traceable back to the paper it came from and to the independent review that let it through. That loop
is the work. A phone app, biotope, is where its output has to land in front of a person, and a
research workbench, nao, is where every relationship can be opened and inspected.

The problem is grounding. Explaining why a pattern in someone's health data might matter means
reading the literature, which is what a health company hires a research department to do. We are
three builders and could not hire one, so we grew one. The obvious shortcut — attach a language
model, ask it why — is the most dangerous thing to put in front of a health claim: a model will state
a correlation as a cause, reverse which came first, and stretch a mouse study onto a person. The
difficulty is grounding the interpretation when the best tool for the job is the least trustworthy
part of the system.

So the pipeline is built the way patient safety is: no single check is trusted, and imperfect checks
are stacked until their holes stop lining up. One model drafts a relationship from a single paper.
Deterministic code confirms every quoted span really appears in that paper. A second model, from a
different company, retrieves its own evidence and tries to refute the claim. A numeric gate decides
whether the relationship may reach anyone. Any layer can stop the run, and two of them are enforced
in code rather than asked for in a prompt: a reviewer that did not retrieve its own sources cannot
return a supporting verdict, and the router refuses to start when the drafting and reviewing models
come from the same company. Models are used only where interpretation is needed; identity, quoting,
budgets, routing and release are deterministic.

The loop runs unattended in the cloud and has completed end to end: papers in, relationships drafted
and independently reviewed, survivors projected into the database the app reads, cards rendered that
cite the paper behind them. It is deliberately narrow, depth on a curated slice rather than breadth.

Two small research models were trained during the challenge. One beat its baseline. The other missed
a bar written down before training, and the code refuses to promote it. Neither serves the product,
which is a decision rather than an omission.

What we are careful not to claim: verified means a claim faithfully reads the paper it cites, not
that the wider literature agrees, and not clinical validation. Clearing the gate makes a relationship
eligible to be shown, not shown. The demonstration account's health data is seeded, and so are the
cards computed from it. Ourobion is non-diagnostic and is not a medical device.

The write-up, appendix and references carry the detail and the figures.
