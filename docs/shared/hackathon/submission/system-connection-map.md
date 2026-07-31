---
title: Ourobion — system connection map (submission-facing projection)
summary: A blocked submission-facing projection undergoing evidence verification; its labels and counts are stale in material places and it must not be submitted until the 2026-08-01 audit defects are resolved.
type: reference
scope: repo
status: draft
updated: 2026-08-01
---

# Ourobion — system connection map

> **DO NOT SUBMIT THIS MAP.** Its provider roles, pipeline result, corpus posture, workflow and
> migration counts, support-model claims, and several built-versus-planned labels require correction.
> The evidence and exact defects are in
> [`submission-verification-audit.md`](../../../temp/run4/submission-verification-audit.md). This
> warning prevents a stale projection from being mistaken for implementation evidence while the
> final narrative remains intentionally unwritten.

> **This document is a submission-facing projection, not architecture authority.**
> It exists so a reader (judge, reviewer, or new contributor) can see the shape of the system and,
> for each part, exactly how strong the evidence behind it is. It is a *rebuildable view*, in the
> sense of the repo's two-tier-truth rule: when it disagrees with the canonical docs or the code, the
> canonical docs and the code win and this file is what gets corrected.
>
> Canonical authorities, in order of precedence:
> - Module graph, data flow, interface rules — [`docs/biotope/architecture-context.md`](../../../biotope/architecture-context.md)
> - Cross-language contracts — [`shared/SHARED-CONTEXT.md`](../../../../shared/SHARED-CONTEXT.md)
> - Insight-engine architecture — [`docs/shared/insight-engine-architecture.md`](../../insight-engine-architecture.md)
> - The Biotope↔nao runtime seam — [`docs/shared/biotope-nao-link.md`](../../biotope-nao-link.md)
> - Brain design — [`docs/nao/brain-synthesis-design.md`](../../../nao/brain-synthesis-design.md), [`brain-ingestion-design.md`](../../../nao/brain-ingestion-design.md)
> - Durable facts — [`docs/memory/`](../../../memory/README.md), decisions — [`docs/shared/decisions/`](../../decisions/README.md)
> - The write-up this appendix serves — [`writeup.md`](./writeup.md)

## 0. The evidence labels

Every component below carries exactly one label. The labels are ordered from strongest to weakest
evidence, and the distinction that matters most is between the third and the fourth: **a configured
target is not a deployment.** Nothing in this document may be read as claiming a hosted deployment
unless it says so under a label that permits it — and none currently does.

| Label | What it means | What it does **not** mean |
|---|---|---|
| **Connected now — local config observed 2026-07-30** | A concrete config/wiring exists in the tree and was read on this date. | That any remote accepted it. |
| **Implemented and locally proven** | Code exists and an executable local check (test/gate) exercises it. | That it runs in production. |
| **Implemented; manual/optional** | Code exists and works, but only when a human runs it or opts in. | That it happens automatically. |
| **Configured target; deployment unproven** | A deploy target/binding is declared in config. | That the resource is provisioned, or that a deploy ever ran. |
| **Defined in cloud CI; latest execution unverified** | A workflow defines the gate on stated triggers. | That the most recent run was green — files cannot prove run history. |
| **Unknown live external state** | Depends on a remote/dashboard setting the repo cannot observe. | Anything at all about its current value. |
| **Planned/research-only; not serving** | Documented intent, no serving path. | That it influences any user-visible output. |

Where the honest answer is "no evidence found in the repo," this document says so. That is a finding,
not a gap in the review.

## 1. Runtime trust zones

Five zones, separated by what can read personal data and what can be reached without a session.

| Zone | Contents | Personal data? | Reachable unauthenticated? | Label |
|---|---|---|---|---|
| **Z1 — the user's device** | Flutter app `apps/biotope/`; on-device preferences; OS permission grants | Yes — the user's own entries, entered here | n/a (local) | Connected now — local config observed 2026-07-30 |
| **Z2 — the account-bound backend** | Supabase Postgres: raw rows, projections, RLS on `auth.uid()`; 4 Deno edge functions | Yes — isolated per account by RLS | No | Implemented and locally proven (local stack); hosted state: Unknown live external state |
| **Z3 — the brain corpus + pipeline** | `tools/brain-ingest/`, R2 corpus, D1 index, `verified_edges` | **No.** Papers and claims only | No | Implemented and locally proven (pipeline); Configured target; deployment unproven (R2/D1) |
| **Z4 — the nao operator console** | `apps/nao/` (Next.js), role-gated control surfaces | **No** — reads corpus/claims state, never user health rows | `/` is the static explainer; `/how-it-works` redirects there. Operations remain gated | Implemented and locally proven |
| **Z5 — cloud CI** | `.github/workflows/ci.yml`, `brain-ingest.yml` | No | n/a | Defined in cloud CI; latest execution unverified |

**The boundary that matters.** Z1/Z2 (personal) and Z3/Z4 (evidence) do not call each other at
runtime. Biotope does not call nao; nao does not read user health rows. The two meet only where the
insight engine joins a user's own projections against `verified_edges` — the brain's *published*
output — inside Z2. There is no direct Biotope→nao navigation or request path in the app: a search of
`apps/biotope/lib/` finds no reference to nao, no `url_launcher`, and no outbound URL construction.

## 2. Component status

### Biotope (Z1)

| Component | Label | Evidence |
|---|---|---|
| Flutter app, self-report logging, baselines/insights/engagement surfaces | Implemented and locally proven | `apps/biotope/lib/`; `flutter analyze` + `flutter test` in CI (`ci.yml` `flutter` job) |
| Supabase client init from `.env.public` | Connected now — local config observed 2026-07-30 | `apps/biotope/lib/main.dart:22,28-40`; throws if absent |
| Hosted Supabase URL/key | **No evidence found in repo** | Only `apps/biotope/.env.public.example:9-10`, whose value is the literal placeholder `https://your-project-ref.supabase.co`. Real values exist, if anywhere, as GitHub Actions secrets — never committed |
| Wearable ingestion (Health Connect / HealthKit) | Implemented; manual/optional | Best-effort by construction; `.ignore()` on failure — [memory 0006](../../../memory/0006-wearable-sync-best-effort.md). HRV SDNN is iOS-only — [memory 0004](../../../memory/0004-hrv-sdnn-ios-only.md) |
| iOS build / Apple Sign In / HealthKit | Planned/research-only; not serving | Needs a Mac + paid Apple account + real device — [memory 0010](../../../memory/0010-ios-build-needs-mac-and-paid-account.md) |
| "How Ourobion works" in-app explainer | Implemented and locally proven | Static screen, no service/network imports; asserted by widget + isolation tests |

### Supabase backend (Z2)

| Component | Label | Evidence |
|---|---|---|
| 39 migrations, 2026-03-13 → 2026-07-30 | Implemented and locally proven | `supabase/migrations/` (39 files); CI `migrations-apply` shadow-applies all of them in filename order to a throwaway vanilla `postgres:17` container (`ci.yml:293-329`) |
| Applied to a **hosted** project | **No evidence found in repo** | No `.supabase/` link file; `supabase/config.toml:5` `project_id = "ourobion"` is a *local CLI label*, not a hosted ref; no tracked automation runs `db push` — every hit is human-facing instructions |
| 4 edge functions (`compute-baselines`, `evaluate-signals`, `generate-insights`, `run-pipeline`) | Implemented and locally proven | CI `deno-check` type-checks each entrypoint against a frozen `deno.lock` (`ci.yml:236-258`); `supabase/deploy-attestation.json` records a local `functions serve` probe reaching all four handlers |
| Edge functions **deployed** | Configured target; deployment unproven | `supabase/deploy-attestation.json` states `"scope": "local-only"` and `"hostedDeployParityClaimed": false` |
| pg_cron scheduling of `compute-baselines` + `generate-insights` | Implemented; manual/optional → Unknown live external state | Migrations `20260515100001`, `20260728020000`, `20260728060000` register the jobs but each header requires `app.supabase_url`, `app.supabase_publishable_key`, `app.ourobion_internal_secret` to be set **by hand in the Supabase dashboard first** — [memory 0005](../../../memory/0005-pgcron-config-prereqs.md). Whether they are set on any real project is unobservable from here |
| RLS isolation per account | Implemented and locally proven | RLS predicates on `auth.uid() = user_id` across the personal tables |

### The brain (Z3)

| Component | Label | Evidence |
|---|---|---|
| Ingest / extract / passage selection | Implemented and locally proven | `tools/brain-ingest/src/`, 33 test files, run in CI `node-tools` matrix |
| A8 synthesis (LLM) | Implemented and locally proven | `tools/brain-ingest/src/synth/`; one real end-to-end run recorded (PR #190) |
| A9 quote check (deterministic) | Implemented and locally proven | `tools/brain-ingest/src/verify/quoteCheck.ts` + tests |
| A10 decorrelated adversarial verifier — **real verdict** | Planned/research-only; not serving | Blocked on a non-Anthropic key (register B5). `verifier.ts:14-20` states real runs are BLOCKED on the verifier vendor's key; `buildFallbackUncertain()` (`verifier.ts:154-193`) forces `uncertain` with `corroboration {supporting: 0, contradicting: 0}` — [memory 0016](../../../memory/0016-insight-engine-l6-one-card-slice.md), [memory 0012](../../../memory/0012-brain-adversarial-edge-verification.md) |
| Grounding invariant (no retrieval ⇒ `uncertain`) | Implemented and locally proven | Enforced structurally in schema + `enforceVerification`, not merely documented |
| R2 corpus bucket / D1 index | Configured target; deployment unproven | `apps/nao/wrangler.jsonc:17-29` declares `CORPUS`/`ourobion-corpus` and `DB`/`ourobion-nao-index` with a real-looking `database_id`. A declared binding is not a provisioned resource |
| The 5 custom support models | Planned/research-only; not serving | All five rows in `docs/temp/model-training/README.md:13-20` read "planned; no training" + "research-only; no serving"; `model-roster.md` §8 forbids serving influence. Verified by search: zero imports of `model-training/` from `apps/`, `supabase/`, `shared/`, `tools/brain-ingest` — the only hits are `tools/check_arch_boundaries.mjs`, the CI guard that blocks such imports |

### nao (Z4)

| Component | Label | Evidence |
|---|---|---|
| Next.js console, read + control surfaces | Implemented and locally proven | `apps/nao/src/`; typecheck + 327-test suite (326 pass, 1 platform-skip, 0 fail) |
| Authentication gate (edge JWT verification) | Implemented and locally proven | `src/middleware.ts` — `verifyAccessToken` against project JWKS |
| Authorization: tiered `viewer`/`curator`/`admin` | Implemented and locally proven | `src/lib/authz.ts` closed ranked enum + a `ROUTE_POLICY` matrix over all 14 API method+path pairs; `src/lib/authzServer.ts` `requireRole()` is the first statement of every API handler and re-reads the role from `nao_role()` — never from a JWT claim — enforced by a source-conformance test that fails CI on drift |
| Page-level membership check | Implemented and locally proven | `src/middleware.ts` calls `rpc('nao_role')` for non-`/api/` paths; a Biotope-only account is redirected to `/login?denied=nao` |
| Public `/` explainer | Implemented and locally proven | Static server component outside the `(app)` group, allow-listed in `isPublicPath()` before any config/session/role read; legacy `/how-it-works` redirects to it; zero privileged imports, asserted by source-conformance test |
| Cloudflare Workers deployment + `nao.ourobion.com` route | Configured target; deployment unproven | `wrangler.jsonc:6-55`. There is **no deploy workflow and no `deploy` script anywhere in `apps/nao`**. `apps/nao/README.md:5-6` says it outright: *"a production deployment ... **not yet proven**; do not read the presence of routes as deployment evidence"* |
| Worker secret delivery (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `OUROBION_INTERNAL_SECRET`, `GH_ACTIONS_TOKEN`) | Unknown live external state | Declared **by name only** in `wrangler.jsonc:34-41`; no values committed. `README.md:82-84` states local build proves artifact construction only |

### CI (Z5)

**Defined in cloud CI; latest execution unverified** — for all of it. Two workflows exist:
`ci.yml` (triggers on push/PR to `main`, `dev-phase2`, `dev-phase2-run3`, `dev-phase2-run4`) with jobs
`context`, `flutter`, `typescript`, `node-tools`, `nao`, `deno-check`, `migrations-apply`,
`model-training-core`, `model-training-lint-type`, `arch-boundaries`, `secret-scan`, and the Run-4
release-gate aggregators; and `brain-ingest.yml`, which is `workflow_dispatch` **only** — the sole
workflow doing live network/PDF work, never triggered by a push.

Repo files can prove a workflow is *defined*; they cannot prove the last run was green. That requires
the Actions run history. Note also that `ci.yml:3-6` records that `dev-phase2-run4` is *"intentionally
unprotected by owner decision"* — so a green run is evidence, not a mechanically enforced precondition.

## 3. Personal-data / insight flow

One direction, all inside Z1→Z2. Nothing here traverses Z3/Z4.

```
[Z1] user enters a check-in in Biotope
      │
      ▼
[Z2] daily_gut_rows / antibiotic_courses        ← TRUTH: raw rows, never derive-only
      │  (S2 projection)
      ▼
     metric_daily_values
      │
      ├─► compute-baselines  ──►  baseline_snapshots        ┐
      └─► evaluate-signals   ──►  personal_signals          │ DERIVED PROJECTIONS
                                                            │ (rebuildable, never hand-edited)
[Z2] generate-insights  reads: rules, baseline_snapshots,   │
     personal_signals, metric_daily_values,                 │
     and verified_edges ◄── the brain's PUBLISHED output    │
      │                                                     │
      ▼                                                     │
     composed_insights ──► insight_cards ──► insight_reports/surfaced_cards (S9)
      │                                                     ┘
      ▼
[Z1] InsightService → the card the user reads
```

`verified_edges` is the **only** place brain output touches the personal path, and it enters as a
read of already-published, trust-gated rows — not as a call to nao. Raw rows are truth; everything
downstream of `metric_daily_values` is a rebuildable projection, and the rule is to fix the input and
re-run, never to hand-edit the projection — [memory 0001](../../../memory/0001-two-tier-truth.md).

**Label:** Implemented and locally proven on the local stack. Whether this pipeline is currently
running on a schedule against a hosted project is **Unknown live external state** (see the pg_cron row
in §2).

## 4. Brain publication flow

```
seed → discover/fetch papers → extract → passage selection
   │
   ▼
A8 SYNTHESIS (LLM, OpenAI family)  ──►  RelationshipClaim
   │
   ▼
A9 QUOTE CHECK (deterministic — every span must exist in the source)
   │
   ▼
A10 INDEPENDENT VERIFICATION (must be a DIFFERENT vendor family — decorrelation
    enforced unconditionally at router config load; Anthropic family per C13)
   │   fresh retrieval, adversarial posture, graded trust score
   │
   ├── grounded + corroborated  ──►  supported / partial  ──►  verified_edges  ──►  SERVED
   └── no independent retrieval, or no supporting corroboration
                                 ──►  uncertain  ──►  edge HELD  ──►  NOT SERVED
```

**The honest current state, stated plainly:** the A10 verifier's real decorrelated verdict has never
run. It is blocked on the verifier vendor's key, and the code fails *closed* rather than degrading
quietly — `buildFallbackUncertain()` returns `uncertain` with zero corroboration, and the schema will
not permit `supported`/`partial` without `corroboration.supporting ≥ 1`. The one recorded end-to-end
run produced `uncertain` with `independentRetrieval.performed: true` and `sources: []`, and the edge
was **held, not served**. That is a single observed refusal — not an accuracy rate, and not a
wrong-accept/wrong-reject measurement, which would need the labelled gold set the write-up names as
missing.

**Label:** stages up to and including A9 — Implemented and locally proven. A10 real verdict —
Planned/research-only; not serving.

## 5. nao control flow

```
request
  │
  ├─ / (legacy /how-it-works redirects here) ────► PUBLIC static page. Short-circuits in
  │                                                isPublicPath() BEFORE the env/config read,
  │                                                so a missing config cannot block it.
  │                                                Exposes no corpus state, counts, provider
  │                                                names, role names, controls, or API links.
  │
  └─ protected operations (/overview, /papers, …, /api/*)
       │  1. env/config present?            no ──► /login  (fail closed)
       │  2. session via @supabase/ssr, refreshed onto the response
       │  3. verifyAccessToken() against project JWKS (edge)   no claims ──► /login
       │  4. page routes: rpc('nao_role')   null/error ──► /login?denied=nao
       │  5. /api/* routes: requireRole() as the handler's FIRST statement,
       │        role re-read from nao_role() (never from a JWT claim),
       │        checked against ROUTE_POLICY  ──► 401 no session / 403 insufficient
       ▼
     control surface (Overview, Papers, Claims, Ingest, Loader, Models)
       │
       └─ ingestion trigger ──► GitHub Actions workflow_dispatch (brain-ingest.yml)
```

Two independent enforcement layers, deliberately: the middleware is a UX/defense-in-depth gate, and
each `/api/` handler enforces its own role. **`docs/shared/biotope-nao-link.md` (stamped
`updated: 2026-07-26`) is stale on this point** — it says *"the current middleware enforces
authentication only"* and treats role enforcement as an open blocker. The R4-U2 source is stronger
than that prose: tiered, DB-re-verified, CI-enforced role checks exist. The doc's general warning
("never infer authorization from the current route existing") remains good advice; its specific
factual claim is out of date. Recorded here rather than silently reconciled, because correcting a
canonical doc is its own reviewed change — and the code is what governs either way.

**Label:** Implemented and locally proven.

## 6. Local versus hosted configuration

| Concern | Local (observed 2026-07-30) | Hosted |
|---|---|---|
| Biotope → Supabase | `.env.public` read at startup; only a placeholder template is committed | **No evidence found in repo.** Real values, if any, live as GitHub Actions secrets |
| Postgres schema | 39 migrations apply cleanly to local + a vanilla CI container | Unknown live external state; no link file, no tracked `db push` |
| Edge functions | Type-checked in CI; local `functions serve` probe reached all four handlers | Configured target; deployment unproven (`"scope": "local-only"`) |
| pg_cron settings | Prerequisites documented in each migration header | Unknown live external state — dashboard-only, unobservable here |
| nao runtime | `next build` succeeds locally; `next dev` serves the app | Configured target; deployment unproven — no deploy workflow or script exists |
| R2 / D1 | Bindings declared; `database_id` looks real | Configured target; deployment unproven — a declared binding is not a provisioned resource |
| LLM providers | Router recognises `anthropic`, `openai`, `google`, `agnes`; presence-checked by env var name only. **No key is committed** — independently enforced by the pinned gitleaks `secret-scan` job over worktree *and* full history | Verifier key absent ⇒ fail closed to `uncertain` |

## 7. Deployment evidence

The short version: **there is none, and the repo says so itself.**

- No `deploy.yml` / `release.yml` exists; `.github/workflows/` contains only `ci.yml` and `brain-ingest.yml`.
- No `deploy` script and no `wrangler deploy` invocation exists in `apps/nao`.
- `supabase/deploy-attestation.json`: `"scope": "local-only"`, `"hostedDeployParityClaimed": false`, and a `replayBoundary` stating CI *"does not replay local serve or claim hosted deploy parity."*
- `apps/nao/README.md:5-6`: *"a production deployment and production-grade role/RLS boundary are not yet proven; do not read the presence of routes as deployment evidence."*
- `apps/nao/README.md:159-169` gives operator deploy steps and then states the section *"is an operator outline, not evidence that those hosted steps were executed."*

The one inferential exception, flagged as inference and not evidence: `wrangler.jsonc` carries a
real-looking D1 `database_id` UUID rather than a placeholder, which is consistent with someone having
run `wrangler d1 create` at some point. That is a reasonable guess about history, not proof of a
provisioned or deployed system, and nothing in this document depends on it.

## 8. Limitations

1. **Nothing here is proven in production.** Every "proven" label means locally proven or CI-defined.
2. **The adversarial verifier's real decorrelated verdict has never run.** The system's most
   distinctive claim is the one with the least live evidence; it fails closed to `uncertain`.
3. **One end-to-end run, one held edge.** No accuracy, precision, or recall figure exists, because
   the labelled gold set does not exist yet. A single refusal is not a rate.
4. **No per-edge latency measurement.** Cost is reconstructed locally in aggregate; provider billing
   is authoritative.
5. **CI run history is unverified from files.** Defined ≠ last-run-green.
6. **Hosted Supabase state is unobservable from the repo** — including whether the pg_cron
   prerequisites were ever set, which determines whether projections refresh on a schedule at all.
7. **The five support models are research-only and influence nothing served.**
8. **iOS is unbuilt** (needs Mac + paid Apple account + device), so HealthKit/Apple Sign In are
   untested on real hardware.
9. **`docs/shared/biotope-nao-link.md` is stale** on nao role enforcement (§5) — the code is stronger
   than the prose.
10. **Non-diagnostic by construction, and not a medical device.** Every user-facing string is
    observational and gated by `CopyRules.validateCopyString` —
    [memory 0003](../../../memory/0003-non-diagnostic-copy.md).

## 9. Submission-safe claims

Statements below are supported by the evidence in this document. Use these; do not upgrade them.

**Safe to say:**
- Raw user rows are treated as truth and stored, never derive-only; baselines, signals, and cards are
  rebuildable projections.
- Personal data and evidence data are separated into different trust zones; Biotope and nao do not
  call each other at runtime, and nao does not read user health rows.
- Every synthesised brain claim must survive a deterministic quote check against its source text.
- Verification is designed so a claim cannot be marked supported without independent retrieval and
  corroboration; absent those, the schema forces `uncertain` and the edge is held, not served.
- Decorrelation is enforced structurally: the verifier must run in a different vendor family than
  synthesis, checked at router config load.
- One end-to-end run has been performed; it produced a refusal, and the edge was held.
- nao enforces authentication at the edge and re-reads a tiered role from the database on every API
  call, with a CI test that fails on drift.
- 39 migrations apply cleanly, in order, to a clean Postgres.
- No API key is committed; this is enforced by a pinned secret scan over the full history.
- The system is non-diagnostic by construction.

**Not safe to say** (each would be false or unproven today):
- ~~"Deployed"~~ / ~~"in production"~~ / ~~"live"~~ — for any component.
- ~~"The adversarial verifier validates our edges"~~ — its real verdict has never run.
- ~~"X% accuracy"~~ or any rate — one observation is not a rate.
- ~~"Real-time research"~~ — ingestion is `workflow_dispatch`, manual.
- ~~"Encrypted"~~ — no encryption claim is substantiated anywhere in this repo.
- ~~"Personalised medical advice"~~ — non-diagnostic by construction; the opposite of the design.
- ~~"N studies / papers in the corpus"~~ — no corpus count is published, and counts must never be
  asserted from a configured binding.
- ~~"Custom models improve our results"~~ — all five are research-only and serve nothing.
- ~~"Runs automatically on a schedule"~~ — depends on unobservable dashboard prerequisites.

## 10. Claim → evidence links

| Claim | Evidence |
|---|---|
| Two-tier truth (raw = truth, projections rebuildable) | [memory 0001](../../../memory/0001-two-tier-truth.md); `supabase/migrations/` |
| Non-diagnostic copy is enforced, not aspirational | [memory 0003](../../../memory/0003-non-diagnostic-copy.md); `shared/constants/copy_guidelines.{ts,dart}`; copy-gate tests |
| Adversarial, grounded edge verification | [memory 0012](../../../memory/0012-brain-adversarial-edge-verification.md); `shared/brain/relationships.ts`; `tools/brain-ingest/src/verify/` |
| Verifier verdict is an honest, key-blocked `uncertain` | [memory 0016](../../../memory/0016-insight-engine-l6-one-card-slice.md); `tools/brain-ingest/src/verify/verifier.ts:14-20,154-193` |
| Decorrelation enforced at config load | `tools/llm-router/src/config.ts:112,148-181`; `router.ts:357,391-408` |
| Pipeline + support-model shape | [memory 0013](../../../memory/0013-brain-pipeline-and-support-models-decision.md) |
| Support models are non-serving | `docs/temp/model-training/README.md:13-20`; `model-roster.md` §8; `tools/check_arch_boundaries.mjs` |
| Insight path (tables + functions) | `supabase/functions/evaluate-signals/index.ts`, `generate-insights/index.ts`; [`insight-engine-architecture.md`](../../insight-engine-architecture.md) |
| nao tiered authorization | `apps/nao/src/lib/authz.ts`, `authzServer.ts`; `apps/nao/tests/authz.test.ts` |
| Public explainer leaks nothing | `apps/nao/src/app/page.tsx`; `apps/nao/src/components/OurobionExplainer.tsx`; `apps/nao/tests/howItWorks.test.ts` |
| Local-only deploy posture | `supabase/deploy-attestation.json`; `apps/nao/README.md:5-6,82-84,159-169` |
| CI gate definitions | `.github/workflows/ci.yml`, `brain-ingest.yml` |
| pg_cron manual prerequisites | [memory 0005](../../../memory/0005-pgcron-config-prereqs.md); migrations `20260515100001`, `20260728020000`, `20260728060000` |
| One end-to-end run, held edge | PR #190; [`writeup.md`](./writeup.md) Appendix A + E |
| No committed secrets | `ci.yml` `secret-scan` job (pinned gitleaks, worktree + full history + canary) |
