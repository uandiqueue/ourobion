---
title: Ourobion — system connection map (submission-facing projection)
summary: A submission-facing projection whose counts and verifier labels were re-measured on 2026-08-01 and whose hosted table counts were read directly from Supabase on 2026-08-02; migrations are 44 and workflows 6, the adversarial verifier has produced 14 verified edges of which 11 are servable, and no insight card yet carries producer='edge'.
type: reference
scope: repo
status: draft
updated: 2026-08-02
---

# Ourobion — system connection map

> **DO NOT SUBMIT THIS MAP.** Its counts and verifier labels were re-measured and corrected on 2026-08-01:
> migrations 39→**44**, workflows 2→**6** (two of which cannot be dispatched at all). Corpus counts are now
> stated per tier.
>
> **The A10 verifier row has now moved twice.** It read *"has never run"*, then *"ran, and produced no
> promotable verdict"*, and both are out of date. Hosted state was read directly on **2026-08-02**:
> `relationship_claims 14 · edge_verifications 14 · verified_edges 14, of which 11 are servable ·
> insight_cards 45`. The correct row is **"ran, and produced 11 servable verdicts — none of which has
> become a card."**
>
> One item is still not settled and is why this is not submittable: support-model claims remain
> quarantined behind issue #277. One label was deliberately left un-refreshed rather than guessed: the
> nao test-suite count (§2, Z4).
>
> The defect ledger is
> [`submission-verification-audit.md`](../../../development/run4/submission-verification-audit.md).

> **This document is a submission-facing projection, not architecture authority.**
> It exists so a reader (judge, reviewer, or new contributor) can see the shape of the system and,
> for each part, exactly how strong the evidence behind it is. It is a *rebuildable view*, in the
> sense of the repo's two-tier-truth rule: when it disagrees with the canonical docs or the code, the
> canonical docs and the code win and this file is what gets corrected.
>
> Canonical authorities, in order of precedence:
> - Module graph, data flow, interface rules — [`docs/implemented/biotope/architecture-context.md`](../../../implemented/biotope/architecture-context.md)
> - Cross-language contracts — [`shared/SHARED-CONTEXT.md`](../../../../shared/SHARED-CONTEXT.md)
> - Insight-engine architecture — [`docs/implemented/shared/insight-engine-architecture.md`](../../../implemented/shared/insight-engine-architecture.md)
> - The Biotope↔nao runtime seam — [`docs/implemented/shared/biotope-nao-link.md`](../../../implemented/shared/biotope-nao-link.md)
> - Brain design — [`docs/implemented/nao/brain-synthesis-design.md`](../../../implemented/nao/brain-synthesis-design.md), [`brain-ingestion-design.md`](../../../implemented/nao/brain-ingestion-design.md)
> - Durable facts — [`docs/memory/`](../../../memory/README.md), decisions — [`docs/development/decisions/`](../../../development/decisions/README.md)
> - The write-up this appendix serves — [`writeup.txt`](../submission/writeup.txt)

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
| 44 migrations, 2026-03-13 → 2026-08-01 | Implemented and locally proven | `supabase/migrations/` — recounted 2026-08-01: **44 `.sql` files**, first `20260313_create_profiles_and_consent.sql`, last `20260801091500_surface_edge_verification_caveats.sql`. CI `migrations-apply` shadow-applies all of them in filename order to a throwaway vanilla `postgres:17` container (`ci.yml:293-329`) |
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
| A10 decorrelated adversarial verifier — **real verdict** | Implemented and locally proven (ran); **produced 11 servable verdicts** | Agnes ran for real, provider-attested `agnes-2.5-flash`, decorrelation confirmed by executing `llm-router check-config` (`Decorrelation: OK — synthesis=openai, verifier=agnes`). Hosted on 2026-08-02: **14 `edge_verifications` → 14 `verified_edges`, 11 servable** (8 `high`, 3 `mid`, 3 `hold`). Verdicts: 1 `supported`, 10 `partial`, 2 `uncertain`, 1 `unsupported`; confidence 0.72–0.92. **Since PR #355 the verdict is bound to single-paper fidelity** — `relationships.schema.ts:236,245` now require `directionCheck.matchesClaim` for `supported`/`partial` and its negation for `contradicted`. The earlier `supporting >= 1` rule, and the "zero verified edges is derivable" conclusion built on it, are both gone |
| Verifier retrieval term expansion | **No evidence found in repo** | There is no metric alias map. Retrieval splits snake_case keys on underscores, so `resting_hr_bpm` searches "resting" and "hr" and never "heart rate". Thin corroboration counts therefore measure our lexical coverage, not the literature — do not present a zero corroboration count as a finding about the science |
| Grounding invariant (no retrieval ⇒ `uncertain`) | Implemented and locally proven | Enforced structurally in schema + `enforceVerification`, not merely documented |
| R2 corpus bucket / D1 index | Configured target; deployment unproven (hosted) · Implemented and locally proven (local index) | `apps/nao/wrangler.jsonc:17-29` declares `CORPUS`/`ourobion-corpus` and `DB`/`ourobion-nao-index` with a real-looking `database_id`. A declared binding is not a provisioned resource. The **local** manifest is real and measured (§2a) |
| Corpus volume | Implemented and locally proven (point-in-time) | `data/corpus/papers.jsonl`, 60 MB, counted 2026-08-01: **21,823 records = 20,912 `discovered` + 911 `fetched`**; all 911 fetched carry extracted full text and **894 exceed 5,000 characters**. Keep the three tiers distinct — *discovered* is a metadata hit, *fetched* means the object is held, and only *usable full text* can ground a claim. The corpus was still growing during measurement, so this is a timestamp, not a total. Do **not** quote the ~6,158 figure the deployed console shows; that is a stale hosted projection (Z5) |
| The 5 custom support models | Planned/research-only; not serving | All five rows in `docs/development/model-training/README.md:13-20` read "planned; no training" + "research-only; no serving"; `model-roster.md` §8 forbids serving influence. Verified by search: zero imports of `model-training/` from `apps/`, `supabase/`, `shared/`, `tools/brain-ingest` — the only hits are `tools/check_arch_boundaries.mjs`, the CI guard that blocks such imports |

### nao (Z4)

| Component | Label | Evidence |
|---|---|---|
| Next.js console, read + control surfaces | Implemented and locally proven | `apps/nao/src/`; typecheck + test suite in CI `nao` job. **The test count is deliberately omitted:** the previously quoted "327 tests (326 pass, 1 skip)" was measured at an older head and was not re-run here, so quoting it would be copying an unverified number forward. Re-run at the final integration head before any submission uses a figure. The console has **7 sections** (`SubNav.tsx:11-27`): Overview, Papers, Ingestion, Brain pipeline, Data Loader, Models, Claims |
| nao section-by-section demonstrability | **Mixed — roughly 4 of 7** | Audited 2026-08-01, re-checked 2026-08-02. **Overview** works (local counts; the deployed instance shows a stale figure). **Papers** lists and searches; **paper detail no longer 404s** — PR #354 falls back to `IndexRowDetail` from the D1 row when the R2 object is out of reach, and only 404s if the index row is missing too. It is a *reduced* record, not the full paper object. **Ingestion** renders, but its `RUNNING` badge is `control.paused ? 'PAUSED' : 'RUNNING'` over `DEFAULT_INGEST_CONTROL` (`types.ts:131-136`), which the API returns *when no control document exists in R2* — so `RUNNING` is a hardcoded default displayed identically to observed execution, and observes nothing. **Brain pipeline** cannot dispatch (workflow absent from the default branch, #343). **Data Loader** works only with a UUID pre-registered in `nao_demo_targets`, else 403. **Models** now has real data (`llm_router_status`/`_spend` published). **Claims** now has **14 rows** |
| Authentication gate (edge JWT verification) | Implemented and locally proven | `src/middleware.ts` — `verifyAccessToken` against project JWKS |
| Authorization: tiered `viewer`/`curator`/`admin` | Implemented and locally proven | `src/lib/authz.ts` closed ranked enum + a `ROUTE_POLICY` matrix over all 14 API method+path pairs; `src/lib/authzServer.ts` `requireRole()` is the first statement of every API handler and re-reads the role from `nao_role()` — never from a JWT claim — enforced by a source-conformance test that fails CI on drift |
| Page-level membership check | Implemented and locally proven | `src/middleware.ts` calls `rpc('nao_role')` for non-`/api/` paths; a Biotope-only account is redirected to `/login?denied=nao` |
| Public `/` explainer | Implemented and locally proven | Static server component outside the `(app)` group, allow-listed in `isPublicPath()` before any config/session/role read; legacy `/how-it-works` redirects to it; zero privileged imports, asserted by source-conformance test |
| Cloudflare Workers deployment + `nao.ourobion.com` route | Configured target; deployment unproven | `wrangler.jsonc:6-55`. There is **no deploy workflow and no `deploy` script anywhere in `apps/nao`**. `apps/nao/README.md:5-6` says it outright: *"a production deployment ... **not yet proven**; do not read the presence of routes as deployment evidence"* |
| Worker secret delivery (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `OUROBION_INTERNAL_SECRET`, `GH_ACTIONS_TOKEN`) | Unknown live external state | Declared **by name only** in `wrangler.jsonc:34-41`; no values committed. `README.md:82-84` states local build proves artifact construction only |

### CI (Z5)

**Defined in cloud CI; latest execution unverified** — for all of it. **Recounted 2026-08-01: six workflow
files**, not two — `brain-ingest.yml`, `brain-pipeline.yml`, `ci.yml`, `model-inference.yml`,
`nao-d1-etl.yml`, `run4-u6b-evidence.yml`.

`ci.yml` (triggers on push/PR to `main`, `dev-phase2`, `dev-phase2-run3`, `dev-phase2-run4`) carries jobs
`context`, `flutter`, `typescript`, `node-tools`, `nao`, `deno-check`, `migrations-apply`,
`model-training-core`, `model-training-lint-type`, `arch-boundaries`, `secret-scan`, and the Run-4
release-gate aggregators. `brain-ingest.yml` is `workflow_dispatch` **only** — the sole workflow doing live
network/PDF work, never triggered by a push.

> **Two of the six cannot be dispatched at all — a stronger statement than "execution unverified."**
> `brain-pipeline.yml` and `nao-d1-etl.yml` exist in `dev-phase2-run4` but **not on the default branch**
> (`origin/main` carries only `brain-ingest.yml` and `ci.yml`). `workflow_dispatch` resolves the workflow
> definition from the default branch, so the GitHub API answers **`HTTP 404: workflow not found on the
> default branch`** for both — verified by querying it on 2026-08-01, not inferred from the file layout.
> Consequences: the cloud brain pipeline has never run and currently *cannot* be triggered (#343), and the
> hosted D1 projection cannot be refreshed from CI, which is why the deployed console serves a corpus count
> from an earlier pass. Correct label for both: **Configured target; deployment unproven.**

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

**The honest current state, stated plainly (hosted read 2026-08-02):** the A10 verifier has run under
confirmed decorrelation and **produced servable verdicts**. Two earlier versions of this section are
superseded — one said the verifier had never run, the next said it ran but promoted nothing. Hosted:

| `relationship_claims` | `edge_verifications` | `verified_edges` | `insight_cards` |
|---|---|---|---|
| 14 | 14 | **14 — 11 servable** (8 `high`, 3 `mid`, 3 `hold`) | 45 — 43 `personal`, 2 `rules`, **0 `edge`** |

Verdicts: **1 `supported`, 10 `partial`, 2 `uncertain`, 1 `unsupported`**, confidence 0.72–0.92. Read that
precisely in both directions:

- **What is proven.** The chain runs end to end against a real second-vendor model, from claim through
  independent verification to a trust-banded, servable edge. Three edges are still held at `hold`, so the
  refusal path is live rather than vestigial.
- **What a verdict actually asserts.** Since PR #355 it answers *"is this claim a faithful reading of the
  one paper it cites?"* — checked against quote spans a deterministic gate already proved verbatim. It is
  **not** a judgement that the relationship is true, nor that the literature agrees. Corroboration, impact
  tier and evidence tier are still computed and stored, but they reach the user only through the caveat.
- **What is not proven.** Nothing about accuracy. 14 verdicts with no labelled gold set and no baseline are
  not a rate and not a wrong-accept/wrong-reject measurement.
- **Thin corroboration is our defect, not a fact about the literature.** See the retrieval-alias row in §2.
  Do not narrate low corroboration as "the science does not support this."
- **The last mile is missing.** 11 servable edges and **0 cards with `producer='edge'`**. The capability to
  publish an edge exists and has been exercised; the capability to render one as a card has not.

**Label:** stages up to and including A9 — Implemented and locally proven. A10 real verdict — **ran, and
produced 11 servable verdicts.** Edge→card projection — **built, never executed.**

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
each `/api/` handler enforces its own role.

`docs/implemented/shared/biotope-nao-link.md` used to contradict this — it said *"the current
middleware enforces authentication only"* and treated role enforcement as an open O25 / B-SEC1
blocker. **That prose was corrected on 2026-08-02 and the two now agree**: membership plus tiered,
DB-re-verified, CI-enforced role checks exist (R4-U2). The doc's general warning — "never infer
authorization from the current route existing" — was kept, because it remains good advice. The code
is what governs either way.

**Label:** Implemented and locally proven.

## 6. Local versus hosted configuration

| Concern | Local (observed 2026-07-30) | Hosted |
|---|---|---|
| Biotope → Supabase | `.env.public` read at startup; only a placeholder template is committed | **No evidence found in repo.** Real values, if any, live as GitHub Actions secrets |
| Postgres schema | 44 migrations apply cleanly to local + a vanilla CI container | No link file and no tracked `db push`, so the *schema* provenance is still unobservable from here — but the hosted project is demonstrably reachable and populated: its table counts were read directly on 2026-08-02 (§4) |
| Edge functions | Type-checked in CI; local `functions serve` probe reached all four handlers | Configured target; deployment unproven (`"scope": "local-only"`) |
| pg_cron settings | Prerequisites documented in each migration header | Unknown live external state — dashboard-only, unobservable here |
| nao runtime | `next build` succeeds locally; `next dev` serves the app | Configured target; deployment unproven — no deploy workflow or script exists |
| R2 / D1 | Bindings declared; `database_id` looks real | Configured target; deployment unproven — a declared binding is not a provisioned resource |
| LLM providers | Router recognises `anthropic`, `openai`, `google`, `agnes`; presence-checked by env var name only. **No key is committed** — independently enforced by the pinned gitleaks `secret-scan` job over worktree *and* full history | Verifier key absent ⇒ fail closed to `uncertain` |

## 7. Deployment evidence

The short version: **there is none, and the repo says so itself.**

- No `deploy.yml` / `release.yml` exists. `.github/workflows/` holds six files (§2, Z5), of which only
  `ci.yml` and `brain-ingest.yml` are on the default branch and therefore dispatchable at all.
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
2. **The adversarial verifier has produced 11 servable verdicts, and no card has been made from one.**
   `verified_edges` is 14 with 11 servable; `insight_cards` has **0 rows with `producer='edge'`**. The
   capability to verify and publish an edge has been exercised; the capability to render one as a card has
   not. Those are different claims and this document keeps them apart.
3. **14 verdicts is not an evaluation.** No accuracy, precision, or recall figure exists, because the
   labelled gold set does not exist yet, and there is no baseline to compare the verifier against.
3a. **Verifier retrieval has no alias map**, so corroboration counts measure our lexical coverage rather
   than the literature. Since PR #355 this no longer suppresses verdicts, but it still shapes every caveat.
4. **No per-edge latency measurement.** Cost is reconstructed locally in aggregate; provider billing
   is authoritative.
5. **CI run history is unverified from files.** Defined ≠ last-run-green.
6. **Hosted Supabase state is not observable from the repo itself** — there is no link file or committed
   credential. The counts in §4 were read out-of-band from the hosted project on 2026-08-02 and are
   reproducible only with a credential this repository does not carry. Whether the pg_cron prerequisites
   were ever set — which determines whether projections refresh on a schedule — remains unobservable.
7. **The five support models are research-only and influence nothing served.**
8. **iOS is unbuilt** (needs Mac + paid Apple account + device), so HealthKit/Apple Sign In are
   untested on real hardware.
9. **`docs/implemented/shared/biotope-nao-link.md` was stale** on nao role enforcement (§5) and was
   corrected on 2026-08-02; doc and code now agree. Everything under `docs/implemented/` remains
   `status: unverified` design material by design — read the code for runtime truth.
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
- Verification is designed so a claim cannot be marked supported without independent retrieval having run
  and without the claim matching the direction its cited paper reports; absent those, the schema forces a
  non-servable verdict and the edge is held. Three of 14 edges are so held today.
- Decorrelation is enforced structurally: the verifier must run in a different vendor family than
  synthesis, checked at router config load — and `check-config` reports it satisfied
  (`synthesis=openai, verifier=agnes`), verified by running the tool, not by reading the config.
- Synthesis has run at batch scale: 40 papers, 20 claims over 20 distinct edges, 12 rule blueprints, every
  blueprint carrying a paper citation; API cost per paper is
  `{{PENDING:openai-usd-per-paper}}` pending provider reconciliation.
- The measured blueprint yield is **0.3 per paper**, against a design assumption of 3–5. Stating that the
  assumption was wrong by an order of magnitude is safe; the 3–5 figure is not.
- The adversarial verifier has run against a real second-vendor model across 14 edges and produced
  **11 servable verdicts** (1 `supported`, 10 `partial`); 3 edges are held.
- A verdict asserts **fidelity to the single paper the claim cites**, not that the relationship is true and
  not that the wider literature agrees. Saying more than that is the main overclaim risk in this submission.
- **14 verified edges exist and 0 insight cards have `producer='edge'`.** Both halves are safe to say and
  both should be said together; either alone misleads.
- The 43 `producer='personal'` cards state in their own user-facing copy that they are *"an unverified
  personal observation from your own data only"* and are titled *"Still researching"*. Describing the app as
  drawing that distinction for the user is safe — it is enforced in `PERSONAL_CARD_TEMPLATE`, not aspirational.
- Measured API usage is pending provider reconciliation: OpenAI calls
  `{{PENDING:openai-calls}}`, Agnes calls `{{PENDING:agnes-calls}}`, OpenAI spend
  `{{PENDING:openai-usd}}`, total spend `{{PENDING:total-usd}}`. Agnes is configured at zero per token
  until 2026-08-08.
- nao enforces authentication at the edge and re-reads a tiered role from the database on every API
  call, with a CI test that fails on drift.
- 44 migrations apply cleanly, in order, to a clean Postgres.
- No API key is committed; this is enforced by a pinned secret scan over the full history.
- The system is non-diagnostic by construction.

**Not safe to say** (each would be false or unproven today):
- ~~"Deployed"~~ / ~~"in production"~~ / ~~"live"~~ — for any component.
- ~~"The adversarial verifier validates our edges"~~ / ~~"the science confirms this"~~ — a verdict judges
  fidelity to one cited paper. It is not a validation of the relationship or of the literature.
- ~~"Zero verified edges"~~ — false since 2026-08-02. There are 14, of which 11 are servable.
- ~~"X% accuracy"~~ or any rate — 14 verdicts with no gold set and no baseline is not a rate.
- ~~"21,823 papers"~~ / ~~"our corpus of 21,823 studies"~~ — that is the **record** count, of which only
  **894** have usable full text. Always give the tier. A count without its tier is the single easiest way to
  overstate this system by ~24×.
- ~~"6,158 papers"~~ — the deployed console's figure is a stale projection and cannot be refreshed from CI.
- ~~"Cards are backed by verified research"~~ — **no card has `producer='edge'`.** Verified edges exist, but
  nothing has rendered one. Any "research" card seen in a demo is a hand-authored fixture edge.
- ~~"3–5 blueprints per paper"~~ — a design-time assumption, measured at 0.3.
- ~~"The verifier found the literature does not support this"~~ — thin corroboration comes from a defect in
  our own retrieval code. Absence of retrieval is not evidence of absence in the literature.
- ~~"Real-time research"~~ — ingestion is `workflow_dispatch`, manual.
- ~~"The brain pipeline runs in CI"~~ — `brain-pipeline.yml` is not on the default branch and cannot be
  dispatched at all.
- ~~"Encrypted"~~ — no encryption claim is substantiated anywhere in this repo.
- ~~"Personalised medical advice"~~ — non-diagnostic by construction; the opposite of the design.
- ~~"Custom models improve our results"~~ — they serve nothing, and their figures are quarantined by #277.
- ~~"Runs automatically on a schedule"~~ — depends on unobservable dashboard prerequisites.
- ~~"Edge functions match their attestation"~~ — three of four entrypoint hashes in
  `supabase/deploy-attestation.json` no longer match the tree.

## 10. Claim → evidence links

| Claim | Evidence |
|---|---|
| Two-tier truth (raw = truth, projections rebuildable) | [memory 0001](../../../memory/0001-two-tier-truth.md); `supabase/migrations/` |
| Non-diagnostic copy is enforced, not aspirational | [memory 0003](../../../memory/0003-non-diagnostic-copy.md); `shared/constants/copy_guidelines.{ts,dart}`; copy-gate tests |
| Adversarial, grounded edge verification | [memory 0012](../../../memory/0012-brain-adversarial-edge-verification.md); `shared/brain/relationships.ts`; `tools/brain-ingest/src/verify/` |
| Verifier ran for real and produced servable verdicts | Hosted `edge_verifications` / `verified_edges` (14 rows, 11 servable), read 2026-08-02; `verification-raw.jsonl` for provider attestation |
| `supported`/`partial` require fidelity to the cited paper, **not** a corroboration headcount | `shared/brain/relationships.schema.ts:236` (`directionCheck.matchesClaim`), `:245` (`contradicted` requires its negation). The former `supporting >= 1` rule was removed by PR #355 |
| Corroboration may not exceed retrieved source stances | `shared/brain/relationships.schema.ts` — invented-corroboration upper bounds, untouched by #355 |
| Decorrelation enforced at config load, and satisfied | `tools/llm-router/src/config.ts:112,148-181`; `router.ts:357,391-408`; `router.config.json` (synthesis `gpt-5` / verifier `agnes-2.5-flash`); `llm-router check-config` output |
| Corpus counts per tier | `data/corpus/papers.jsonl` — 21,823 records / 20,912 discovered / 911 fetched / 894 usable full text |
| 20 claims, 12 cited blueprints from 40 papers | `data/corpus/edges/claims.jsonl`, `blueprints.jsonl` (all 12 `provenance.tier: "extracted"` with a `citation`) |
| API calls and spend `{{PENDING:openai-calls}}` / `{{PENDING:agnes-calls}}` / `{{PENDING:openai-usd}}` / `{{PENDING:total-usd}}` | `data/llm-router/ledger.json` pending provider reconciliation; `router.config.json` confirms Agnes `billingMode: "free"` through 2026-08-08 |
| Free-priced node bounded by a journal, not a USD cap | `tools/llm-router/src/attemptJournal.ts` (append-only, hash-chained, reserves before dispatch) |
| Caveats may be model-written, and are kept only when they name a limitation we measured | `tools/brain-ingest/src/verify/caveat.ts` — `chooseCaveat()` returns `source: 'model'` when the model's sentence passes the copy gate **and** `corroboratesAFiredFlag()`; otherwise it falls back to `composeCaveat()`, `source: 'derived'`. Both paths are real and both occur on the stored records |
| Quality-of-backing caveats are reachable at zero corroboration | `caveat.ts` `firedCaveatFlags()` — the `supporting >= 1 \|\| citedPaperAssessed === true` gate. PR #355 added `citedPaperAssessed`, which is what makes a population/direction limitation surface even with no corroborating source |
| Pipeline + support-model shape | [memory 0013](../../../memory/0013-brain-pipeline-and-support-models-decision.md) |
| Support models are non-serving | `docs/development/model-training/README.md:13-20`; `model-roster.md` §8; `tools/check_arch_boundaries.mjs` |
| Insight path (tables + functions) | `supabase/functions/evaluate-signals/index.ts`, `generate-insights/index.ts`; [`insight-engine-architecture.md`](../../../implemented/shared/insight-engine-architecture.md) |
| nao tiered authorization | `apps/nao/src/lib/authz.ts`, `authzServer.ts`; `apps/nao/tests/authz.test.ts` |
| Public explainer leaks nothing | `apps/nao/src/app/page.tsx`; `apps/nao/src/components/OurobionExplainer.tsx`; `apps/nao/tests/howItWorks.test.ts` |
| Local-only deploy posture | `supabase/deploy-attestation.json`; `apps/nao/README.md:5-6,82-84,159-169` |
| CI gate definitions | `.github/workflows/` — 6 files; only `ci.yml` and `brain-ingest.yml` are on the default branch |
| Two workflows undispatchable | `gh run list --workflow=brain-pipeline.yml` and `=nao-d1-etl.yml` → `HTTP 404: not found on the default branch` |
| pg_cron manual prerequisites | [memory 0005](../../../memory/0005-pgcron-config-prereqs.md); migrations `20260515100001`, `20260728020000`, `20260728060000` |
| 14 verified edges, 11 servable, 0 `producer='edge'` cards | [`writeup.txt`](../submission/writeup.txt) Appendix E; §4 above; hosted read 2026-08-02 |
| Personal cards declare themselves unverified to the user | `supabase/functions/generate-insights/render.ts` — `PERSONAL_CARD_TEMPLATE` title *"Still researching: …"* and body *"an unverified personal observation from your own data only"* |
| Attestation drift (3 of 4 entrypoint hashes) | `supabase/deploy-attestation.json` vs the tree; `compute-baselines` still matches |
| No committed secrets | `ci.yml` `secret-scan` job (pinned gitleaks, worktree + full history + canary) |
