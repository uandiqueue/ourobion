---
title: Hackathon MVP · CLOUD lane prompt — hosted demo migration + live nao verification
summary: One-hour brief for the cloud-backend session, which owns the critical path — migrate schema, edge functions, secrets and the brain projection onto the hosted ourobion-demo Supabase project, seed a demo user, and verify live nao at nao.ourobion.com against it. Windows-only, same box as the APP lane.
type: plan
scope: run4
status: draft
updated: 2026-07-28
---

# Hackathon MVP · CLOUD lane — hosted backend (critical path)

Two agent sessions run simultaneously **on the same Windows box** (host `UaNdIQueue`) with the
physical Android phone attached to it. This file is the CLOUD lane. The other session runs
`hack-mvp-prompt-app.md` (APP lane) and owns Flutter, the phone, and the local Supabase stack.

Recommended assignment: give this lane to **Claude Code** — it performs irreversible operations on a
live hosted database and needs judgement about migration-history repair. Give the APP lane to Codex.
Swap only deliberately.

```text
You are the CLOUD lane of a two-session, ONE-HOUR hackathon MVP run on OUROBION PHASE-2 RUN 4.

You are on Windows (host UaNdIQueue). A SECOND AGENT SESSION IS RUNNING ON THIS SAME MACHINE at the
same time, in its own git worktree, and it owns Flutter, the attached Android phone, and the LOCAL
Supabase stack. You own the HOSTED backend and live nao. You are the critical path.

There is NO macOS machine involved. Ignore docs/temp/run4/orchestrator-prompt.md §6 entirely — it
documents a macOS device setup (`/Applications/Docker.app`, `~/Library/Android/sdk`, zsh word-splitting)
for a machine that does not exist. Correcting that doc is a closeout task below.

===============================================================================
0. THE TARGET AND THE HONEST SCOPE
===============================================================================

MVP demo shape the owner (Jayden) wants:
  - the biotope Flutter app, TETHERED to this laptop (not on Play Store), reading the HOSTED
    ourobion-demo Supabase project;
  - nao already LIVE at nao.ourobion.com (Cloudflare Worker), pointed at the SAME project;
  - both apps therefore share one database — that IS the nao/biotope sync, there is nothing to build;
  - separated auth: biotope = end-user Supabase auth; nao = staff cookie session over Supabase JWKS
    with the membership/role boundary. ALREADY BUILT AND MERGED (U2 #177). Verify, do not rebuild.

YOUR JOB: make the hosted project a database both apps work against.

ALREADY TRUE — do not redo:
  - dev-phase2-run4 is at 547280f with the full 5-tab UI (#191) and real knowledge-base counts (#202).
  - nao is deployed and live. It DISPATCHES GitHub Actions (.github/workflows/brain-ingest.yml) for
    ingestion, using GitHub REPO SECRETS (OPENALEX/NCBI/S2/CORE/LENS/R2_*). Provider keys are already
    there. Do NOT move them to Cloudflare env: the Worker needs only GH_ACTIONS_TOKEN and SUPABASE_URL
    as secrets, and R2 (CORPUS) + D1 (DB) are native bindings in apps/nao/wrangler.jsonc.
  - apps/biotope/.env.public.hosted-backup already holds the hosted URL
    (https://bewwvcksgpxoomyjavjp.supabase.co) and its anon key. The APP lane flips to it on your signal.
  - nao NEVER reads SUPABASE_SERVICE_ROLE_KEY — a source-conformance test in apps/nao/tests/authz.test.ts
    enforces it. Never introduce it, never expose any server key to Flutter or a NEXT_PUBLIC_* var.

AUTHORIZATION — record it BEFORE touching hosted. Run 4's standing boundary forbids hosted Supabase
writes; docs/temp/run4/pending-build-register.md B-PL19 requires "Jayden's separate approval of named
isolated rehearsal resources". Jayden has now directed this migration for the hackathon MVP. FIRST
ACTION: append that decision to docs/temp/run4/human-decisions.md — date, exact scope (apply
migrations + deploy functions + load projection + seed a demo user on bewwvcksgpxoomyjavjp), and the
limits below. Do not proceed on an unrecorded approval.

LIMITS THAT STILL HOLD:
  - Demo project bewwvcksgpxoomyjavjp ONLY. Never touch the clean reserve jscxvnettbvkboijczav.
  - NO real personal health rows. Simulated demo data only, kept flagged as simulated.
  - This is a DEMO REHEARSAL, not a release promotion. No immutable release, no O29 claim.
  - Never weaken a cap, gate, test, scanner, RLS policy or assertion to make something work.
  - No live LLM/provider calls. Do not touch model-training/.
  - Never claim production readiness or scientific validation.

===============================================================================
1. TIMEBOX — the migration is the risk; start it first
===============================================================================

T+00–05  Worktree + environment; record the authorization decision
T+05–25  Hosted schema: link, reconcile migration history, push 30 migrations
T+25–35  Edge functions + secrets on hosted; verify with real HTTP invokes
T+35–45  Brain projection load + seed the demo user + derive; VERIFY ROWS EXIST
T+45–52  Signal the APP lane "HOSTED READY", then verify live nao against hosted
T+52–60  Record decisions, session log, --fix-index, push

STOP RULE: if the hosted schema is not pushed by T+30, STOP the cloud path and tell the APP lane to
demo against its LOCAL stack, which already works. A local demo that runs beats a cloud demo that
half-loads. Say so plainly; do not burn the hour on a half-migrated database.

===============================================================================
2. T+00–05 · SAME-BOX SETUP (two agents, one filesystem)
===============================================================================

Work in your OWN worktree so the other session's Flutter runs and generated-file churn cannot touch
your tree (AGENTS.md §7):
  node tools/setup_agent_worktree.mjs --branch chore/hack-mvp-hosted-demo \
    --path <abs path OUTSIDE the repo> --base dev-phase2-run4

Per PowerShell shell, activate the bounded toolchain — node and flutter are NOT on the base PATH:
  . .\scripts\biotope-env.ps1
Git Bash has NO node, so `git push` from bash dies in .githooks/pre-push
(`node tools/context_sync.mjs --check` → "node: command not found"). PUSH FROM AN ACTIVATED POWERSHELL.
deno is absent on this box; you do not need it for this lane.
Supabase CLI is repo-local: node_modules\.bin\supabase (2.81.2).

NEVER run `flutter` anything. The APP lane owns Flutter and the phone; a stray `flutter test` here
dirties 7 generated plugin files with line-ending-only diffs and can lock the device.
NEVER run `supabase start`, `supabase stop`, or `supabase db reset`. Docker containers are
machine-global (supabase_db_ourobion) and the APP lane owns the LOCAL stack. You touch HOSTED ONLY.

git fetch origin --prune   # integration tip should be 547280f or later

===============================================================================
3. T+05–25 · HOSTED SCHEMA — the risky step
===============================================================================

30 migrations live in supabase/migrations/ (20260313_… through 20260728050000_knowledge_base_stats_rpc).
B-PL19 recorded a 2026-07-26 read-only probe: Auth and PostgREST answered on bewwvcksgpxoomyjavjp but
THE RUN-2 BRAIN TABLES WERE ABSENT. Expect a PARTIALLY populated schema and a migration-history
mismatch. This is the single most likely thing to eat the hour.

  node_modules\.bin\supabase link --project-ref bewwvcksgpxoomyjavjp
  node_modules\.bin\supabase migration list        # compare local vs remote BEFORE pushing

RULES:
  - NEVER `supabase db reset` against hosted. It destroys data.
  - Snapshot/back up first (dashboard, or `supabase db dump`) so you can retreat.
  - On history mismatch use `supabase migration repair --status applied <version>` ONLY for migrations
    whose objects genuinely already exist remotely. Verify each before claiming it. No blanket repair.
  - If a migration fails mid-chain, read the error. Duplicate-object → repair. Genuine dependency
    error → order matters. Do NOT edit or renumber a committed migration to make it pass; that breaks
    every other environment.
  - After pushing, reload PostgREST or new RPCs 404 even though the SQL exists:
      NOTIFY pgrst, 'reload schema';
    Skipping this is exactly what would silently break the #202 Home knowledge-base counts
    (get_knowledge_base_stats) and look like a UI bug.

VERIFY, do not assume. Confirm remotely that what biotope actually calls exists: get_knowledge_base_stats,
the insight-card tables including the 'archived' status, baseline snapshots, profile prefs / daily
digest, and the brain edge/serving projection tables.

===============================================================================
4. T+25–35 · EDGE FUNCTIONS AND SECRETS ON HOSTED
===============================================================================

  node_modules\.bin\supabase functions deploy <name> --project-ref bewwvcksgpxoomyjavjp
for the functions the demo path needs (compute-baselines, generate-insights, and
evaluate-signals / run-pipeline if used).

Set function secrets on hosted:
  node_modules\.bin\supabase secrets set OUROBION_INTERNAL_SECRET_CURRENT=<43-char base64url> ...
These functions REQUIRE the header X-Ourobion-Internal-Secret. A plain service-role key returns 401
BY DESIGN — that is the O25 boundary working. Never relax the check to make a call succeed.

Any LLM key belongs in SUPABASE function secrets or the existing GitHub Actions secrets — NOT in
Cloudflare env, which cannot reach a Supabase edge function. Live provider calls remain outside Run 4
authority: use the deterministic rule engine plus already-loaded brain edges, and say so on stage.

Verify every function with a real HTTP invoke against hosted and paste the actual response.

===============================================================================
5. T+35–45 · DATA THE DEMO NEEDS
===============================================================================

(a) Brain projection — Insights needs real research edges. Load the pinned R2 edge JSONL into the
    hosted serving projection with tools/edge-loader (`--from-r2`). B-PL19 notes it reads MUTABLE R2
    keys with no exact migration ledger; acceptable for a demo, but RECORD which keys you loaded so
    the demo is reproducible.
(b) Demo user + 21 days of simulated history. You cannot `docker exec` into hosted — run
    scripts/seed-test-data.sql through psql against the hosted connection string, passing the same
    variables the local path uses:  -v email=<demo user> -v days=21
    The demo user must be a real Supabase auth user on hosted so the app can log in.
(c) Derive: invoke compute-baselines, then generate-insights, against hosted.
(d) KNOWN GAP: tools/rules cannot run on a clean clone — shared/rules/rule.schema.ts imports `zod`,
    declared neither in tools/rules/package.json nor at the repo root. Work around with
    `npm install --no-save zod` at the repo root. DO NOT COMMIT that.

DO NOT hand-edit derived baseline/insight/engagement/brain rows. Raw user rows are truth — fix the
input or the logic and re-run. A hand-edited projection is a fabricated demo.

VERIFY ROWS EXIST before signalling. Query hosted and paste the counts.

===============================================================================
6. T+45–52 · SIGNAL THE APP LANE, THEN VERIFY LIVE NAO
===============================================================================

Tell the APP lane: "HOSTED READY — bewwvcksgpxoomyjavjp, demo user <email>, N insight cards,
M baselines." It then swaps apps/biotope/.env.public for .env.public.hosted-backup and runs on the phone.

Then verify https://nao.ourobion.com against the same project:
  - staff login works; the cookie session validates against Supabase JWKS;
  - the membership/role boundary holds — a non-member sees nothing and global-job responses stay
    redacted (merged U2 #177 behaviour);
  - Overview reflects the hosted data you just loaded;
  - the Models panel renders — BE HONEST ABOUT WHAT IT IS: a READ-ONLY PROJECTION of
    tools/llm-router/router.config.json + the budget ledger, published by
    `tools/llm-router npx tsx scripts/publish-status.ts`. nao does NOT write router config today. If
    the numbers look stale, republish the projection; do not invent a write path in this hour.
  - Run-now dispatch: nao calls brain-ingest.yml's workflow_dispatch via GH_ACTIONS_TOKEN — confirm the
    Worker secret is present. B-UI6 records that the Run-now dropdown ignores db seeds; that is a
    deliberate deferral, so do not present it as fully wired.
  - If the live Worker points at a different Supabase URL, update the SUPABASE_URL secret
    (`wrangler secret put`) plus the public URL/anon pair and redeploy. Verify before changing anything.

===============================================================================
7. CONDITIONAL — only if the APP lane needs to land a code hotfix
===============================================================================

Nothing can land right now: tools/run4_release_gate.mjs:51 still pins
RUN4_UNIT_BASE_SHA = ff0546434f081cadc3e5683217d484f250c19139, which PREDATES #191, so every landing
delta is charged for the 7,670 merged UI lines and blows the 115-path / 8,500-line cap.

If and only if a demo-blocking code fix must land, advance the base exactly as PR #197 did: set
RUN4_UNIT_BASE_SHA to the real tip, update .github/workflows/ci.yml IN LOCKSTEP (otherwise the gate
fails with "run4-release landing constants drifted"), re-record the attestation THROUGH THE TOOL
(never hand-edit), and prove the gate still fails closed with injected negatives. Caps stay 115 / 8,500.
The attestation needs deno pinned to 2.8.1, which is NOT installed on this box:
  irm https://deno.land/install.ps1 | iex        # then confirm `deno --version` is exactly 2.8.1
If you cannot get exactly 2.8.1, do not fudge recorded hashes — report it as blocked.

Two CI failures that are NOT code defects: (a) "synthetic merge parents do not match current event
base/head" — the base moved; RE-RUNNING CANNOT FIX IT (a re-run replays the same immutable event
payload), so merge origin/dev-phase2-run4 in and push; (b) "binary/unparsable diff row" —
checkLandingDelta fails closed on rewritten files under apps/biotope/assets/. Both guards are deliberate.

Config-only changes may not be tracked at all — check `git check-ignore -v apps/biotope/.env.public`
before assuming a PR is needed.

===============================================================================
8. CLOSEOUT
===============================================================================

Also fix the doc defect: docs/temp/run4/orchestrator-prompt.md §6 prescribes a macOS setup for a
machine that does not exist. Replace it with the real Windows setup (`. .\scripts\biotope-env.ps1`,
push from PowerShell, deno absent, adb at C:\project\biotope-toolchain\android-sdk\platform-tools).

Write exactly one docs/sessions/<UTC>-uandiqueue-claude-hack-mvp-hosted-demo-migration.md with
Attempted / Changed / Decided / Left / Blockers AND a `memory:` line. Include:
  - the exact migration-history reconciliation performed, and every `migration repair` you claimed;
  - which R2 keys the projection came from;
  - what is loaded on hosted and what is not;
  - that this is a demo rehearsal on bewwvcksgpxoomyjavjp under Jayden's recorded approval, NOT a
    release promotion, and that B-PL19's missing pieces (exact migration ledger, immutable namespace,
    checksummed promotion, rollback, cross-environment verdict policy) still do not exist.
Then `node tools/context_sync.mjs --fix-index` and PUSH FROM AN ACTIVATED POWERSHELL.

Report: hosted schema state, function invoke output, row counts, nao verification results, and
anything still blocking the APP lane. Stop before any release promotion.
```
