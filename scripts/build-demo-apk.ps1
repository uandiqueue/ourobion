param(
    [switch]$AcceptDebugSigning,
    [switch]$PreflightOnly
)

# Build the reviewer APK only after proving that the public client config points
# at the approved hosted Supabase project. The current Android release variant
# intentionally uses this Windows host's debug keystore for hackathon sideloads.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ExpectedSupabaseUrl = 'https://bewwvcksgpxoomyjavjp.supabase.co'
$RepoRoot = Split-Path $PSScriptRoot -Parent
$AppRoot = Join-Path $RepoRoot 'apps\biotope'
$PublicEnvPath = Join-Path $AppRoot '.env.public'
$GradlePath = Join-Path $AppRoot 'android\app\build.gradle.kts'
$ApkPath = Join-Path $AppRoot 'build\app\outputs\flutter-apk\app-release.apk'

function Read-PublicEnv {
    param([string[]]$Lines)

    $values = @{}
    foreach ($rawLine in $Lines) {
        $line = $rawLine.Trim()
        if (-not $line -or $line.StartsWith('#')) {
            continue
        }

        $parts = $line.Split('=', 2)
        if ($parts.Count -eq 2) {
            $values[$parts[0].Trim()] = $parts[1].Trim()
        }
    }
    return $values
}

function Assert-HostedPublicEnv {
    param(
        [hashtable]$Values,
        [string]$Source
    )

    $url = $Values['SUPABASE_URL']
    $anonKey = $Values['SUPABASE_ANON_KEY']

    if ($url -ne $ExpectedSupabaseUrl) {
        throw "$Source must set SUPABASE_URL=$ExpectedSupabaseUrl. Refusing to build an APK for localhost or another project."
    }
    if ([string]::IsNullOrWhiteSpace($anonKey) -or $anonKey -match '^(your-|<|change-me|placeholder)') {
        throw "$Source must contain the hosted project's public Supabase anon key."
    }
}

if (-not (Test-Path -LiteralPath $PublicEnvPath)) {
    throw "Missing $PublicEnvPath. Copy the approved hosted public client config into this worktree before building."
}
if (-not (Test-Path -LiteralPath $GradlePath)) {
    throw "Missing Android Gradle file: $GradlePath"
}

$publicEnv = Read-PublicEnv -Lines (Get-Content -LiteralPath $PublicEnvPath)
Assert-HostedPublicEnv -Values $publicEnv -Source 'apps/biotope/.env.public'

$gradleSource = Get-Content -LiteralPath $GradlePath -Raw
$usesDebugSigning = $gradleSource -match 'signingConfig\s*=\s*signingConfigs\.getByName\("debug"\)'
if ($usesDebugSigning -and -not $AcceptDebugSigning) {
    throw @"
The release variant uses this machine's debug keystore.
Re-run with -AcceptDebugSigning only for the hackathon reviewer APK.
All demo APKs must be built on this one Windows host. A build from another
machine cannot upgrade this app; Android must uninstall the previous demo first.
This APK is for sideloading only and is not eligible for Play Store publishing.
"@
}

Write-Host 'APK preflight passed:' -ForegroundColor Green
Write-Host "  hosted backend  $ExpectedSupabaseUrl"
if ($usesDebugSigning) {
    Write-Host '  signing         debug keystore explicitly accepted; one Windows build host; sideload only' -ForegroundColor Yellow
} else {
    Write-Host '  signing         non-debug release signing configured'
}

if ($PreflightOnly) {
    Write-Host 'Preflight-only mode: no dependencies installed and no APK built.'
    exit 0
}

$gitStatus = @(& git -C $RepoRoot status --porcelain --untracked-files=normal)
if ($LASTEXITCODE -ne 0) {
    throw 'Unable to inspect the Git worktree before the release build.'
}
if ($gitStatus.Count -ne 0) {
    throw 'The Git worktree is dirty. Commit and review all source changes before building the release APK.'
}

. (Join-Path $RepoRoot 'scripts\biotope-env.ps1')
$ErrorActionPreference = 'Stop'

Push-Location $AppRoot
try {
    & flutter pub get
    if ($LASTEXITCODE -ne 0) {
        throw "flutter pub get failed with exit code $LASTEXITCODE"
    }

    # Deliberately omit --split-per-abi: reviewers receive one universal APK.
    & flutter build apk --release --no-pub
    if ($LASTEXITCODE -ne 0) {
        throw "flutter build apk failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}

if (-not (Test-Path -LiteralPath $ApkPath)) {
    throw "Flutter reported success but the expected APK is missing: $ApkPath"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($ApkPath)
try {
    $entry = $archive.GetEntry('assets/flutter_assets/.env.public')
    if ($null -eq $entry) {
        throw 'The APK does not contain assets/flutter_assets/.env.public.'
    }

    $stream = $entry.Open()
    $reader = [System.IO.StreamReader]::new($stream)
    try {
        $embeddedEnv = Read-PublicEnv -Lines (($reader.ReadToEnd()) -split "\r?\n")
    }
    finally {
        $reader.Dispose()
        $stream.Dispose()
    }
}
finally {
    $archive.Dispose()
}
Assert-HostedPublicEnv -Values $embeddedEnv -Source 'the .env.public embedded in app-release.apk'

$androidSdk = if ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { $env:ANDROID_HOME }
if ([string]::IsNullOrWhiteSpace($androidSdk)) {
    throw 'ANDROID_SDK_ROOT/ANDROID_HOME is not set after activating the bounded toolchain.'
}
$buildToolsRoot = Join-Path $androidSdk 'build-tools'
$apksigner = Get-ChildItem -LiteralPath $buildToolsRoot -Directory |
    ForEach-Object { Join-Path $_.FullName 'apksigner.bat' } |
    Where-Object { Test-Path -LiteralPath $_ } |
    Sort-Object -Descending |
    Select-Object -First 1
if (-not $apksigner) {
    throw "No apksigner.bat found under $buildToolsRoot"
}

& $apksigner verify --verbose --print-certs $ApkPath
if ($LASTEXITCODE -ne 0) {
    throw "apksigner verification failed with exit code $LASTEXITCODE"
}

$apk = Get-Item -LiteralPath $ApkPath
$sha256 = (Get-FileHash -LiteralPath $ApkPath -Algorithm SHA256).Hash.ToLowerInvariant()
$sourceCommit = (& git -C $RepoRoot rev-parse HEAD).Trim()

Write-Host ''
Write-Host 'Reviewer APK verified:' -ForegroundColor Green
Write-Host "  path            $($apk.FullName)"
Write-Host "  bytes           $($apk.Length)"
Write-Host "  sha256          $sha256"
Write-Host "  source commit   $sourceCommit"
Write-Host "  hosted backend  $ExpectedSupabaseUrl (verified inside APK)"
Write-Host '  signing         debug keystore; same-host upgrades only; not Play Store eligible'
