---
title: Ourobion — Launchpad 2026 submission references
summary: External works cited by writeup.txt and appendix.md — the Swiss-cheese reliability model and the evidence-grading approaches named as prior art.
type: reference
scope: repo
status: draft
updated: 2026-08-02
---

# References

Companion to [`writeup.txt`](./writeup.txt) and [`appendix.md`](./appendix.md). Third-party models,
datasets, platforms, code, fonts, and assets are credited separately in
[ATTRIBUTION.md](../../../../ATTRIBUTION.md).

## Reliability framing

The layered design follows the Swiss-cheese model of accident causation — many imperfect checks, none
trusted alone, arranged so that a single mistake does not reach a published result.

- Reason, J. *Human Error*. Cambridge University Press, 1990.
- Reason, J. "Human error: models and management." *BMJ* 2000;320:768–770.
  <https://doi.org/10.1136/bmj.320.7237.768>

## Prior approaches named in the write-up

Manual evidence grading — rigorous, and the cost baseline our automation is measured against.

- GRADE Working Group. "Grading quality of evidence and strength of recommendations."
  *BMJ* 2004;328:1490. <https://doi.org/10.1136/bmj.328.7454.1490>
- Higgins, J.P.T. et al., eds. *Cochrane Handbook for Systematic Reviews of Interventions*.
  Cochrane, current version. <https://training.cochrane.org/handbook>

## Training data for the two small models we trained

- **Viceroy**, which judges whether a sentence claims a cause or only a correlation — trained on
  Yu, B., Li, Y. and Wang, J. "Detecting Causal Language Use in Science Findings." *EMNLP* 2019.
  <https://doi.org/10.18653/v1/D19-1473>
- **Zebra**, which judges whether a piece of evidence supports a claim — trained on
  Wadden, D. et al. "Fact or Fiction: Verifying Scientific Claims." *EMNLP* 2020, the SciFact
  dataset. <https://doi.org/10.18653/v1/2020.emnlp-main.609>

Neither model is used in the product. Both are marked in the database as unvalidated and not ready to
serve, and the code refuses to load a model carrying those flags.
