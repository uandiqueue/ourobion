---
title: Run 4 live provider acceptance and 226 backend membership unblock
summary: Executed the ordered Anthropic/OpenAI/Agnes live acceptance at exact head, granted the bounded nao curator membership that unblocked 226, and recorded honest blocked results for 246, 240 and 179.
type: session
scope: shared
status: canonical
updated: 2026-07-31
---

# Run 4 live provider acceptance and 226 backend membership unblock

Issues: #233, #226, #246, #240, #179; branch: `feat/brain/run4-233-live-legs`;
base and exact head: `c6a2ca64298998205a09451f78a6bfc63afa1a03` (`dev-phase2-run4` tip, = PR #291
merge commit); device: `uandiqueue-wsl`.

## Attempted

- Act as nao system/backend owner for the five assigned Run 4 items, producing exact-head evidence and
  honest PASS / FAIL / BLOCKED for each rather than partial claims.
- Execute the owner-approved ordered live provider acceptance for #233 under a finite runtime
  authorization: Anthropic first (max SGD 2), OpenAI second (max SGD 20), Agnes last (max 20 testing
  calls, acceptance-only).
- Apply the minimum bounded backend change needed to unblock the #226 browser acceptance.

## Changed

- **Hosted (bounded test data, not schema):** inserted exactly **one** row into `public.nao_members` in
  the approved demo project `bewwvcksgpxoomyjavjp` — `user_id
  bf88b88e-73b7-4564-be44-70bd2b6d1502`, `role 'curator'`, `status 'active'`, `revoked_at null`,
  applied `2026-07-31T12:18:44.188938+00`. Guarded by `where exists` on `auth.users`, `on conflict do
  nothing`, and an explicit literal id. The table held **0** rows beforehand, so no existing member was
  displaced. This is row-level test data and correctly produces **no** migration diff.
- **No source change was made in this session.** The only repository artifact is this session log.
- Live-acceptance runtime artifacts were written to the gitignored
  `data/brain-ingest/live-acceptance/run4-233-live-2026-07-31/` inside the isolated worktree only.

## Decided

- **The #226 grant target is not the root `.env` account.** The handover named `DEMO_USER_EMAIL`, but
  `last_sign_in_at` evidence shows that account (`d9b5bc39…`) last authenticated 2026-07-30 16:12Z and
  took no part in the browser run, while `bf88b88e…` signed in at 2026-07-31 10:49:29Z — nine minutes
  before the #226 matrix comment reporting auth-success-then-role-denial. Granting the `.env` account
  would have left #226 blocked. Owner confirmed the corrected target before any write.
- **`GET /models` was deliberately not called**, departing from #233 §A's proposed health check per the
  owner directive. Agnes identity is established solely from POST response bodies.
- **Agnes pricing was not invented.** `maxReservedUsd: 0` derives solely from the owner-confirmed free
  plan already recorded in `router.config.json`, so any future non-zero Agnes reservation fails closed.
- SGD→USD used a deliberately conservative **1.40 SGD/USD** (repo working assumption is 1.29). A higher
  divisor buys fewer USD per SGD ceiling, so the USD caps cannot exceed the owner's SGD ceilings.
  Prior #189 use was **declared and counted** in aggregate (Anthropic 3 starts / US$0.103893; OpenAI
  2 starts / US$0.05023125).
- Did **not** land #233 §D (the cloud pipeline workflow). Its first execution would also be its first
  validation, plus a hosted mutation and real cloud spend; it needs its own authorized session.
- Did **not** port the Windows 14+7 runner to Linux. A port is a different artifact and could not serve
  as acceptance evidence for the merged runner.

## Verification

- Both typechecks clean; **brain-ingest 426/426**, **llm-router 121/121** at exact head on Node 26.5.0.
- Offline preflight passed twice (checked-in fixture, then runtime bundle): quote gate 1/1,
  independent second-paper retrieval, `families.separated: true`, exit 0.
- **All three live legs PASS**, each from an isolated worktree at exact head with
  `git status --porcelain --untracked-files=all` **empty before and after**:

  | Leg | Model | Identity | Attested | Accepted | HTTP |
  |---|---|---|---|---|---|
  | anthropic-synthesis | `claude-sonnet-5` | provider-response | true | 1 claim | 200 |
  | openai-synthesis | `gpt-5-2025-08-07` | provider-response | true | 1 claim | 200 |
  | agnes-verification | `agnes-2.5-flash` | provider-response | true | 1 record | 200 ×2 |

  Leg 2's recorded identity is the concrete snapshot OpenAI returned, distinct from the configured
  `gpt-5` — a genuine attestation, not a config echo. Agnes recorded
  `decorrelatedFromSynthesis: true`.
- **Spend (actual, from ledger + hash-chained journal):** Anthropic 1 start / 1,279 in / 405 out /
  **US$0.006608**; OpenAI 1 start / 798 in / 1,060 out / **US$0.0115975**; Agnes **2 of 20** starts /
  2,048 in / 820 out / **US$0** (free plan). Total **4 POSTs, US$0.0182055 (~SGD 0.023)**. Anthropic
  used ~0.47% of SGD 2; OpenAI ~0.08% of SGD 20. No cap approached.
- Journal: 12 events (4 × reserved/started/response), **hash chain verified intact**, all four statuses
  200. A **4th** invocation was attempted and correctly refused with **no dispatch**; journal unchanged.
- Verification verdict is `uncertain` (0.3) with `supporting: 0` because independent retrieval returned
  a `mentions`-stance source — the designed fail-closed grounding. The edge is correctly held; **no
  servable edge is claimed**.
- #226 membership verified post-change: full table shows exactly the one row, and effective-role
  resolution under `nao_role()`'s own predicate returns `curator` / rank 20 / `satisfies_curator: true`.
- #246: merged runner parse-checks clean on the real target interpreter (Windows PowerShell
  **5.1.26100.8875**) for `demo-dryrun-run2.ps1`, `native-process.ps1`, `native-process.tests.ps1`.
- #179: PR #184 confirmed **merged**; the original dual-upsert defect is fixed — the route now issues a
  single `nao_loader_apply_simulated_days` RPC.

## Left

- **#233** open on §D only (cloud pipeline in GitHub Actions). §A/§B/§C are done and §E is satisfied —
  `gh secret list` confirms all required secrets exist, so §D is now genuinely unblocked.
- **#246** BLOCKED on environment; needs the Windows device with a Windows-filesystem checkout,
  `..\biotope-toolchain`, an owned isolated `ourobion` Supabase stack, and deno 2.8.1.
- **#240** requirements 1–3 done; 4 needs a corpus with a genuinely *supporting* independent source
  (the frozen two-paper control cannot produce one by construction); 5 waits on #246.
- **#179** implementation merged; open on acceptance evidence alone, gated by #246 and #240 req 4.
- **#226** backend half complete; browser/UI owner still owes the authenticated matrix re-run and the
  four UI defect fixes.
- Cleanup owed: revoke or delete the `nao_members` row when #226 closes or the disposable account is
  retired.

## Blockers

- #246/#240/#179 acceptance cannot proceed on this WSL2 Linux device (see #246 comment for the five
  independent blockers). No substitute was run and no acceptance was claimed.

memory: none
