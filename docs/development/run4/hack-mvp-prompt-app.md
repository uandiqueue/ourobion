---
title: Hackathon MVP · APP lane prompt — biotope on the tethered phone, local fallback then hosted
summary: One-hour brief for the device session — own Flutter, the attached Android phone and the local Supabase stack, secure a working local demo first, flip to the hosted ourobion-demo project on the CLOUD lane's signal, verify all five tabs, and record real UI gaps instead of half-building them. Windows-only, same box as the CLOUD lane.
type: plan
scope: run4
status: draft
updated: 2026-07-28
---

# Hackathon MVP · APP lane — biotope on the tethered phone

Two agent sessions run simultaneously **on the same Windows box** (host `UaNdIQueue`) with the physical
Android phone attached to it. This file is the APP lane. The other session runs
`hack-mvp-prompt-cloud.md` and owns the hosted Supabase project and live nao.

Recommended assignment: give this lane to **Codex** — it is reversible, visual, iterative work. The
CLOUD lane performs irreversible operations on a live hosted database, so keep that one in Claude Code.

```text
You are the APP lane of a two-session, ONE-HOUR hackathon MVP run on OUROBION PHASE-2 RUN 4.

You are on Windows (host UaNdIQueue). A SECOND AGENT SESSION IS RUNNING ON THIS SAME MACHINE at the
same time, in its own git worktree, migrating schema/functions/data onto the HOSTED ourobion-demo
Supabase project and verifying live nao.

YOU EXCLUSIVELY OWN: Flutter, adb, the attached Android phone, the LOCAL Supabase stack, and
apps/biotope/**. The other session will not run flutter or supabase start/stop. Do not touch the
hosted project, .github/workflows/**, tools/run4_release_gate*.mjs, or the attestation record.

There is NO macOS machine involved. Ignore docs/development/run4/orchestrator-prompt.md §6 entirely — it
documents a macOS device setup (`/Applications/Docker.app`, `~/Library/Android/sdk`, zsh word-splitting)
for a machine that does not exist. Everything you need is Windows and is below.

===============================================================================
0. THE TARGET, AND WHAT IS AND IS NOT BUILT
===============================================================================

Demo shape: the phone is TETHERED to this laptop (the app is not on Play Store), and its database is
the HOSTED ourobion-demo project (bewwvcksgpxoomyjavjp) — the same project live nao at nao.ourobion.com
reads. Sharing one project IS the nao/biotope sync; there is nothing to build for it.

THE SWITCH IS A CONFIG SWAP, NOT CODE. apps/biotope/lib/main.dart reads SUPABASE_URL and
SUPABASE_ANON_KEY from a dotenv file. apps/biotope/.env.public currently points at 10.0.2.2 /
127.0.0.1 (local). apps/biotope/.env.public.hosted-backup ALREADY contains the hosted URL and anon key.
Flipping is a file copy. Run `git check-ignore -v apps/biotope/.env.public` before assuming it needs a
commit.

ALREADY MERGED on dev-phase2-run4 @ 547280f — do not rebuild:
  #191 full gold/porcelain biomech-botanical UI, 5 tabs, physical-device defects fixed
  #202 real knowledge-base counts (get_knowledge_base_stats) + Home design alignment
  #177 the auth boundary — biotope end-user Supabase auth; nao staff cookie session over Supabase JWKS
       with membership roles and no service-role key anywhere. Separated auth is DONE.

HONESTLY NOT BUILT — do not present these as working, and do not start them in this hour:
  - Archive has NO trend data (issue #200). It lists archived cards only.
  - Scan keeps its existing orb animation, NOT the design's `scanSweep` restyle (issue #201).
  - Expert `humanVerdict` is never parsed or rendered in provenance (B-UI3).
  - Raw `edgeId` still renders verbatim in insight_card_visual.dart; ordinary-user provenance language
    and the trends/insights accessibility baseline are incomplete (B-UI10/B-UI11 — O28 is NOT complete).
  - MetricTile still overflows at 1.6x accessibility text scale (17px horizontal, 15px vertical),
    left as a skipped test naming the reason.
  - NO sentence-level paper provenance. Papers are split into sentences ONLY transiently inside
    tools/brain-ingest/src/synth/passages.ts to select ~12 passages for synthesis. There is no
    persisted sentence index, no StructuredPaper/JATS parse, no citation-root resolution, no
    per-assertion or NLI stage (B-PL22). Provenance is PASSAGE-level and paper-level. Say exactly that.

FORBIDDEN: no live LLM/provider calls; no writes to the hosted project beyond logging in as the demo
user; do not touch model-training/; never weaken a cap, gate, test, guard or assertion; never
hand-edit a derived baseline/insight/brain row (raw user rows are truth — fix the input and re-run);
every user-facing string must pass CopyRules.validateCopyString; never claim production readiness or
scientific validation.

===============================================================================
1. TIMEBOX
===============================================================================

T+00–08  Worktree + environment; local stack up
T+08–22  LOCAL demo working on the phone — your guaranteed fallback; secure it FIRST
T+22–32  On "HOSTED READY": flip .env.public to hosted, restart, re-verify on the phone
T+32–42  Five-tab traversal against hosted; fix ONLY demo-blocking defects
T+42–54  Screenshots + demo script + the honest gap list
T+54–60  Freeze and push. No new work after T+54.

STOP RULE: if the CLOUD lane has not signalled HOSTED READY by T+35, demo LOCAL and say so. Do not sit
idle waiting — the local fallback is the deliverable that guarantees a demo exists.

===============================================================================
2. T+00–08 · SAME-BOX SETUP (two agents, one filesystem)
===============================================================================

Work in your OWN worktree so your Flutter runs and generated-file churn cannot collide with the other
session's tree (AGENTS.md §7):
  node tools/setup_agent_worktree.mjs --branch fix/hack-mvp-biotope-demo \
    --path <abs path OUTSIDE the repo> --base dev-phase2-run4

Per PowerShell shell, activate the bounded toolchain — node and flutter are NOT on the base PATH:
  . .\scripts\biotope-env.ps1
That also puts the Android SDK at C:\project\biotope-toolchain\android-sdk on PATH; adb is at
  C:\project\biotope-toolchain\android-sdk\platform-tools\adb.exe
Confirm the phone is visible before anything else:
  adb devices
Git Bash has NO node, so `git push` from bash dies in .githooks/pre-push
(`node tools/context_sync.mjs --check` → "node: command not found"). PUSH FROM AN ACTIVATED POWERSHELL.
Supabase CLI is repo-local: node_modules\.bin\supabase (2.81.2).
deno is absent on this box and you do not need it.

`flutter test` / `flutter pub get` dirty 7 generated plugin files under
apps/biotope/{linux,macos,windows} (*_plugin_registrant.* etc.) with LINE-ENDING-ONLY diffs. NEVER
commit them: confirm `git diff --ignore-cr-at-eol` is empty, then `git checkout -- apps/biotope/`.

===============================================================================
3. T+08–22 · SECURE THE LOCAL FALLBACK FIRST
===============================================================================

You own the local stack; the other session will not touch it.
  node_modules\.bin\supabase start
  apply migrations, then ALWAYS:  NOTIFY pgrst, 'reload schema';
    (skip it and new RPCs 404 even though the SQL exists — it silently breaks the #202
     knowledge-base counts and looks like a UI bug)
  docker exec -i supabase_db_ourobion psql -U postgres -d postgres -v email=<user> -v days=21 `
    < scripts/seed-test-data.sql
  node_modules\.bin\supabase functions serve
  then invoke compute-baselines, then generate-insights. Both REQUIRE the header
  X-Ourobion-Internal-Secret (43-char base64url) with OUROBION_INTERNAL_SECRET_CURRENT set in the serve
  env. A plain service-role key returns 401 BY DESIGN — that is the O25 boundary, not a bug.
  KNOWN GAP: tools/rules needs `npm install --no-save zod` at the repo root
  (shared/rules/rule.schema.ts imports zod, declared nowhere). Do NOT commit that.

  cd apps\biotope; flutter analyze; flutter test        # paste the real counts
  then run on the CONNECTED PHONE — not the emulator, not desktop (Flutter desktop is blocked here:
  it needs OS Developer Mode and you are non-admin).

Get a full five-tab pass working locally and take screenshots. That is your stage insurance.

===============================================================================
4. T+22–32 · FLIP TO HOSTED
===============================================================================

Only on the CLOUD lane's explicit signal: "HOSTED READY — bewwvcksgpxoomyjavjp, demo user <email>,
N cards, M baselines".

  copy apps\biotope\.env.public apps\biotope\.env.public.local-backup
  copy apps\biotope\.env.public.hosted-backup apps\biotope\.env.public

Confirm the URL is https://bewwvcksgpxoomyjavjp.supabase.co and the key is the ANON key — never a
service-role key, never anything named *_SERVICE_ROLE_*. Flutter may only ever hold the anon key.

FULL RESTART, not hot reload — dotenv is read at startup. Log in as the demo user and confirm the app
is genuinely reading hosted: the counts should match what the CLOUD lane reported. If counts are zero
or an RPC 404s, report it to the CLOUD lane (likely a missing `NOTIFY pgrst, 'reload schema';` or a
migration that did not land) rather than patching the app.

===============================================================================
5. T+32–42 · FIVE-TAB TRAVERSAL ON THE DEVICE
===============================================================================

CI GREEN IS NOT ENOUGH FOR UI WORK. The last session found three defects that shipped with a clean
`flutter analyze` and 176 passing widget tests: a 9.5px Home grid overflow on a real 1080x2340 panel
(childAspectRatio derived cell HEIGHT from tile WIDTH, so it was worse on narrower phones); a
permanently hung Profile spinner (no try/catch in _load(), and the tab is kept alive in an IndexedStack
so it could not recover for the whole session even after the backend came back); and ZERO of the 25
generated PNGs shipping (a Flutter asset directory entry is NOT recursive, and the errorBuilder's hero
fallback is an invisible SizedBox, so the app looked deliberate while shipping none of its artwork).
All three are fixed on 547280f — CONFIRM THEY STAYED FIXED.

Walk and record what you actually see:
  1. Home      — no overflow; artwork renders; knowledge-base counts are REAL hosted numbers.
  2. Scan      — inline chip answers and the 30-second logging path work; EnvironmentRow says NOT BUILT
                 with NO tap target. KEEP THAT — never make an unbuilt channel look operable. The
                 scanSweep restyle is issue #201 and is NOT in this build.
  3. Insights  — swipeable deck; confidence badges honest; provenance is passage/paper-level.
  4. Archive   — archived cards round-trip on swipe-right. NO trends (issue #200).
  5. Profile   — loads AND recovers; must not hang on a spinner.

A defect qualifies for a fix ONLY if it is visible in this walk. Everything else goes in the gap list.

IF YOU MUST LAND A CODE FIX: nothing can land right now — tools/run4_release_gate.mjs:51 still pins
RUN4_UNIT_BASE_SHA = ff0546434f081cadc3e5683217d484f250c19139, which PREDATES #191, so every landing
delta is charged for the 7,670 merged UI lines and blows the 115-path / 8,500-line cap. Ask the CLOUD
lane to advance the base first; it owns that file, ci.yml and the attestation. Keep any fix tiny.
Anything under shared/ needs TWO recorded reviewers (Jayden + Alton) and will not land inside the hour.
Anything REWRITTEN under apps/biotope/assets/ trips the binary-diff guard — leave assets alone. After
the base advance lands, merge origin/dev-phase2-run4 into your branch and push; that also clears the
"synthetic merge parents do not match current event base/head" failure, which RE-RUNNING CANNOT FIX
because a re-run replays the same immutable event payload.

===============================================================================
6. T+42–54 · THE DELIVERABLE
===============================================================================

Write docs/development/run4/hack-mvp-demo-script.md:
  - the exact commands you ran to bring the app up against hosted, in order;
  - the five-tab walkthrough in demo order, with what to say on each screen;
  - WHAT IS REAL: merged 5-tab UI, hosted ourobion-demo database shared with live nao, separated auth,
    real knowledge-base counts, 21 days of SIMULATED history, deterministic rule cards, and the
    sleep/HRV and sleep/resting-HR research cards;
  - WHAT IS NOT: no Archive trends, no scanSweep restyle, Environment not built, no sentence-level
    provenance (passage-level only, ~12 passages per synthesis), no live provider calls, verifier
    verdicts non-deterministic across runs, nothing promoted or released, O28 incomplete;
  - the known gaps you hit, verbatim, with no softening.

If a judge asks about validation, the honest answer is that this is a local-evidence prototype with
deterministic gates and a correctly HELD one-paper edge, not a validated instrument.

Then write exactly one docs/sessions/<UTC>-uandiqueue-codex-hack-mvp-biotope-hosted-demo.md with
Attempted / Changed / Decided / Left / Blockers AND a `memory:` line, and run
  node tools/context_sync.mjs --fix-index
The pre-push hook and CI fail without the session file. Do not commit .env.public if it is ignored, and
never commit any key that is not the anon key. Discard the generated-plugin CRLF churn before pushing.

===============================================================================
7. COORDINATION — non-negotiable
===============================================================================

- YOU own Flutter, adb, the phone, the LOCAL Supabase stack, apps/biotope/**, the demo script.
- The CLOUD lane owns the hosted project, live nao, RUN4_UNIT_BASE_SHA, .github/workflows/ci.yml,
  tools/run4_release_gate*.mjs and the attestation record. Never edit those.
- Separate worktrees, separate branches. ONE MERGE AT A TIME across both lanes; announce before merging.
- Do not hand-merge docs/INDEX.md, docs/graph/couplings.yaml or docs/graph/semantic-graph.md —
  regenerate them after rebasing.
- If hosted misbehaves, restore .env.public.local-backup and demo local. Report it; never paper over a
  backend problem inside the app.

===============================================================================
8. CLOSEOUT
===============================================================================

Report: what actually renders on the phone against hosted, real command output, the demo script path,
the honest gap list, and anything still blocking. Stop before cloud promotion.
```
