---
title: Write the four reviewer-facing docs, fix AGENTS.md, and teach the secret-scan guard about historical paths
summary: Added system-truth, project-overview, engineering-practice and research-models; corrected a fabricated mechanism in the drafted system-truth; retargeted AGENTS.md onto the new taxonomy and onto main as the integration line; and fixed the secret-scan guard so a commit-pinned allowlist entry is validated against its own commit rather than HEAD, verified against a real gitleaks 8.30.1 history scan.
type: session
scope: repo
status: canonical
updated: 2026-08-02
---

# Phase 3 — the new docs, plus two corrections

Branch `docs/phase3/new-docs-328`, cut from `docs/reorg/taxonomy-328` (PR #378), which it depends on.

## Changed

Four new documents, drafted by subagents against briefs containing the Phase 1 **measured** figures
(agents were given the numbers rather than asked to find them, because earlier agent-sourced counts
were wrong by up to 7x):

- `docs/implemented/system-truth.md` — the measured ground truth
- `docs/project-overview.md` — origin, audience, why two systems, identity/logo, rescoped from the
  owner's brand doc (dropping the "life-science company" framing and the unrelated Yugen product)
- `docs/engineering-practice.md` — development cycle and enforcement discipline
- `docs/hackathon/the_launchpad_challenge/plan/research-models.md` — the Swiss-cheese argument,
  Zebra/Viceroy results, and why neither is wired in

`README.md` gained a "start here" table pointing at the first three. `AGENTS.md` was retargeted onto
the new taxonomy (0 dead doc paths remain) and onto `main` as the integration line.

## Decided

- **A subagent fabricated a mechanism, and it was caught by checking the code.** The drafted
  system-truth asserted that the directional card rule "emits cards only for edges carrying
  `decreases`" and that a correlational co-movement path "has not been implemented". Neither was in
  its brief and neither is true — `coMovementEdgeCardTemplate` and `classified.coMovementEdge` exist
  in `supabase/functions/generate-insights/index.ts`. Rewritten to state what is measured (13
  `correlates`, 1 `decreases`, exactly 1 cited card), to note that the co-movement path exists and is
  deliberately constrained, and to record explicitly that **the per-edge reason more cards have not
  appeared was not established** — rather than inventing one.
- **The secret-scan guard could not express a moved file's history, so the guard was fixed.** A
  gitleaks 8.30.1 history scan was run locally (binary SHA256-verified against
  `tools/secret-scan/pins.json`) and emits, for the historical finding:
  `1a69650…:docs/nao/nao-app-design.md:generic-api-key:198` — the path **as it was at that commit**.
  The guard required `entry.path` to equal the fingerprint's file *and* be tracked at HEAD; after the
  reorg those are unsatisfiable. Rewriting the path to the new location would have silently
  un-suppressed a real finding. Added `existedAtCommit()`: a **commit-pinned** entry is now validated
  against the commit it names, while dir-mode entries still require HEAD. This is not a relaxation —
  the path must still resolve to a real blob in history, ruleId must still match exactly, and globs
  are still refused.
  - This supersedes the interim decision recorded in the Phase 2 session log, which aligned both
    fields to the new path on a fail-visible argument. That would have failed CI; the scan proved it.
- **Verified end to end:** with the emitted `.gitleaksignore` applied, the `nao-app-design` finding is
  suppressed and no longer reported. Five findings remain, all at commit `1cb6f74` on the unmerged
  local branch `feat/db/run4-u3-atomic-demo-loader` — **not on `main`**, so CI does not see them.
- **AGENTS.md branch model updated with a historical note** rather than a silent rewrite, so the ~250
  session logs describing the old `session → dev-phase2-run4 → main` flow read as records of what was
  true then, not as instructions to follow.
- **README edit kept additive** so it merges cleanly with the launch instructions already open in
  PR #374.

## Follow-up — session-log research (owner: "#379 isn't comprehensive enough")

The first draft described mechanisms without showing them working. Issue #328 §2.3 had asked for
exactly what was missing: *mine the session logs for the* why *, not the* what *, and include
decisions we reversed, with the reason.* Two read-only agents mined all 264 logs.

`engineering-practice.md` gained **"Where the process caught us"** — seven incidents where a gate,
review or live check caught something that would otherwise have shipped, each cited to its session:

- a fabricated CORE rate-limit model ("1000 tokens/day") falsified by live `X-RateLimit-*` headers on
  the first real ingestion run — the real limit was ~10 requests per 60s (`20260703`)
- a confidence cutoff changed 7→5 days, reverted to 7 when an evidence review found the literature
  supports 6–7 and nothing supported 5; a boundary test now pins it (`20260719`)
- three support-model dataset assumptions checked against primary sources and **all three false**,
  recorded as memory 0017 (`20260726`)
- a dedup bug where an unconditional content fingerprint could merge two different papers sharing
  title+author+year but with different DOIs (`20260629`)
- a CRLF-vs-LF attestation bug that made identical content hash differently across platforms, caught
  by CI (`20260727`)
- the R2-mailbox control plane reversed after the owner pointed out it could not invoke on demand
  (`20260703`)
- a refusal to ship an unverified xDF effective-N implementation — a deliberate throw rather than an
  approximation (`20260719`)

Existing sections were also made concrete: the two-reviewer rule **blocking PR #199** (nine `shared/`
files; "no agent can supply them"); the stale-worktree failure that produced the rule that read-only
subagents may run in parallel but **writers must be strictly serial**; the budget ledger's
element-wise merge so a hard stop fires on totals no single writer ever saw; and an attestation
regeneration that differed by **exactly two lines**, proving only one function had drifted.

Scale, verified: 264 session logs, 2026-06 → 2026-08-02, ~32 June / 194 July / 38 August, across
several distinct agent identities.

## Follow-up 2 — mistakes split into their own document (owner)

Owner: *"For mistakes, should be a separated docs no?"* — correct. Folding seven reversals into a
section of `engineering-practice.md` undersold them and buried them under a heading about process.
They are now `docs/development/what-we-got-wrong.md`, and the research had surfaced **20** findings,
not the 7 that fitted in a section.

The organising choice matters: entries are grouped by **the mechanism that caught each** — live
verification, independent review, literature, automated gates, humans — not by the mistake. Read the
headings alone and you are reading the project's defence in depth, which is the same argument the
reliability design makes about decorrelated verification, applied to the team instead of the model.

It also carries a **"Caught during this housekeeping run"** section listing this session's own five
errors, because a document like this is worthless if it only records comfortably old mistakes. The
noted pattern: every one was caught by *running* something, not by reading something, and four of the
five came from inspection that looked authoritative and was wrong.

`engineering-practice.md` keeps a pointer plus two exemplars.

### Accuracy fixes to `engineering-practice.md`

Reviewing the drafted file found three claims that were themselves wrong — the failure mode this whole
run exists to prevent:

- it cited `docs/shared/decisions/`, a path the reorganisation had already moved
- it described PRs targeting `dev-phase2-run4` as the integration line; that branch was promoted into
  `main` and has since been **deleted remotely**
- it called the pipeline "seven-stage" while listing ten jobs; `ci.yml` defines thirteen

Also corrected "250+ session logs" to the measured 264.

memory: none — the durable facts here (measured system state, the reliability argument) are captured
in the documents themselves, which is where a future session should read them.

## Verification

- `node --test tools/secret_scan_guard.test.mjs` — 112 pass, 0 fail
- `gitleaks git` with the emitted ignore — target finding suppressed; residue is off-main only
- `node tools/context_sync.mjs --check` — passed
- `AGENTS.md` — 0 dead doc paths; every `docs/*.md` reference resolves on disk
