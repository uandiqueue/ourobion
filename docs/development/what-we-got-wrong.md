---
title: What we got wrong, and what caught it
summary: A running record of decisions this project reversed, assumptions it disproved, and defects it caught before they shipped — organised by the mechanism that caught each, because the mechanism is the point.
type: reference
scope: repo
status: canonical
updated: 2026-08-02
---

# What we got wrong, and what caught it

Every entry here is a case where this project believed something, and was wrong.

It exists because a reversal with a stated reason is stronger evidence than a decision that happened
to work out. Anyone can list what went right. What tells you whether a system is trustworthy is
whether it can find its own errors — and, more importantly, *what found them*.

So the organising principle is not the mistake. It is **the mechanism that caught it**. Read down the
section headings and you are reading the project's actual defence in depth: live verification,
independent review, literature, automated gates, and humans each catch a different class of error,
and none of them catches all of them. That is the same argument the reliability design makes about
[decorrelated verification](../hackathon/the_launchpad_challenge/plan/research-models.md) — many
imperfect layers whose holes do not line up — applied to the team rather than to the model.

Each entry cites the session log it came from, under `docs/sessions/`, so any of it can be checked.

---

## Caught by live verification against reality

**A rate-limit model that was simply invented.** A design document stated that the CORE API allowed
"1000 tokens/day, hard-stop 950", and the rate limiter was built to match. On the first real
ingestion run, inspection of the live `X-RateLimit-*` response headers showed the truth: roughly a
ten-request bucket that refills after about sixty seconds. Nothing about the documented model was
correct. CORE was removed from the budget model entirely, the limiter was corrected from an
unverified ~1/s to the measured 10/60s, and 429-aware retry was added. `20260703`

*Why it matters:* the number had been written confidently, propagated into code, and survived review —
because nobody had asked the API. It took thirty seconds of looking at a response header to falsify.

**Deployed code that did not match its own specification.** The baseline confidence cutoffs were
specified as 3/5/14, but the shipped v1 code used 3/7/14. The divergence was found only when the
component was reimplemented. `20260715`

---

## Caught by independent or adversarial review

**A deduplication bug that would have quietly corrupted the corpus.** In the ingestion pipeline, a
content fingerprint was being applied unconditionally. Two genuinely different papers that shared a
title, author and year — but had *different DOIs* — could therefore collapse into a single
`paper_uid`. Adversarial review caught it before it ran at scale; the fingerprint is now used only
when no external identifier exists, with a regression test. `20260629`

*Why it matters:* this would not have thrown an error. It would have silently merged distinct
science, and every downstream claim built on the merged record would have been wrong.

**A serialization bug behind a 500.** `citationsContainsValue()` returned a JavaScript array, which
postgrest-js serialised as a Postgres array literal — producing `cs.{[object Object]}` and a 500.
Found during a file-by-file audit of a predecessor session's partial work after it halted mid-task.
`20260724`

**A training plan with stacked, unexamined assumptions.** An initial model-training plan contained
dev-set early-stopping leakage, undefined neutral labels, unsupported WORM and image-digest
assumptions, and errors in the budget-reserve logic. An explicit adversarial pass found and fixed all
of them before the plan was finalised. `20260726`

---

## Caught by evidence and literature review

**A threshold changed without justification, and reverted.** One unit moved the "medium confidence"
cutoff from 7 days to 5. A subsequent evidence review found that 6–7 nights is what the literature
supports, and that nothing supported 5. It was reverted, and a boundary test now pins the value so
the regression cannot recur silently. `20260719`

**Three dataset assumptions, all false.** The support-model design asserted that BioRED carries
relation *direction* labels, that MEDLINE `PublicationType` can express evidence tiers 1–3, and that
Cochrane Crowd data was reusable here. A bounded research task checked all three against primary
sources. All three were wrong — direction needs a separate enrichment whose licence is unverified,
tier 1 is a check tag while cohort and cross-sectional are MeSH headings, and Cochrane Crowd is
licensed for personal use only. Recorded as `docs/memory/0017`. `20260726`

*Why it matters:* the research task was explicitly briefed that a negative verdict with evidence
beats a padded list of confirmations. It returned three negatives.

---

## Caught by an automated gate

**A reproducibility bug no human would have seen.** Attestation hashes generated on Windows differed
from those generated on Linux — not because anything had changed, but because raw-byte hashing made
CRLF and LF line endings hash differently. CI caught it. Attested text is now canonicalised to LF,
with tests covering the invariant. `20260727`

**A policy the process would not let us break.** A task asked for an append to an existing
architecture decision record. Committing the amendment made `context_sync --check` fail on an
immutability guard enforced by both the pre-push hook and CI. The amendment was recorded as intent in
a decision register instead. `20260719`

*Why it matters:* the guard blocked a change that had been explicitly requested. That is the gate
working, not the gate being inconvenient.

**A size cap that stopped a merge.** The landing gate measured 14,063 added lines against an 8,500
cap and hard-stopped, 5,563 lines over. Investigation showed an unrelated merge had already consumed
most of the budget, so each subsequent unit was being charged for work it did not do. The fix was
structural: each unit now advances its own base so the gate measures per-unit work. `20260729`

**A function that was built but never wired up.** `evaluate-signals` existed and passed its tests, but
had no entry in `supabase/config.toml` — so it had no cron and no configured trigger. Found while
wiring the pipeline. `20260724`

**A copy rule that matched too loosely.** Forbidden-term matching was tightened to
`\b<word>(?:e?s)?\b` after a regression where words such as "conditions" passed a check they should
not have. `20260718`

---

## Caught by a human

**An architecture reversed on one question.** The first control-plane design queued ingestion requests
through an R2 "mailbox". The owner pointed out that it could not actually invoke anything on demand.
It was redesigned around GitHub Actions `workflow_dispatch`. `20260703`

**A stale worktree that produced confident false claims.** An agent rewrote three planning documents
from a worktree cut before a PR landed, checked for a file, did not find it, and reported it did not
exist. It did exist. Three agents were writing that branch and the worktree had gone stale within the
hour. Two rules came out of it: fetch before touching shared planning documents, not merely at
session start; and read-only subagents may run in parallel, but **writers must be strictly serial**,
because concurrent writers in one worktree corrupt each other. `20260727`

**Features reported as unbuilt that were already built.** A status claim said the app shell,
navigation and a statistics display were not implemented. All were, and were wired into the app
shell. `20260702`

**"Gitignored" used to mean "absent".** A session reported that evidence-review files were gitignored.
They were not ignored at all — merely untracked. The distinction was settled with
`git check-ignore`. `20260720`

*Why it matters:* the same confusion recurred during this housekeeping run, in a pull-request
description that said a directory "was gitignored" when the files had been on disk the whole time.
The owner caught it. Recurring confusions deserve to be written down precisely because they recur.

---

## Chose to fail rather than approximate

Not errors — refusals. Included because deciding *not* to ship is the same judgement, exercised
before the fact.

**An unverified statistic.** A request to ship a hand-rolled implementation of the xDF
effective-sample-size method was blocked by a deliberate throw: *"not yet implemented — faithful
Afyouni xDF port + reference-vector verification pending … must not ship unverified."* The
cross-correlation-aware effective-N is the principled fix for co-moving metric pairs; an unverified
version would have produced confident-looking numbers with nothing behind them. `20260719`

**A model that missed its own bar.** Zebra v1 was trained, evaluated, and found below its
preregistered readiness gate (macro-F1 0.5991 against a ≥0.70 target). It was not shipped, and the
refusal is enforced in code rather than left to discipline — the runner stops at its native label
space and will not map onto the product's verdict vocabulary. See
[research-models](../hackathon/the_launchpad_challenge/plan/research-models.md).

---

## Caught during this housekeeping run

The most recent entries, included because a document like this is worthless if it only records
comfortably old mistakes.

- **"Synthesis never ran; `verified_edges` is empty."** Asserted from an inspection pass that had read
  an empty local database. Direct measurement against the hosted project found 14 verified edges and
  56 cards. The claim would have badly understated the system in the one document meant to be honest.
- **"Decorrelation is off at runtime."** Repeated from a stale risk register. Running
  `llm-router check-config` showed `Decorrelation: OK — synthesis=openai, verifier=agnes`, and the
  escape hatch had been removed entirely. The submission docs were *understating* the guarantee.
- **"No paper has full text over 5,000 characters."** Produced by probing a top-level `charCount`
  field that is actually nested at `fullText.charCount`. The real figure is 894.
- **A secret-scan fingerprint aligned to the wrong path.** During the docs reorganisation, a
  commit-pinned gitleaks fingerprint was rewritten to the file's new location on a fail-visible
  argument. Installing gitleaks and running the history scan disproved it: gitleaks emits the path
  *as it was at that commit*, so the rewrite would have silently un-suppressed a real finding. The
  guard was fixed to validate commit-pinned entries against their own commit.
- **A fabricated mechanism in a generated draft.** A drafting agent explained the single cited card by
  asserting that a correlational co-movement path "has not been implemented". It has been. The
  document now states the measured facts and records explicitly that the per-edge reason has *not*
  been established, rather than substituting a plausible story.

*The pattern worth noticing:* every one of these was caught by running something rather than by
reading something. Four of the five were produced by inspection that looked authoritative and was
wrong.
