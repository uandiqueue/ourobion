# biotope-env.ps1 — activate the project-bounded toolchain for THIS PowerShell session.
#
# Usage (dot-source so the env vars land in your current shell):
#     . .\scripts\biotope-env.ps1
#
# Brings up, scoped to biotope only (nothing touches your global PATH):
#   - conda env "biotope"  -> Node + npm + JDK 17
#   - Flutter / Dart SDK
#   - Android SDK (adb, emulator, sdkmanager) with AVDs + caches kept inside the toolchain
#
# The toolchain lives in a sibling folder of the repo (default: ..\biotope-toolchain).
# Override with $env:BIOTOPE_TOOLCHAIN before sourcing if you put it elsewhere.

# Native tools (java, flutter) print their version banners to stderr; with
# ErrorActionPreference=Stop that would abort the script, so keep it at Continue.
$ErrorActionPreference = 'Continue'

$RepoRoot  = Split-Path $PSScriptRoot -Parent
$Toolchain = if ($env:BIOTOPE_TOOLCHAIN) { $env:BIOTOPE_TOOLCHAIN } else { Join-Path (Split-Path $RepoRoot -Parent) 'biotope-toolchain' }

if (-not (Test-Path $Toolchain)) {
    Write-Error "Toolchain not found at '$Toolchain'. Run scripts\setup.ps1 first (or set `$env:BIOTOPE_TOOLCHAIN)."
    return
}

$CondaHook = Join-Path $Toolchain 'miniconda\shell\condabin\conda-hook.ps1'
$EnvName   = 'biotope'
$EnvRoot   = Join-Path $Toolchain 'miniconda\envs\biotope'
$FlutterRoot = Join-Path $Toolchain 'flutter'
$AndroidSdk  = Join-Path $Toolchain 'android-sdk'

# --- conda env (Node + JDK) ---
& $CondaHook
conda activate $EnvName

# --- Java (from the conda env, so it's bounded too) ---
$env:JAVA_HOME = Join-Path $EnvRoot 'Library'

# --- Android SDK, with AVDs / adb keys kept inside the toolchain (not %USERPROFILE%\.android) ---
# avdmanager writes AVDs to ANDROID_USER_HOME\avd, but the emulator lists from ANDROID_AVD_HOME.
# Point ANDROID_AVD_HOME at that exact folder so both tools agree on one bounded location.
$env:ANDROID_HOME       = $AndroidSdk
$env:ANDROID_SDK_ROOT   = $AndroidSdk
$env:ANDROID_USER_HOME  = Join-Path $Toolchain 'android-config'
$env:ANDROID_AVD_HOME   = Join-Path $Toolchain 'android-config\avd'

# --- Flutter / Dart, with a bounded pub cache ---
$env:FLUTTER_ROOT = $FlutterRoot
$env:PUB_CACHE    = Join-Path $Toolchain 'pub-cache'

# --- Prepend toolchain bins to PATH for this session only ---
$prepend = @(
    (Join-Path $FlutterRoot 'bin'),
    (Join-Path $AndroidSdk  'platform-tools'),
    (Join-Path $AndroidSdk  'emulator'),
    (Join-Path $AndroidSdk  'cmdline-tools\latest\bin')
) -join ';'
$env:PATH = "$prepend;$($env:PATH)"

$javaLine    = (& java -version 2>&1 | Select-String 'version' | Select-Object -First 1)
$flutterLine = (& "$FlutterRoot\bin\flutter.bat" --version 2>&1 | Select-String 'Flutter' | Select-Object -First 1)
Write-Host ""
Write-Host "biotope toolchain active (session-scoped):" -ForegroundColor Green
Write-Host ("  node     {0}" -f (& node --version))
Write-Host ("  java     {0}" -f $javaLine)
Write-Host ("  flutter  {0}" -f $flutterLine)
Write-Host ("  android  {0}" -f $AndroidSdk)
Write-Host ""
Write-Host "Backend: 'npx supabase start' (Docker Desktop). App: 'cd src; flutter run'." -ForegroundColor DarkGray
