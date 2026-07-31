# PowerShell 5.1-safe native-process runner for bounded local automation.
# Captures stdout and stderr asynchronously and treats Process.ExitCode as the
# only command-success signal. Stderr remains diagnostic output: many tools
# emit warnings there while returning exit 0.

function ConvertTo-NativeCommandLineArgument([string]$Argument) {
  if ($null -eq $Argument -or $Argument.Length -eq 0) { return '""' }
  if ($Argument -notmatch '[\s"]') { return $Argument }

  $escaped = New-Object System.Text.StringBuilder
  [void]$escaped.Append('"')
  $backslashes = 0
  foreach ($character in $Argument.ToCharArray()) {
    if ($character -eq '\') {
      $backslashes += 1
      continue
    }

    if ($character -eq '"') {
      [void]$escaped.Append('\', ($backslashes * 2) + 1)
      [void]$escaped.Append('"')
      $backslashes = 0
      continue
    }

    if ($backslashes -gt 0) { [void]$escaped.Append('\', $backslashes) }
    [void]$escaped.Append($character)
    $backslashes = 0
  }

  # Backslashes immediately before the closing quote must be doubled.
  if ($backslashes -gt 0) { [void]$escaped.Append('\', $backslashes * 2) }
  [void]$escaped.Append('"')
  return $escaped.ToString()
}

function Join-NativeCommandLine([string[]]$Arguments) {
  return (@($Arguments | ForEach-Object { ConvertTo-NativeCommandLineArgument $_ }) -join ' ')
}

function Resolve-NativeProcessStart([string]$Exe, [string[]]$Arguments) {
  $command = Get-Command -Name $Exe -CommandType Application -ErrorAction Stop | Select-Object -First 1
  $path = if ($command.Path) { $command.Path } else { $command.Source }
  if (-not $path) { throw "Unable to resolve native command '$Exe'." }

  # Never route arbitrary command files through cmd.exe. Its metacharacter
  # grammar would reinterpret otherwise exact native arguments.
  if ([IO.Path]::GetExtension($path) -match '^\.(cmd|bat)$') {
    throw "Native command '$path' is a command script and is rejected; invoke its underlying executable directly."
  }

  return @{ FileName = $path; Arguments = Join-NativeCommandLine $Arguments }
}

function Resolve-NodePackageCli([ValidateSet('npm', 'npx')][string]$Cli) {
  $fromPath = Get-Command -Name 'node.exe' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  $repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
  $toolchainNode = Join-Path (Split-Path $repoRoot -Parent) 'biotope-toolchain\miniconda\envs\biotope\node.exe'
  $nodes = @(
    $(if ($null -ne $fromPath) { $fromPath.Path }),
    $toolchainNode
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } | Select-Object -Unique
  foreach ($node in $nodes) {
    $candidate = Join-Path (Split-Path $node -Parent) "node_modules\npm\bin\$Cli-cli.js"
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      continue
    }
    return @{ NodePath = $node; CliPath = $candidate }
  }
  throw ('Unable to resolve node.exe with {0}-cli.js from PATH or the project sibling biotope-toolchain.' -f $Cli)
}

function Invoke-NodePackageCli {
  param(
    [Parameter(Mandatory = $true)][ValidateSet('npm', 'npx')][string]$Cli,
    [string[]]$Arguments = @(),
    [Parameter(Mandatory = $true)][string]$WorkDir,
    [ValidateRange(0, 2147483)][int]$TimeoutSec = 0,
    [AllowNull()][string]$StandardInput = $null
  )
  $resolved = Resolve-NodePackageCli $Cli
  return Invoke-NativeProcess -Exe $resolved.NodePath -Arguments (@($resolved.CliPath) + $Arguments) -WorkDir $WorkDir -TimeoutSec $TimeoutSec -StandardInput $StandardInput
}
function Start-NativeBackgroundProcess {
  param(
    [Parameter(Mandatory = $true)][string]$Exe,
    [string[]]$Arguments = @(),
    [Parameter(Mandatory = $true)][string]$WorkDir,
    [Parameter(Mandatory = $true)][string]$StandardOutputPath,
    [Parameter(Mandatory = $true)][string]$StandardErrorPath
  )

  if (-not (Test-Path -LiteralPath $WorkDir -PathType Container)) {
    throw "Native command working directory does not exist: $WorkDir"
  }

  $resolved = Resolve-NativeProcessStart $Exe $Arguments
  # Start-Process on Windows PowerShell 5.1 joins an ArgumentList array with
  # spaces. Supply one already-quoted command line so paths such as npm-cli.js
  # under a directory with spaces remain one argument.
  return Start-Process -FilePath $resolved.FileName -ArgumentList $resolved.Arguments `
    -WorkingDirectory $WorkDir -RedirectStandardOutput $StandardOutputPath `
    -RedirectStandardError $StandardErrorPath -PassThru -WindowStyle Hidden
}

function Complete-NativeProcessTeardown {
  param(
    [int]$ProcessId,
    [ValidateRange(1, 2147483647)][int]$TimeoutMs = 5000,
    [AllowNull()][scriptblock]$OnFailure = $null
  )

  $cleanup = Stop-NativeProcessTree -ProcessId $ProcessId -TimeoutMs $TimeoutMs
  if ($null -ne $cleanup -and $cleanup.Succeeded) {
    return [pscustomobject]@{ Succeeded = $true; Error = $null }
  }

  $error = if ($null -ne $cleanup -and $cleanup.Error) {
    [string]$cleanup.Error
  } else {
    'process-tree cleanup returned no success result'
  }
  if ($null -ne $OnFailure) { [void](& $OnFailure $error) }
  return [pscustomobject]@{ Succeeded = $false; Error = $error }
}

function Wait-NativeTasks([Threading.Tasks.Task[]]$Tasks, [ValidateRange(1, 2147483647)][int]$TimeoutMs) {
  try { return [Threading.Tasks.Task]::WaitAll($Tasks, $TimeoutMs) } catch { return $false }
}

function Stop-NativeProcessTree {
  param(
    [int]$ProcessId,
    [ValidateRange(1, 2147483647)][int]$TimeoutMs = 5000
  )

  $result = [pscustomobject]@{ Succeeded = $false; Error = $null }
  $target = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if ($null -eq $target) {
    $result.Succeeded = $true
    return $result
  }

  try {
    if ($env:OS -eq 'Windows_NT') {
      $info = New-Object System.Diagnostics.ProcessStartInfo
      $info.FileName = 'taskkill.exe'
      $info.Arguments = "/PID $ProcessId /T /F"
      $info.UseShellExecute = $false
      $info.CreateNoWindow = $true
      $info.RedirectStandardOutput = $true
      $info.RedirectStandardError = $true
      $killer = New-Object System.Diagnostics.Process
      $killer.StartInfo = $info
      [void]$killer.Start()
      $killerTasks = [Threading.Tasks.Task[]]@($killer.StandardOutput.ReadToEndAsync(), $killer.StandardError.ReadToEndAsync())
      if (-not $killer.WaitForExit($TimeoutMs)) {
        try { $killer.Kill() } catch {}
        [void]$killer.WaitForExit(1000)
        $result.Error = 'taskkill did not exit before cleanup deadline'
        return $result
      }
      if (-not (Wait-NativeTasks -Tasks $killerTasks -TimeoutMs $TimeoutMs)) {
        $result.Error = 'taskkill streams did not drain before cleanup deadline'
        return $result
      }
      if ($killer.ExitCode -ne 0) {
        $result.Error = "taskkill exited $($killer.ExitCode)"
        return $result
      }
    } else {
      $target.Kill()
      if (-not $target.WaitForExit($TimeoutMs)) {
        $result.Error = 'process did not exit before cleanup deadline'
        return $result
      }
    }

    if (-not $target.WaitForExit($TimeoutMs)) {
      $result.Error = 'target process did not exit before cleanup deadline'
      return $result
    }
    if ($null -ne (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) {
      $result.Error = 'target process remains after cleanup'
      return $result
    }
    $result.Succeeded = $true
    return $result
  } catch {
    $result.Error = $_.Exception.Message
    return $result
  }
}

function Invoke-NativeProcess {
  param(
    [Parameter(Mandatory = $true)][string]$Exe,
    [string[]]$Arguments = @(),
    [Parameter(Mandatory = $true)][string]$WorkDir,
    [ValidateRange(0, 2147483)][int]$TimeoutSec = 0,
    [AllowNull()][string]$StandardInput = $null,
    [ValidateRange(1, 2147483647)][int]$CleanupTimeoutMs = 5000
  )

  if (-not (Test-Path -LiteralPath $WorkDir -PathType Container)) {
    throw "Native command working directory does not exist: $WorkDir"
  }

  $resolved = Resolve-NativeProcessStart $Exe $Arguments
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = $resolved.FileName
  $info.Arguments = $resolved.Arguments
  $info.WorkingDirectory = $WorkDir
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $info.RedirectStandardInput = $true

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $info
  [void]$process.Start()
  if ($null -ne $StandardInput) { $process.StandardInput.Write($StandardInput) }
  $process.StandardInput.Close()

  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()
  $tasks = [Threading.Tasks.Task[]]@($stdoutTask, $stderrTask)
  $timedOut = $TimeoutSec -gt 0 -and -not $process.WaitForExit([int]($TimeoutSec * 1000))

  if ($timedOut) {
    $cleanup = Stop-NativeProcessTree -ProcessId $process.Id -TimeoutMs $CleanupTimeoutMs
    $exited = $process.WaitForExit($CleanupTimeoutMs)
    $drained = Wait-NativeTasks -Tasks $tasks -TimeoutMs $CleanupTimeoutMs
    $cleanupFailed = -not ($cleanup.Succeeded -and $exited -and $drained)
    $stdout = if ($drained -and $stdoutTask.Status -eq 'RanToCompletion') { $stdoutTask.Result } else { '' }
    $stderr = if ($drained -and $stderrTask.Status -eq 'RanToCompletion') { $stderrTask.Result } else { '' }
    $output = @($stdout, $stderr) | Where-Object { $_.Length -gt 0 }
    $reason = if ($cleanupFailed) { "timeout cleanup failed: $($cleanup.Error)" } else { 'native command timed out and was terminated' }
    return [pscustomobject]@{
      ExitCode = -1
      Output = ($output -join [Environment]::NewLine)
      StdOut = $stdout
      StdErr = $stderr
      TimedOut = $true
      CleanupFailed = $cleanupFailed
      CleanupError = $reason
      ProcessId = $process.Id
    }
  }

  $process.WaitForExit()
  if (-not (Wait-NativeTasks -Tasks $tasks -TimeoutMs $CleanupTimeoutMs)) {
    throw "Native command exited but its output streams did not drain within $CleanupTimeoutMs ms."
  }
  $stdout = $stdoutTask.GetAwaiter().GetResult()
  $stderr = $stderrTask.GetAwaiter().GetResult()
  $output = @($stdout, $stderr) | Where-Object { $_.Length -gt 0 }

  return [pscustomobject]@{
    ExitCode = $process.ExitCode
    Output = ($output -join [Environment]::NewLine)
    StdOut = $stdout
    StdErr = $stderr
    TimedOut = $false
    CleanupFailed = $false
    CleanupError = $null
    ProcessId = $process.Id
  }
}
