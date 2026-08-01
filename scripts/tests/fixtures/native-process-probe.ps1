param(
  [Parameter(Mandatory = $true)][ValidateSet('warning', 'nonzero', 'args', 'stdin', 'large', 'tree', 'sleep')][string]$Mode,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$PassThrough
)

switch ($Mode) {
  'warning' {
    [Console]::Out.WriteLine('stdout: completed')
    [Console]::Error.WriteLine('warning: expected diagnostic')
    exit 0
  }
  'nonzero' {
    [Console]::Out.WriteLine('success: misleading text')
    [Console]::Error.WriteLine('warning: this command still failed')
    exit 23
  }
  'args' {
    [Console]::Out.WriteLine(([pscustomobject]@{ args = @($PassThrough) } | ConvertTo-Json -Compress))
    exit 0
  }
  'stdin' {
    [Console]::Out.Write(([Console]::In.ReadToEnd()))
    exit 0
  }
  'large' {
    foreach ($number in 1..12000) {
      [Console]::Out.WriteLine(('out-{0:D5} {1}' -f $number, ('o' * 40)))
      [Console]::Error.WriteLine(('err-{0:D5} {1}' -f $number, ('e' * 40)))
    }
    exit 0
  }
  'tree' {
    $child = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @('-NoProfile', '-Command', 'Start-Sleep -Seconds 30') -PassThru -WindowStyle Hidden
    [Console]::Out.WriteLine("parent=$PID child=$($child.Id)")
    [Console]::Out.Flush()
    Start-Sleep -Seconds 30
    exit 0
  }
  'sleep' {
    Start-Sleep -Seconds 30
    [Console]::Out.WriteLine('should not be reached before timeout')
    exit 0
  }
}
