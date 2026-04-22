# Deploy Script for EnsureOS Auth Server
# Run this script from the apps/auth-server directory

param(
    [Alias('e')]
    [ValidateSet('prod', 'test')]
    [string]$Env,
    [Alias('t','Tag')]
    [string]$ImageTag = 'latest',
    [switch]$Help
)

if ($Help) {
    Write-Host @"
Deploy Script for EnsureOS Auth Server

Usage:
    .\deploy.ps1 [options]

Options:
    -Env <env>              Environment: 'prod', 'test' (default: local docker-compose)
    -ImageTag <tag>         Docker image tag (default: 'latest')
    -Help                   Show this help message

Examples:
    .\deploy.ps1                    # Local development (docker-compose up)
    .\deploy.ps1 -e prod            # Deploy to Fly.io production
    .\deploy.ps1 -e test           # Deploy to Fly.io test environment
    .\deploy.ps1 -e prod -t v1.2.3  # Deploy specific tag to production
    .\deploy.ps1 -e test -t v1.2.3  # Deploy specific tag to test
"@ -ForegroundColor Cyan
    exit 0
}

$prefix = '[auth-server/deploy.ps1]'
Set-Location -Path $PSScriptRoot
Write-Host "$prefix env=$Env, tag=$ImageTag"

# Local development mode (no environment specified)
if ([string]::IsNullOrWhiteSpace($Env)) {
    Write-Host "$prefix LOCAL: docker-compose build" -ForegroundColor Green
    docker-compose build
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "$prefix docker-compose build failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "$prefix Image built successfully: registry.fly.io/morezero-auth-server" -ForegroundColor Green
    Write-Host "$prefix To start the container: docker-compose up -d" -ForegroundColor Cyan
    return
}

# Production deployment
if ($Env -eq 'prod') {
    $flyAppName = 'morezero-auth-server'
    $flyConfig = 'fly.toml'
    
    # Check if fly.toml exists
    if (-not (Test-Path $flyConfig)) {
        Write-Host "$prefix No Fly config found: $flyConfig" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "$prefix Using config: $flyConfig" -ForegroundColor Blue
    
    $sourceImageRepo = 'registry.fly.io/morezero-auth-server'  # Built by docker-compose
    $pushImageRepo = "registry.fly.io/$flyAppName"          # Push to Fly app registry
    $imageRef = "$pushImageRepo`:$ImageTag"
    
    Write-Host "$prefix Authenticating to Fly registry" -ForegroundColor Blue
    flyctl auth docker
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "$prefix Fly registry authentication failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "$prefix Checking Fly app exists: $flyAppName" -ForegroundColor Blue
    flyctl apps show $flyAppName | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "$prefix Fly app '$flyAppName' not found. Create it first with: flyctl apps create $flyAppName" -ForegroundColor Red
        exit 1
    } else {
        Write-Host "$prefix Fly app found: $flyAppName" -ForegroundColor Green
    }
    
    Write-Host "$prefix Building image via docker-compose" -ForegroundColor Blue
    docker-compose build
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "$prefix build failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "$prefix Tagging built image ($sourceImageRepo) as $imageRef" -ForegroundColor Blue
    docker tag $sourceImageRepo $imageRef
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "$prefix tagging failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "$prefix Setting Docker client timeouts for large image push" -ForegroundColor Blue
    $env:DOCKER_CLIENT_TIMEOUT = "3600"
    $env:COMPOSE_HTTP_TIMEOUT = "3600"
    
    Write-Host "$prefix Pushing $imageRef" -ForegroundColor Blue
    function Invoke-Push {
        param([string]$ref)
        docker push $ref
        return $LASTEXITCODE
    }
    
    $pushExit = Invoke-Push -ref $imageRef
    if ($pushExit -ne 0) {
        Write-Host "$prefix Push failed. Re-authenticating and retrying once..." -ForegroundColor Yellow
        flyctl auth docker
        $pushExit = Invoke-Push -ref $imageRef
        if ($pushExit -ne 0) { 
            Write-Host "$prefix push failed after retry" -ForegroundColor Red
            exit 1
        }
    }
    
    Write-Host "$prefix Resolving image digest for deploy" -ForegroundColor Blue
    $digestRef = $(docker image inspect $imageRef --format '{{index .RepoDigests 0}}' 2>$null)
    if ([string]::IsNullOrWhiteSpace($digestRef) -or ($digestRef -notlike '*@*')) {
        Write-Host "$prefix Digest not available, deploying by tag: $imageRef" -ForegroundColor Yellow
        $deployImageRef = $imageRef
    } else {
        Write-Host "$prefix Using digest: $digestRef" -ForegroundColor Green
        $deployImageRef = $digestRef
    }
    
    Write-Host "$prefix Deploying to Fly app: $flyAppName" -ForegroundColor Blue
    flyctl deploy --image $deployImageRef --app $flyAppName --config $flyConfig
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "$prefix fly deploy failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "$prefix Deployment completed!" -ForegroundColor Green
    Write-Host "$prefix Your app is available at: https://$flyAppName.fly.dev" -ForegroundColor Cyan
    Write-Host "$prefix Check status: flyctl status --app $flyAppName" -ForegroundColor Cyan
    Write-Host "$prefix View logs: flyctl logs --app $flyAppName" -ForegroundColor Cyan
}

# Test deployment
if ($Env -eq 'test') {
    $flyAppName = 'morezero-auth-server-test'
    $flyConfig = 'fly.toml'
    
    # Check if fly.toml exists
    if (-not (Test-Path $flyConfig)) {
        Write-Host "$prefix No Fly config found: $flyConfig" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "$prefix Using config: $flyConfig" -ForegroundColor Blue
    
    $sourceImageRepo = 'registry.fly.io/morezero-auth-server'  # Built by docker-compose
    $pushImageRepo = "registry.fly.io/$flyAppName"          # Push to Fly app registry
    $imageRef = "$pushImageRepo`:$ImageTag"
    
    Write-Host "$prefix Authenticating to Fly registry" -ForegroundColor Blue
    flyctl auth docker
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "$prefix Fly registry authentication failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "$prefix Checking Fly app exists: $flyAppName" -ForegroundColor Blue
    flyctl apps show $flyAppName | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "$prefix Fly app '$flyAppName' not found. Create it first with: flyctl apps create $flyAppName" -ForegroundColor Red
        exit 1
    } else {
        Write-Host "$prefix Fly app found: $flyAppName" -ForegroundColor Green
    }
    
    Write-Host "$prefix Building image via docker-compose" -ForegroundColor Blue
    docker-compose build
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "$prefix build failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "$prefix Tagging built image ($sourceImageRepo) as $imageRef" -ForegroundColor Blue
    docker tag $sourceImageRepo $imageRef
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "$prefix tagging failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "$prefix Setting Docker client timeouts for large image push" -ForegroundColor Blue
    $env:DOCKER_CLIENT_TIMEOUT = "3600"
    $env:COMPOSE_HTTP_TIMEOUT = "3600"
    
    Write-Host "$prefix Pushing $imageRef" -ForegroundColor Blue
    function Invoke-Push {
        param([string]$ref)
        docker push $ref
        return $LASTEXITCODE
    }
    
    $pushExit = Invoke-Push -ref $imageRef
    if ($pushExit -ne 0) {
        Write-Host "$prefix Push failed. Re-authenticating and retrying once..." -ForegroundColor Yellow
        flyctl auth docker
        $pushExit = Invoke-Push -ref $imageRef
        if ($pushExit -ne 0) { 
            Write-Host "$prefix push failed after retry" -ForegroundColor Red
            exit 1
        }
    }
    
    Write-Host "$prefix Resolving image digest for deploy" -ForegroundColor Blue
    $digestRef = $(docker image inspect $imageRef --format '{{index .RepoDigests 0}}' 2>$null)
    if ([string]::IsNullOrWhiteSpace($digestRef) -or ($digestRef -notlike '*@*')) {
        Write-Host "$prefix Digest not available, deploying by tag: $imageRef" -ForegroundColor Yellow
        $deployImageRef = $imageRef
    } else {
        Write-Host "$prefix Using digest: $digestRef" -ForegroundColor Green
        $deployImageRef = $digestRef
    }
    
    Write-Host "$prefix Deploying to Fly app: $flyAppName" -ForegroundColor Blue
    flyctl deploy --image $deployImageRef --app $flyAppName --config $flyConfig
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "$prefix fly deploy failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "$prefix Test deployment completed!" -ForegroundColor Green
    Write-Host "$prefix Your test app is available at: https://$flyAppName.fly.dev" -ForegroundColor Cyan
    Write-Host "$prefix Check status: flyctl status --app $flyAppName" -ForegroundColor Cyan
    Write-Host "$prefix View logs: flyctl logs --app $flyAppName" -ForegroundColor Cyan
}

Write-Host "$prefix Done." -ForegroundColor Green

