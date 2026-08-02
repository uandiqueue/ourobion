---
title: Reconcile docs/implemented, correct submission figures against the hosted database, and narrow the owner-verification scope
summary: Demoted every docs/implemented file from the unstamped `canonical` status, corrected the drift each file carried against code, re-measured the brain figures on the hosted database and propagated them into writeup.txt and the appendix, repaired six broken links, exempted hackathon plan material and the generated INDEX from the owner-verification gate, and recorded three owner stamps.
type: session
scope: repo
status: canonical
updated: 2026-08-02
memory: none — the durable facts this session relied on are already recorded (0021 nao membership, 0024 local training compute, 0025 team composition); the corrections here are documentation state, not new invariants.
---

# docs/implemented reconciliation and submission truth

Branch: `docs/reconciliation/main-sync-328`. Continuation of the reconciliation recorded in
issue #392. Owner-directed throughout; every stamp below was applied on explicit instruction.

## Attempted

- Make `docs/implemented/` honest about what is built rather than designed.
- Check the wider `docs/` tree for documents whose declared freshness does not match reality.
- Re-measure the brain figures the submission quotes, rather than reusing a dated snapshot.

## Changed

### `docs/implemented/` — all 14 files

Twelve files declared `status: canonical`. Under the current taxonomy `canonical` is an
**owner-verified** status (`OWNER_VERIFIED_STATUS` in `tools/context_sync.mjs`), and none carried a
`verified_by` stamp. `docs/implemented/**` sits outside `isOwnerVerificationScoped()`, so the gate
never caught it: the directory asserted the repository's highest trust level, unchecked, while
`AGENTS.md` §7 simultaneously declared it stale. All are now `unverified`, each drifted file carrying
an inline evidence-class banner.

Corrections made against code, not prose:

- `biotope/architecture-context.md` — the M5b→M6 `InsightFiredEvent` flow is marked
  `[TARGET — not implemented]` in all three places it appeared. The type exists in `shared/types/`
  and a parity test; nothing emits or consumes it.
- `shared/biotope-nao-link.md` — the "nao enforces authentication only / role gating is the
  O25 · B-SEC1 blocker" claim is resolved; membership and viewer/curator/admin tiers landed in R4-U2
  with negative RLS assertions. The gap ledger is split into implemented writers and the
  unimplemented §A3 queue builder.
- `nao/nao-app-design.md` — Nao deploys as an OpenNext Cloudflare **Worker**, not Pages.
- `nao/brain-ingestion-design.md` — the Run-4 audit's "workflow has never executed" disposition is
  itself superseded; both `brain-ingest.yml` and `brain-pipeline.yml` have executed, with run history
  recorded inline.
- `nao/brain-support-models-design.md` — "no model has been trained" is false; Zebra and Viceroy were
  trained on local Apple Silicon. Performance figures remain routed through #277 and were not imported.
- `shared/insight-engine-architecture.md` — no longer claims "authoritative ground truth".
  `METRIC_TERMS` and `StructuredPaper` confirmed unimplemented as named.
- `project-context.md` — stale `AGENTS.md` §6/§7 pointers fixed, team table replaced by a pointer to
  the verified `0025-team-composition.md`, tech stack extended with the Nao/Cloudflare surfaces.
- `biotope/metrics-catalog.md` — banner-marked a candidate catalogue against the 24-entry registry.
- `system-truth.md` — mutable figures separated from those that still hold.

### Submission figures re-measured

Read directly from the hosted database (read-only): **11 relationship claims, 11 verified edges**
(10 `high`, 1 `hold`), current verdicts **1 supported / 10 partial**, **59 insight cards**, and
**2 cards carrying `edge_refs`, both `active`**. `archived` is no longer a card status.

This superseded the 14/11/3 figures in `writeup.txt`, `appendix.md` and `system-truth.md`.
`system-truth.md` had stated that no paper-derived card reaches the active deck; that is now false in
the project's favour and is corrected inline.

`writeup.txt` also carried an overclaim: "three never reached a person" implied the other eleven did.
Clearing the serving gate makes a relationship *eligible*; only two have surfaced as cards. The
write-up now distinguishes the two and states that the loop has run unattended in the cloud three
times. It remains at exactly 1000 words.

### Gate and links

- `tools/context_sync.mjs` — `docs/hackathon/**/plan/**` and `docs/INDEX.md` exempted from the
  owner-verification gate, via a single predicate now shared by both scope functions so they cannot
  drift apart. Rationale recorded inline.
- Six broken links repaired (four to the deleted `writeup.md`, one to a never-existent
  `generate-insights/data_rules.ts`, one to an untracked `semantic-graph.html`). 675 links, 0 broken.
- `documentation-freshness-audit-2026-07-26.md` marked `superseded`.
- `model-training/README.md` — the banner said "no model has been trained" while the same file
  described loading frozen Zebra v1 and Viceroy v0 releases. Rewritten to separate the trained
  checkpoints from the five unimplemented `JobSpec` plugins.
- Research models surfaced in the root README, which previously never mentioned them.

### Owner stamps (applied on explicit instruction)

`docs/memory/0018-cloud-verifier-authorization.md`, `docs/memory/0007-rules-as-data-two-tier.md`, and
`docs/hackathon/the_launchpad_challenge/submission/references.md`.

## Decided

- `docs/implemented/` stays `unverified` for submission. A stamp there is unenforced, would
  contradict `AGENTS.md` §7, and would attest to a review that did not happen.
- Model performance claims stay routed through #277; none were imported into `docs/implemented/`.

## Left

- Commit counts and the session-log count in `appendix.md` and the root README are still stale; they
  are deliberately fixed last because every commit changes them.
- `hackathon-direction.md` still carries the superseded 14/11/3 figures and an unverifiable
  0.72–0.92 confidence range.
- 23 documents in `docs/development/` repeat the unstamped-`canonical` pattern.

## Blockers

- 16 `context_sync --check` errors remain, all of one class: memory records whose content changed on
  this branch while carrying an owner stamp. The gate cannot see that review happened before the
  stamp. Clearing them needs two pushes, not two commits, because the check spans the whole push
  range. These affect pushing only — a fresh clone skips the check via `nothingToPush`.
