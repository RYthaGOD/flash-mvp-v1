# =============================================================================
# FLASH Bridge - Setup Script (PowerShell)
# =============================================================================
# Prepares the environment for first-time deployment
# Usage: .\scripts\setup.ps1
# =============================================================================

Write-Host "╔═══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                    FLASH Bridge Setup Script                          ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if running from project root
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "Error: Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

# =============================================================================
# Step 1: Create directories
# =============================================================================
Write-Host "Step 1: Creating directories..." -ForegroundColor Yellow

New-Item -ItemType Directory -Force -Path "keys" | Out-Null
New-Item -ItemType Directory -Force -Path "backend\logs" | Out-Null

Write-Host "✓ Directories created" -ForegroundColor Green

# =============================================================================
# Step 2: Create environment files from templates
# =============================================================================
Write-Host "Step 2: Setting up environment files..." -ForegroundColor Yellow

if (-not (Test-Path "backend\.env")) {
    if (Test-Path "backend\env-template.txt") {
        Copy-Item "backend\env-template.txt" "backend\.env"
        Write-Host "✓ Created backend\.env from template" -ForegroundColor Green
        Write-Host "  → Please edit backend\.env with your configuration" -ForegroundColor Yellow
    } else {
        Write-Host "✗ backend\env-template.txt not found" -ForegroundColor Red
    }
} else {
    Write-Host "✓ backend\.env already exists" -ForegroundColor Green
}

if (-not (Test-Path "frontend\.env")) {
    if (Test-Path "frontend\env-template.txt") {
        Copy-Item "frontend\env-template.txt" "frontend\.env"
        Write-Host "✓ Created frontend\.env from template" -ForegroundColor Green
        Write-Host "  → Please edit frontend\.env with your configuration" -ForegroundColor Yellow
    } else {
        Write-Host "✗ frontend\env-template.txt not found" -ForegroundColor Red
    }
} else {
    Write-Host "✓ frontend\.env already exists" -ForegroundColor Green
}

# =============================================================================
# Step 3: Generate admin API key if not set
# =============================================================================
Write-Host "Step 3: Checking API key..." -ForegroundColor Yellow

$envContent = Get-Content "backend\.env" -Raw -ErrorAction SilentlyContinue
if ($envContent -match "ADMIN_API_KEY=change-me") {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $newKey = [System.BitConverter]::ToString($bytes).Replace("-", "").ToLower()
    
    $envContent = $envContent -replace "ADMIN_API_KEY=change-me.*", "ADMIN_API_KEY=$newKey"
    Set-Content "backend\.env" $envContent
    Write-Host "✓ Generated new ADMIN_API_KEY" -ForegroundColor Green
} else {
    Write-Host "✓ ADMIN_API_KEY already configured" -ForegroundColor Green
}

# =============================================================================
# Step 4: Check for relayer keypair
# =============================================================================
Write-Host "Step 4: Checking relayer keypair..." -ForegroundColor Yellow

if (-not (Test-Path "keys\relayer-keypair.json")) {
    Write-Host "  No relayer keypair found at keys\relayer-keypair.json" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  To generate a new keypair, run:" -ForegroundColor White
    Write-Host "  solana-keygen new -o keys\relayer-keypair.json" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Or copy an existing keypair to keys\relayer-keypair.json" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "✓ Relayer keypair found" -ForegroundColor Green
}

# =============================================================================
# Step 5: Check Docker
# =============================================================================
Write-Host "Step 5: Checking Docker..." -ForegroundColor Yellow

$dockerExists = Get-Command docker -ErrorAction SilentlyContinue
$dockerComposeExists = Get-Command docker-compose -ErrorAction SilentlyContinue

if ($dockerExists -and $dockerComposeExists) {
    Write-Host "✓ Docker and docker-compose are installed" -ForegroundColor Green
} else {
    Write-Host "✗ Docker or docker-compose not found" -ForegroundColor Red
    Write-Host "  Please install Docker Desktop: https://docs.docker.com/desktop/install/windows-install/" -ForegroundColor White
}

# =============================================================================
# Summary
# =============================================================================
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                         Setup Complete!                               ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host ""
Write-Host "1. Edit backend\.env with your configuration:" -ForegroundColor White
Write-Host "   - Set BITCOIN_BRIDGE_ADDRESS (your BTC address)" -ForegroundColor Gray
Write-Host "   - Set DB_PASSWORD (database password)" -ForegroundColor Gray
Write-Host "   - Configure ARCIUM_* settings" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Edit frontend\.env:" -ForegroundColor White
Write-Host "   - Set REACT_APP_API_URL (backend URL)" -ForegroundColor Gray
Write-Host "   - Set REACT_APP_SOLANA_NETWORK" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Add your relayer keypair:" -ForegroundColor White
Write-Host "   - solana-keygen new -o keys\relayer-keypair.json" -ForegroundColor Gray
Write-Host "   - Or copy existing keypair to keys\relayer-keypair.json" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Start the system:" -ForegroundColor White
Write-Host "   docker-compose up -d" -ForegroundColor Green
Write-Host ""
Write-Host "5. Check status:" -ForegroundColor White
Write-Host "   docker-compose ps" -ForegroundColor Gray
Write-Host "   curl http://localhost:3001/health" -ForegroundColor Gray
Write-Host ""

