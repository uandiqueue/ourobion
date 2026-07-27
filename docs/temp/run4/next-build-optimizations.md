---
title: Run 4 — candidate scope and carried-forward register
summary: Run 4's candidate scope, assembled from the 2026-07-27 independent audit. Holds the preconditions Run 3 cannot satisfy itself, ten new optimisation items (O31-O40) targeting the audit's central pattern of unenforced invariants, and the 41 register rows plus 5 schema gaps that Run 3's O24-O29 does not cover. Candidate scope, not locked.
type: plan
scope: shared
status: draft
updated: 2026-07-27
---

# Run 4 — candidate scope and carried-forward register

**Status: candidate, not locked.** Nothing here is approved or sequenced. Run 4 begins only when
Jayden locks a subset; the audit that produced it is [`run3-audit-findings.md`](./run3-audit-findings.md).

**Relationship to Run 3.** Run 3 (six units, U0–U5 = O24–O29) is still live and still owns its items.
Run 4 deliberately does **not** duplicate O24–O29. If Run 3 is cut short — which finding A8 says is
likely, since its scope is 1.7–2.1× over its file cap — the unbuilt O-items return to
`docs/temp/run3/pending-build-register.md` per that run's own rule, and become Run 4 candidates then.

## 1. Preconditions — resolve before Run 4 (and mostly before Run 3 continues)

These are not build units. Most are settings or decisions, and several block Run 3 right now.

| ID | What | Why it blocks | Who |
|---|---|---|---|
| P1 | **Add required status checks** on `dev-phase2`, `dev-phase2-run3`, and any successor working branch | Audit A1: every working branch is `protected: false` with no `required_status_checks` rule. CI is advisory today, so "green CI" is not a gate. This is the single highest-value action in this document and costs minutes | Jayden (repo admin) |
| P2 | **Resolve B8** — name a second `shared/` reviewer, or record a scoped solo-review waiver | Audit A4: gates U3 explicitly, U4 implicitly (O28 must add fields to `shared/metrics/registry.ts`), and U5's promotion slice — 60% of the remaining tranche. Blocking and accruing since Run 1 | Jayden |
| P3 | **Give model-training its own integration base** (`dev-phase2-model-training`), before MT1 is cut | Audit A3: MT0 alone consumed ~69% of Run 3's caps and broke U0. Five more model PRs are currently pointed at the product base | Jayden + orchestrator |
| P4 | **State one cap-baseline rule and re-derive the number** | Audit A3: two live documents disagree by 5,362 lines. Recommendation: exclude non-Run-3 merges explicitly, since the current wording counts them | Jayden |
| P5 | **Record every credential gate in `human-decisions.md`** — B2/B3 (Cloudflare Worker + hosted Supabase secret keys), B5 (second provider key), B10 (Android device) | Audit A4: five of eight human gates are missing from the file the orchestrator prompt tells builders to consult | orchestrator |
| P6 | **Decide O29's provider posture** — provision a second family, or rescope the vendor-agnostic clause | Audit A5: only `OPENAI_API_KEY` exists, `config.ts:288` hard-codes an Anthropic-verifier reject, and the caps (Anthropic ≤2 SGD / OpenAI ≤20 SGD) are allocated backwards for the only legal configuration | Jayden |

## 2. New optimisation items (O31–O40)

Numbering starts at **O31**. `O30` is deliberately skipped: it is a dead ID in `docs/temp/` and a live
one in the archive, so reusing it would be ambiguous.

These target the audit's central pattern — **stated invariants with no machine behind them**. That
pattern matters more than usual here because the owner does not review code, so every unenforced rule
is an unguarded rule.

### O31 · Mechanical cap enforcement in CI
A job computing `git diff --shortstat <baseline>..HEAD` and failing past the run's declared file/line
caps. Converts the caps from an honour system into a gate. Would have caught A3 the moment #145 merged
rather than an audit finding it afterwards. Needs P4 first (one baseline rule). *Source: audit.*

### O32 · Required-status-check configuration as recorded state
P1 sets the checks; this item records *which* checks are required, where, and adds a periodic
verification that the setting still holds. Repo settings drift silently and invisibly — an assertion
that the gate exists is itself a gate. *Source: audit A1.*

### O33 · Fix the fail-open coverage guard
`tools/check_supabase_deno_matrix.mjs` silently discards `[functions.*]` sections its regex cannot
parse, so `[functions.x] # comment` and `[functions."x"]` (mandatory quoting for dotted names) drop a
deployable function out of the required set. Throw instead of filter. Additionally verify that
`deno-check` is actually running (not `if: false`, not a no-op) and that the checked file equals the
declared `entrypoint`. *Source: audit A7/A11. Belongs to Run 3 if O24 is reworked; to Run 4 if O24
merges as-is.*

### O34 · Deploy-path attestation
The frozen lock constrains CI only. There is no deploy workflow; deploys are manual
`npx supabase functions deploy`, which never reads `supabase/deno.lock`, and the handlers use a bare
unversioned `jsr:@supabase/functions-js` reference. Make the deployed dependency set equal the gated
one, or state honestly that it is not. Includes verifying that the Supabase CLI tolerates the `"lock"`
key in a file it parses as an import map — currently untested on any path. *Source: audit A12.*

### O35 · Import-boundary linting
`AGENTS.md` states that `model-training/` may never be imported by `apps/`, `supabase/`, `shared/`, or
`tools/brain-ingest`, and forbids cross-module `/impl` imports. Both are prose. A repo-wide search for
`dependency-cruiser`, `eslint-plugin-boundaries`, `no-restricted-imports` and `import/no-restricted-paths`
returns zero hits. This is now the only architectural boundary with a newly added foreign language on
the other side of it and no mechanical guard. *Source: audit.*

### O36 · Secret scanning on push and PR
O25's acceptance proves "no server key in a client bundle, `NEXT_PUBLIC_*`, response, trace or log"
once, at one commit. There is no gitleaks/trufflehog config. Fourteen files reference
`SUPABASE_SERVICE_ROLE_KEY` and O25 introduces a second long-lived credential; a point-in-time test
cannot be the regression guard for that. *Source: audit.*

### O37 · Golden-test determinism as a prerequisite
`apps/biotope` has zero `matchesGoldenFile` usage and no `flutter_test_config.dart`. Goldens authored
on the Windows toolchain will not byte-match `ubuntu-latest` without a pinned font loader and a
tolerance-configured comparator. O28 assumes this infrastructure exists. Either scope it as a small
pre-U4 task or drop image goldens in favour of widget + semantics assertions — the latter also removes
~24–30 files from Run 3's file cap, which A8 says is the binding constraint. *Source: audit.*

### O38 · Promote `TEST_MODE_LABEL` into `shared/`
The user-facing trust disclaimer is duplicated across four modules: `tools/llm-router/src/types.ts`
(canonical), `apps/nao/src/lib/claimsControl.ts` (comment says "mirrors … verbatim"),
`apps/nao/src/components/ModelsPanel.tsx` (retyped as a raw JSX literal, not the constant), and
biotope's provenance screen ("Hardcoded mirror of TEST_MODE_LABEL"). This is the anti-pattern
`B-PL21` flags for `PaperRecord`, but on a **trust label** — and the register does not list it. O27
must touch all four anyway. Requires a `shared/` change, so it depends on P2. *Source: audit.*

### O39 · Dependency update channel
No `dependabot.yml`, no renovate config. U0 freezes a fifth pinned toolchain (Deno 2.8.1 + a shared
`deno.lock`) on top of Flutter, Node, the Supabase CLI and `model-training/constraints.txt`. O24
deliberately increases pinning without adding any mechanism to un-pin safely. *Source: audit.*

### O40 · Doc-status hygiene
Two concrete defects. (a) All five `docs/temp/run3/*.md` carry `status: canonical` while their own
summaries say "not ground truth", and `context_sync.mjs` renders no flag for `canonical`, so they are
indistinguishable from constant-layer truth in the generated index — contradicting the CONSTANT vs
VARIABLE layering in `AGENTS.md`. (b) `docs/shared/decisions/0003-paper-reliability.md` has
`status: accepted` in frontmatter and **"Status: Proposed"** in its body; `context_sync` freezes
accepted ADR bodies, so a self-described proposal is immutable — and O27 renders user-facing
study-design copy off its semantics. Resolving (b) needs a superseding ADR, not an edit.
*Source: audit A15/A16.*

## 3. Carried forward from the pending-build register

Run 3's O24–O29 fully covers **14** register rows and partially covers 3. The following **41 rows plus
5 schema gaps** are untouched. Original IDs are preserved deliberately — Run 4 must reuse them, not
renumber, so the trail back to Run 1 and Run 2 survives.

### 3.1 Ownership holes found by the audit — no owner today

| ID | What | Finding |
|---|---|---|
| `B-BR7` (un-reject slice) | Re-review / **restore** after rejection. Split across O25 and O27; the words "restore"/"un-reject" appear in neither | A9 |
| `B-PL19` (cross-env slice) | Cross-environment verdict policy. Claimed covered by O29, which **explicitly forbids** migrating `edge_human_verdicts` with no successor | A10 |
| `B-SEC1` (suppression slice) | Small-cohort suppression — O25 defers the decision rather than implementing it | A10 |
| `B-PL20` | Docs reconciliation stated as a precondition for unattended Run-3 work, with no unit, no slot and no owner | A21 |

### 3.2 Schema and storage primitives
`A1` env_daily table absent (blocks 18 W3 metrics) · `A2` derived_metrics unwritten/unread (blocks ~16)
· `A3` no static/T5 storage table · `A4` events/state_bands absent from `metric_daily_values`
(17 metrics dashboard-invisible) · `A5` daily_log not generalised.
Depends on `B-PL5`/O4 and `B-PL6`/O5.

### 3.3 Backlog O-items never pulled into a run
`B-PL2` O1 deadband reconciliation + drift guard · `B-PL3` **O2 Method & Parameter Register — a hard
gate on every statistical sign-off** · `B-PL4` O3 registry catalog · `B-PL5` O4 derived_metrics RLS ·
`B-PL6` O5 storage-primitive coverage · `B-PL7` O6 CODEOWNERS + branch protection · `B-BR8` O8
router-config calibration · `B-BR11` O22 venue override table · `B-PL12` O21 location-fetch trigger ·
`B-PL13` **O23 brain-ingest→llm-router package dep — a blocker for any build/publish, and the cause of
two budget ledgers**.

`B-PL3`/O2 is the most consequential: it blocks `B-R1-3`'s calibration backlog and `B-SCI2`'s
calibration half, and Run 3 excludes it explicitly.

### 3.4 Brain / verifier
`B-BR4` custom support models (the roster's NLI pre-filter and models (b)/(c) — now the separate
model-training workstream; the *product* gap stays here) · `B-BR5` presentation agent unwired ·
`B-BR6` autonomous gap→research loop · `B-BR9` M6 `InsightFiredEvent` never emitted · `B-BR10`
`contradiction` → `needsReview()` unwired, **no owner** · `B-BR12` non-deterministic verdicts (accepted).

### 3.5 UI / app surface
`B-UI1` porcelain-luxury reskin · `B-UI2` formal user testing · `B-UI4` Windows-desktop Flutter launch
· `B-UI5` nao `/login` click-path never driven end-to-end · `B-UI6` Run-now dropdown ignores db seeds ·
`B-UI7` nao production build / OpenNext / Worker secrets unverified · `B-UI8` O10(c) ingestion-progress
boundary.

### 3.6 Platform and process
`B-PL1` evaluate-signals nightly cron · `B-PL8` `shared/brain` has no typecheck target · `B-PL9` iOS
path env-gated · `B-PL10` **B8 two-reviewer rule (see P2)** · `B-PL11` ADR amendment intents recorded
but unapplied · `B-PL16` run-pipeline summaries scale with users × metrics · `B-PL17` semantic-graph
freshness unenforced · `B-PL18` semantic-graph query ranking noisy · `B-PL21` `PaperRecord` duplicated
across the ingestion/nao boundary · `B-COST1` **router budget not atomic and not globally capped —
six 5-USD node caps imply 30 USD/day against a stated lower ceiling, and a corrupt ledger resets to
zero**.

### 3.7 Review and sign-off debt
`B-R1-1` ~20 of 24 Run-1 unit sign-offs outstanding · `B-R1-2` human blockers B2–B12 · `B-R1-3`
calibration backlog · `B-R1-4` register hygiene · `B-R2-1` **all 14 Run-2 unit sign-offs pending** ·
`B-R2-2`, `B-R2-3` recorded, not defects.

Combined with A14, this is 34 outstanding sign-offs. Run 4 should not add a 35th without changing how
acceptance works.

## 4. Explicitly not in Run 4

- **O24–O29** — Run 3 owns them while it is live.
- **The five model-training units MT1–MT5** — separate workstream, separate budget, and per P3 they
  should also get a separate integration base.
- **Anything requiring hardware or accounts that do not exist**: CGM, real wearables, iOS/Mac + paid
  Apple account, a physical Android device for TalkBack.
- **Production cutover, hosting, or any claim of scientific validation.** Unchanged from Run 3.

## 5. ID hygiene — read before reusing any ID

The audit found the register's own indexing unreliable; Run 4 must not inherit the errors.

- **§I's self-audit is wrong** (A17): it claims "56 canonical rows, 56 unique IDs"; there are **58**.
  `B-PL20` and `B-PL21` post-date the reconciliation. Its instruction to "check §I before assuming an
  item is missing" is therefore not currently safe.
- **`B1`–`B13` is two colliding namespaces** (A18): human-gated access blockers (B5 = provider keys,
  B11 = SJR dataset) *and* the research-fixes calibration backlog (B1–B7). "B3" and "B5" are ambiguous
  without context. `B8` doubles as both a human blocker and the canonical name of `B-PL10`.
  **Run 4 should qualify every reference** as `B5(access)` or `B3(calibration)`.
- **`O30` is dead in `docs/temp/` and live in the archive.** Run 4 numbering starts at O31 for this
  reason. Do not reuse O30.
- **`A1`–`A5` schema gaps** use a different convention from every `B-*` row and are not counted in §I's
  tally. They also collide with this audit's own `A1`–`A21` finding IDs — cite them as
  `register A1` vs `audit A1`.
