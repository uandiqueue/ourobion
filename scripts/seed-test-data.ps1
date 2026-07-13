<#
.SYNOPSIS
  ourobion · local test-data seeder. Tune the variables below, run it, and the phone
  UI renders "weeks in" — streak, baselines and insights included.

.DESCRIPTION
  Acts like the app's own writes, but in bulk and backdated:
    1. Injects N days of daily_gut_rows (+ optional wearable_daily / antibiotics) for
       ONE existing user, via scripts\seed-test-data.sql piped into the local db container.
    2. Rebuilds engagement_state in that SQL (mirrors M6).
    3. Invokes the compute-baselines then generate-insights EDGE FUNCTIONS to rebuild
       the M5 projections (baseline_snapshots, insight_cards).

  This is LOCAL-ONLY. It relies on `npx supabase start` already running (Docker), which
  also serves the edge functions. See AGENTS.md §4 and docs/memory/0009-local-test-data-seeding.md.

.NOTES
  RLS keys on auth.uid() = user_id, so the user must already exist: sign in once in the
  app with $TestEmail BEFORE running this. Run from the repo root in an activated shell
  (. .\scripts\biotope-env.ps1). After it finishes, pull-to-refresh / re-open the app
  to re-fetch (the app loads on screen init, not live).

.EXAMPLE
  .\scripts\seed-test-data.ps1
  .\scripts\seed-test-data.ps1 -TestEmail you@example.com -Days 30 -WithAntibiotics
#>

[CmdletBinding()]
param(
  # ── TUNABLES ───────────────────────────────────────────────────────────────
  # The account you sign into the app with (must already exist in auth.users).
  [string] $TestEmail       = 'test@ourobion.local',

  # How many consecutive days to fabricate, ending today.
  #   >=3 → baselines leave "insufficient"; >=7 → "medium"; >=14 → "high" confidence
  #   and the 7-day streak unlocks insights + the "Committed" title.
  [int]    $Days            = 14,

  # Baseline daily DQS (log_completeness). Kept in [60,100] so every day is streak-worthy.
  [int]    $BaseDqs         = 78,

  # Region tag copied onto each row (matches the user's profile region).
  [string] $Region          = 'SG',

  # Also fabricate wearable_daily rows (resting HR, HRV, sleep, SpO2, temp, steps)?
  [switch] $IncludeWearable = $true,

  # Add a 5-day antibiotic course over the most recent days (sets on_antibiotics / gut_watch)?
  [switch] $WithAntibiotics = $false,

  # Wipe this user's existing rows + projections first (recommended for clean runs)?
  [switch] $WipeFirst       = $true,

  # Skip the edge-function step (only inject rows + rebuild engagement_state)?
  [switch] $SkipEdgeFunctions = $false
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$sqlPath  = Join-Path $PSScriptRoot 'seed-test-data.sql'

function Write-Step($msg) { Write-Host "›› $msg" -ForegroundColor Cyan }

# ── 1. Locate the running local Postgres container ────────────────────────────
Write-Step 'Locating local Supabase database container…'
$dbContainer = docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | Select-Object -First 1
if (-not $dbContainer) {
  throw "No 'supabase_db_*' container running. Start the stack first:  npx supabase start"
}
Write-Host "   db container: $dbContainer"

# ── 2. Inject rows + rebuild engagement_state (psql inside the container) ──────
Write-Step "Seeding $Days day(s) for $TestEmail…"
$psqlArgs = @(
  'exec', '-i', $dbContainer,
  'psql', '-U', 'postgres', '-d', 'postgres',
  '-v', "email=$TestEmail",
  '-v', "days=$Days",
  '-v', "base_dqs=$BaseDqs",
  '-v', "region=$Region",
  '-v', "include_wearable=$([int][bool]$IncludeWearable)",
  '-v', "with_antibiotics=$([int][bool]$WithAntibiotics)",
  '-v', "wipe_first=$([int][bool]$WipeFirst)"
)
# Pipe the SQL file into the container's psql over stdin.
Get-Content -Raw $sqlPath | docker @psqlArgs
if ($LASTEXITCODE -ne 0) { throw "psql seed failed (exit $LASTEXITCODE)." }

# ── 3. Rebuild the M5 projections via the edge functions ──────────────────────
if ($SkipEdgeFunctions) {
  Write-Step 'Skipping edge functions (baseline/insight projections not rebuilt).'
} else {
  Write-Step 'Reading local Supabase credentials…'
  $status  = npx --yes supabase status -o json | ConvertFrom-Json
  $apiUrl  = $status.API_URL;          if (-not $apiUrl)  { $apiUrl  = 'http://127.0.0.1:54321' }
  $svcKey  = $status.SERVICE_ROLE_KEY; if (-not $svcKey)  { $svcKey  = $status.service_role_key }
  if (-not $svcKey) { throw 'Could not read SERVICE_ROLE_KEY from `supabase status`.' }

  $headers = @{ Authorization = "Bearer $svcKey"; 'Content-Type' = 'application/json' }

  # Order matters: generate-insights reads baseline_snapshots, so baselines run first.
  foreach ($fn in @('compute-baselines', 'generate-insights')) {
    Write-Step "Invoking edge function: $fn"
    try {
      $resp = Invoke-RestMethod -Method Post -Uri "$apiUrl/functions/v1/$fn" `
                                -Headers $headers -Body '{}'
      Write-Host "   $fn ->" ($resp | ConvertTo-Json -Compress -Depth 5)
    } catch {
      Write-Warning "   $fn failed: $($_.Exception.Message)"
      Write-Warning "   Ensure the stack is fully up (npx supabase start serves edge functions)."
    }
  }
}

Write-Host ''
Write-Host "✓ Done. Pull-to-refresh / re-open the app (signed in as $TestEmail) to see the data." -ForegroundColor Green
