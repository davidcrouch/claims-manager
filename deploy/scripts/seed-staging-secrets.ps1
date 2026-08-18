# deploy/scripts/seed-staging-secrets.ps1
# DEPRECATED: Use seed-secrets.ps1 -Environment staging instead.
# This shim is kept for backward compatibility.

[CmdletBinding()]
param(
   [switch]$Force,
   [switch]$DryRun
)

Write-Warning "[seed-staging-secrets] DEPRECATED — use: pwsh deploy/scripts/seed-secrets.ps1 -Environment staging"

$args2 = @('-Environment', 'staging')
if ($Force)  { $args2 += '-Force' }
if ($DryRun) { $args2 += '-DryRun' }

& "$PSScriptRoot/seed-secrets.ps1" @args2
