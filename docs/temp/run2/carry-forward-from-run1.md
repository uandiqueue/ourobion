---
title: Carry-forward from Run 1 — what the first run left open
summary: The single list of everything Run 1 (Phase-2 build, audit, evidence review, research-fixes) did NOT close, with a pointer into run1/ for the detail and a note on who owns each. Run 2.0 closed the O9–O20 backlog but did not close these. A pointer index, not a decision record — nothing here is a locked decision. Dev aid (docs/temp), not ground truth.
type: plan
scope: shared
status: canonical
updated: 2026-07-26
---

# Carry-forward from Run 1

Run 1's record lives in [`../run1/`](../run1/README.md). Run 2.0 executed the demo backlog (O9–O20) but
did **not** close the items below, so they live here — in the active run folder — rather than being
buried in a closed run's registers.

This is a **pointer index**. Nothing here is a locked decision; each line says where the detail is and
what kind of resolution it needs.

> Every item below also has a row in **[`pending-build-register.md`](../run3/pending-build-register.md) §E**,
> which is the superset register for the whole project. This doc is the detail sheet; the register is
> the complete list. Keep them in step — if you close something here, update its `B-R1-*` row there.

## 1 · The Run-1 unit sign-off review is unfinished

Of 24 unit rows in [`../run1/unit-index.md`](../run1/unit-index.md), only **U1** is fully cleared.
U3 (provisional), U4 (Alton-signed) and U9 are individually approved; **the remaining ~20 rows are
pending or deferred**. The authoritative ledger is
[`../run1/signoff-instructions.md`](../run1/signoff-instructions.md) §6.

- **Owner:** Jayden. Stats-bearing rows are **⏸ deferred** by design until the Methodology & Parameter
  Register (O2) exists — engineering correctness can still be signed independently.
- **Blocked by:** the two-reviewer problem below, for any row touching `shared/`.

## 2 · B8 — the two-reviewer rule for `shared/` has no second reviewer

`shared/` contract PRs require two reviewers ([`../run1/blocked-register.md`](../run1/blocked-register.md)
B8). Alton is out, so the rule cannot be satisfied as written. Run 2.0 kept flagging against it rather
than quietly ignoring it: **U2 and U3 both touched `shared/` and are marked
`[B8] shared/ touched — 2-reviewer retro-review`** in [`unit-signoff-index.md`](./unit-signoff-index.md).

- **Needs:** Jayden to either grant a solo-review waiver or name a second reviewer. Until then the
  retro-review debt keeps accruing.

## 3 · ADR-0002 amendment intents recorded but not applied

Accepted ADRs are immutable (`context_sync --check` blocks edits to a `status: accepted` decision body),
so the research-fixes run **recorded amendment intent instead of amending**. Two intents are outstanding
in [`../run1/research-fixes/signoff-decisions.md`](../run1/research-fixes/signoff-decisions.md):

- **D3 / F4** — `deadbandK` intent (§S4): the exact replacement text is written out and flagged
  *retro-review needed*.
- **D5 / F6** — the RU4d / verify-first amendment (two AMENDED blocks, both flagged).

- **Needs:** a human to apply them through the ADR's 2-reviewer / supersede channel. Ties into B8.

## 4 · Human-gated / external-access blockers (Run-1 register)

From [`../run1/blocked-register.md`](../run1/blocked-register.md) — all still open unless noted:

| Item | What it needs |
|------|---------------|
| B2 | Cloudflare provisioning for nao |
| B3 | nao Worker secrets + Supabase login user |
| B4 | GitHub repo secrets for `brain-ingest.yml` |
| B5 | **API keys for the LLM api-worker route** — gates real decorrelation attestation (O7) and the autonomous gap→research loop |
| B6 | GMI GPU credits |
| B7 | Apple Developer Program + Mac/iPhone |
| B8 | see §2 above |
| B9 | Hosted Supabase `pg_cron` config |
| B10 | Real Android device verification (W1) |
| B11 | SJR quartile dataset for venue banding (also gates O22) |
| B12 | Branch-protection required checks for the new CI matrix |

**Register hygiene:** **B1** is marked closed. **B13** (the `dev-phase2` recovery merge) is *also*
resolved — PR #72 merged 2026-07-18 and commit `b774229` is an ancestor of `dev-phase2` — but the
register still reads as open. Mark it closed on the next pass.

## 5 · Calibration backlog (research-fixes register)

[`../run1/research-fixes/blocked-register.md`](../run1/research-fixes/blocked-register.md) B1–B7 are all
open. These are the lane-C items where the *mechanism* shipped but the *right number* needs data the
project does not have yet:

- **B1** per-metric medium confidence cutoff · **B2** persist `edgeScore` component breakdown ·
  **B3** `deadbandK` intent + fire-rate calibration · **B4** deseasonalize day-of-week before trusting
  lag-7 · **B5** faithful xDF effective-N · **B6** field-normalized h-index rule ·
  **B7** calibrate `EDGE_GATES` / `EDGE_WEIGHTS` against GRADE-rated evidence.

- **Needs:** real-run data, then a calibration pass. Several overlap O2 (the Methodology & Parameter
  Register), which is the natural home for the resulting numbers.

## 6 · Backlog items Run 2.0 did not touch

From [`next-build-optimizations.md`](../run3/next-build-optimizations.md):

- **O1–O8 remain open** — not demo-scoped. O7 (generalize the decorrelation invariant) and O8 (router
  config basis) are gated on B5.
- **O21 / O22** are Alton proposals that are **not yet Jayden-reviewed** — unlike every other entry in
  that doc, they are not locked decisions. They were renumbered from O9/O10 when PR #120 merged, because
  Run 2.0 had already claimed those numbers.

## 7 · Truth-hierarchy debt

The adversarial verdict recorded a baseline-confidence drift (runtime 3/7/14 vs docs 3/5/14). **U13
reconciled the architecture doc and the migration comment** to 3/7/14. Remaining drift items are listed
under *Verdict debt notes* in [`next-build-optimizations.md`](../run3/next-build-optimizations.md) — notably
`derived_metrics` still user-writable (→ O4) and M6's `InsightFiredEvent` not emitted by
`generate-insights`.
