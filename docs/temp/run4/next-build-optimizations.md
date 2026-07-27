---
title: Run 4 — reviewed candidate scope and priority tranche
summary: Run 4's active reviewed scope: accepted envelope, O31-O40 enforcement candidates, promoted pending-build register, and a priority tranche that rebuilds O24 before security, raw-truth, and scientific-semantics work.
type: plan
scope: shared
status: draft
run4_u5_sentence_provenance: planning-admitted; implementation-cap-deferred-pending-later-envelope
updated: 2026-07-28
---

> **U5/B-PL22 sentence-provenance planning admission.** This remains inside U5, not a new pipeline.
> A future local tool-only tranche is versioned/rebuildable StructuredPaper text, native JATS or frozen
> GROBID-style sections, sentence IDs/offsets, citation/refGraph roots, curated mention and deterministic
> quote/tier/numeric/schema/negation/hedge gates. Frozen/mock LlmRouter seams must expose complete
> `INTERIM:` metadata and only suggest; deterministic enforcement fails closed. The 14 / ~1,900 local
> tranche is split/deferred; persisted/served/UI is P2-blocked. Verified combined product snapshot
> `f2f2dac` (base `77c982`; U1 `baab1536` + U5 `cdc16f9`; MT4 paths/session excluded) is the historical
> pre-overlay 38 / +8,002 / -162 snapshot, leaving 77 / +498. The later final pre-commit overlay (U5
> docs + harness script + 44-line session) was independently audited at 40 / +8,156 / -195, leaving 75 /
> +344. U1 fits, but U2/U3 expected additions and the minimal sentence tranche
> (six touched, two reused, four new, ~+1,900) do not fit the line budget and are cap-deferred pending a
> later envelope decision. Exact pre-merge remeasurement remains mandatory. Separately, O29 defers provider/model execution under the zero-call posture.

# Run 4 — reviewed candidate scope and priority tranche

**Historical preflight status (superseded).** U0 merged through PR #161 at
`66bfde53b0dc388e40af42ab0ff4737ffb2fd8aa`; exact merge-SHA CI run `30285010079` passed 19/19. The
accepted base, cap, locked units, and intentionally unprotected
`dev-phase2-run4` posture are recorded in the companion decision documents. The audit that produced the
candidate list is [`run3-audit-findings.md`](./run3-audit-findings.md).

**Current admitted sequence:** complete U5 health/insight proof, integrate completed U1, then run the
Run 4 exit gate. U2, U3, and sentence-provenance implementation are cap-deferred pending an explicit
later envelope decision and are not prerequisites for this exit gate.

**Historical relationship to Run 3 (superseded sequencing context).** Run 3 closed without an accepted unit. PR #144 must not merge in its
audited state; O24-O29 are therefore unfinished and have been promoted into
[`pending-build-register.md`](./pending-build-register.md). Run 4 does not assume that all six fit.
The original plan rebuilt O24 first and then prioritized O25-O27; O28 and O29 stayed deferred by default.

## 1. Preconditions — resolve before Run 4 (and mostly before Run 3 continues)

These are not build units. Most are settings or decisions, and several block Run 3 right now.

| ID | What | Why it blocks | Who |
|---|---|---|---|
| P1 | **Exact-current-SHA CI evidence** on `dev-phase2-run4` | User override: the branch intentionally remains unprotected; `Run 4 Gate` is evidence only, not GitHub branch-setting enforcement. No ADMIN or settings action is requested | U0 / CI |
| P2 | **Two named `shared/` reviewers** | Historical audit A4 blocker resolved for U4 on 2026-07-28: Alton and Jayden approve implementation; both actual PR reviews remain required. Current cap admission separately fails (+344 remains versus U4 low +1,600); no U6 approval. | Alton + Jayden |
| P3 | **Separate model-training from the Run 4 integration base before MT1 is cut** | Audit A3: MT0 alone changed 59 files / added 5,362 lines after the Run 3 candidate baseline and broke U0's mergeability. The exact model-training integration target is a human decision; do not invent a long-lived branch contrary to the normal workflow | Jayden + orchestrator |
| P4 | **Approve a fresh immutable Run 4 base and one cap metric** | Do not retroactively exclude merged work. Define the run budget as the final landing delta from the accepted Run 4 base (`base..HEAD`), including generated/tracking files, with unique changed paths and added lines counted mechanically. Record the base SHA and cap before implementation | Jayden |
| P5 | **Record every credential/resource gate in Run 4 `human-decisions.md`** — B2/B3 (Cloudflare Worker + hosted Supabase secret keys), B5 (second provider key), B10 (Android device) | Record names and approval state only, never secret values. Missing external authority blocks only the affected unit; it cannot be inferred from this prompt | orchestrator |
| P6 | **Decide O29's provider posture** — provision a second family, or rescope the vendor-agnostic clause | Audit A5: only `OPENAI_API_KEY` exists, `config.ts:288` hard-codes an Anthropic-verifier reject, and the caps (Anthropic ≤2 SGD / OpenAI ≤20 SGD) are allocated backwards for the only legal configuration | Jayden |
| P7 | **Close PR #144 as superseded; do not merge it** | Its 15 green checks belong to an old synthetic merge, the current base conflicts in the workflow under test, and the audit found fail-open/tautological gate logic. Rebuild the useful O24 intent on the fresh Run 4 base | Jayden + orchestrator |

## 2. New optimisation items (O31–O40)

Numbering starts at **O31**. `O30` is deliberately skipped: it is a dead ID in `docs/temp/` and a live
one in the archive, so reusing it would be ambiguous.

These target the audit's central pattern — **stated invariants with no machine behind them**. That
pattern matters more than usual here because the owner does not review code, so every unenforced rule
is an unguarded rule.

### O31 · Mechanical landing-delta cap enforcement in CI
A fail-closed job reads one machine-recorded immutable base SHA, fetches that object explicitly, and
counts unique changed paths plus added lines in `base..HEAD`. This is a **landing-delta** budget, not
"cumulative churn" across intermediate commits. Binary/generated/tracking files still count as
changed paths. Needs P4; missing base, shallow-history failure, or unparsable output fails the gate.
*Source: audit, corrected in issue #150.*

### O32 · Exact-current-SHA CI evidence
Record the required jobs and run one stable aggregate `Run 4 Gate` with `if: always()` and explicit
`needs` that fails unless every required dependency succeeds. Evaluate that evidence only for the exact
current SHA: base advances, workflow edits, or a different head invalidate older evidence. The branch
intentionally remains unprotected, so O32 neither configures nor claims GitHub branch-setting
enforcement; no ADMIN or settings action is part of this run. *Source: audit A1; current Run 4 override.*

### O33 · Fix the fail-open coverage guard
`tools/check_supabase_deno_matrix.mjs` silently discards `[functions.*]` sections its regex cannot
parse, so `[functions.x] # comment` and `[functions."x"]` (mandatory quoting for dotted names) drop a
deployable function out of the required set. Replace regex-as-parser with a TOML-aware, fixture-tested
reader that fails on unsupported forms. Additionally verify that `deno-check` is enabled, invokes the
expected command, and checks the exact declared `entrypoint`. This is part of the O24 rebuild.
*Source: audit A7/A11, corrected in issue #150.*

### O34 · Deploy-path attestation
Current evidence proves `deno check --frozen`, not what the pinned Supabase CLI bundles. Official
Supabase guidance says per-function `deno.json` is the recommended deployment configuration, but does
not by itself prove that this repo's lock-v5 file and `lock` object are honored identically by every
CLI bundling mode. Run a non-hosted bundle/serve probe on the pinned CLI, capture the resolved module
graph or bundle hash, and compare it with the gated graph. If parity cannot be demonstrated, pin exact
imports or vendor dependencies and keep deploy reproducibility blocked. Do not state that the CLI
"never reads" the lock without evidence. *Source: audit A12, corrected in issue #150.*

### O35 · Import-boundary enforcement
`AGENTS.md` states that `model-training/` may never be imported by `apps/`, `supabase/`, `shared/`, or
`tools/brain-ingest`, and forbids cross-module `/impl` imports. Both are prose. A repo-wide search for
`dependency-cruiser`, `eslint-plugin-boundaries`, `no-restricted-imports` and `import/no-restricted-paths`
returns zero hits. Use fixture-tested guards covering TS imports/path aliases, Dart imports, forbidden
`/impl` access, and subprocess/path references into the isolated model-training workspace; an ESLint-
only rule is insufficient for this polyglot boundary. *Source: audit, corrected in issue #150.*

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
~24–30 files from the prior estimate. **Run 4 defaults to widget + semantics assertions and defers
image goldens** unless a separate determinism proof is accepted. *Source: audit, decision in issue
#150.*

### O38 · Promote `TEST_MODE_LABEL` through the shared contract seam
The user-facing trust disclaimer is duplicated across four modules: `tools/llm-router/src/types.ts`
(canonical), `apps/nao/src/lib/claimsControl.ts` (comment says "mirrors … verbatim"),
`apps/nao/src/components/ModelsPanel.tsx` (retyped as a raw JSX literal, not the constant), and
biotope's provenance screen ("Hardcoded mirror of TEST_MODE_LABEL"). This is the anti-pattern
`B-PL21` flags for `PaperRecord`, but on a **trust label**. Use the repository's TS/Dart generated or
parity-guarded constants pattern; neither language may directly import the other's source. O27 must
touch all four anyway. Requires a `shared/` change and two reviewers, so it depends on P2. *Source:
audit, corrected in issue #150.*

### O39 · Dependency update channel
No `dependabot.yml`, no renovate config. U0 freezes a fifth pinned toolchain (Deno 2.8.1 + a shared
`deno.lock`) on top of Flutter, Node, the Supabase CLI and `model-training/constraints.txt`. O24
deliberately increases pinning without adding any mechanism to un-pin safely. *Source: audit.*

### O40 · Doc-status hygiene
At audit time, the Run 3 cockpit, scope, prompt, and register carried `status: canonical` despite being
temporary planning aids. Issue #150 reclassified the closing Run 3 execution docs as draft and
promoted the living register, so that slice is resolved. The remaining defect is
`docs/shared/decisions/0003-paper-reliability.md`: it has
`status: accepted` in frontmatter and **"Status: Proposed"** in its body; `context_sync` freezes
accepted ADR bodies, so a self-described proposal is immutable — and O27 renders user-facing
study-design copy off its semantics. Resolving (b) needs a superseding ADR, not an edit.
*Source: audit A15/A16; partial closeout in issue #150.*

## 3. Recommended priority tranche

This is the largest tranche accepted for the locked envelope. U0 is complete through PR #161 with
exact merge-SHA CI run `30285010079` passing 19/19; Alton and Jayden resolve U4's reviewer gate, but
the current cap keeps U4 pending/NO-GO; P3 excludes training and P5/P6 retain local-only, zero-provider constraints. The run may not
silently add O28, O29, O37, O39, O40, or any other register row.

| Priority | Candidate unit | Contents | Start gate |
|---|---|---|---|
| 1 | R4-U0 · trustworthy release gate | Rebuild O24 with O31-O34; stable required aggregate, current landing-SHA evidence, fail-closed config/matrix coverage, and deploy-path dependency proof | COMPLETE: PR #161 merged at `66bfde5`; exact merge-SHA CI `30285010079` passed 19/19 |
| 2 | R4-U1 · mechanical boundaries | O35 + O36; polyglot import/path guard and pinned secret scanning | COMPLETE externally at `baab1536`; PR #170 remains draft/open and unmerged, CLEAN, 21/21 green |
| 3 | R4-U2 · authorization and key boundary | O25; nao RBAC/RLS, redacted global jobs, named server-key migration | DEFERRED BY CAP pending explicit later envelope decision |
| 4 | R4-U3 · raw-truth and retry safety | O26; atomic demo loading and idempotent/single-flight pipeline publication | DEFERRED BY CAP with U2 pending explicit later envelope decision |
| 5 | R4-U4 · scientific semantics | O27 + O38; claim-kind preservation, artifact trust, revision-bound dispositions, TS/Dart trust-label parity | Reviewer gate resolved (Alton + Jayden; both PR reviews mandatory); current cap NO-GO/pending (+344 versus +1,600 low); no U6 authority |

Default deferrals:

- **O28/O37:** defer image goldens and the broader accessibility/UI tranche; use widget + semantics
  assertions only where R4-U4 touches UI.
- **O29:** defer until a legal second-provider posture, immutable release inputs, and an approved
  isolated rehearsal target exist. Zero live provider calls and zero hosted writes in R4-U0-U4.
- **O39:** dependency-update policy is valuable maintenance, but it must not dilute the blocker
  tranche.
- **O40:** perform only the Run 3→Run 4 routing needed for safe launch. Superseding ADR work remains a
  separately reviewed decision change.

## 3b. Jayden's product brief (2026-07-27) — reconciled against the tranche above

The §3 tranche was signed off **before** Jayden's product brief and is infrastructure-first. The brief
adds three product goals it does not cover, and adds a capability that changes what is testable. This
section reconciles the two; it does not replace §3.

**New capability — the full local test suite now exists.** A real **Android device** is available and
**local nao runs live**. This is the largest change entering Run 4: `B-UI2`, `B-UI5`, `B-UI6`,
`B-UI11`, the O28 TalkBack traversal, and human blocker `B10(access)` all move from *blocked* to
*doable*. Several §3 default-deferrals were justified partly by untestability and should be re-examined
on that basis — O28 in particular.

**No model training in Run 4.** Custom-model artifacts are unavailable, non-serving, and forbidden from
runtime import. Frozen/mock lightweight stand-ins use the existing LlmRouter only; O29 keeps provider
execution deferred under the zero-call posture.

### Coverage of the six priorities

| # | Priority | Covered by | Status |
|---|---|---|---|
| 1 | Auth split: dev vs user; dev reaches nao; nao shows ingestion + biotope data | R4-U2 (O25) | **partial** — R4-U2 is the RBAC/key boundary; the dev/user *split* and dev-facing nao data population are additional |
| 2 | All pending Run-3 optimisations | R4-U0/U2/U3/U4 | covered, minus deferred O28/O29 |
| 3 | Single-paper ingestion, no empty checkpoints, LLM stand-ins | — | **not covered** → R4-U5 below |
| 4 | biotope metrics, EASY + MEDIUM | — | **not covered** → R4-U6 below |
| 5 | biotope UX revamp | — | **not covered** → R4-U7 below |
| 6 | As much of the register as fits | R4-U1 partially | partial |

### Additional candidate units

**R4-U5 · Single-paper end-to-end ingestion with stand-in seams.** Closes register **section C**. One
real paper, start to finish, with **no empty checkpoints**: each planned custom-model slot is a
replaceable existing-LlmRouter adapter exercised only with frozen/mock replies, or the deterministic
path where one exists (`impactTier` is already OpenAlex + SJR). The exact contract is register §C.1.

> Every frozen/mock output visibly records `INTERIM:` task, returned model, prompt version, timestamp,
> confidence or abstention, and deterministic-fallback use. Deterministic enforcement alone advances
> an artifact. OpenAI, Haiku, GMI and every live-provider target are historical or O29-deferred and
> non-admitted here; R4-U5 makes no provider, decorrelation, model-performance or validation claim.

**R4-U6 · biotope metrics, EASY + MEDIUM (~50).** Split into **U6a/U6b/U6c**.

> **This is not a metric-authoring unit.** EASY metrics need `register A5` (generalise `daily_log`) and
> MEDIUM metrics need `register A4` (extend `metric_daily_values`, or events/state_bands stay
> dashboard-invisible). Both are structural schema work owned by `B-PL6`/O5. Sizing U6 without them
> under-scopes it by the entire storage-primitive workstream. U6a is those primitives; U6b is EASY;
> U6c is MEDIUM. Touches `shared/metrics` → **P2**.

**R4-U7 · biotope UX revamp.** `B-UI1`, the porcelain-luxury re-skin, excluded from Runs 2 and 3 as
needing human supervision — now viable with a device in hand. Sequence **after** any accessibility work
so it is not redone. `B-UI2` formal user testing also becomes possible, but needs a protocol, not just
hardware.

### Sizing reality

§3's five units were deliberately capped as "the largest tranche this review signs off for preflight".
Adding U5–U7 roughly doubles it, and three of the additions (U2's split extension, U6a, U6c) are
substantially greenfield. On Run-3 calibration the combined scope plausibly lands at **150–250 changed
paths** against a landing-delta cap.

**Historical recommendation (superseded):** do not lock all eight; the earlier proposed sequence was:

**R4-U5 → R4-U2(+auth split) → R4-U0 → R4-U6a → R4-U6b → R4-U4 → R4-U7 → R4-U6c → R4-U1**

That ordering no longer governs active work. The current admitted sequence is **U5 health/insight proof
→ U1 integration → Run 4 exit gate**. U2, U3, and sentence-provenance implementation are cap-deferred
pending an explicit later envelope decision. Anything outside the admitted sequence rolls forward rather
than inflating the cap.

## 3c. Run 4 exit gate — local qualification before cloud promotion

**This runs after every currently admitted/integration unit is complete, explicitly excluding
cap-deferred units, and it gates promotion to the cloud demo database.**
Nothing is promoted until both passes below are green. Jayden's specification, 2026-07-27.

### Why two passes and not one

The existing harness proves **API integrity**, not **end-to-end authoring**. Those are different
claims and conflating them is the trap this gate exists to prevent.

`scripts/demo-dryrun-run2.ps1` (756 lines; canonical procedure in
[`phase2-demo-runbook.md`](../../shared/phase2-demo-runbook.md)) already verifies relationship claims
and verified edges in Postgres, simulated Biotope rows through nao `/api/loader`,
`compute-baselines → evaluate-signals → generate-insights`, insight cards and provenance, the claims /
rejection / models / caps / seeds / gap endpoints, and Biotope rendering on Android — **21/21 at last
run**.

But it does so from **four hand-authored relationship fixtures**, one fixture claim with a real live
verifier call, real local edge loading and insight-engine execution, and **simulated,
provenance-labelled** Biotope health data. So it validates every implemented application API while
proving nothing about whether an arbitrary newly ingested paper becomes a relationship. That gap is
register row **`B-PL22`**: the nao ingestion button stops after the GitHub Actions paper-ingestion job,
and synthesis, verification and edge loading remain separate CLI stages.

### Pass 1 — API integrity

Run the official full harness. **Every endpoint and stage assertion must pass**; a partial pass is a
fail. Record the run output, the commit SHA, and the environment, per the runbook.

### Pass 2 — real-paper authoring

Take one **existing corpus paper** and drive it the whole way:

> **`doi:10.1016/j.isci.2026.116224`** — *Unraveling the gut microbiota-brain axis…*
>
> Chosen because it already has canonical R2 text **and** an existing `gut_comfort_score ↔ mood_score`
> claim, so it is traceable end to end. **Do not use the D1 paper** inserted earlier: it is searchable
> but not connected to the demo insight chain, so it cannot evidence this pass.

Then: regenerate a relationship from that DOI → verify it → load it → generate Biotope health data →
confirm the resulting insight and its provenance.

### Relationship to R4-U5

Pass 2 **is** the acceptance form of candidate unit **R4-U5** (§3b) — the same single-paper traceable
run, judged as a gate rather than as a build. Do not scope them as separate work. If R4-U5 ships, pass
2 is its acceptance evidence; if R4-U5 is cut, pass 2 still runs and will fail until the CLI stages are
driven manually, which is itself the honest result.

The stand-in constraint carries through: Pass 2 uses frozen/mock existing-LlmRouter seam replies with
complete visible `INTERIM:` provenance under zero live calls. It may evidence local pipeline plumbing,
not provider execution, decorrelation, model performance, semantic validity or scientific validation;
all live targets remain historical/O29-deferred.

### Promotion rule

Only after **both** passes are green may the **same** migrations and reviewed artifacts be promoted to
the cloud demo. Promote the artifacts that were qualified — not a rebuild, not a re-run, not a
"should be equivalent" variant. Any divergence between what passed locally and what is promoted voids
the gate.

## 4. Carried forward from the pending-build register

The former O24-O29 scope would fully cover **14** register rows and partially cover 3 if all six units
were completed. The following **41 rows plus 5 schema gaps** remain outside that scope. Original IDs
are preserved deliberately — Run 4 must reuse them, not renumber, so the trail survives.

### 4.1 Ownership holes found by the audit — no owner today

| ID | What | Finding |
|---|---|---|
| `B-BR7` (un-reject slice) | Re-review / **restore** after rejection. Split across O25 and O27; the words "restore"/"un-reject" appear in neither | A9 |
| `B-PL19` (cross-env slice) | Cross-environment verdict policy. Claimed covered by O29, which **explicitly forbids** migrating `edge_human_verdicts` with no successor | A10 |
| `B-SEC1` (suppression slice) | Small-cohort suppression — O25 defers the decision rather than implementing it | A10 |
| `B-PL20` | Docs reconciliation stated as a precondition for unattended Run-3 work, with no unit, no slot and no owner | A21 |

### 4.2 Schema and storage primitives
`A1` env_daily table absent (blocks 18 W3 metrics) · `A2` derived_metrics unwritten/unread (blocks ~16)
· `A3` no static/T5 storage table · `A4` events/state_bands absent from `metric_daily_values`
(17 metrics dashboard-invisible) · `A5` daily_log not generalised.
Depends on `B-PL5`/O4 and `B-PL6`/O5.

### 4.3 Backlog O-items never pulled into a run
`B-PL2` O1 deadband reconciliation + drift guard · `B-PL3` **O2 Method & Parameter Register — a hard
gate on every statistical sign-off** · `B-PL4` O3 registry catalog · `B-PL5` O4 derived_metrics RLS ·
`B-PL6` O5 storage-primitive coverage · `B-PL7` O6 CODEOWNERS + branch protection · `B-BR8` O8
router-config calibration · `B-BR11` O22 venue override table · `B-PL12` O21 location-fetch trigger ·
`B-PL13` **O23 brain-ingest→llm-router package dep — a blocker for any build/publish, and the cause of
two budget ledgers**.

`B-PL3`/O2 is the most consequential: it blocks `B-R1-3`'s calibration backlog and `B-SCI2`'s
calibration half, and Run 3 excludes it explicitly.

### 4.4 Brain / verifier
`B-BR4` custom support models (the roster's NLI pre-filter and models (b)/(c) — now the separate
model-training workstream; the *product* gap stays here) · `B-BR5` presentation agent unwired ·
`B-BR6` autonomous gap→research loop · `B-BR9` M6 `InsightFiredEvent` never emitted · `B-BR10`
`contradiction` → `needsReview()` unwired, **no owner** · `B-BR12` non-deterministic verdicts (accepted).

### 4.5 UI / app surface
`B-UI1` porcelain-luxury reskin · `B-UI2` formal user testing · `B-UI4` Windows-desktop Flutter launch
· `B-UI5` nao `/login` click-path never driven end-to-end · `B-UI6` Run-now dropdown ignores db seeds ·
`B-UI7` nao production build / OpenNext / Worker secrets unverified · `B-UI8` O10(c) ingestion-progress
boundary.

### 4.6 Platform and process
`B-PL1` evaluate-signals nightly cron · `B-PL8` `shared/brain` has no typecheck target · `B-PL9` iOS
path env-gated · `B-PL10` **B8 two-reviewer rule (see P2)** · `B-PL11` ADR amendment intents recorded
but unapplied · `B-PL16` run-pipeline summaries scale with users × metrics · `B-PL17` semantic-graph
freshness unenforced · `B-PL18` semantic-graph query ranking noisy · `B-PL21` `PaperRecord` duplicated
across the ingestion/nao boundary · `B-COST1` **router budget not atomic and not globally capped —
six 5-USD node caps imply 30 USD/day against a stated lower ceiling, and a corrupt ledger resets to
zero**.

### 4.7 Review and sign-off debt
`B-R1-1` ~20 of 24 Run-1 unit sign-offs outstanding · `B-R1-2` human blockers B2–B12 · `B-R1-3`
calibration backlog · `B-R1-4` register hygiene · `B-R2-1` **all 14 Run-2 unit sign-offs pending** ·
`B-R2-2`, `B-R2-3` recorded, not defects.

Combined with A14, this is 34 outstanding sign-offs. Run 4 should not add a 35th without changing how
acceptance works.

## 5. Explicitly not in the Run 4 priority tranche

- **O28 and O29** — retained in the promoted register, but deferred by default for this tranche.
- **The five model-training units MT1–MT5** — separate workstream, separate budget, and per P3 they
  should also get a separate integration base.
- **Anything requiring hardware or accounts that do not exist**: CGM, real wearables, iOS/Mac + paid
  Apple account, a physical Android device for TalkBack.
- **Production cutover, hosting, or any claim of scientific validation.** Unchanged from Run 3.

## 6. ID hygiene — read before reusing any ID

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
