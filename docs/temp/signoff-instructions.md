---
title: Phase-2 Sign-off — Instructions & Ledger (how to sign off a unit)
summary: Runbook for the human-gated unit-by-unit sign-off of the phase-2 runs (build / audit / research-fixes). Explains the signoff/phase2 integration branch + per-unit branch→PR→CLI-merge flow, the review routing (agent→Jayden, build→Alton, shared→both, stats→deferred), the annotation format, and the per-unit sign-off ledger reviewers fill in. Dev aid (docs/temp), not ground truth.
type: process
scope: shared
status: canonical
updated: 2026-07-20
---

# Phase-2 Sign-off — Instructions & Ledger

**Read this fully before signing off anything.** It is the runbook for the human-gated, unit-by-unit
sign-off of the three phase-2 runs. If anything here conflicts with `AGENTS.md`, `AGENTS.md` wins.

## 1. What you're doing

The phase-2 runs shipped autonomously; each shipped unit's judgment calls now need a human sign-off
before the eventual `dev-phase2 → main` fold. You sign off the units **routed to you** (§3), recording
your verdict in the **ledger** (§6) through a small **branch → PR → merge** (§4). A unit is **cleared**
only when every required reviewer has signed it.

## 2. Where the things you're reviewing live

- **Build/audit decisions to confirm:** `docs/temp/phase2-run-signoff-decisions.md` (D-entries) +
  `docs/temp/phase2-run-config-decisions.md` (C-entries, numeric/config values).
- **Audit findings:** `docs/temp/phase2-audit/audit-findings-register.md` (A1–A27 + dispositions).
- **Research-fixes (deferred):** `docs/temp/phase2-research-fixes/`.
- **Per-unit detail:** each unit's `docs/sessions/…` log and its PR / commit (see the ledger for refs).
- **This ledger:** §6 below.
- **Forward optimizations (separate task, not sign-off):** `docs/temp/next-build-optimizations.md`.

## 3. Who signs what (routing)

| Bucket | Rule | Reviewer(s) |
|--------|------|-------------|
| `shared/` contracts | memory-0002 2-reviewer rule (register B8) — non-negotiable | **BOTH** (Jayden + Alton) |
| Agent-related | LLM router, synthesis, adversarial verifier, seeder, prompts — the hackathon deliverable | **Jayden** |
| Build / plumbing | app, tools, CI, DB migrations, deterministic engine | **Alton** |
| Statistical method or number | thresholds, estimators, calibration, the science | **⏸ DEFERRED** — nobody signs the science until the Methodology & Parameter Register is built next build (`next-build-optimizations.md` O2). Engineering correctness of a stats unit may still be signed. |

> **Alton:** your units are every row tagged **Alton** or **BOTH** in the ledger (§6). Skip anything
> tagged **⏸ deferred** — do not sign the statistics.

> **Brain-synthesis lane = Jayden (the whole pipeline that turns a paper into edges).** Breaking a
> research paper into parts for the LLM and synthesising from them is the agent core:
> **A4 extract** (`tools/brain-ingest/src/extract.ts` — segment + offsets + role-tagging, LLM-assisted)
> **+ A6 mentions/co-occurrence** → **A8 synthesis** → **A10 verify**. In the ledger these are
> **U10** (A8 synthesis) and **U11** (A10 verifier), both Jayden's. The A4-v2 extract/decomposition
> rebuild (**U15**: A4 · A4b · A2 · A6 · A7) is a **not-yet-built stretch unit — Jayden's when built**;
> the `extract.ts` shipped today is the pre-phase-2 baseline, outside this sign-off's scope.

## 4. The git flow (per unit)

The integration branch **`signoff/phase2`** already exists (cut from `dev-phase2`, scaffolding
committed). Only `dev-phase2` / `main` carry merge protection, so `signoff/phase2` takes CLI merges.
For each unit you own:

```powershell
. .\scripts\biotope-env.ps1              # node/flutter onto PATH — git hooks need node
git checkout signoff/phase2
git pull                                  # pick up others' merged sign-offs first
git checkout -b signoff/u2-storage-primitives    # signoff/uN-<slug>
#   … edit this unit's ledger row (§6) + complete the Sign-off line on its D-entry (§5) …
git add docs/temp/phase2-run-signoff-decisions.md docs/temp/signoff-instructions.md
git commit -m "docs(signoff): U2 storage primitives — Alton sign-off (D9)"
git push -u origin signoff/u2-storage-primitives
gh pr create --base signoff/phase2 --fill        # PR = the reviewable record
```

Then merge into the integration branch (CLI):

```powershell
git checkout signoff/phase2
git merge --no-ff signoff/u2-storage-primitives
git push                                  # the PR auto-closes as merged
```

- **BOTH (shared/) units:** wait for the other reviewer's PR approval **before** the CLI merge.
- **Additive commits only** — never `git commit --amend` / force-push a pushed branch.
- Do units in ledger order where you can (they touch the same file; sequential merges stay conflict-free).

## 5. Annotation format

On each decision you're signing (the `D`-entry in `phase2-run-signoff-decisions.md`), complete its
**Sign-off** line; leave the **Review** line as-is. States: **✅** approved · **⬜** pending · **⏸** deferred.

```
- **Review:**  <who must approve + why>
- **Sign-off:** ✅ <Name> <YYYY-MM-DD> — <verdict>. <comment / caveats / refs to O- or B- items>.
                 ⬜ <other required reviewer> — pending
```

Example format (illustrative — not yet applied):
```
- **Sign-off:** ✅ Jayden 2026-07-20 — approved (contract/semantics): deadbandK = ADR-0002 robust-σ̂
                 semantics, correctly supersedes deadbandSigma. Doc drift → O1; method + value 1.0 are
                 statistics → ⏸ deferred (O2 / B3). ⬜ Alton — pending co-sign (shared/ contract).
```

Units without a dedicated D-entry (built straight to spec) are signed off in the **ledger row only** —
note "built to spec, PR reviewed" + your name/date.

## 6. Sign-off ledger

One row per shipped unit. Update your rows as you sign. `commit/PR` is the thing to review.
**Deferred stat sub-decisions** inside a unit are called out so you sign only the engineering.

### Build run (`phase2-run`)

| Unit | Owner | Confirm | commit / PR | Status |
|------|-------|---------|-------------|--------|
| U1 · L0 contract | BOTH | D5, D8 (deadbandK **value** ⏸) | `b774229` | ✅ Jayden 2026-07-20 · ⬜ Alton |
| U2 · storage primitives | Alton (shared part BOTH) | D9 (derived_metrics RLS → O4) | `23f6947` | ⬜ Alton *(Jayden pre-flagged O4/O5 in session)* |
| U3 · LLM router | Jayden | C6/C7 (model-ids, caps, decorrelation) | `a419d8e` | ⬜ Jayden |
| U4 · quoteCheck + venue | Alton | plumbing; impactTier bands C8 ⏸ | `389074f` | ⬜ Alton |
| U5 · rules-as-data | BOTH | D10 | `e8e4a06` | ⬜ BOTH |
| U6 · S2 view + S3 baseline | Alton | D11; confidence cutoffs C5 ⏸ | `cfcf257` | ⬜ Alton |
| U7 · S4 signals + S5 evaluator | Alton | D12; deadbandK/ρ/N_eff/q C3/C4 ⏸ | `97dbd40` | ⬜ Alton |
| U8 · S6 edge store + loader | BOTH | D13 | `b5b0115` | ⬜ BOTH |
| U9 · agentic seeder | Jayden | C9 | `f13d359` | ⬜ Jayden |
| U10 · A8 synthesis | Jayden | built-to-spec (real run) | `138fea4` | ⬜ Jayden |
| U11 · A10 verifier scaffold | Jayden | D4 | `106e120` | ⬜ Jayden |
| U12 · S7/S8 engine refactor | Alton | D14 | `a9204ee` | ⬜ Alton |
| U13 · L6 one-card slice | Jayden | D15 (honest end-state) | `8b33dc2` | ⬜ Jayden |
| U18 · CI node-suite wiring | Alton | built-to-spec | `00bd131` | ⬜ Alton |
| U19 · shared/brain safeguard | BOTH | D16 (audit A1–A5) | PR #75 | ⬜ BOTH |
| U20 · InsightCard contract | BOTH | D18 mirror half (A6/A7/A20/A26) | PR #77 | ⬜ BOTH |
| U21 · app serve seam | Alton | D18 app half; A25/A27 | PR #81 | ⬜ Alton |
| U22 · engine lifecycle | Alton | D17 (A18/A19) | PR #79 | ⬜ Alton |
| U24 · loader hardening | Alton | A13/A14 | PR #83 | ⬜ Alton |
| U25 · DB constraint hygiene | Alton | D19 (A16/A17) | PR #85 | ⬜ Alton |
| U26 · budget-ledger lifecycle | Alton | A10/A11 | PR #87 | ⬜ Alton |
| U27 · CI deno-check + migrations | Alton | A24 | PR #89 | ⬜ Alton |
| U28 · nit sweep | Alton (shared/constants part BOTH) | A8/A9/A21/A22/A23 | PR #91 | ⬜ Alton |
| U29 · deno client types | Alton | built-to-spec (A/U27 follow-up) | PR #95 | ⬜ Alton |

### Audit run (`phase2-audit`) — one acceptance review

| Item | Owner | Confirm | Status |
|------|-------|---------|--------|
| Audit findings register A1–A27 | BOTH | dispositions correct: 26 fixed via U19–U28; **A15** by-design → O4; A-D1/2/3 "not bugs"; honesty findings **A1** (D16) / **A12** (B5) are Jayden's | ⬜ BOTH |

### Research-fixes run (`phase2-research-fixes`) — ⏸ deferred

| Item | Owner | Status |
|------|-------|--------|
| F1–F8 (label, cutoff, edge weights, deadbandK, lag, xDF, impactTier, gates) | ⏸ deferred | **Do not sign** — all statistical; wait for the Methodology & Parameter Register (next-build O2). F3/F6/F8 shared/brain *code* still needs the eventual shared cosign; the *science* is deferred. |

## 7. Deferred — do NOT sign now

- All research-fixes **F1–F8**.
- The stat sub-decisions embedded in build units: **C3, C4** (S4/S5 thresholds), **C5** (baseline cutoffs),
  **C8** (impactTier bands), and **U1's `deadbandK` value 1.0**.

These wait for the **Methodology & Parameter Register** (`next-build-optimizations.md` O2), which becomes
the gate for every statistical sign-off. Signing their *engineering* (built as specified, tests green) is
fine; signing the *method / number* is not.
