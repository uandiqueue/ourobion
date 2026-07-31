$ErrorActionPreference = 'Stop'
$testRoot = Split-Path $PSScriptRoot -Parent
. (Join-Path $testRoot 'lib\native-process.ps1')
$probe = Join-Path $PSScriptRoot 'fixtures\native-process-probe.ps1'
$powerShell = (Get-Command powershell.exe -CommandType Application -ErrorAction Stop).Path

function Assert-Test([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Probe([string[]]$ProbeArguments, [int]$TimeoutSec = 0, [AllowNull()][string]$StandardInput = $null) {
  $params = @{
    Exe = $powerShell
    Arguments = (@('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $probe) + $ProbeArguments)
    WorkDir = $testRoot
    TimeoutSec = $TimeoutSec
    StandardInput = $StandardInput
  }
  return Invoke-NativeProcess @params
}

$warning = Invoke-Probe @('-Mode', 'warning')
Assert-Test ($warning.ExitCode -eq 0 -and -not $warning.TimedOut) 'a zero-exit command with stderr warning must succeed'
Assert-Test ($warning.StdOut -match 'stdout: completed') 'stdout was not preserved'
Assert-Test ($warning.StdErr -match 'warning: expected diagnostic') 'stderr warning was not preserved'
Assert-Test ($warning.Output -match 'stdout: completed' -and $warning.Output -match 'warning: expected diagnostic') 'combined output omitted a stream'

$nonzero = Invoke-Probe @('-Mode', 'nonzero')
Assert-Test ($nonzero.ExitCode -eq 23 -and -not $nonzero.TimedOut) 'nonzero Process.ExitCode must win over misleading successful text'
Assert-Test ($nonzero.Output -match 'success: misleading text') 'nonzero command output was not preserved for diagnostics'

$cmdProbe = Join-Path $PSScriptRoot 'fixtures\native-process-probe.cmd'
$marker = Join-Path $env:TEMP ('native-process-injected-' + $PID + '.txt')
Remove-Item -LiteralPath $marker -Force -ErrorAction SilentlyContinue
$hostile = @('amp&echo.INJECTED', '%OUROBION_TEST%', 'pipe|echo.INJECTED', 'caret^echo.INJECTED', '<input', '>output', "& echo INJECTED > `"$marker`"")
$cmdRejected = $false
try { Invoke-NativeProcess -Exe $cmdProbe -Arguments $hostile -WorkDir $testRoot | Out-Null } catch { $cmdRejected = $_.Exception.Message -match 'is rejected' }
Assert-Test $cmdRejected 'cmd/bat command script must be rejected before hostile arguments can execute'
Assert-Test (-not (Test-Path -LiteralPath $marker)) 'hostile cmd metacharacters executed instead of being rejected'
$nodeCli = Resolve-NodePackageCli 'npx'
Assert-Test ($nodeCli.NodePath -match 'node\.exe$' -and (Test-Path -LiteralPath $nodeCli.CliPath -PathType Leaf)) 'npx must resolve to node.exe plus npx-cli.js, not npx.cmd'

$bareNodeRoot = Join-Path $env:TEMP ("native process bare node {0}" -f $PID)
$bareNodeBin = Join-Path $bareNodeRoot 'bin'
$bareNode = Join-Path $bareNodeBin 'node.exe'
$oldPath = $env:Path
try {
  [void](New-Item -ItemType Directory -Path $bareNodeBin -Force)
  [void](New-Item -ItemType File -Path $bareNode -Force)
  $env:Path = "$bareNodeBin;$oldPath"
  $pathNode = Get-Command -Name 'node.exe' -CommandType Application -ErrorAction Stop | Select-Object -First 1
  Assert-Test ($pathNode.Path -eq $bareNode) 'minimal PATH node fixture was not selected first'
  $fallbackCli = Resolve-NodePackageCli 'npm'
  Assert-Test ($fallbackCli.NodePath -ne $bareNode -and (Test-Path -LiteralPath $fallbackCli.CliPath -PathType Leaf)) 'node resolution did not fall back when the first PATH node lacked npm-cli.js'
} finally {
  $env:Path = $oldPath
  Remove-Item -LiteralPath $bareNodeRoot -Recurse -Force -ErrorAction SilentlyContinue
}

$expectedArguments = @('space value', 'quote"inside', 'C:\path with space\', '', '-literal-option', 'two words and a "quote"')
$roundTrip = Invoke-Probe (@('-Mode', 'args') + $expectedArguments)
Assert-Test ($roundTrip.ExitCode -eq 0) 'argument probe failed'
$receivedArguments = @((($roundTrip.StdOut | ConvertFrom-Json).args))
Assert-Test ($receivedArguments.Count -eq $expectedArguments.Count) 'argument count changed during launch'
for ($index = 0; $index -lt $expectedArguments.Count; $index += 1) {
  Assert-Test ($receivedArguments[$index] -ceq $expectedArguments[$index]) "argument $index did not survive quoting"
}

$backgroundRoot = Join-Path $env:TEMP ("native process background {0}" -f $PID)
$backgroundProbe = Join-Path $backgroundRoot 'probe with spaces.ps1'
$backgroundOut = Join-Path $backgroundRoot 'stdout.txt'
$backgroundErr = Join-Path $backgroundRoot 'stderr.txt'
$background = $null
try {
  [void](New-Item -ItemType Directory -Path $backgroundRoot -Force)
  Copy-Item -LiteralPath $probe -Destination $backgroundProbe
  $background = Start-NativeBackgroundProcess -Exe $powerShell `
    -Arguments @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $backgroundProbe, '-Mode', 'args', 'background value', 'two words') `
    -WorkDir $backgroundRoot -StandardOutputPath $backgroundOut -StandardErrorPath $backgroundErr
  Assert-Test ($background.WaitForExit(5000)) 'background process with a spaced script path did not exit before its deadline'
  Assert-Test (Test-Path -LiteralPath $backgroundOut -PathType Leaf) 'background process with a spaced script path did not produce stdout'
  $backgroundArgs = @((Get-Content -LiteralPath $backgroundOut -Raw | ConvertFrom-Json).args)
  Assert-Test ($backgroundArgs.Count -eq 2 -and $backgroundArgs[0] -ceq 'background value' -and $backgroundArgs[1] -ceq 'two words') 'background launch split a quoted argument or the spaced script path'
} finally {
  if ($null -ne $background -and -not $background.HasExited) { Stop-NativeProcessTree -ProcessId $background.Id | Out-Null }
  Remove-Item -LiteralPath $backgroundRoot -Recurse -Force -ErrorAction SilentlyContinue
}

$large = Invoke-Probe @('-Mode', 'large')
Assert-Test ($large.ExitCode -eq 0) 'large dual-stream command failed'
$input = "select 'semi;';`nsecond line"
$stdin = Invoke-Probe -ProbeArguments @('-Mode', 'stdin') -StandardInput $input
Assert-Test ($stdin.ExitCode -eq 0 -and $stdin.StdOut -ceq $input) 'standard input was not preserved'

Assert-Test ($large.StdOut.Length -gt 500000 -and $large.StdErr.Length -gt 500000) 'large stdout/stderr capture was truncated or deadlocked'
Assert-Test ($large.StdOut -match 'out-12000' -and $large.StdErr -match 'err-12000') 'large stream tails were not captured'

$timeoutStarted = Get-Date
$timeout = Invoke-Probe @('-Mode', 'tree') 1
$timeoutElapsedMs = ((Get-Date) - $timeoutStarted).TotalMilliseconds
Assert-Test ($timeout.TimedOut -and $timeout.ExitCode -eq -1) 'timed-out command must return the non-success timeout sentinel'
Assert-Test (-not $timeout.CleanupFailed) "timeout cleanup failed: $($timeout.CleanupError)"
Assert-Test ($timeoutElapsedMs -lt 7000) "timeout cleanup exceeded its bounded deadline ($timeoutElapsedMs ms)"
$treeIds = [regex]::Match($timeout.StdOut, 'parent=(\d+) child=(\d+)')
Assert-Test $treeIds.Success 'parent-child fixture did not report both process ids'
Start-Sleep -Milliseconds 250
Assert-Test ($null -eq (Get-Process -Id ([int]$treeIds.Groups[1].Value) -ErrorAction SilentlyContinue)) 'timed-out parent survived cleanup'
Assert-Test ($null -eq (Get-Process -Id ([int]$treeIds.Groups[2].Value) -ErrorAction SilentlyContinue)) 'timed-out child survived cleanup'

$teardownReports = New-Object System.Collections.ArrayList
$originalStop = ${function:Stop-NativeProcessTree}
try {
  Set-Item -Path function:Stop-NativeProcessTree -Value {
    param([int]$ProcessId, [int]$TimeoutMs)
    return [pscustomobject]@{ Succeeded = $false; Error = 'forced teardown failure for regression proof' }
  }
  $teardown = Complete-NativeProcessTeardown -ProcessId 424242 -OnFailure {
    param([string]$Error)
    [void]$teardownReports.Add([pscustomobject]@{ Step = 'Final teardown nao dev server'; Status = 'FAIL'; Evidence = $Error })
  }
  Assert-Test (-not $teardown.Succeeded -and $teardown.Error -match 'forced teardown failure') 'teardown helper hid a Stop-NativeProcessTree failure'
  Assert-Test (@($teardownReports | Where-Object { $_.Status -eq 'FAIL' -and $_.Evidence -match 'forced teardown failure' }).Count -eq 1) 'teardown failure was not recorded as a final FAIL result'
  Assert-Test (@($teardownReports | Where-Object { $_.Status -eq 'FAIL' }).Count -gt 0) 'runner summary would not exit nonzero after teardown failure'
} finally {
  Set-Item -Path function:Stop-NativeProcessTree -Value $originalStop
}

Write-Host 'native-process.tests.ps1: PASS (warning, exit code, quoting, fallback, background path, large streams, timeout cleanup)'
