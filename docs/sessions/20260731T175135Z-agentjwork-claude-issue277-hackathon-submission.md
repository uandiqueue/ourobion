---
title: Issue 277 hackathon submission write-up refresh
summary: Refreshed the hackathon submission text against the two trained research checkpoints and the Haiku 4.5 disagreement pilot — five pillars trimmed to exactly 1,000 words, the honest model section written with both readings of the disagreement kept on the page, the stale claims in writeup.md listed, the scope-C system-connection-map rows drafted, and scope A and B recorded as not done because no provider spend was authorised.
type: session
scope: run4
status: canonical
updated: 2026-08-01
---

# Issue 277 hackathon submission write-up refresh

Issue: #277 - branch: `docs/run4/hackathon-submission-277` - base: `dev-phase2-run4` @ `c8144f6`

## Attempted

- Settle what may truthfully be said about Zebra v1 and Viceroy v0 in the hackathon submission, and
  write it as submission-ready text rather than as a separate model report.
- Reconcile the submission material with the 2026-07-31 landings and with the two harness bugs, without
  editing any file another branch is currently editing.
- Writing only. No experiments, no provider or LLM calls, no model runs, no spend.

## Changed

- `docs/temp/run4/hack-submission-277.md` — new. The refreshed five-pillar submission text (measured at
  exactly 1,000 whitespace-delimited tokens over a marked block), the long-form model section, the list
  of claims in `writeup.md` that are now false, the paste-ready `system-connection-map.md` rows, the
  scope A/B follow-up record, the landed/deferred ledger, the demo-script corrections, and a claim
  ledger of may-say versus may-not-say.
- This session log.

Nothing else. `README.md`, `decisions-signoff.md`, `unit-signoff-index.md`, `hack-mvp-demo-script.md`,
`writeup.md`, `system-connection-map.md` and `tools/run4_release_gate.test.mjs` were deliberately left
untouched.

## Decided

- **The disagreement pilot is reported as agreement, never as accuracy.** Nobody has adjudicated any
  row, so no correctness or ranking claim exists. The issue's own recommended framing — "the LLM
  systematically over-credits topical overlap as support" — was **not** carried over, because it is a
  correctness claim about Haiku's labels dressed as an observation. §2.3 states both readings of the
  structured disagreement (Haiku over-crediting, or Zebra over-refusing) and says nothing we ran
  distinguishes them, with an explicit instruction that a later editor must keep both on the page.

- **One deduction from the disagreement rate is safe, and it is the one we lead with.** Two mutually
  exclusive labels on one row cannot both be right, so on at least 42.7% / 47.9% of rows at least one
  system is wrong. That is the honest version of "do not trust a single verifier": it is symmetric,
  costs us nothing, and needs no adjudication. It is stated with its own caveat — it presumes a
  well-defined gold label exists, which §2.4 doubts for 63 of Viceroy's 96 sentences.

- **The weakest number is named by us, in the pillar text and not only in an appendix.** Only 33 of
  Viceroy's 96 sentences carried an explicit conclusion cue; the other 63 were last-sentence fallbacks.
  A judge who opens the sample finds this in a minute, so it is stated before they do.

- **Both harness bugs are attributed to us, and the retraction is not converted into its opposite.**
  The earlier "Zebra `contradicted` bias" finding is retracted as an evidence-format mismatch — and the
  write-up says explicitly that retracting it does not show Zebra is unbiased, only that the
  observation does not survive a correct input format. The re-run warning ("preserve both fixes or you
  re-measure the harness") is stated as a requirement, not a note.

- **Scope C is drafted, not applied.** The rows and the §9 sentence are in §3.2 ready to paste under the
  existing `Planned/research-only; not serving` label. Editing the two shared submission docs from this
  branch would collide with concurrent work and the merge is human-serialised anyway.

- **The five pillars were trimmed to the 1,000-word rules limit rather than left over it.** The first
  draft was 1,125. Every cut came from descriptive design prose; the file records what was cut and
  forbids paying for future additions out of the Honesty pillar.

- **The demo-script corrections live in the new file, not in `hack-mvp-demo-script.md`.** They cover
  three landings that falsify script lines (#284 coverage copy, #285 registry-derived axes, #286
  citation canonicalisation), two stale "not built" claims (#200 Archive trends and #201 the Scan sweep
  restyle are both closed and both present in the merged code), one open hazard to avoid on stage
  (#287, an expanded Scan gap card has no collapse target), and an explicit instruction not to let the
  offline model runs and the app's "no live LLM calls" posture be read as one story.

## Left

- **Issue #277 scope A (cued-only re-run) and scope B (adjudicate ~30-100 rows) were not done.** Both
  need fresh model and provider runs and no spend was authorised for this session. Recorded in §4 with
  the issue's sizing note: ~220 sampled rows yields ~100 disagreements; at 100 the 95% CI is ±10%, at
  30 it is ±18%. The adjudicator must not be a Claude-family model.
- Scope C application to `docs/shared/hackathon/submission/{writeup.md,system-connection-map.md}`,
  including splicing the model paragraphs into the Evidence and Honesty pillars and correcting the
  "no support model was trained" claims.
- Two items in the write-up are flagged **verify**, not asserted: whether Agnes AI / GMI Cloud were
  genuinely never called (a pricing-config commit exists on `main`), and the "4 rule-based cards plus
  two research cards" count against the frozen demo state.
- `git tag -l` is still empty, so `pre-hackathon-baseline` does not exist and the prior-work boundary
  remains only a commit-date argument. Appendix B's 248-commit delta is stale;
  `git rev-list --count 2214fbb..HEAD` is 483 at `c8144f6` and must be re-measured at the frozen
  submission commit rather than copied.
- Not pushed, no PR opened, per instruction.

## Blockers

- None for the writing. Scope A and B are blocked on authorised provider spend and on a non-Claude
  adjudicator.

## Verification

- `node tools/context_sync.mjs --check` - passed.
- Five-pillar word count measured programmatically over the marked block: 1,000 tokens.
- Every model number cross-checked against its source before it was written down: the release digests,
  byte counts and timings against
  `docs/sessions/20260730T185942Z-uandiqueue-claude-offline-inference-runner.md`; the gate table,
  macro-F1, minimum-seed recalls and ECE against
  `model-training/evidence/publication-results/zebra-v1-results.md`; the fold-0 macro-F1 and its
  group-bootstrap CI against `viceroy-v0-results.md`.
- Landed-work claims verified against `git log` on the base: the #270, #293, #294, #295 and #296 merges
  are all present at `c8144f6`. Deferred-issue states verified with `gh issue view`: #222, #283, #275,
  #246, #287, #282 and #264 are OPEN; #266, #284, #285, #286, #200 and #201 are CLOSED.
- Demo-script corrections verified against the merged code, not against the issue text: the
  `CoverageCard` completeness predicate in `home_tab.dart`, `MetricTrendSection` rendered by
  `archive_tab.dart`, and the sweep presentation constants in `scan_tab.dart`.
- No provider or LLM calls, no model runs, no inference, no spend, no Docker, no supabase, no flutter,
  no device operations, no cloud writes, no deployment or promotion. Nothing pushed. `main` and
  `dev-phase2` untouched.

memory: none
