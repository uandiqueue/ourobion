---
title: "Run 4 U1 — mechanical boundaries (O35) + fail-closed secret scanning (O36)"
summary: "Polyglot import/path boundary guard and pinned fail-closed secret scanning, both added as standalone CI gates; the required-aggregate promotion needs a U0-owned edit and is reported, not taken."
type: session
scope: shared
status: canonical
updated: 2026-07-28
---

# Run 4 U1 — mechanical boundaries (O35) + fail-closed secret scanning (O36)

Issue #166. Unit base `66bfde53b0dc388e40af42ab0ff4737ffb2fd8aa` (verified equal to
`origin/dev-phase2-run4` at session start). Branch `ci/run4-u1-boundaries-secret-scan` in an
isolated worktree. Start gate confirmed: 19/19 required check-runs `success` on the unit base,
including `Run 4 Gate` and `Run 4 release evidence`.

## Attempted

Implement only R4-U1: O35 mechanical architecture-boundary enforcement and O36 fail-closed secret
scanning, with positive and negative fixtures proving every guard has a reachable failure path.

## Changed

Nine paths, all additive except the workflow:

- `tools/check_arch_boundaries.mjs` / `.test.mjs` — O35. Pure `analyze({files})` plus a thin CLI
  driver. Rule R1: no cross-module import into another module's `impl/`. Rules R2a/R2b/R2c:
  `model-training/` isolation by import, by subprocess call, and by path literal. Node stdlib only.
  46 tests.
- `tools/secret-scan/{pins.json,pin.mjs,gitleaks.toml,allowlist.json}` and
  `tools/secret_scan_guard.mjs` / `.test.mjs` — O36. Pinned gitleaks CLI, 19 fail-closed
  conditions, narrow per-fingerprint allowlist, and the client-surface leak assertions
  (F1–F6, N1–N5, H1–H4, L1–L4). Node stdlib only. 102 tests.
- `.github/workflows/ci.yml` — +162 lines: two new standalone jobs, `arch-boundaries` and
  `secret-scan`. No existing job touched.

## Decided

- **Scope as the mechanism, not allowlists.** The O35 guard has no allowlist, skip-list, or ignore
  facility at all. R2c is scoped to `apps/`, `supabase/`, `shared/`, `tools/brain-ingest/` —
  AGENTS.md's exact stated import-ban scope — which is precisely why it does not fire on
  `tools/run4_release_gate.mjs`, whose `model-training` strings are CI job names, nor on
  `run4_release_gate.test.mjs:115`, where `model-training/` is a JS regex-literal delimiter.
- **R1's composition-root exemption is narrow and positional.** Only a file directly in `<app>/lib/`
  is exempt (this is what `apps/biotope/lib/main.dart:7-9` relies on); `<app>/lib/sub/deep.dart` is
  not. Test files at `<app>/test/<seg>/` map to module `<seg>` when that module exists, so a test
  importing its own module's `impl/` is legal and one reaching another module's is not.
- **gitleaks CLI, not `gitleaks/gitleaks-action`.** The Action downloads its own scanner at runtime,
  so pinning the Action's SHA pins only the wrapper and leaves the scanner unpinned. The CLI is MIT;
  the Action carries a proprietary EULA. The org-license clause does *not* apply here
  (`uandiqueue/ourobion` `.owner.type == "User"`), so it was not the disqualifier.
- **Allowlist is 9 entries, not zero.** The design predicted zero; a real pre-flight scan falsified
  that. Every entry is pinned to exact rule + path + fingerprint (commit-pinned for the 7 history
  ones), each with justification, owner, and a 2027-01-20 expiry. Hard cap raised 10 → 16 so the
  baseline does not sit at 90% of cap.
- **The two `jwt` history findings are not credentials.** Payload claims verified as
  `{iss: supabase-demo, role: anon, exp: 1983812996}` — the published Supabase local-development
  key, least-privileged `anon` role, already absent from the current tree. No rotation required.
  Owner-authorised identification; the evidence is recorded in the allowlist justifications.
- **Both guards are standalone, not in `run4-gate.needs`.** `tools/run4_release_gate.mjs:362`
  asserts set equality against the frozen `RUN4_REQUIRED_JOBS` (line 35) and line 175 hard-fails any
  required job lacking a `REQUIRED_JOB_STEP_SETS` entry. Promoting these jobs is a U0-owned edit and
  outside U1's authority, so it is reported rather than taken. Verified that U0's validator accepts
  the addition: `run4_release_gate.mjs config` PASS and its 9 tests green against the modified
  workflow.
- **A guard is not validated until its own files are tracked.** This bit both halves independently.
  Each guard initially reported clean only because its files were untracked and therefore invisible
  to `git ls-files`. Once staged, O35 self-flagged 5 times and O36's `policy` failed 5 times. Fixed
  at the root — fixture literals composed at runtime, and `CANARY_TOKEN_COMMITTED` corrected from
  "contains the bare prefix" (which flagged `gitleaks.toml`, the file that *defines* the rule) to
  "contains a complete 32-char token" — never by excluding files. Both guards now carry a regression
  lock asserting their own files are in the scanned set and clean.
- **`--redact=100`, not `--redact 100`.** Measured: the flag is declared `uint[=100]`, so the space
  form parses as flag-plus-positional and gitleaks aborts with "accepts at most 1 arg(s)".

## Left

- **Required-aggregate promotion (reported requirement).** Adding `arch-boundaries` and
  `secret-scan` to `RUN4_REQUIRED_JOBS` + `REQUIRED_JOB_STEP_SETS` + `run4_release_gate.test.mjs`
  needs U0-owned edits. Until then both gates fail closed individually but do not fail the aggregate.
- **Cap projection.** U1 measures ~4,810 added lines / 10 paths. With U0's 1,709 already spent
  against a 8,500 ceiling, U1 + the designed U2 (~2,563) exceeds it by roughly 580 lines, and
  ordering cannot fix it. Advancing `RUN4_UNIT_BASE_SHA` is precedented
  (`run-envelope.json` `historicalUnitBaseShas`) but is an envelope decision.
- **`N5_GENENV_DIRECTION` is advisory**, not a hard failure — it is a textual assertion over one
  statement in a reserved file and would red the gate on a legitimate refactor. Fully wired, with
  fixtures; does not fire against the current tree.
- **`SURFACE_MANIFEST_INVALID` is unexercised** by a dedicated negative test: no reachable fixture
  can trip it without mutating internals. Implemented, not proven.
- **Not fixed, in reserved paths:** `apps/nao/.open-next/server-functions/default/.env` holds real
  R2 values (untracked, correctly ignored via `apps/nao/.gitignore:4`, so not a commit leak);
  `apps/biotope/assets/fonts/Manrope-*.ttf` are committed GitHub HTML error pages rather than fonts
  — an asset-integrity bug, no credential material.
- **CI never builds a bundle**, so no CI run scans a real one. Coverage rests on
  `F5_TRACKED_BUNDLE` + `F6_IGNORE_INTEGRITY` (both deterministic) plus a synthetic fixture.
- **Static, not observational.** H1–H4 and L1–L4 prove absence of syntactically direct and
  one-hop-local paths from a server-only env var into a response, header, cookie, log, or error
  string. They prove nothing about multi-hop or cross-file dataflow, framework serialisation,
  platform-captured logs, or real HTTP bytes.
- **Existing actions in the ten U0 jobs remain tag-pinned** (`@v4`). Only the jobs added here are
  SHA-pinned; re-pinning U0's jobs would be an out-of-scope edit its validator would reject.

## Blockers

None for U1. Two reported requirements sit outside this unit's authority: the required-aggregate
promotion and the landing-delta cap decision, both U0/envelope-owned.

memory: none
