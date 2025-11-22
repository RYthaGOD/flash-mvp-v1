# FLASH Bridge - Setup Fix Script
# This script fixes common setup issues

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FLASH Bridge - Setup Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"

# Check and create backend .env
Write-Host "Checking backend/.env..." -ForegroundColor Yellow
if (-not (Test-Path "backend\.env")) {
    Write-Host "Creating backend/.env..." -ForegroundColor Green
    @"
PORT=3001
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
ZENZEC_MINT=YourZenZECMintAddressHere
ENABLE_RELAYER=false
RELAYER_KEYPAIR_PATH=~/.config/solana/id.json
ZENZEC_TO_SOL_RATE=0.001
"@ | Out-File -FilePath "backend\.env" -Encoding utf8
    Write-Host "✓ Created backend/.env" -ForegroundColor Green
} else {
    Write-Host "✓ backend/.env exists" -ForegroundColor Green
}

# Check and create frontend .env
Write-Host "Checking frontend/.env..." -ForegroundColor Yellow
if (-not (Test-Path "frontend\.env")) {
    Write-Host "Creating frontend/.env..." -ForegroundColor Green
    @"
REACT_APP_API_URL=http://localhost:3001
REACT_APP_PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
REACT_APP_ZENZEC_MINT=YourZenZECMintAddressHere
"@ | Out-File -FilePath "frontend\.env" -Encoding utf8
    Write-Host "✓ Created frontend/.env" -ForegroundColor Green
} else {
    Write-Host "✓ frontend/.env exists" -ForegroundColor Green
}

# Check and install backend dependencies
Write-Host "`nChecking backend dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "backend\node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
    Set-Location backend
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Backend dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "✗ Backend installation failed" -ForegroundColor Red
    }
    Set-Location ..
} else {
    Write-Host "✓ Backend dependencies exist" -ForegroundColor Green
}

# Check and install frontend dependencies
Write-Host "`nChecking frontend dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location frontend
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Frontend dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "✗ Frontend installation failed" -ForegroundColor Red
    }
    Set-Location ..
} else {
    Write-Host "✓ Frontend dependencies exist" -ForegroundColor Green
}

# Check for missing tab files
Write-Host "`nChecking component files..." -ForegroundColor Yellow
$requiredFiles = @(
    "frontend\src\components\TabbedInterface.js",
    "frontend\src\components\TabbedInterface.css",
    "frontend\src\components\tabs\BridgeTab.js",
    "frontend\src\components\tabs\ZcashTab.js",
    "frontend\src\components\tabs\ArciumTab.js",
    "frontend\src\components\tabs\TokenManagementTab.js",
    "frontend\src\components\tabs\TransactionHistoryTab.js",
    "frontend\src\components\tabs\TabStyles.css"
)

$allFilesExist = $true
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✓ $file" -ForegroundColor Green
    } else {
        Write-Host "✗ $file MISSING" -ForegroundColor Red
        $allFilesExist = $false
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
if ($allFilesExist) {
    Write-Host "✓ Setup complete! Ready to run." -ForegroundColor Green
    Write-Host "`nTo start the system:" -ForegroundColor Yellow
    Write-Host "  .\run.ps1" -ForegroundColor White
    Write-Host "`nOr manually:" -ForegroundColor Yellow
    Write-Host "  Terminal 1: cd backend && npm start" -ForegroundColor White
    Write-Host "  Terminal 2: cd frontend && npm start" -ForegroundColor White
} else {
    Write-Host "⚠ Some files are missing. Check errors above." -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Cyan

