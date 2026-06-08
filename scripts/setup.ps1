# setup.ps1 — Windows-native, project-bounded toolchain installer for biotope.
#
#   Run from the repo root in PowerShell:   .\scripts\setup.ps1
#
# Installs everything biotope needs into a SIBLING folder of the repo
# (default: ..\biotope-toolchain) so nothing touches your global PATH:
#   - Miniconda (bounded)  ->  conda env "biotope" with Node + JDK 17
#   - Flutter / Dart SDK
#   - Android SDK (platform-tools, emulator, platform 36, build-tools, system image) + an AVD
#
# Idempotent: re-running skips anything already in place.
#
# PREREQUISITES you must install yourself first (they integrate with Windows / the OS):
#   - Docker Desktop (started)  — runs the local Supabase stack, maps it to localhost
#   - Git
#
# After this finishes, activate the toolchain in any new shell with:
#   . .\scripts\biotope-env.ps1

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'   # faster Invoke-WebRequest

$RepoRoot  = Split-Path $PSScriptRoot -Parent
$Toolchain = if ($env:BIOTOPE_TOOLCHAIN) { $env:BIOTOPE_TOOLCHAIN } else { Join-Path (Split-Path $RepoRoot -Parent) 'biotope-toolchain' }
$Downloads = Join-Path $Toolchain 'downloads'
New-Item -ItemType Directory -Force -Path $Downloads | Out-Null

function Step($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }

# ─── 0. Prerequisite: Docker ────────────────────────────────────────────────
Step "Checking Docker (prerequisite)"
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker not found. Install Docker Desktop and start it: https://www.docker.com/products/docker-desktop/"
}
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker is installed but not running. Start Docker Desktop, then re-run." }
Write-Host "OK: $(docker --version)"

# ─── 1. Miniconda (bounded) ─────────────────────────────────────────────────
Step "Miniconda"
$conda = Join-Path $Toolchain 'miniconda\Scripts\conda.exe'
if (-not (Test-Path $conda)) {
    $mini = Join-Path $Downloads 'Miniconda3-latest-Windows-x86_64.exe'
    if (-not (Test-Path $mini)) {
        Write-Host "Downloading Miniconda..."
        Invoke-WebRequest "https://repo.anaconda.com/miniconda/Miniconda3-latest-Windows-x86_64.exe" -OutFile $mini
    }
    Write-Host "Installing Miniconda (bounded, no global PATH)..."
    Start-Process $mini -ArgumentList "/InstallationType=JustMe","/RegisterPython=0","/AddToPath=0","/S","/D=$(Join-Path $Toolchain 'miniconda')" -Wait
}
Write-Host "OK: conda $(& $conda --version)"

# ─── 2. conda env: Node + JDK 17 (conda-forge only, avoids Anaconda ToS) ────
Step "conda env 'biotope' (Node + JDK 17)"
if (-not (Test-Path (Join-Path $Toolchain 'miniconda\envs\biotope\node.exe'))) {
    & $conda create -y --override-channels -c conda-forge -n biotope "nodejs>=20" "openjdk=17"
    if ($LASTEXITCODE -ne 0) { throw "conda env creation failed" }
} else { Write-Host "OK: env already exists" }

# ─── 3. Flutter SDK (latest stable) ─────────────────────────────────────────
Step "Flutter SDK"
if (-not (Test-Path (Join-Path $Toolchain 'flutter\bin\flutter.bat'))) {
    $rel = (Invoke-RestMethod "https://storage.googleapis.com/flutter_infra_release/releases/releases_windows.json")
    $hash = $rel.current_release.stable
    $stable = $rel.releases | Where-Object { $_.hash -eq $hash } | Select-Object -First 1
    $zip = Join-Path $Downloads ("flutter_windows_{0}-stable.zip" -f $stable.version)
    if (-not (Test-Path $zip)) {
        Write-Host "Downloading Flutter $($stable.version)..."
        Invoke-WebRequest "https://storage.googleapis.com/flutter_infra_release/releases/$($stable.archive)" -OutFile $zip
    }
    Write-Host "Extracting Flutter..."
    Expand-Archive $zip -DestinationPath $Toolchain -Force
}
Write-Host "OK: flutter present"

# ─── 4. Android command-line tools ──────────────────────────────────────────
Step "Android command-line tools"
$Sdk = Join-Path $Toolchain 'android-sdk'
if (-not (Test-Path (Join-Path $Sdk 'cmdline-tools\latest\bin\sdkmanager.bat'))) {
    $page = (Invoke-WebRequest "https://developer.android.com/studio" -UseBasicParsing).Content
    $build = [regex]::Match($page, 'commandlinetools-win-(\d+)_latest\.zip').Groups[1].Value
    if (-not $build) { $build = '14742923' }   # fallback to a known-good build
    $zip = Join-Path $Downloads "commandlinetools-win.zip"
    if (-not (Test-Path $zip)) {
        Write-Host "Downloading cmdline-tools build $build..."
        Invoke-WebRequest "https://dl.google.com/android/repository/commandlinetools-win-${build}_latest.zip" -OutFile $zip
    }
    $tmp = Join-Path $Downloads 'cmdline-extract'
    Expand-Archive $zip -DestinationPath $tmp -Force
    New-Item -ItemType Directory -Force -Path (Join-Path $Sdk 'cmdline-tools\latest') | Out-Null
    Get-ChildItem (Join-Path $tmp 'cmdline-tools') | Move-Item -Destination (Join-Path $Sdk 'cmdline-tools\latest') -Force
}
Write-Host "OK: sdkmanager present"

# ─── 5. Accept SDK licenses (deterministic hash files) ──────────────────────
Step "Android SDK licenses"
$lic = Join-Path $Sdk 'licenses'
New-Item -ItemType Directory -Force -Path $lic | Out-Null
$licenses = @{
  "android-sdk-license"           = @("8933bad161af4178b1185d1a37fbf41ea5269c55","d56f5187479451eabf01fb78af6dfcb131a6481e","24333f8a63b6825ea9c5514f83c2829b004d1fee")
  "android-sdk-preview-license"   = @("84831b9409646a918e30573bab4c9c91346d8abd")
  "android-googletv-license"      = @("601085b94cd77f0b54ff86406957099ebe79c4d6")
  "android-sdk-arm-dbt-license"   = @("859f317696f67ef3d7f30a50a5560e7834b43903")
  "google-gdk-license"            = @("33b6a2b64607f11b759f320ef9dff4ae5c47d97a")
  "mips-android-sysimage-license" = @("e9acab5b5fbb560a72cfaecce8946896ff6aab9d")
}
foreach ($k in $licenses.Keys) {
    [System.IO.File]::WriteAllText((Join-Path $lic $k), "`n" + ($licenses[$k] -join "`n"))
}
Write-Host "OK: licenses written"

# ─── 6. Android packages + AVD ──────────────────────────────────────────────
Step "Android packages (platform-tools, emulator, platform 36, system image)"
$env:JAVA_HOME = Join-Path $Toolchain 'miniconda\envs\biotope\Library'
$env:ANDROID_SDK_ROOT = $Sdk; $env:ANDROID_HOME = $Sdk
$env:ANDROID_USER_HOME = Join-Path $Toolchain 'android-config'
$env:ANDROID_AVD_HOME  = Join-Path $Toolchain 'android-config\avd'
$sdkmanager = Join-Path $Sdk 'cmdline-tools\latest\bin\sdkmanager.bat'
$sysimage = "system-images;android-35;google_apis;x86_64"
& $sdkmanager --sdk_root=$Sdk "platform-tools" "emulator" "platforms;android-36" "build-tools;36.0.0" $sysimage
if ($LASTEXITCODE -ne 0) { throw "sdkmanager install failed" }

Step "Android emulator (AVD 'biotope_pixel')"
$avdmanager = Join-Path $Sdk 'cmdline-tools\latest\bin\avdmanager.bat'
if (-not (Test-Path (Join-Path $env:ANDROID_AVD_HOME 'biotope_pixel.ini'))) {
    "no" | & $avdmanager create avd -n biotope_pixel -k $sysimage -d "pixel_7"
}
Write-Host "OK: $(& (Join-Path $Sdk 'emulator\emulator.exe') -list-avds)"

# ─── 7. Configure Flutter ───────────────────────────────────────────────────
Step "Configure Flutter"
$flutter = Join-Path $Toolchain 'flutter\bin\flutter.bat'
$env:PUB_CACHE = Join-Path $Toolchain 'pub-cache'
& $flutter config --android-sdk $Sdk --no-analytics *> $null
& $flutter doctor

# ─── 8. Env files from templates ────────────────────────────────────────────
Step "Environment files"
if (-not (Test-Path "$RepoRoot\src\.env.public")) {
    Copy-Item "$RepoRoot\src\.env.public.example" "$RepoRoot\src\.env.public"
    Write-Host "Created src\.env.public — set SUPABASE_URL=http://10.0.2.2:54321 and the anon key from 'npx supabase start'."
} else { Write-Host "src\.env.public exists" }
if (-not (Test-Path "$RepoRoot\supabase\.env")) {
    Copy-Item "$RepoRoot\supabase\.env.example" "$RepoRoot\supabase\.env"
    Write-Host "Created supabase\.env"
} else { Write-Host "supabase\.env exists" }

# ─── 9. Project dependencies ────────────────────────────────────────────────
Step "Install project dependencies"
$node = Join-Path $Toolchain 'miniconda\envs\biotope'
$env:PATH = "$node;$(Join-Path $node 'Scripts');$($env:PATH)"
Push-Location $RepoRoot;            npm install;  Pop-Location
Push-Location "$RepoRoot\shared";   npm install;  Pop-Location
Push-Location "$RepoRoot\src";      & $flutter pub get;  Pop-Location

# ─── Done ───────────────────────────────────────────────────────────────────
Step "Setup complete"
Write-Host @"
Next steps (each new PowerShell session):
  1. . .\scripts\biotope-env.ps1              # activate the bounded toolchain
  2. npx supabase start                       # start local Supabase (Docker Desktop)
     -> copy the printed 'anon key' into src\.env.public (SUPABASE_ANON_KEY)
  3. npx supabase db reset                    # apply migrations to the local DB
  4. flutter emulators --launch biotope_pixel # boot the Android emulator
  5. cd src; flutter run                      # build + run the app on the emulator

The emulator reaches local Supabase at http://10.0.2.2:54321 (no WSL / port-forward needed).
"@ -ForegroundColor Green
