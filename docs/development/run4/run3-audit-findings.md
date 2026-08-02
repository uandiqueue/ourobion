---
title: Run-3 independent audit — findings register
summary: Record-only adversarial audit of Run 3 conducted 2026-07-27 under issue #147. Covers the one implemented unit (U0/O24, PR #144), the Run-3 plan itself, and the coverage claims of the pending-build register. Two blockers, six high findings; nothing was fixed.
type: plan
scope: shared
status: draft
updated: 2026-07-27
---

# Run-3 independent audit — findings register

Record-only. **Nothing in this audit was fixed.** Requested by Jayden, who is not reviewing code
directly, so this is the only independent check between the work and the integration branch.

> Location line numbers below refer to audit commit `c731238` before issue #150 promoted and amended
> the live Run 4 scope/register. The finding IDs and evidence remain historical; use the current
> [`README.md`](./README.md) for the corrected sign-off and present execution boundary.

**Entry state, and the first finding.** Run 3 is *not built*. `dev-phase2-run3` carries 18 commits,
all planning docs plus the model-training workstream; **none of O24–O29 has merged**. The only
Run-3 implementation is U0/O24 as open PR #144. The audit therefore covers what exists — one unit,
the plan, and the register's coverage claims — not a completed run.

**Scope correction.** Run 3 is **six units, U0–U5 = O24–O29**. There is no O30 and no U6; the
seven-unit version survives only in the frozen Run-2 snapshot, which `AGENTS.md` forbids building
from. Any doc still saying "O24–O30" is stale.

## Register

| ID | Sev | Area | Summary | Location | Confidence |
|---|---|---|---|---|---|
| A1 | blocker | CI | Nothing requires CI to be green on any working branch | repo settings; `ci.yml:3` | confirmed by running |
| A2 | blocker | U0 | Exact-SHA evidence is stale; the state that would land has never been CI-tested | PR #144; `decisions-signoff.md:24-29` | confirmed by running |
| A3 | high | plan | Cap baseline already consumed by out-of-scope work (5,362 lines) | `run3/README.md:41-42` | confirmed by running |
| A4 | high | plan | B8 two-reviewer gate blocks 60% of the tranche and is absent from `human-decisions.md` | `pending-build-register.md:117`; `next-build-optimizations.md:64` | confirmed by reading |
| A5 | high | plan | O29's central acceptance clause is unexecutable under the run's own provider posture | `next-build-optimizations.md:950`; `router.config.json:3-4`; `config.ts:280-291` | confirmed by reading |
| A6 | high | U0 | "Assert exact checked SHA" step has no reachable failure path | `ci.yml:36-54` | confirmed by running |
| A7 | high | U0 | Config→matrix guard fails **open** on TOML-legal function declarations | `tools/check_supabase_deno_matrix.mjs:7,17` | confirmed by running |
| A8 | high | plan | Declared caps cannot fit the remaining scope (files 1.7–2.1× over) | `next-build-optimizations.md:47-49` | confirmed by reading |
| A9 | medium | register | `B-BR7` un-reject/restore is split across O25+O27 and owned by neither | `pending-build-register.md:83,228,230` | confirmed by reading |
| A10 | medium | register | `B-PL19` cross-environment verdict policy claimed covered by O29, which forbids it | `pending-build-register.md:126,232`; `next-build-optimizations.md:971-972` | confirmed by reading |
| A11 | medium | U0 | Matrix guard verifies membership only — blind to `if: false`, no-op steps, wrong entrypoint | `check_supabase_deno_matrix.mjs:34-56`; `ci.yml:229-231` | confirmed by running |
| A12 | medium | U0 | Frozen lock constrains CI only; the actual deploy resolves fresh | `supabase/deno.lock`; `AGENTS.md:122` | confirmed by reading |
| A13 | medium | U0 | On `workflow_dispatch`, a wrong `expected_sha` reddens only `context`; 14 jobs still run | `ci.yml:36-54` | confirmed by reading |
| A14 | medium | plan | Verification collapses to self-attestation; 34 unit sign-offs outstanding | `orchestrator-prompt.md:247-249`; `pending-build-register.md:139,148` | confirmed by reading |
| A15 | medium | docs | `docs/archive/runs/run3/*` are `status: canonical` while their own summaries say "not ground truth" | all five run3 docs; `context_sync.mjs:210` | confirmed by reading |
| A16 | medium | docs | ADR 0003 frontmatter says `accepted`, body says "Status: Proposed" — and accepted bodies are frozen | `docs/development/decisions/0003-paper-reliability.md:6,17` | confirmed by reading |
| A17 | medium | register | §I self-audit claims 56 unique IDs; there are 58, so its "check §I first" rule is unsafe | `pending-build-register.md:191` | confirmed by reading |
| A18 | medium | register | `B1`–`B13` is two colliding namespaces (human blockers vs calibration backlog) | `pending-build-register.md:140,141` | confirmed by reading |
| A19 | low | U0 | Gate tooling itself unpinned; the runtime under `checkout` changed between runs | `ci.yml:23,70,101,141,184,221,263` | confirmed by running |
| A20 | low | U0 | `\s{10}` matches newlines, not ten spaces | `check_supabase_deno_matrix.mjs:31` | confirmed by reading |
| A21 | low | plan | `B-PL20` is a stated precondition with no owner and no slot | `pending-build-register.md:127` | confirmed by reading |

## Detail on the two blockers

### A1 — the verification claim is false

```
gh api repos/uandiqueue/ourobion/branches/dev-phase2-run3 --jq .protected  -> false
gh api repos/uandiqueue/ourobion/branches/dev-phase2      --jq .protected  -> false
gh api repos/uandiqueue/ourobion/rulesets/17510182 --jq '[.rules[].type]'
  -> ["deletion","non_fast_forward","pull_request"]     # no required_status_checks
```

Any PR into `dev-phase2-run3` can have all 15 jobs red and still merge. `ci.yml:3` and `AGENTS.md:356`
both describe CI as "the non-bypassable backstop". O24's stated intent is to *restore* that claim; it
adds coverage and no enforcement.

This is the audit's most consequential finding, because the owner does not review code. The stated
safety model is "CI plus review"; today the CI half is advisory.

Setting required checks is a repo-settings action, so it cannot appear in a diff — but it is also not
recorded as a pending human action anywhere.

**Failure scenario:** push a commit breaking `deno check`, open a PR into `dev-phase2-run3`, let CI go
red, merge. Nothing intervenes.

### A2 — stale evidence that looks permanently green

The sole evidence run was green on synthetic merge `c916f880` (parents `9b41f4a` + `5eebddd`).
`dev-phase2-run3` has since moved to `0da76ca`; `git merge-tree` reports a conflict in
`.github/workflows/ci.yml`, and GitHub cannot recompute `refs/pull/144/merge` while conflicted — so the
"exact cumulative SHA" evidence is pinned to a three-commit-old base and will look green indefinitely.
The conflicted file is the workflow under test, so any resolution is new, never-tested YAML that A1
permits merging unverified.

**Cause: the MT0 merge (PR #145), which was mine.** Not a defect in this PR's work. See A3 and the note
posted on #145.

## Not bugs — by design (verify with human)

- **Non-deterministic verifier verdicts** (`B-BR12`) — inherent to LLM verification and documented as
  accepted; it bounds what re-runs can prove, but it is not a defect.
- **`B-R2-2` orientation not exercised in the decorrelated variant** — recorded as accepted-as-honest.
- **`B-R2-3` PRs #123–#136 closed-not-merged** — recorded state, not a defect.
- **O29's local-first fallback** — the plan's best pattern, not a gap. O25 and O28 need the same clause.

## Coverage gaps (not exercised)

| Gap | What it would take |
|---|---|
| Classic branch protection on `main` | An admin token; the reviewing token is `admin: false`, so a legacy protection object on `main` cannot be ruled out. `dev-phase2-run3` is confirmed unprotected via the readable field. |
| Whether the Supabase CLI tolerates the new `"lock"` key in a file declared as `import_map` | `supabase functions deploy --dry-run` or `functions serve`. **Highest-value pre-merge check for #144** — it touches production config on four functions with zero automated coverage. |
| Byte-identical reproducibility across two runs of the same commit | Re-running a fixed SHA; `deno check` emits no artifact, so "reproducible" can only mean "resolves the same dependency set". |
| Authenticity of `supabase/deno.lock` integrity hashes | Verification against the registry. The lock's shape is internally consistent and CI went green, which is strong but indirect evidence. |
| `context_sync --check` against the post-#145 merge state | Materialising the merge; both `AGENTS.md` and `docs/development/structure-context.md` changed on the base after the evidence run. |
| Run-time behaviour on Python 3.10 (model-training) | A 3.10 interpreter; only 3.13/3.14 exist locally. Same shape of gap that produced the Linux path defect. |

## Summary

**Two blockers, six high, ten medium, three low.**

The top five concerns, ranked:

1. **A1 — CI is not required anywhere.** Everything else in this audit assumes a gate that does not
   exist. Fix this first; it is a settings change, not a build.
2. **A3 — the cap baseline is already blown**, by my merge, and two live documents disagree by 5,362
   lines. A builder reading the README stops immediately; one reading the orchestration log overruns.
3. **A4/A5 — two of the five remaining units cannot complete** as written: U3/U4/U5 wait on an
   unsatisfiable `shared/` review gate, and O29 requires a second provider family that isn't
   provisioned, with the caps allocated backwards for the only legal configuration.
4. **A8 — the scope does not fit the caps** even before A3, at 1.7–2.1× over on files, driven mostly by
   O28's golden-image requirement in a codebase with zero golden tests today.
5. **A14 — verification is self-attested.** 34 unit sign-offs are outstanding across Runs 1 and 2. A
   prior "independent adversarial evaluation … no blocker, high, or medium findings remain" comment on
   #144 missed four findings that are statically visible in the diff.

**Cross-cutting pattern.** The plan's *honesty scaffolding* is genuinely strong — "not this item"
sections, refusals to claim production validation, honest pending markers. What is weak is
**mechanical enforcement**: caps are a hand-maintained table, boundaries are prose, the SHA gate is a
tautology, the coverage guard fails open, and CI is advisory. Every failure above is a case of a
stated invariant with no machine behind it (A1, A3, A6, A7, A11, A17). That is the theme Run 4 should
attack, and it matters more than usual precisely because the owner does not read the code.
