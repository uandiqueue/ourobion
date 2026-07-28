---
title: Phase-2 Run 4 continuation orchestrator prompt
summary: Paste-ready continuation authority for resuming Run 4 after the UI integration and Home design alignment, covering current PR state, the two non-defect CI failure modes, macOS device setup, and the remaining unit queue.
type: plan
scope: shared
status: canonical
updated: 2026-07-28
---

# Phase-2 Run 4 continuation orchestrator prompt

When the human says `run docs/temp/run4/orchestrator-prompt.md`, execute the block below. That
command is explicit authorization to resume local Run 4 within the recorded boundaries. It is not
authorization for hosted writes, deployment, production promotion, model training, or merges outside
`dev-phase2-run4`.

```text
You are the lead orchestrator for OUROBION PHASE-2 RUN 4.

This is a CONTINUATION. Do not rebuild merged units. Work continuously until the queue below is
done, or until a genuine external prerequisite blocks every remaining path.

===============================================================================
1. AUTHORITIES AND STARTUP
===============================================================================

Read and obey, in order:

1. AGENTS.md — the single source of truth for this repo.
2. docs/INDEX.md — the doc map.
3. docs/temp/run4/continuation-status.md — the live cockpit.
4. docs/sessions/20260728T063000Z-agentjwork-claude-run4-ui-device-defects-and-home-design.md
   — the most recent session; it explains everything below in detail.
5. Run `node tools/context_sync.mjs --session-start` and read the newest session logs.

Then refresh live state yourself — never trust this file over reality:
  gh pr list --state open --json number,title,headRefName,isDraft
  git fetch origin --prune && git log --oneline -3 origin/dev-phase2-run4

A repo hook will insist you run `graphify` before reading code. It is NOT installed on macOS
(`command not found`). Ignore the hook; use git/grep/read directly.

===============================================================================
2. WHERE THINGS STAND (2026-07-28)
===============================================================================

Integration tip: 9164458 (merge of PR #197).
Gate base: RUN4_UNIT_BASE_SHA = ff0546434f081cadc3e5683217d484f250c19139, caps 115 paths /
8,500 added lines, set in BOTH tools/run4_release_gate.mjs and .github/workflows/ci.yml.

MERGED
  #197  gate-base advance. This unblocked the whole queue: the old base c558c04 was charging every
        unit for already-merged work. #191 fell from a reported 13,449 added lines to a real 6,436
        with no code removed.

GREEN, UNMERGED, NEEDS A HUMAN
  #191  canonical full UI. 19/19 green, MERGEABLE, CLEAN. Contains #175 — NEVER land both.
  #202  knowledge-base counts + Home design alignment. Stacked on #191; merge #191 first.

  Both are blocked ONLY because `gh pr merge` is refused by the local permission classifier. Ask
  the human to run it. Do not try to work around the refusal.
  #191 also still needs the TWO-REVIEWER signoff recorded on its shared/types/index.ts change
  (InsightCard.status gains 'archived'). Jayden + Alton are the named reviewers. Test evidence does
  not substitute for review.

NOT STARTED — your queue
  #200  Archive tab: trend data alongside past insights.
  #201  Scan tab: scanning-motion restyle.

STILL OPEN FROM THE ORIGINAL QUEUE (untouched by the last session)
  #180/#170 U1 security; #185/#186 U2 corrections; #184 U3 loader; #176 U5 + #190 evidence; U4.
  #180 is STALE-BASED: its merge-base predates the merged U2, so its diff currently DELETES
  authz.ts, authzServer.ts, internal_auth.ts, the nao_* migrations and supabase/tests/authz/**.
  Rebase it before doing anything else with it.

===============================================================================
3. TWO CI FAILURES THAT ARE NOT CODE DEFECTS — read before debugging any red
===============================================================================

(a) "synthetic merge parents do not match current event base/head"
    The base branch moved between the PR event firing and GitHub recomputing the merge ref, so the
    event's recorded base.sha is stale.
    RE-RUNNING DOES NOT FIX IT — a re-run replays the same immutable event payload. This was
    confirmed by trying it and getting byte-identical SHAs back.
    FIX: merge origin/dev-phase2-run4 into the branch and push. That fires a fresh event.
    #176 is recorded as "unstable — release job rejects mismatched synthetic-merge parents". That
    is very likely this, not a defect in #176. Check before assuming the code is broken.

(b) "binary/unparsable diff row"
    checkLandingDelta fails closed on any binary row. Anything under apps/biotope/assets/ that is
    REWRITTEN (not merely added) triggers it. That guard stops unreviewed binary payloads landing.
    DO NOT weaken it. Changing it needs a recorded human decision.

===============================================================================
4. LANDING BUDGET — CHECK THIS BEFORE YOU PLAN
===============================================================================

PR #202 already measures 57 paths / 7,670 added lines against 115 / 8,500. Roughly 830 lines of
headroom remain on the current base.

So: once #191 and #202 merge, ADVANCE THE GATE BASE AGAIN before starting #200 or #201, exactly as
PR #197 did — set RUN4_UNIT_BASE_SHA to the new tip, update ci.yml in lockstep, re-record the
attestation THROUGH THE TOOL (never hand-edit it), and re-prove the gate fails closed with injected
negatives. tools/run4_release_gate.mjs:27-39 documents this per-unit convention.

Re-recording the attestation needs a local `supabase functions serve` probe; see §6.

===============================================================================
5. YOUR QUEUE
===============================================================================

Do #200 then #201. One issue, one branch, one worktree, one PR each (AGENTS.md §7):
  node tools/setup_agent_worktree.mjs --branch <name> --path <abs path OUTSIDE the repo> --base dev-phase2-run4

#200 — ARCHIVE: TRENDS + PAST INSIGHTS
  archive_tab.dart only calls getArchivedInsights(userId) and renders saved cards. Add historical
  metric trends so the tab is a real look-back surface.
  Keep the archived-card round trip and the `archived` status contract intact —
  insight_status_contract_test.dart and archive_status_widget_test.dart must stay green.
  REAL DATA ONLY. If a metric has no history, say so plainly; never draw an empty chart that
  implies data. Reuse m5a_baselines/impl/chart_math.dart rather than re-deriving axis math.

#201 — SCAN: SCANNING-MOTION RESTYLE
  Scan is ALREADY the log tab: inline chip answers (_InlineChipRow.onAnswer), a full-log route
  (onOpenFullLog), gap cards, channel rows, and an existing orb animation. This is a RESTYLE, NOT A
  REBUILD. Do not replace the logging behaviour.
  Build the sweep from the design's `scanSweep` keyframe.
  EnvironmentRow renders NOT BUILT with an honest explanation and DELIBERATELY has no onTap, no
  GestureDetector and no focusable descendant. KEEP THAT. Never make an unbuilt channel look
  operable.
  Gate continuous animation on MediaQuery.disableAnimations.

THE DESIGN FILE
  The Claude Design export ("Biotope Biomech Botanical.dc.html" + support.js + assets/) is supplied
  BY THE HUMAN out of band — ask for the zip. It is deliberately NOT committed: its text alone is
  ~2,763 lines, which would blow the landing cap, and its PNGs would trigger the binary-diff guard.
  10 of its 11 referenced images ALREADY EXIST in the repo under
  apps/biotope/assets/images/generated/biomech_botanical/<category>/ — map design asset names onto
  BiotopeGeneratedAssets rather than re-adding files. Only biotope-mark-light.svg has no local
  counterpart (the repo has logo.png).

===============================================================================
6. DEVICE SETUP (macOS) — machine-local, does not travel between devices
===============================================================================

- deno is required by the release gate and is NOT installed by default. Install the pinned version:
    curl -fsSL https://deno.land/install.sh | DENO_INSTALL="$HOME/.deno" sh -s v2.8.1
  It must be 2.8.1: CI pins it, and the attestation's module-graph hashes must match.
- Docker Desktop's credential helper is not on PATH, so `docker run` fails with
  "docker-credential-desktop not found". Prefix with:
    export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
  The authz and profile_prefs harnesses need this — they spin disposable postgres:17 containers.
- adb lives at ~/Library/Android/sdk/platform-tools/adb and is not on PATH; `flutter devices` will
  not see the phone until it is. Note zsh does NOT word-split unquoted variables, so
  `A="adb -s X"; $A shell ...` fails — write adb commands out in full.
- The repo-local Supabase CLI is node_modules/.bin/supabase (2.81.2).
- Local seeding:
    docker exec -i supabase_db_ourobion psql -U postgres -d postgres -v email=<user> -v days=21 \
      < scripts/seed-test-data.sql
  then invoke compute-baselines and generate-insights. Those functions require the header
  `X-Ourobion-Internal-Secret` (43-char base64url) with OUROBION_INTERNAL_SECRET_CURRENT set in the
  serve env — a plain service-role key returns 401 by design.
- After applying new migrations to the local stack run `NOTIFY pgrst, 'reload schema';`, or
  PostgREST will 404 new RPCs even though they exist in SQL.
- KNOWN GAP: tools/rules cannot run on a clean clone — shared/rules/rule.schema.ts imports `zod`,
  declared neither in tools/rules/package.json nor at the repo root. Work around with
  `npm install --no-save zod` at the repo root. Blocks local insight-engine seeding until fixed.

===============================================================================
7. NON-NEGOTIABLE BOUNDARIES
===============================================================================

- All issues, branches, PRs and merges target dev-phase2-run4 ONLY. Never dev-phase2, never main.
- Never weaken a cap, test, guard, scanner or assertion to make CI green. If an envelope genuinely
  must change, record the exact human decision and add negative tests.
- No hosted Supabase write, deployment, production traffic, key mutation, model promotion, or
  scientific-validation claim. No model training; do not touch model-training/.
- No live LLM/provider calls. Issue #189's bounded test is closed and did not unblock O29.
- shared/ contract changes require TWO reviewers recorded on the actual PR.
- Raw user rows are truth. Never hand-edit derived baseline/insight/engagement/brain projections —
  fix the input or the logic and re-run.
- Every user-facing string must pass CopyRules.validateCopyString (non-diagnostic).
- NO FAKE CONTROLS. A surface that cannot report must say so, not simulate activity. The last
  session removed a hardcoded three-line "knowledge base" ticker that implied live indexing with
  nothing behind it. Do not reintroduce that pattern anywhere.

===============================================================================
8. VERIFICATION
===============================================================================

For every changed surface, run and PASTE ACTUAL OUTPUT:
  cd apps/biotope && flutter analyze && flutter test
  node tools/context_sync.mjs --check
  node --test tools/run4_release_gate.test.mjs && node tools/run4_release_gate.mjs config
  supabase/tests/authz/run.mjs           (when migrations/auth/preference RPCs change; 443/443)
  supabase/tests/profile_prefs/run.mjs   (34/34)
  node tools/run4_release_gate.mjs landing --base <base> --head HEAD --max-paths 115 --max-added 8500

CI GREEN IS NOT ENOUGH FOR UI WORK. The last session found THREE defects that shipped with a clean
`flutter analyze` and 176 passing widget tests:
  1. the Home grid overflowed 9.5px on a real 1080x2340 device — childAspectRatio derived cell
     HEIGHT from tile WIDTH, but tile content height is fixed, so it was worse on narrower phones;
  2. the Profile tab hung on a spinner permanently — no try/catch in _load(), and the tab is kept
     alive in an IndexedStack, so it could not recover for the whole session even after the backend
     came back;
  3. NONE of the 25 generated PNGs shipped — a Flutter asset directory entry is NOT recursive, and
     every Image.asset fell through to an errorBuilder whose hero fallback is an invisible SizedBox,
     so the app looked deliberate while shipping none of its artwork.
ALWAYS build to the physical Android device and LOOK AT IT.

Before pushing: write exactly one docs/sessions/<UTC>-<device>-<agent>-<slug>.md with
Attempted / Changed / Decided / Left / Blockers AND a `memory:` line, then run
`node tools/context_sync.mjs --fix-index`. The pre-push hook and CI fail without the session file.

===============================================================================
9. KNOWN DEBTS ALREADY RECORDED (do not rediscover these as new)
===============================================================================

- Asset weight: the 25 generated PNGs total ~31MB at up to 1535x1024 for views a few hundred
  logical px wide. Downscaling was measured at 31MB -> 7.9MB with no visible difference, but it
  rewrites blobs already on the integration branch and therefore trips the binary-diff guard. It
  needs its own change plus a human decision. Left as a SKIPPED test group in
  apps/biotope/test/core/asset_bundling_test.dart naming that reason.
- MetricTile still overflows at a 1.6x accessibility text scale (17px horizontal, 15px vertical)
  because of its fixed type scale. Pre-existing, independent of the grid fix, deferred O28. Left as
  a skipped test with the reason in its name.
- home_hero_robot_hand_main.png is RGB with NO alpha — an opaque rectangle, not a cutout. It is
  currently clipped and feathered with a ShaderMask. A transparent-background asset would make the
  mask a no-op and is the real fix.
- Raw edgeId still renders verbatim in provenance (insight_card_visual.dart) — deferred O28.
- O28 is NOT complete merely because the reskin added accessibility work.

===============================================================================
10. CLOSEOUT
===============================================================================

Report shipped work, the actual commands and results, what is held or deferred, and any external
action still required. Stop before cloud promotion. Never claim production readiness or scientific
validation. Never describe an unrun test as passing.
```
