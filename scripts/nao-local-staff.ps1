<#
.SYNOPSIS
Idempotently grant or revoke Nao staff membership on the local Supabase stack.

.DESCRIPTION
Uses psql inside the fixed local Supabase database container, never a host-supplied database URL
or the HTTP service-role API. It never prints a credential and changes only public.nao_members for
an existing auth.users email. Grant restores a previously revoked/suspended membership; Revoke
preserves the audit row and makes authorization fail immediately.

.EXAMPLE
.\scripts\nao-local-staff.ps1 -Action Grant -Email curator@example.test -Role curator
.\scripts\nao-local-staff.ps1 -Action Revoke -Email curator@example.test
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [ValidateSet('Grant', 'Revoke')]
  [string]$Action,

  [Parameter(Mandatory)]
  [ValidatePattern('^[^\s@]+@[^\s@]+\.[^\s@]+$')]
  [string]$Email,

  [ValidateSet('viewer', 'curator', 'admin')]
  [string]$Role = 'viewer'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# This exact container is created by `supabase start` for this repository. There is deliberately
# no database-URL parameter: libpq query options can override a URL host, so accepting one would
# make a superficially local URL an unsafe boundary.
$ContainerName = 'supabase_db_ourobion'
$runningContainers = @(& docker ps --filter "name=^/$ContainerName$" --format '{{.Names}}')
if ($LASTEXITCODE -ne 0) {
  throw 'Could not inspect Docker. Start the local Supabase stack before provisioning staff access.'
}
$runningContainers = @($runningContainers | Where-Object { $_ -and $_.Trim().Length -gt 0 })
if ($runningContainers.Count -ne 1 -or $runningContainers[0].Trim() -ne $ContainerName) {
  throw "Refusing to continue: the exact local container '$ContainerName' is not running."
}

$lookupArgs = @(
  'exec', $ContainerName, 'psql', '-U', 'postgres', '-d', 'postgres',
  '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-v', "email=$Email",
  '-c', "select id from auth.users where lower(email) = lower(:'email') limit 1;"
)
$userId = & docker @lookupArgs
if ($LASTEXITCODE -ne 0) { throw 'Could not query the local auth user.' }
$userId = ($userId | Select-Object -First 1).Trim()
if ($userId -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$') {
  throw "No local auth.users account exists for $Email. Sign in/create the local account before provisioning staff access."
}

if ($Action -eq 'Grant') {
$sql = @'
insert into public.nao_members (user_id, role, status, revoked_at, updated_at)
values (:'uid'::uuid, :'role', 'active', null, now())
on conflict (user_id) do update
set role = excluded.role, status = 'active', revoked_at = null, updated_at = now();
'@
  $mutationArgs = @(
    'exec', $ContainerName, 'psql', '-U', 'postgres', '-d', 'postgres',
    '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-v', "uid=$userId", '-v', "role=$Role", '-c', $sql
  )
  & docker @mutationArgs
  if ($LASTEXITCODE -ne 0) { throw 'Local staff grant failed.' }
  Write-Host "Granted local Nao $Role membership for $Email."
} else {
$sql = @'
update public.nao_members
set status = 'suspended', revoked_at = coalesce(revoked_at, now()), updated_at = now()
where user_id = :'uid'::uuid;
'@
  $mutationArgs = @(
    'exec', $ContainerName, 'psql', '-U', 'postgres', '-d', 'postgres',
    '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-v', "uid=$userId", '-c', $sql
  )
  & docker @mutationArgs
  if ($LASTEXITCODE -ne 0) { throw 'Local staff revoke failed.' }
  Write-Host "Revoked local Nao membership for $Email (idempotent; audit row retained)."
}
