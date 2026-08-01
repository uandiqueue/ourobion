---
title: Hackathon submission writeups — replace stale and overclaimed figures with measured state
summary: Two passes. Pass 1 took over Session B's abandoned submission writeups and re-measured every quantitative claim against committed artifacts — corpus 1,298/756/739 to 21,823/911/894, always per tier; runbook R0 (decorrelation VIOLATED) cleared and inverted; migrations 39 to 44 and workflows 2 to 6, two undispatchable. Pass 2 corrected pass 1 against a direct hosted Supabase read: the pipeline had run, so 0/0/0 became 14 claims / 14 verifications / 14 verified edges with 11 servable, and two pass-1 conclusions are retracted as false — that zero verified edges was derivable by schema (PR #355 deleted the rule it cited) and that the card caveats were unreachable templates. What survives is the exact boundary: verified edges exist, and no insight card has producer='edge'.
type: session
scope: shared
status: canonical
updated: 2026-08-02
---

# Hackathon submission writeups — honesty rewrite

Issue: submission verification (audit gate at `submission-verification-audit.md`); branch:
`worktree-agent-af97b4134cd88c1fb`; base and exact head at branch cut: `e0c6077`
(`origin/dev-phase2-run4`); device: `agent-j`; agent: `claude` (Opus 5, 1M context). Isolated git
worktree; the main checkout was read but never written.

Territory: `docs/shared/hackathon/submission/**`, `docs/temp/run4/**`, this log. `AGENTS.md` and
`docs/shared/dev-workflow.md` were not touched (already fixed in merged PR #346).

## Attempted

Take over Session B's abandoned hackathon submission writeups and make them honest: replace stale,
overclaimed and now-wrong quantitative claims with measured facts, and state plainly where an outcome
has not happened instead of leaving a hopeful placeholder.

## Respecting the rewrite gate

`submission-verification-audit.md` §"Final rewrite gate" blocks the final narrative until #307's
verification/projection/card result exists, #277 clears model claims, and every quantitative sentence
is reproduced from the current head. Read as intended rather than literally: the *measurement*
precondition is now met, because verification has run and its outcome — a zero result — is
reproducible. So the drafts were corrected to state that outcome. The two unmet conditions (#277, and
the absence of any served output) are why all three docs keep do-not-submit banners, rewritten to name
those real blockers instead of the stale ones they previously named.

## Measured, before changing anything

Every figure below was produced in-session by streaming a committed artifact or executing a tool at
`e0c6077`. Nothing was carried forward from another session's prose.

- **Corpus** (`data/corpus/papers.jsonl`, 60 MB): **21,823 records = 20,912 `discovered` + 911
  `fetched`**; all 911 fetched carry extracted full text and **894 exceed 5,000 characters**, 768
  exceed 20,000. The brief supplied 21,813/21,070/743; the corpus grew during the session, which is
  itself the point — these are timestamps, not totals.
- **Manifest integrity, not in the brief:** 21,827 physical lines for 21,824 logical records. One
  record's title contains raw newlines and spans four lines, breaking the one-record-per-line
  invariant the file's streamability depends on.
- **Synthesis:** 20 claims, 20 distinct `edgeId`s, 17 distinct source papers, all
  `claimKind: correlational`. 12 blueprints, **every one** `provenance.tier: "extracted"` with a
  `citation.paperId` and locator, over 11 papers. Yield **0.30/paper** against a 3–5 design
  assumption.
- **Claim provenance is mixed, not in the brief:** 18 of 20 claims are from
  `gpt-5-2025-08-07`/`synthesis-whole-paper-2026-08-01.2`, one from `gpt-5` on the older prompt, and
  **one from `claude-fable-5` dated 2026-07-16**. `claims.jsonl` is not purely today's batch.
- **Verification:** 7 Agnes records plus one older interim placeholder. **All seven:**
  `verdict: uncertain`, `independentRetrieval {performed: true, sources: []}`,
  `corroboration {supporting: 0, contradicting: 0}`, confidences spanning 0.00–0.95. Provider
  attestation `agnes-2.5-flash`, `attested: true`. The raw response records the model's own reasoning:
  *"Since no sources were retrieved, I must return 'uncertain'."*
- **Zero verified edges is derivable, not incidental.**
  `shared/brain/relationships.schema.ts:221` requires `corroboration.supporting >= 1` for
  `supported`/`partial`, and `:236-247` forbids corroboration exceeding retrieved stances. With
  `sources: []` on every record, no edge is promotable. This is a stronger and more useful statement
  than "a projection run is in flight."
- **Decorrelation:** executed `llm-router check-config` →
  `Decorrelation: OK — synthesis=openai, verifier=agnes (independent families enforced)`. The TEST-MODE
  override block no longer exists in `tools/llm-router/src/`.
- **Spend** (`data/llm-router/ledger.json`): **US$1.8040535 over 59 calls** all time. 2026-08-01:
  synthesis 40 calls US$1.58452 (≈US$0.0396/paper), verifier 10 calls **US$0**, seeder 2 calls
  US$0.0202325. Agnes priced at zero, `expiresAt: 2026-08-08`.
- **Inventory:** **44** migration `.sql` files (`20260313_…` → `20260801091500_…`), **6** workflow
  files. `origin/main` carries only `ci.yml` and `brain-ingest.yml`.
- **Two workflows cannot be dispatched at all** — stronger than the brief's note about one.
  `gh run list --workflow=brain-pipeline.yml` and `--workflow=nao-d1-etl.yml` both return
  **`HTTP 404: workflow not found on the default branch`**. `workflow_dispatch` resolves from the
  default branch. So the cloud brain pipeline cannot be triggered (#343) *and* the hosted D1
  projection cannot be refreshed from CI — which is the mechanical reason the deployed console still
  shows ~6,158.
- **Attestation drift:** recomputed SHA-256 against `supabase/deploy-attestation.json` — **3 of 4**
  entrypoint hashes mismatch (`generate-insights`, `evaluate-signals`, `run-pipeline`);
  `compute-baselines` still matches.
- **nao:** 7 sections (`SubNav.tsx:11-27`). Paper detail calls `notFound()` on a null `getPaperMeta`.
  The ingest badge is `control.paused ? 'PAUSED' : 'RUNNING'` over `DEFAULT_INGEST_CONTROL`
  (`types.ts:131-136`), which the API returns *when no control document exists in R2* — so `RUNNING`
  is a hardcoded default rendered identically to observed execution.

### The correction I did not expect to make

The brief offered, as evidence that Agnes produces real caveats, the sentences *"At least one other
study points the other way. Only one other study backed this up."* Those are **hardcoded template
strings** at `tools/brain-ingest/src/verify/caveat.ts:174,176`, selected deterministically from
measured corroboration counts. The machinery is real and unit-tested, but both branches require a
non-zero count, so **neither sentence is reachable from any data this project has produced** — the only
reachable one is *"No other studies were found to check this against."* The on-disk verification
records have no `caveat` field at all, because they predate PR #348.

That is exactly the failure mode this session existed to remove: code read as result. It is now
recorded as a "not safe to say" entry in the map and the runbook, and in the audit's defect list.

## Corrections landed

`writeup.md`

- Banner rewritten: names the two real remaining blockers (#277 quarantine; no served output) instead
  of the stale "wait for #307."
- Approach: verifier was **"Anthropic, in the run we executed"** → **Agnes `agnes-2.5-flash`**, with
  the executed `check-config` output quoted. Anthropic is not the verifier and never was.
- Evidence rewritten around measured facts, always per tier, plus the disproven yield assumption and
  the derivability of zero verified edges.
- **`writeup.md:76-78`, the most dangerous line:** "two research cards" now reads *"came from
  hand-authored fixture edges, not paper-synthesised claims. No card, in any run, has ever come from
  the research pipeline"* — asserted on the sentence itself, in bold, not hedged in a footnote.
- Constraints: SGD 0.0648/0.1340 → **US$1.80 all-time**; added the free-priced-node bounding argument
  and the 2026-08-08 expiry; added the undispatchable-workflow consequence.
- Honesty: removed the Zebra/Viceroy training and macro-F1 figures per the #277 quarantine (the audit's
  P0 #3 says remove, not restate), replaced with a statement that they are excluded in either
  direction. "One held edge from one paper" → "0 verified edges, 0 published research cards."
- Appendix D rebuilt as the full per-day ledger; Appendix E rebuilt as all seven verdicts with an
  explicit both-directions reading, including that confidence here is model self-assessment, not
  evidential strength.
- Appendix G fixed: Agnes moved from *"not used; no run exists"* to the verifier that ran; Anthropic
  demoted to one older synthesis call.
- New Appendix I holds the four defects and the two adjacent caveats.
- **Word cap.** The rules cap the five pillars at 1,000 words. My first honest draft came to 1,909, so
  detail was moved into appendices (which do not count) and the pillars compressed to exactly
  **1,000** by a strict count that treats markdown emphasis markers as part of their token. The same
  method scores the previous revision at 1,058 against its own stated 997, so the stated figure now
  names its method. At exactly the cap, any addition must be paid for by a deletion.

`system-connection-map.md`

- **§2 (`:90`)** 39 migrations → **44**, with the recount and the actual first/last filenames.
- **Z5** "Two workflows exist" → **six**, named, plus a block on the two that cannot be dispatched and
  why that is stronger than "execution unverified."
- **§2 A10 verifier** flipped from `Planned/research-only; not serving` and "blocked on a non-Anthropic
  key" — both now-wrong — to "ran, and produced no promotable verdict," with the seven verdicts and
  the schema reason no edge is promotable. Added rows for the missing retrieval alias map, measured
  corpus volume per tier, and a section-by-section nao demonstrability audit (~2½ of 7).
- **§4** honest-state paragraph rewritten from "has never run" to what actually happened, split into
  what is and is not proven.
- **§6, §7, §8, §9** counts and claims updated; §9's safe/unsafe lists substantially extended — bare
  corpus totals, "cards are backed by verified research," the 3–5 yield, "the literature doesn't
  support this," and the template caveat sentences are all now explicitly unsafe.
- Banner rewritten to state what changed and what remains unverifiable.

`demo-runbook.md`

- **The fatal R0 is cleared.** The 🛑 "DO NOT RECORD THIS SLIDE — decorrelation VIOLATED (allowed by
  TEST-MODE)" block was false at this head; replaced with the green `check-config` output. Added
  **R0b** (the new fatal risk is the opposite one: narration upgrading "it ran" into "it validated")
  and **R0c** (Agnes pricing expires 2026-08-08).
- §3 corpus table rebuilt per tier, with a standalone "one number discipline" block; the
  do-not-quote-6,158 warning kept and given its mechanical cause.
- Added why `verified_edges` is 0, as the strongest thing on the page.
- Spend: US$1.118 → US$1.80; **"Agnes 18 of 50 calls" removed as unverifiable** (the ledger shows 10;
  the plan quota is vendor-side).
- Slide 3 annotation, Slide 5 bullets, and the §8 narration all re-cut to the measured figures, and
  Slide 5's narration now names our own retrieval defect as the cause of the refusals.
- §9 "never say these" extended by seven rows.
- §10 D1-ETL note extended to cover both undispatchable workflows; §11 checklist now re-counts all
  three corpus tiers together, re-checks hosted counts, and expects 44 migrations.

`docs/temp/run4/submission-verification-audit.md`

- Added a measured-state block that supersedes the earlier point-in-time rows, a newly-found-defects
  list (6 items), and an explicit "could not verify" section.
- Rewrote the final rewrite gate as partially satisfied, naming which conditions are met and which are
  not, so the next session does not re-litigate it.

## Gates

- `node tools/context_sync.mjs --check` — passed after `--fix-index`; `docs/INDEX.md` regenerated and
  staged (four summaries changed).
- `git diff --check` — clean.
- No source was modified, so no test suite applies and `graphify update` is not required.

## Could not verify, and how it was handled

- **Hosted table counts.** No `.supabase` link file and no service credential in this worktree, so
  `relationship_claims`/`edge_verifications`/`verified_edges`/`composed_insights`/`insight_cards` could
  not be read live. The brief said a projection run was in flight; the projection workflow is
  **undispatchable**, so CI cannot have refreshed anything. The docs now present #309's owner-verified
  `0/0/0/0` + `insight_cards 1` (hand-authored, `producer: 'rules'`) as *last-verified, not live*, and
  the runbook checklist requires a re-check before recording. Zero is also derivable independently from
  the verdicts, so the substantive claim does not rest on the unread number.
- **"Agnes 18 of 50 calls."** Not reproducible; removed rather than restated.
- **The nao "327-test suite."** Not re-run at this head; the number was removed with a note to re-run,
  rather than copied forward.
- **The "20 of 32 pieces built" claim.** Searched the whole tree including untracked run4 prompt files
  in the main checkout — **it does not exist at this head**, so there was nothing to correct. I did not
  synthesise a replacement table to fix a claim I could not find.

## Blockers

- **#277 still gates model claims.** The drafts exclude those figures; they cannot be restated until it
  clears.
- ~~**No served output exists**~~ — see the second pass below; this was true when written and is now false.
- **`brain-pipeline.yml` and `nao-d1-etl.yml` must reach the default branch** before either can ever
  run. Owner action.
- **Agnes free pricing expires 2026-08-08** and only the owner can renew it; verification dies that
  day.
- CI on `dev-phase2-run4` was observed failing at session start (unrelated to these docs-only changes).

---

# Second pass — corrections after a hosted read (2026-08-02)

Branch `docs/run4/submission-honesty-corrected`, rebased onto `origin/dev-phase2-run4` @ `0083858`.
Same docs-only territory. The first pass above was drafted **without database credentials** and stated
hosted state from a stale prior record (#309) while the pipeline was in fact running. It then reasoned
*from* that stale zero to a stronger conclusion, using a contract rule that PR #355 had already removed.

**The general failure worth remembering: an honest document that understates is still inaccurate.** The
first pass was scrupulous about not overclaiming and still shipped five false statements, because it
treated "no credential" as licence to carry a prior figure forward rather than as an unknown to label.

## What was corrected (old → new)

| Claim | First pass | Corrected |
|---|---|---|
| Hosted counts | `0 / 0 / 0` + `insight_cards 1` | **14 claims · 14 verifications · 14 verified edges (11 servable: 8 `high`, 3 `mid`, 3 `hold`) · 45 cards**; `composed_insights` populated |
| Verdicts | 7 × `uncertain`, zero sources, conf 0.00–0.95 | **1 `supported`, 10 `partial`, 2 `uncertain`, 1 `unsupported`**, conf 0.72–0.92 |
| "Zero verified edges is derivable, not incidental" | Asserted as a schema consequence of `supporting >= 1` | **Retracted.** PR #355 deleted that rule; verdicts now bind to single-paper fidelity (`directionCheck.matchesClaim`, `relationships.schema.ts:236,245`) |
| Card caveats | "Hardcoded templates at `caveat.ts:174,176`, unreachable from any data this project has produced" | **Retracted.** `chooseCaveat()` keeps the model's own prose when it passes the copy gate and names a fired flag; #355's `citedPaperAssessed` opens quality-of-backing flags at zero corroboration. Real stored examples quoted in Appendix E |
| "No card has ever come from the research pipeline" | Stated as flat fact | **Made precise.** Still true that **0 cards have `producer='edge'`** — but 43 `producer='personal'` cards exist from real correlations. Both halves stated together |
| Verifier "produced no promotable verdict" | — | It produced **11 promotable verdicts** |
| Paper detail 404s locally | Stated as a filming risk | **PR #354** falls back to a reduced `IndexRowDetail`; it only 404s if the index row is missing too |

## Preserved from `677fcf0` deliberately

Its two-workflows-undispatchable finding; its removal of the stale `DO NOT RECORD — decorrelation
VIOLATED` block (decorrelation genuinely reports OK with `agnes-2.5-flash`); its Zebra/Viceroy removal
under the #277 quarantine; its R0b inversion (the fatal risk is now claiming the verifier validated
something merely because it ran) — R0b is kept and sharpened, since 11 servable verdicts make the
overclaim *more* tempting, not less. All corpus-tier discipline and spend corrections stand.

## The owner's runbook

`demo-runbook.md` was rebased onto **PR #342's 630-line owner-specified animation-led running order**,
not onto the first pass's 577-line edit. §1 and §1b are the owner's structure, untouched. Only figures,
statuses and the stale TEST-MODE stop-block were corrected on top. PR #342's own note that its
§4 → §6 → §7 sequence "cannot currently be paid off" is now **partly** false and is restated with the
exact boundary: §4 and §6 pay off, §7 does not, because no card has `producer='edge'`.

## Still unverifiable

- **Hosted counts are not reproducible from this repository.** No `.supabase` link file, no service
  credential. They were read out of band and are labelled as such everywhere they appear.
- **The ledger does not reconcile with the pipeline.** `data/llm-router/ledger.json` is gitignored and
  machine-local, and records **10** Agnes verifier calls on 2026-08-01 against **14** hosted
  verifications. USD is unaffected (Agnes is zero-priced), but 59 must not be quoted as the pipeline's
  call count.
- **The Agnes plan quota** ("18 of 50") remains vendor-side and unobservable. Still removed.
- **The nao test-suite count** was again not re-run, so it is still omitted rather than copied forward.
- **Per-edge cost and latency** were never captured.

memory: submission-honesty rewrite, two passes. Pass 1 fixed three stale corpus figures (756/739,
6,158, 1,298): measured 21,823 records = 20,912 discovered + 911 fetched + 894 usable, a ~24x
discovered:usable gap, so every count must carry its tier and a bare total overstates the corpus by that
factor. nao-d1-etl.yml and brain-pipeline.yml both return HTTP 404 not-found-on-default-branch, so
workflow_dispatch cannot resolve either and no CI projection can run. The runbook's fatal R0
(decorrelation VIOLATED under TEST-MODE) is CLEARED — check-config reports OK
synthesis=openai/verifier=agnes, override block gone — and the risk inverted to R0b: claiming the
verifier validated something because it ran.
  THE LESSON FROM PASS 2, which corrected pass 1: AN HONEST DOCUMENT THAT UNDERSTATES IS STILL
INACCURATE. Pass 1 had no DB credential, carried #309's stale 0/0/0 forward as if it were current, and
then REASONED FROM IT to a stronger claim — "zero verified edges is derivable by schema" — citing a
relationships.schema.ts:221 `supporting>=1` rule that PR #355 had already deleted. Both were false when
committed. Real hosted state: 14 claims / 14 verifications / 14 verified edges with 11 SERVABLE (8 high,
3 mid, 3 hold), 45 insight_cards. Verdicts 1 supported / 10 partial / 2 uncertain / 1 unsupported, conf
0.72-0.92. Post-#355 a verdict answers ONLY "is this claim faithful to the ONE paper it cites?" — not
whether the science agrees; corroboration no longer votes and reaches the user solely via the caveat.
Caveats are NOT unreachable templates: chooseCaveat() keeps the model's own prose when it passes the
copy gate and names a fired flag, and #355's citedPaperAssessed opens quality-of-backing flags even at
zero corroboration. Two durable rules fall out: (1) a derivation is only as current as the code it
cites — re-read the contract before deriving from it, especially across a merge; (2) "no credential" is
an UNKNOWN TO LABEL, never licence to carry a prior figure forward. The one boundary that still holds
and is the most important sentence in the submission: verified edges exist, but ZERO insight_cards have
producer='edge' — the chain is real up to verified_edges and stops one step short of a card. Also: the
gitignored machine-local ledger records 10 Agnes calls against 14 hosted verifications and does not
reconcile, so never quote its 59 as the pipeline's call count. Hackathon rules cap the five pillars at
1,000 words with appendices free, so detail belongs in appendices; state the counting method alongside
the number (bodies only, headings excluded — that reproduces the cap exactly).
