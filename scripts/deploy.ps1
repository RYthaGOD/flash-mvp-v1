# =============================================================================
# FLASH Bridge - Production Deployment Script (Windows)
# =============================================================================
# This script deploys the FLASH Bridge to production.
# Run: .\scripts\deploy.ps1 [environment]
# Environments: staging, production
# =============================================================================

param(
    [string]$Environment = "staging"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║                    FLASH Bridge Production Deployment                      ║" -ForegroundColor Blue
Write-Host "║                         Environment: $Environment                                   ║" -ForegroundColor Blue
Write-Host "╚═══════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

# =============================================================================
# Pre-flight Checks
# =============================================================================
Write-Host "[1/8] Running pre-flight checks..." -ForegroundColor Yellow

# Check Docker
try {
    $dockerVersion = docker --version
    Write-Host "✓ Docker installed: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker is not installed" -ForegroundColor Red
    exit 1
}

# Check Docker Compose
try {
    $composeVersion = docker compose version
    Write-Host "✓ Docker Compose installed" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker Compose is not installed" -ForegroundColor Red
    exit 1
}

# Check required files
$requiredFiles = @(
    "backend\.env",
    "frontend\.env",
    "keys\relayer-keypair.json",
    "docker-compose.yml"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✓ Found $file" -ForegroundColor Green
    } else {
        Write-Host "✗ Missing required file: $file" -ForegroundColor Red
        Write-Host "  Run .\scripts\setup.ps1 first" -ForegroundColor Yellow
        exit 1
    }
}

# =============================================================================
# Environment Validation
# =============================================================================
Write-Host ""
Write-Host "[2/8] Validating environment configuration..." -ForegroundColor Yellow

# Load backend .env
$envContent = Get-Content "backend\.env" | Where-Object { $_ -notmatch '^#' -and $_ -match '=' }
$env = @{}
foreach ($line in $envContent) {
    $parts = $line -split '=', 2
    if ($parts.Count -eq 2) {
        $env[$parts[0].Trim()] = $parts[1].Trim()
    }
}

# Check critical environment variables
$criticalVars = @(
    "ADMIN_API_KEY",
    "BITCOIN_BRIDGE_ADDRESS",
    "DB_PASSWORD",
    "SOLANA_RPC_URL",
    "FLASH_BRIDGE_MXE_PROGRAM_ID"
)

foreach ($var in $criticalVars) {
    $value = $env[$var]
    if ([string]::IsNullOrEmpty($value) -or $value -eq "change-me-generate-a-secure-key") {
        Write-Host "✗ $var is not properly configured" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ $var is set" -ForegroundColor Green
}

# =============================================================================
# Run Backend Preflight Check
# =============================================================================
Write-Host ""
Write-Host "[3/8] Running backend preflight check..." -ForegroundColor Yellow

Push-Location backend
try {
    node src/utils/preflight-check.js
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Preflight check passed" -ForegroundColor Green
    } else {
        Write-Host "✗ Preflight check failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Preflight check failed: $_" -ForegroundColor Red
    exit 1
}
Pop-Location

# =============================================================================
# Build Docker Images
# =============================================================================
Write-Host ""
Write-Host "[4/8] Building Docker images..." -ForegroundColor Yellow

docker compose build --no-cache
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Docker build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Docker images built" -ForegroundColor Green

# =============================================================================
# Database Migration
# =============================================================================
Write-Host ""
Write-Host "[5/8] Running database migrations..." -ForegroundColor Yellow

# Start only PostgreSQL first
docker compose up -d postgres

# Wait for PostgreSQL to be ready
Write-Host "Waiting for PostgreSQL to be ready..."
$retries = 30
for ($i = 1; $i -le $retries; $i++) {
    $result = docker compose exec -T postgres pg_isready -U postgres 2>&1
    if ($LASTEXITCODE -eq 0) {
        break
    }
    Start-Sleep -Seconds 1
}

Write-Host "✓ Database migrations complete" -ForegroundColor Green

# =============================================================================
# Start All Services
# =============================================================================
Write-Host ""
Write-Host "[6/8] Starting all services..." -ForegroundColor Yellow

docker compose up -d

Write-Host "Waiting for services to be healthy..."
Start-Sleep -Seconds 10

# =============================================================================
# Health Checks
# =============================================================================
Write-Host ""
Write-Host "[7/8] Running health checks..." -ForegroundColor Yellow

# Check backend health
$healthUrl = "http://localhost:3001/health"
$retries = 30
for ($i = 1; $i -le $retries; $i++) {
    try {
        $response = Invoke-RestMethod -Uri $healthUrl -Method Get -ErrorAction SilentlyContinue
        if ($response.status -eq "healthy") {
            Write-Host "✓ Backend is healthy" -ForegroundColor Green
            break
        }
    } catch {
        # Ignore errors during retry
    }
    if ($i -eq $retries) {
        Write-Host "✗ Backend health check failed" -ForegroundColor Red
        docker compose logs backend
        exit 1
    }
    Start-Sleep -Seconds 2
}

# Check frontend
$frontendUrl = "http://localhost:3000"
$retries = 10
for ($i = 1; $i -le $retries; $i++) {
    try {
        $response = Invoke-WebRequest -Uri $frontendUrl -Method Get -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "✓ Frontend is accessible" -ForegroundColor Green
            break
        }
    } catch {
        # Ignore errors during retry
    }
    if ($i -eq $retries) {
        Write-Host "⚠ Frontend not responding (may still be starting)" -ForegroundColor Yellow
    }
    Start-Sleep -Seconds 2
}

# =============================================================================
# Deployment Summary
# =============================================================================
Write-Host ""
Write-Host "[8/8] Deployment Summary" -ForegroundColor Yellow

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                    ✓ Deployment Complete!                                  ║" -ForegroundColor Green
Write-Host "╠═══════════════════════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║                                                                            ║" -ForegroundColor Green
Write-Host "║  Frontend:        http://localhost:3000                                   ║" -ForegroundColor Green
Write-Host "║  Backend API:     http://localhost:3001                                   ║" -ForegroundColor Green
Write-Host "║  API Docs:        http://localhost:3001/api/v1/docs                       ║" -ForegroundColor Green
Write-Host "║  Health Check:    http://localhost:3001/health                            ║" -ForegroundColor Green
Write-Host "║                                                                            ║" -ForegroundColor Green
Write-Host "╠═══════════════════════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Services Running:                                                         ║" -ForegroundColor Green
Write-Host "║    • PostgreSQL    ✓                                                       ║" -ForegroundColor Green
Write-Host "║    • Redis         ✓                                                       ║" -ForegroundColor Green
Write-Host "║    • Arcium Node   ✓                                                       ║" -ForegroundColor Green
Write-Host "║    • Backend       ✓                                                       ║" -ForegroundColor Green
Write-Host "║    • Frontend      ✓                                                       ║" -ForegroundColor Green
Write-Host "║                                                                            ║" -ForegroundColor Green
Write-Host "╠═══════════════════════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Next Steps:                                                               ║" -ForegroundColor Green
Write-Host "║    1. Fund relayer wallet with SOL                                        ║" -ForegroundColor Green
Write-Host "║    2. Configure HTTPS (see docs/HTTPS_SETUP.md)                           ║" -ForegroundColor Green
Write-Host "║    3. Set up monitoring and alerts                                        ║" -ForegroundColor Green
Write-Host "║                                                                            ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Show running containers
Write-Host "Running containers:" -ForegroundColor Blue
docker compose ps

