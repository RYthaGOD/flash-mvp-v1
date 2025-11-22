# Start Frontend Server
# This script starts the React frontend development server

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting FLASH Bridge Frontend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"

# Navigate to frontend directory
$frontendPath = Join-Path $PSScriptRoot "frontend"

if (-not (Test-Path $frontendPath)) {
    Write-Host "Error: frontend directory not found!" -ForegroundColor Red
    Write-Host "Expected path: $frontendPath" -ForegroundColor Yellow
    exit 1
}

Set-Location $frontendPath

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "Creating frontend/.env with defaults..." -ForegroundColor Yellow
    @"
REACT_APP_API_URL=http://localhost:3001
REACT_APP_PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
REACT_APP_ZENZEC_MINT=YourZenZECMintAddressHere
"@ | Out-File -FilePath ".env" -Encoding utf8
    Write-Host "✓ Created .env file" -ForegroundColor Green
}

# Check if port 3000 is in use
$portInUse = Test-NetConnection -ComputerName localhost -Port 3000 -InformationLevel Quiet -WarningAction SilentlyContinue
if ($portInUse) {
    Write-Host "⚠️  Port 3000 is already in use!" -ForegroundColor Yellow
    Write-Host "   Another process may be using the port." -ForegroundColor Yellow
    Write-Host "   The frontend will try to start anyway..." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Starting frontend development server..." -ForegroundColor Green
Write-Host "Frontend will be available at: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Start the React development server
npm start

