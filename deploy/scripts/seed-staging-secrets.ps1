# deploy/scripts/seed-staging-secrets.ps1
#
# Idempotently populates Secret Manager in claims-manager-staging-493807 with
# the full set of secrets the compose stack on the staging VM reads at
# boot. Run this once after `terraform apply` in environments/staging has
# created the empty secret shells. Re-running is safe - secrets that
# already have a version are skipped unless -Force is set.
#
# Secrets split into 3 buckets:
#
#   1. Derived from terraform output
#      database-url-api, database-url-auth, redis-url, gcs-hmac-*
#   2. Randomly generated
#      credentials-encryption-key, auth-jwt-secret, auth-oidc-client-secret,
#      auth-dcr-secret, auth-dcr-iat-key, auth-oidc-cookies-keys,
#      auth-jwks-rsa-* (7 components), auth-jwks-ec-* (3 components),
#      frontend-oidc-cookie-secret
#   3. External placeholders (must be replaced by a human before staging
#      can serve real traffic)
#      auth-google-client-id, auth-google-client-secret, openai-api-key,
#      stripe-*, mz-client-credentials, oidc-jwks, nats-url
#
# Usage:
#   pwsh deploy/scripts/seed-staging-secrets.ps1
#   pwsh deploy/scripts/seed-staging-secrets.ps1 -Force       # re-add versions
#   pwsh deploy/scripts/seed-staging-secrets.ps1 -DryRun      # print plan only

[CmdletBinding()]
param(
   [string]$StagingProject   = 'claims-manager-staging-493807',
   [string]$StagingRegion    = 'australia-southeast1',
   [string]$TerraformDir     = (Join-Path $PSScriptRoot '..\terraform\environments\staging'),
   [string]$JwksGeneratorJs  = (Join-Path $PSScriptRoot 'generate-jwks.mjs'),
   [switch]$Force,
   [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$script:PackageMethod = '[seed-staging-secrets]'

function Log { param([string]$Msg) Write-Host "$script:PackageMethod $Msg" }
function Warn { param([string]$Msg) Write-Warning "$script:PackageMethod $Msg" }
function Die  { param([string]$Msg) Write-Error "$script:PackageMethod $Msg"; exit 1 }

function Assert-CommandAvailable {
   param([string]$Name)
   if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
      Die "Required command '$Name' not found on PATH"
   }
}

Assert-CommandAvailable gcloud
Assert-CommandAvailable terraform
Assert-CommandAvailable node

# ── Collect terraform outputs ───────────────────────────────────────
Log "reading terraform outputs from $TerraformDir"
$tfRaw = & terraform -chdir="$TerraformDir" output -json 2>&1
if ($LASTEXITCODE -ne 0) {
   Die "terraform output failed. Did you run 'terraform apply' in $TerraformDir?`n$tfRaw"
}
$tf = $tfRaw | ConvertFrom-Json

function TfOut {
   param([string]$Key)
   $node = $tf.$Key
   if (-not $node) { Die "terraform output '$Key' is missing - redeploy environments/staging first" }
   return $node.value
}

$cloudsqlIp       = TfOut 'cloudsql_private_ip'
$cloudsqlUser     = TfOut 'cloudsql_admin_user'
$cloudsqlPassword = TfOut 'cloudsql_admin_password'
$redisHost        = TfOut 'redis_host'
$redisPort        = TfOut 'redis_port'
$frontendSa       = TfOut 'frontend_sa_email'

# The API and auth-server both live in the same "claims_manager" database.
# apps/auth-server/src/db/client.ts hard-asserts the expected db name and
# refuses to start if it sees anything else. The legacy "auth" and "chat"
# databases in deploy/terraform/modules/cloudsql/main.tf are unused - see
# .github/workflows/cd-staging.yaml which only migrates "claims_manager".
$apiDbName  = 'claims_manager'
$authDbName = 'claims_manager'

$databaseUrlApi  = "postgresql://${cloudsqlUser}:${cloudsqlPassword}@${cloudsqlIp}:5432/${apiDbName}"
$databaseUrlAuth = "postgresql://${cloudsqlUser}:${cloudsqlPassword}@${cloudsqlIp}:5432/${authDbName}"
$redisUrl        = "redis://${redisHost}:${redisPort}/0"

# ── Random + JWKS generation helpers ────────────────────────────────
function New-Random-Hex {
   param([int]$Bytes = 32)
   $buf = New-Object byte[] $Bytes
   [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
   return (-join ($buf | ForEach-Object { $_.ToString('x2') }))
}

function New-Random-Base64 {
   param([int]$Bytes = 32)
   $buf = New-Object byte[] $Bytes
   [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
   return [Convert]::ToBase64String($buf)
}

Log "generating JWKS keypair via $JwksGeneratorJs"
$jwksRaw = & node $JwksGeneratorJs
if ($LASTEXITCODE -ne 0) { Die "generate-jwks.mjs failed:`n$jwksRaw" }
$jwks = $jwksRaw | ConvertFrom-Json

# ── gcloud secret helpers ───────────────────────────────────────────
function Test-SecretExists {
   param([string]$Name)
   & gcloud secrets describe $Name --project=$StagingProject --format='value(name)' *> $null
   return ($LASTEXITCODE -eq 0)
}

function Test-SecretHasVersion {
   param([string]$Name)
   $v = & gcloud secrets versions list $Name --project=$StagingProject --limit=1 --format='value(name)' 2>$null
   return [bool]$v
}

function Set-SecretValue {
   param(
      [Parameter(Mandatory)] [string]$Name,
      [Parameter(Mandatory)] [string]$Value,
      [string]$Label = ''
   )

   if (-not (Test-SecretExists $Name)) {
      Warn "secret '$Name' does not exist in $StagingProject - did terraform apply module.secrets run? skipping"
      $script:Skipped += @{ Name = $Name; Reason = 'missing-shell' }
      return
   }

   if ((Test-SecretHasVersion $Name) -and -not $Force) {
      Log "skip  $Name (already has at least one version)"
      $script:Skipped += @{ Name = $Name; Reason = 'already-populated' }
      return
   }

   if ($DryRun) {
      Log "plan  $Name $Label"
      return
   }

   $tmp = New-TemporaryFile
   $tmpPath = $tmp.FullName
   try {
      # Write without BOM or trailing newline - Secret Manager stores the file bytes verbatim.
      [System.IO.File]::WriteAllBytes($tmpPath, [System.Text.Encoding]::UTF8.GetBytes($Value))
      & gcloud secrets versions add $Name --project=$StagingProject "--data-file=$tmpPath" | Out-Null
      if ($LASTEXITCODE -ne 0) { Die "failed to add version for $Name" }
      Log "write $Name $Label"
      $script:Written += $Name
   } finally {
      Remove-Item $tmpPath -ErrorAction SilentlyContinue
   }
}

$script:Written  = @()
$script:Skipped  = @()
$script:Manual   = @()

# ── 1. Derived from terraform outputs ──────────────────────────────
Set-SecretValue -Name 'database-url-api'  -Value $databaseUrlApi  -Label '(derived)'
Set-SecretValue -Name 'database-url-auth' -Value $databaseUrlAuth -Label '(derived)'
Set-SecretValue -Name 'redis-url'         -Value $redisUrl        -Label '(derived)'

# ── 2. Randomly generated ──────────────────────────────────────────
Set-SecretValue -Name 'credentials-encryption-key'  -Value (New-Random-Hex    32) -Label '(random 32B hex)'
Set-SecretValue -Name 'auth-jwt-secret'             -Value (New-Random-Hex    48) -Label '(random 48B hex)'
Set-SecretValue -Name 'auth-oidc-client-secret'     -Value (New-Random-Base64 48) -Label '(random 48B base64)'
Set-SecretValue -Name 'auth-dcr-secret'             -Value (New-Random-Base64 32) -Label '(random 32B base64)'
Set-SecretValue -Name 'auth-dcr-iat-key'            -Value (New-Random-Base64 32) -Label '(random 32B base64, getIatSigningKey requires base64)'

# OIDC_COOKIES_KEYS must parse as a JSON array - see
# apps/auth-server/src/config/env-validation.ts getOidcCookieKeys.
$cookieKeys = @((New-Random-Base64 32), (New-Random-Base64 32)) | ConvertTo-Json -Compress
Set-SecretValue -Name 'auth-oidc-cookies-keys'      -Value $cookieKeys            -Label '(JSON array, 2 base64 keys)'

Set-SecretValue -Name 'frontend-oidc-cookie-secret' -Value (New-Random-Base64 32) -Label '(random 32B base64)'

# Shared secret for api-server /internal/* service-to-service routes
# (auth-server -> api-server seed-tenant after signup).
Set-SecretValue -Name 'internal-api-token'          -Value (New-Random-Hex    32) -Label '(random 32B hex)'

# JWKS RSA (7 components) + EC (3 components). Names follow
# deploy/terraform/modules/secrets/main.tf and the env vars startup.sh
# renders into staging.env.
Set-SecretValue -Name 'auth-jwks-rsa-n'  -Value $jwks.rsa.n  -Label '(JWK RSA n)'
Set-SecretValue -Name 'auth-jwks-rsa-d'  -Value $jwks.rsa.d  -Label '(JWK RSA d)'
Set-SecretValue -Name 'auth-jwks-rsa-p'  -Value $jwks.rsa.p  -Label '(JWK RSA p)'
Set-SecretValue -Name 'auth-jwks-rsa-q'  -Value $jwks.rsa.q  -Label '(JWK RSA q)'
Set-SecretValue -Name 'auth-jwks-rsa-dp' -Value $jwks.rsa.dp -Label '(JWK RSA dp)'
Set-SecretValue -Name 'auth-jwks-rsa-dq' -Value $jwks.rsa.dq -Label '(JWK RSA dq)'
Set-SecretValue -Name 'auth-jwks-rsa-qi' -Value $jwks.rsa.qi -Label '(JWK RSA qi)'
Set-SecretValue -Name 'auth-jwks-ec-d'   -Value $jwks.ec.d   -Label '(JWK EC  d)'
Set-SecretValue -Name 'auth-jwks-ec-x'   -Value $jwks.ec.x   -Label '(JWK EC  x)'
Set-SecretValue -Name 'auth-jwks-ec-y'   -Value $jwks.ec.y   -Label '(JWK EC  y)'

# ── 3. GCS HMAC (created via gcloud, not random) ───────────────────
function New-GcsHmacKey {
   param([string]$ServiceAccountEmail, [string]$Project)

   if ($DryRun) { Log "plan  create HMAC key for $ServiceAccountEmail"; return $null }

   Log "creating GCS HMAC key for $ServiceAccountEmail"
   $raw = & gcloud storage hmac create $ServiceAccountEmail --project=$Project --format=json 2>&1
   if ($LASTEXITCODE -ne 0) { Die "gcloud storage hmac create failed:`n$raw" }
   $parsed = $raw | ConvertFrom-Json
   return @{ AccessId = $parsed.metadata.accessId; Secret = $parsed.secret }
}

if (-not ((Test-SecretHasVersion 'gcs-hmac-access-key') -or (Test-SecretHasVersion 'gcs-hmac-secret-key')) -or $Force) {
   $hmac = New-GcsHmacKey -ServiceAccountEmail $frontendSa -Project $StagingProject
   if ($hmac) {
      Set-SecretValue -Name 'gcs-hmac-access-key' -Value $hmac.AccessId -Label '(gcloud storage hmac)'
      Set-SecretValue -Name 'gcs-hmac-secret-key' -Value $hmac.Secret   -Label '(gcloud storage hmac)'
   }
} else {
   Log "skip  gcs-hmac-access-key / gcs-hmac-secret-key (already populated)"
   $script:Skipped += @{ Name = 'gcs-hmac-*'; Reason = 'already-populated' }
}

# ── 4. Placeholders for secrets that need manual values ────────────
$placeholders = @(
   @{ Name = 'nats-url';                       Hint = 'Not used on staging. Replace only if NATS is introduced.' }
   @{ Name = 'auth-google-client-id';          Hint = 'GCP Console -> APIs and Services -> Credentials -> OAuth 2.0 client' }
   @{ Name = 'auth-google-client-secret';      Hint = 'Paired with auth-google-client-id' }
   @{ Name = 'oidc-jwks';                      Hint = 'Legacy slot. Leave as REPLACE_ME unless the auth server loads it.' }
   @{ Name = 'openai-api-key';                 Hint = 'https://platform.openai.com/api-keys' }
   @{ Name = 'stripe-secret-key';              Hint = 'Stripe dashboard - test mode key for staging' }
   @{ Name = 'stripe-webhook-secret';          Hint = 'Stripe dashboard - webhook endpoint signing secret' }
   @{ Name = 'stripe-connect-client-id';       Hint = 'Stripe dashboard - Connect client id (ca_...)' }
   @{ Name = 'mz-client-credentials';          Hint = 'MoreZero client credentials JSON blob' }
)

foreach ($p in $placeholders) {
   if (-not (Test-SecretExists $p.Name)) {
      Warn "placeholder target '$($p.Name)' does not exist as a secret shell - skipping"
      continue
   }
   if ((Test-SecretHasVersion $p.Name) -and -not $Force) {
      Log "skip  $($p.Name) (already has a value)"
      continue
   }
   if ($DryRun) {
      Log "plan  $($p.Name) (placeholder REPLACE_ME)"
      $script:Manual += $p
      continue
   }
   $tmp = New-TemporaryFile
   $tmpPath = $tmp.FullName
   try {
      [System.IO.File]::WriteAllBytes($tmpPath, [System.Text.Encoding]::UTF8.GetBytes('REPLACE_ME'))
      & gcloud secrets versions add $p.Name --project=$StagingProject "--data-file=$tmpPath" | Out-Null
      if ($LASTEXITCODE -ne 0) { Die "failed to seed placeholder $($p.Name)" }
      Log "write $($p.Name) (placeholder REPLACE_ME)"
      $script:Manual += $p
   } finally {
      Remove-Item $tmpPath -ErrorAction SilentlyContinue
   }
}

# ── Summary ─────────────────────────────────────────────────────────
Write-Host ''
Write-Host "=== summary ================================================" -ForegroundColor Cyan
Write-Host "Written ($($script:Written.Count)):"
$script:Written | ForEach-Object { Write-Host "  + $_" }
Write-Host ''
Write-Host "Skipped ($($script:Skipped.Count)):"
$script:Skipped | ForEach-Object { Write-Host "  - $($_.Name) ($($_.Reason))" }
Write-Host ''
if ($script:Manual.Count -gt 0) {
   Write-Host "Manual follow-up required - placeholders written as 'REPLACE_ME':" -ForegroundColor Yellow
   $script:Manual | ForEach-Object {
      Write-Host ("  ! {0,-32} {1}" -f $_.Name, $_.Hint) -ForegroundColor Yellow
   }
   Write-Host ''
   Write-Host "Update any placeholder with:" -ForegroundColor Yellow
   Write-Host "  gcloud secrets versions add <NAME> --project=$StagingProject --data-file=-" -ForegroundColor Yellow
}
Write-Host ''
Write-Host "Next:" -ForegroundColor Green
Write-Host "  1. Replace REPLACE_ME placeholders above (if any)."
Write-Host "  2. Roll the MIG once so staging.env picks up new values:"
Write-Host "     gcloud compute instance-groups managed rolling-action replace claims-manager-staging-mig \"
Write-Host "       --zone=australia-southeast1-a --project=$StagingProject"
