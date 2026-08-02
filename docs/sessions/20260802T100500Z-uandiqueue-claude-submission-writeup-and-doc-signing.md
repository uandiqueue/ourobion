---
title: Rebuild the Launchpad write-up as a 1,000-word plain-text submission, split evidence into appendix and references, and sign four governed documents
summary: Reviewed the judge-facing write-up against the five-pillar rubric, replaced it with an exactly-1,000-word writeup.txt plus appendix.md and references.md, corrected stale model-training and hackathon-plan records, folded the Swiss-cheese reliability argument into project-overview.md, and applied Jayden's verification to four documents.
type: session
scope: repo
status: canonical
updated: 2026-08-02
memory: added 0024 (training compute is local Apple Silicon); renumbered team-composition 0018 → 0025 to clear an id collision with main's 0018-cloud-verifier-authorization; merged 0007 with main's #371 extracted-rule extension and returned it to unverified.
---

# Launchpad submission rewrite and governed-document signing

Branch: `docs/phase4/stale-updates-328`. Collaborative local session with the owner, continuing the
prior session on the same branch.

## Attempted

- Evaluate `writeup.md` against the Launchpad five-pillar rubric for a mixed judge audience, then
  rebuild it to the rubric and the 1,000-word cap.
- Move everything that does not fit the cap into companion documents rather than dropping it.
- Correct records that had gone stale or wrong: model-training state, the hackathon direction doc,
  and the project overview's origin story.
- Record the GMI compute constraint in the document that owns model state, plus one durable memory.
- Apply the owner's verification to documents the owner named.

## Changed

### Submission

- Added `docs/hackathon/the_launchpad_challenge/submission/writeup.txt` — **exactly 1,000 words**
  by `wc -w`, plain text with no front matter, five pillars as section headings, because the
  submission portal accepts no formatting. Replaces the deleted `writeup.md`.
- Opened on James Reason's Swiss-cheese model (owner's choice, attributed), which carries the
  "why an agent rather than one well-prompted call" argument and returns in the limitations as
  "every layer has holes."
- Added the prior-art paragraph the Problem pillar was missing (GRADE and Cochrane, same-model
  re-ask, retrieval-with-citations), named the Agentic Systems track, and stated the
  pre-declared criterion as a criterion.
- Corrected the card claim: biotope shows research-backed cards on the seeded, view-only demo
  account, and a self-created account is empty by design. The previous text understated this into
  "we do not claim biotope currently shows a research-backed card."
- Stated plainly that the demonstration profile's health logs are synthetic, and that the account is
  view-only in both products.
- Added `appendix.md`, written for a reader who has not seen the codebase: evidence organised by the
  write-up claim it backs, the prior-work/delta boundary, a "Not claimed" section, and a glossary.
  Internal shorthand was removed or defined — `L6`, `verified_edges`, `quoteCheck`, `serving_ready`,
  `D1/R2 ETL`, macro-F1, Cohen's kappa.
- Added `references.md`: Reason 1990 and BMJ 2000, GRADE and the Cochrane Handbook, and the two
  training corpora.

### Records corrected

- `docs/development/model-training/README.md` claimed Zebra was "planned; no training or GMI
  provisioning performed" and Viceroy "planned; GPL-3.0 review is required", for two models with
  published results. Both rows now carry real state, scores, and result links; the bundle table no
  longer says "no training run". Added a Compute section recording the GMI non-arrival.
- `docs/memory/0024-training-compute-is-local.md` added. First written as 0019, which collided with
  the existing runtime-topology memory; renumbered to 0024 and the index regenerated.
- `hackathon-direction.md`: deadline corrected to 2 Aug 23:59 SGT and finalists to 9 Aug; the
  "user opening the app sees no paper-derived card" claim marked superseded; planning-era model ids
  (`agnes-2.0-flash`, `GPT-5.5`) marked as not what ran; the `pre-hackathon-baseline` tag recorded as
  never pushed, with the commit-date boundary given instead. A precedence banner was added: where
  this document and the submission disagree, the submission wins.
- The §5.1 Agnes cost-accuracy curve was marked **moot rather than unfulfilled** — Agnes is $0 at our
  verification volume, so the cost axis is zero and there is nothing to plot.
- `research-models.md`: added where the models trained and the cue-lexicon macro-F1 baseline.

### Product documents

- `docs/project-overview.md`: origin corrected from "the owner… she" to the three friends with
  Jayden named and correct pronouns, and from a two-person to a three-person team. Added a One Health
  section with the WHO definition and the Quadripartite Joint Plan of Action. Expanded "Who it is
  for" into who it is and is not built for. Added "The brain, and why its output can be trusted",
  folding in the Swiss-cheese argument as an alternating deterministic/non-deterministic chain plus
  cross-vendor decorrelation, and reframed the old "where the layering deliberately stops" section
  into "The layers not yet built".
- `docs/repository-guide.md`: fixed the broken `writeup.md` link, removed the `model/` row (the
  directory is gitignored and has zero tracked files), and corrected the app-README description.
- `README.md`: navigation moved to the top as "Where to go", with the submission folder first.

### Verification applied

Jayden's stamp (`status: accepted`, `verified_by: Jayden`) applied to `docs/engineering-practice.md`,
`docs/project-overview.md`, and `docs/repository-guide.md`. `hackathon-rules.md` was stamped by the
owner directly during the session.

## Corrections made to this session's own work

- The Agnes cost-curve absence was first recorded as a plan that failed. The owner corrected it: with
  Agnes free, there is no comparison to make.
- The "where the layering deliberately stops" framing was wrong; the owner corrected it to a
  forward-looking list of layers not yet built.
- The repository guide was written to say the app READMEs show screens and features. They contain
  zero screenshots and are build instructions; corrected before signing.
- The One Health references were drafted from model knowledge. Before signing, the WHO definition was
  fetched and confirmed verbatim, the Joint Plan of Action date was confirmed as 17 October 2022, the
  over-long block quote was split so only the verified sentence stays quoted, and an unreachable CDC
  link (HTTP 403) was removed.

## Not done

- No single-call baseline comparison was run; the submission states that absence rather than implying
  the comparison exists.
- Biotope's read-only enforcement was **not** verified as a server-side rule rather than a client
  affordance. The appendix claims a judge cannot change the demo state; that claim rests on the
  owner's report.
- The `pre-hackathon-baseline` tag was not created. The commit-date boundary is used instead.
