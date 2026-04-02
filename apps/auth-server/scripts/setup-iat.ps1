# IAT Setup Script for Windows PowerShell
# This script helps set up the Initial Access Token (IAT) implementation

Write-Host "=== IAT Setup Script ===" -ForegroundColor Green
Write-Host "This script will help you set up the IAT implementation" -ForegroundColor Yellow

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Please run this script from the auth-server directory" -ForegroundColor Red
    exit 1
}

Write-Host "`n1. Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js version
try {
    $nodeVersion = node --version
    $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($majorVersion -lt 18) {
        Write-Host "❌ Node.js 18+ required. Current version: $nodeVersion" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js 18+" -ForegroundColor Red
    exit 1
}

# Check pnpm
try {
    $pnpmVersion = pnpm --version
    Write-Host "✅ pnpm version: $pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ pnpm not found. Please install pnpm" -ForegroundColor Red
    exit 1
}

Write-Host "`n2. Generating IAT signing key..." -ForegroundColor Yellow

# Generate IAT signing key
try {
    $iatKey = node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
    Write-Host "✅ Generated IAT signing key" -ForegroundColor Green
    Write-Host "Key: $iatKey" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Failed to generate IAT signing key" -ForegroundColor Red
    exit 1
}

Write-Host "`n3. Creating environment files..." -ForegroundColor Yellow

# Create .env file if it doesn't exist
$envPath = ".env"

if (-not (Test-Path $envPath)) {
    Copy-Item "env.template" $envPath
    Write-Host "✅ Created Auth server .env from template" -ForegroundColor Green
} else {
    Write-Host "⚠️  Auth server .env already exists" -ForegroundColor Yellow
}

Write-Host "`n4. Updating environment file with IAT configuration..." -ForegroundColor Yellow

# Update Auth server .env
$envContent = Get-Content $envPath -Raw
if ($envContent -notmatch "DCR_IAT_SIGNING_KEY") {
    $envContent += "`n# IAT Configuration`nDCR_IAT_SIGNING_KEY=$iatKey`n"
    Set-Content $envPath $envContent
    Write-Host "✅ Added IAT configuration to Auth server .env" -ForegroundColor Green
} else {
    Write-Host "⚠️  IAT configuration already exists in Auth server .env" -ForegroundColor Yellow
}

Write-Host "`n5. Installing dependencies..." -ForegroundColor Yellow

# Install Auth server dependencies
Write-Host "Installing Auth server dependencies..." -ForegroundColor Cyan
try {
    pnpm install
    Write-Host "✅ Auth server dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install Auth server dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "`n6. Building Auth server..." -ForegroundColor Yellow

# Build Auth server
Write-Host "Building Auth server..." -ForegroundColor Cyan
try {
    pnpm run build
    Write-Host "✅ Auth server built successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to build Auth server" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== IAT Setup Complete! ===" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Start the Auth server: pnpm start" -ForegroundColor White
Write-Host "2. Test the setup: .\test\test-iat.ps1" -ForegroundColor White
Write-Host "`nEnvironment variables configured:" -ForegroundColor Yellow
Write-Host "- DCR_IAT_SIGNING_KEY: $iatKey" -ForegroundColor Cyan
Write-Host "- OIDC_ISSUER: http://localhost:4000" -ForegroundColor Cyan
Write-Host "`nFor detailed documentation, see: docs/IAT_IMPLEMENTATION.md" -ForegroundColor Yellow
