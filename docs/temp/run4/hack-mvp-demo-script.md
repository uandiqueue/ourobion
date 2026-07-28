---
title: Hackathon MVP · biotope local-fallback demo script
summary: Reproducible Windows runbook and honest five-tab talk track for the tethered-phone Run 4 demo, including the local evidence actually observed and the gaps that remain.
type: plan
scope: run4
status: draft
updated: 2026-07-28
---

# Hackathon MVP · biotope local-fallback demo script

## Demo posture

This run is the **local fallback**, not the hosted demo. The CLOUD lane did not provide the required
`HOSTED READY — ...` signal before the stop rule, so `.env.public` remained on
`http://127.0.0.1:54321`. The connected Huawei YAL-L21 reached that stack through `adb reverse`.
Nothing was written to the hosted project, promoted, deployed, or released.

Observed local state on 2026-07-28:

- 21 simulated `daily_gut_rows` and 21 simulated `wearable_daily` rows;
- 16 rebuilt baseline snapshots and a 21-day streak;
- 2 rebuilt active insight cards before the walkthrough: one deterministic rules card and one
  sleep-duration/resting-heart-rate relationship card;
- the real local `get_knowledge_base_stats()` result: 5 indexed study identifiers, 4 verified
  relationships, last indexed at `2026-07-28T01:51:34.610346Z`;
- one rules card was saved through the UI during verification, so the frozen local state is now one
  archived rules card plus one active research-linked card.

## Commands actually used

Run from an activated PowerShell in the isolated worktree. Values read from ignored dotenv files or
generated into the system temp directory are intentionally not printed here.

```powershell
. .\scripts\biotope-env.ps1
npm ci

adb devices -l
node_modules\.bin\supabase.cmd status
node_modules\.bin\supabase.cmd migration list --local
node_modules\.bin\supabase.cmd migration up --local
docker exec supabase_db_ourobion psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"

Get-Content scripts\seed-test-data.sql -Raw |
  docker exec -i supabase_db_ourobion psql -U postgres -d postgres `
    -v email=u12-demo@ourobion.local -v days=21
```

The functions were served with a fresh 43-character base64url internal secret in a BOM-free,
machine-local temp env file. The file and value are not committed:

```powershell
$demoTemp = Join-Path $env:LOCALAPPDATA 'Temp\ourobion-hack-mvp-app-203'
$functionsEnv = Join-Path $demoTemp 'functions.env'
$bytes = [byte[]]::new(32)
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$internalSecret = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
[IO.File]::WriteAllText(
  $functionsEnv,
  "OUROBION_INTERNAL_SECRET_CURRENT=$internalSecret`nOUROBION_INTERNAL_SECRET_PREVIOUS=`n",
  [Text.UTF8Encoding]::new($false)
)

Start-Process -WindowStyle Hidden `
  -FilePath 'node_modules\.bin\supabase.cmd' `
  -ArgumentList @('functions','serve','--debug','--env-file',$functionsEnv) `
  -RedirectStandardOutput (Join-Path $demoTemp 'functions.out.log') `
  -RedirectStandardError (Join-Path $demoTemp 'functions.err.log')
```

Invoke `compute-baselines` first and `generate-insights` second. Both requests used the local anon
JWT for end-user authentication plus the separate internal header; a service-role key alone was
also tested and correctly failed closed with `internal auth denied: not_configured`.

```powershell
$publicEnv = Get-Content apps\biotope\.env.public |
  Where-Object { $_ -match '^[A-Z_]+=' } |
  ForEach-Object {
    $name, $value = $_ -split '=', 2
    [pscustomobject]@{ Name = $name; Value = $value }
  }
$anon = ($publicEnv | Where-Object Name -eq 'SUPABASE_ANON_KEY').Value
$headers = @{
  apikey = $anon
  Authorization = "Bearer $anon"
  'Content-Type' = 'application/json'
  'X-Ourobion-Internal-Secret' = $internalSecret
}
$body = @{ user_id = '468ae4eb-426d-4cb4-b1c0-5200fb4649a4' } | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:54321/functions/v1/compute-baselines' `
  -Headers $headers -Body $body
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:54321/functions/v1/generate-insights' `
  -Headers $headers -Body $body
```

Then verify and launch the exact app on the tethered phone:

```powershell
cd apps\biotope
flutter analyze --no-pub
flutter test --no-pub

adb -s SDEDU20528003128 reverse tcp:54321 tcp:54321
flutter run --no-pub -d SDEDU20528003128
```

`flutter pub get` resolved packages but could not finish Windows plugin symlinks because Developer
Mode is unavailable. The ignored Android `GeneratedPluginRegistrant.java` was therefore restored
from the canonical UI worktree before the phone build; it is not part of the commit.

## Five-tab walkthrough and talk track

1. **Home — real local data, not a score.** Point out the rendered biomech-botanical artwork, the
   82/100 **coverage** label, the 21-day simulated streak, the real RPC-backed local count of five
   indexed study identifiers, and the sleep/gut tiles. The 1080×2340 physical panel has no grid
   overflow. Do not call coverage a health score or claim these are hosted/live-nao numbers.
2. **Scan — the honest 30-second path.** Show the existing circular artwork/orb, the wearable and
   self-report channel rows, and the inline logging chips. Point out that Environment says
   `NOT BUILT` and has no tap target. This is not the proposed `scanSweep` restyle.
3. **Insights — deterministic card, then research-linked card.** The first card is the rules-produced
   “Gut consistency pattern.” Swipe right to save it; the `SAVED` counter increments. The next card
   is the low-confidence sleep-duration/resting-heart-rate relationship. Open “How this was
   generated”: it reports 21/28 days of coverage, TEST-MODE verifier posture, passage/paper-level
   source material, and explicitly labels the surfaced citation as a hand-authored fixture—not a
   real paper and not LLM synthesis.
4. **Archive — saved cards only.** After a cold relaunch, the saved Gut card appears. There are no
   trends. During this run, the already-mounted Archive tab stayed on its old empty state immediately
   after the save even though the database row was `archived`; a cold relaunch loaded it correctly.
   Do not imply live tab refresh or trend support.
5. **Profile — recovered, not spinning.** The profile, email, wearable toggle, living-backdrop
   device preference, daily-digest account preference, and sign-out action all render. The tab did
   not hang on a spinner.

Temporary screenshots from the actual device are under
`%LOCALAPPDATA%\Temp\ourobion-hack-mvp-app-203\` (`fixed-home.png`, `scan.png`, `research-card.png`,
`provenance.png`, `provenance-lower.png`, `archive-cold.png`, and `profile.png`). They are evidence
artifacts, not git inputs, and are intentionally uncommitted to avoid the binary-diff gate.

## What is real

- The merged five-tab Flutter UI and its bundled generated artwork.
- End-user Supabase auth in biotope and the separately implemented staff/JWKS authorization boundary
  in nao. This run exercised only local end-user auth; it did not test live nao.
- RPC-derived knowledge-base counts, not a hard-coded ticker. The observed counts are from the local
  database, not the hosted `ourobion-demo` project.
- Twenty-one days of **simulated** raw history, projections rebuilt from those rows, a deterministic
  rules card, and the device-rendered sleep/resting-heart-rate relationship card.
- Swipe-right persisted an `archived` status, and a cold read rendered that saved card.
- Device proof on Huawei YAL-L21 (`SDEDU20528003128`), not desktop or emulator proof.

The requested hosted/shared-database claim and sleep/HRV card were **not** observed on this phone
because no CLOUD handoff arrived. Do not substitute the local evidence for either claim.

## What is not built or validated

- No Archive trends (issue #200).
- No `scanSweep` restyle; Scan retains the current orb/circular presentation (issue #201).
- Environment is not built and remains non-interactive.
- Expert `humanVerdict` is not parsed or rendered (B-UI3).
- Raw identifiers/metric keys still reach ordinary-user provenance copy; B-UI10/B-UI11 remain open.
- O28 is incomplete. `MetricTile` still overflows at 1.6× accessibility text scale; the suite keeps
  the explicit skipped regression.
- No sentence-level provenance, StructuredPaper/JATS parse, citation-root resolution, per-assertion
  provenance, or NLI stage. Sentence splitting is transient selection of roughly 12 passages for
  synthesis; persisted provenance is passage-level and paper-level.
- No live provider/LLM calls. The visible research source in this local run is explicitly a
  hand-authored fixture, and verifier verdicts are not deterministic across real provider runs.
- No production/scientific validation. This is a local-evidence prototype with deterministic gates,
  not a validated instrument.
- Nothing was deployed, promoted, or released.

## Gaps actually hit in this run

- `flutter pub get` cannot complete plugin symlink creation without Windows Developer Mode. The
  Android build needed the ignored generated registrant restored from the canonical UI worktree.
- A restored local session could finish onboarding with `PGRST303: JWT issued at future` during the
  token-refresh boundary and leave the waking screen permanent. The app now retries **only that
  exact response once** after 500 ms; every other failure and a repeated PGRST303 still fail closed.
- Archive does not refresh an already-mounted empty tab immediately after a swipe-right save. The
  write is real and survives; a cold relaunch shows the card.
- The first Android build took 216 seconds and emitted a future Flutter/Kotlin Gradle Plugin migration
  warning. It did not block this build and build-tool migration was not started in the timebox.
- The device logged skipped frames while decoding/rendering the large generated artwork. The known
  asset-downscale work remains blocked by the landing gate's binary-diff policy and was not weakened.

## Verification output

```text
flutter analyze --no-pub
No issues found! (ran in 71.5s)

flutter test --no-pub
00:00 +266 ~26: All tests passed!

focused session-refresh guard
00:00 +3: All tests passed!

physical device
Huawei YAL-L21, serial SDEDU20528003128, 1080×2340
Home / Scan / Insights / Archive / Profile all rendered
```
