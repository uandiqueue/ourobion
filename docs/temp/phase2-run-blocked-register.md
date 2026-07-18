---
title: Phase-2 Run — Blocked-Items Register
summary: Every item the automated Phase-2 run skipped because it needs Jayden — where in the workflow it stopped, exactly what unblocks it, and what downstream work it gates. Companion to phase2-run-orchestration-log.md.
type: plan
scope: shared
status: canonical
updated: 2026-07-18
---

# Phase-2 Run — Blocked-Items Register

Each entry: **where it stopped · what is needed from Jayden · what it gates**. The run skips these and
keeps building; when an item unblocks, the orchestrator picks it up from here.

## B1 · dev-phase2 → main fold — **DONE / CLOSED 2026-07-18**
- **Resolution:** the fold HAPPENED — `origin/main` now carries the consolidation including the
  workflows, via **PR #41**. The `workflow_dispatch` gate this item tracked (brain-ingest.yml absent
  from the default branch) is therefore lifted.
- **Note:** the discrepancy recorded below was real at the time of writing (main was at the initial
  commit when the run started); PR #41 subsequently closed it. The NEXT fold — carrying the Phase-2
  chain U1–U18 to `main` — is a separate future gate and depends on B13 + the B8 retro-review.
- <details>original entry: stopped at ready-to-execute merge; needed Jayden's explicit go; gated
  nao's "Run now" ingestion trigger; session log `20260713T033718Z` had claimed the fold early.</details>

## B2 · Cloudflare provisioning for nao
- **Stopped at:** nao deploys need an authenticated Cloudflare account owning the D1 DB
  (`database_id 1c7d3a80-baa5-47f5-bdcb-9137b19e91ee`), the R2 corpus bucket, and the `ourobion.com`
  zone (`nao.ourobion.com` route).
- **Needs:** `wrangler login` on this machine (interactive — run `! npx wrangler login` yourself), or an
  API token with Workers+D1+R2 rights.
- **Gates:** nao remote deploy, remote D1 index rebuild (`wrangler d1 execute … --remote` + `npm run etl -- --remote`),
  paper-detail pages (R2 binding is empty under local `next dev`), any live "Run now" test.

## B3 · nao Worker secrets + Supabase login user
- **Stopped at:** Worker secrets are set with `wrangler secret put`, never committed.
- **Needs:** `GH_ACTIONS_TOKEN` (fine-grained PAT, Actions read/write, repo-scoped); confirm `GH_REPO`
  var; Supabase URL + anon key as Worker vars; one manually-created nao login user in the Supabase
  project (no public signup).
- **Gates:** authenticated nao UI end-to-end, ingestion dispatch from the UI.

## B4 · GitHub repo secrets for `brain-ingest.yml`
- **Stopped at:** the Actions workflow writes `.env` from repo secrets; set by hand in repo settings.
- **Needs:** confirm/set `INGEST_CONTACT_EMAIL`, `OPENALEX_API_KEY`, `NCBI_API_KEY`, `CORE_API_KEY`,
  `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`; optional `S2_API_KEY`,
  `LENS_API_KEY` for fuller source coverage.
- **Gates:** hosted (Actions) ingestion runs. Local ingestion with a local `.env` is unaffected.

## B5 · API keys for the LLM api-worker route
- **Stopped at:** the router (U3) ships with both routes, but the api-worker route has no keys.
- **Needs:** an **Anthropic** API key (headless synthesis/phrasing) and — hard requirement for real
  adversarial verification — a **non-Anthropic** frontier key (**OpenAI or Google**; the verifier must
  be a different vendor family than the Claude synthesis node, per memory 0012/0013). Also your
  sign-off on the verifier model id (config decision C6).
- **Gates:** real (non-fixture) A10 verification runs; headless/scaled pipeline runs. **Not** gated:
  in-session runs via the local-agent route (keyless), fixture-tested scaffolds.

## B6 · GMI GPU credits
- **Stopped at:** support models a (NLI claim-support), b1 (study-design→tier), c (relation tagging) are
  design + data-prep complete; training needs a GPU.
- **Needs:** GMI credits provisioned.
- **Gates:** support-model training only. b2 (venue lookup) needs no training and is in the worklist (U4).
  Cold-start substitute: the frontier LLM inside A8/A10 (already the plan).

## B7 · Apple Developer Program (US$99/yr) + Mac/iPhone
- **Stopped at:** Phase 2→3 gate decision, per plan.
- **Needs:** purchase decision at the gate.
- **Gates:** HealthKit end-to-end + Apple Sign-In. Android path fully unblocked meanwhile.

## B8 · 2-reviewer review of `shared/` contract PRs
- **Stopped at:** policy (memory 0002) requires 2 human reviewers on `shared/` changes; an autonomous
  run cannot satisfy it, so shared-touching session PRs are self-merged into `dev-phase2` and **flagged
  here for retroactive review** (sign-off decision D1).
- **Needs:** you (+ Alton) retro-review the PRs listed in the orchestration-log session ledger with the
  `shared/` flag before any `dev-phase2 → main` fold.
- **Gates:** nothing during the run; the fold to `main` should wait on it.

## B9 · Hosted Supabase pg_cron config
- **Stopped at:** production pushes of pg_cron migrations silently fail unless `app.supabase_url` +
  `app.service_role_key` are set in the Supabase dashboard first (memory 0005).
- **Needs:** set the two dashboard config values on the hosted project before any prod `db push`.
- **Gates:** the nightly engine cycle on the hosted stack (stress-test criterion 5). Local stack unaffected.

## B10 · Real Android device verification (W1)
- **Stopped at:** Health Connect end-to-end needs a physical device.
- **Needs:** a session with a real Android phone (plus the `MainActivity extends FlutterFragmentActivity` fix applied first).
- **Gates:** metric Wave 4 (wearable/CGM) promotion; W1 device verification. Emulator work unaffected.

## B11 · SJR quartile dataset for b2 venue banding
- **Stopped at:** b2 shipped OpenAlex-only; `sjrQuartile` is a typed optional input with OR-semantics in
  the banding (config C8). The design doc names scimagojr.com as the SJR source but no dataset is in the
  repo.
- **Needs:** your call on vendoring a SCImago CSV snapshot (license/redistribution check) or an
  alternative quartile source.
- **Gates:** nothing hard — banding works from OpenAlex h-index alone; SJR just sharpens the
  high/moderate boundary.

## B12 · Branch-protection required checks for the new CI matrix
- **Stopped at:** U18 added the six `Node tools — tools/*` CI checks; U27 added four more —
  `Deno — compute-baselines` / `Deno — evaluate-signals` / `Deno — generate-insights` and
  `Migrations — shadow apply (postgres:17)`. Making them *required* is a repo settings change
  (Settings → Branches → dev-phase2 protection rule).
- **Needs:** you to add the ten new check names (six node-tools + four U27) to the
  required-checks list (2 minutes).
- **Gates:** nothing hard — the checks run on every PR regardless; requiring them just makes the
  14-PR merge queue unbypassable.

## B13 · dev-phase2 recovery merge (the reverse-cascade fix)
- **Stopped at:** the 2026-07-16 hand-merge of the 15-PR stacked chain cascaded upward (PRs #43–#71
  merged into their stacked PARENT branches; only #43 reached `dev-phase2`). The full chain
  (28 commits, U1–U18) sits on `feat/shared/l6-one-card-slice`; the recovery PR
  (**#72**, base `dev-phase2`, head `feat/shared/l6-one-card-slice`) is open and merges it
  in one click — see sign-off decision D20.
- **Needs:** Jayden to merge the recovery PR. One click.
- **Gates:** everything downstream of `dev-phase2` — CI on `dev-phase2`, future sessions cutting
  from `dev-phase2`, and the next `dev-phase2 → main` fold. Until it merges, new units stack on the
  chain tip (currently `chore/run/chain-recovery-docs-move`) instead of `dev-phase2`.
