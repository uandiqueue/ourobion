---
title: Ourobion — project summary
summary: A short plain-prose overview of what Ourobion is, why it was built the way it was, and what it does and does not claim; the write-up, appendix and references carry the detail and the figures.
type: reference
scope: repo
status: unverified
updated: 2026-08-03
---

# Ourobion — project summary

Ourobion is a non-diagnostic One Health personal health monitor for the ASEAN market. A person logs
a small set of daily signals — gut comfort, hydration, behaviour, and optionally a few wearable
readings — and the system describes patterns in their own data. It never offers a diagnosis.

What sits underneath is the part built for this challenge. Health apps collect well and explain
badly; explaining why a pattern might matter means reading the scientific literature, which is what
a health company hires a research department to do. We are three builders and could not hire one, so
we grew one.

The obvious shortcut — attach a language model, ask it why — is the most dangerous thing to put in
front of a health claim. A model will state a correlation as a cause, reverse which came first, and
stretch a mouse study onto a person. So the pipeline is built the way patient safety is: no single
check is trusted, and imperfect checks are stacked until their holes stop lining up. A model drafts a
relationship between two health measures from one paper. Deterministic code confirms every quoted
span really appears in that paper. A second model, from a different company, retrieves its own
evidence and tries to refute the claim. A numeric gate then decides whether the relationship may
reach anyone at all. Any layer can stop the run. Two of them are enforced in code rather than asked
for in a prompt: a reviewer that did not retrieve its own sources cannot return a supporting verdict,
and the router refuses to start when the drafting and reviewing models come from the same company.

The loop runs unattended in the cloud and has completed end to end — papers in, relationships drafted
and independently reviewed, survivors projected into the database the app reads, and cards rendered
that cite the paper behind them. It is deliberately narrow: depth on a curated slice rather than
breadth.

Two small research models were trained during the challenge. One beat its baseline. The other missed
a bar we had written down before training, and the code refuses to promote it. Neither serves the
product, and that is a decision rather than an omission.

What we are careful not to claim: verified means a claim faithfully reads the paper it cites, not
that the wider literature agrees, and not clinical validation. Clearing the gate makes a relationship
eligible to be shown, not shown. The demonstration account's health data is seeded, and so are the
cards computed from it. Ourobion is not a medical device.

The write-up, appendix and references carry the detail and the figures.
