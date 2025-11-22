# FLASH Bridge - Startup Script
# Usage: .\run.ps1 [backend|frontend|all]

param(
    [Parameter(Position=0)]
    [ValidateSet("backend", "frontend", "all")]
    [string]$Service = "all"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FLASH Bridge - Startup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if a port is in use
function Test-Port {
    param([int]$Port)
    $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue
    return $connection.TcpTestSucceeded
}

# Function to start backend
function Start-Backend {
    Write-Host "Starting Backend Server..." -ForegroundColor Yellow
    
    # Check if port 3001 is in use
    if (Test-Port -Port 3001) {
        Write-Host "⚠️  Port 3001 is already in use!" -ForegroundColor Red
        Write-Host "   Backend may already be running." -ForegroundColor Yellow
        return
    }
    
    # Check if .env exists
    if (-not (Test-Path "backend\.env")) {
        Write-Host "⚠️  Warning: backend\.env not found!" -ForegroundColor Yellow
        Write-Host "   Creating backend\.env with defaults..." -ForegroundColor Yellow
        @"
PORT=3001
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
ZENZEC_MINT=YourZenZECMintAddressHere
ENABLE_RELAYER=false
RELAYER_KEYPAIR_PATH=~/.config/solana/id.json
ZENZEC_TO_SOL_RATE=0.001

# Optional: Bitcoin integration
BITCOIN_NETWORK=mainnet
BITCOIN_BRIDGE_ADDRESS=bc1qtq493cpzfu2frc2rumpm6225mafapmgl2q7auz
BITCOIN_EXPLORER_URL=https://blockstream.info/api
ENABLE_BITCOIN_MONITORING=false
"@ | Out-File -FilePath "backend\.env" -Encoding utf8
    }
    
    # Check if node_modules exists
    if (-not (Test-Path "backend\node_modules")) {
        Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
        Set-Location backend
        npm install
        Set-Location ..
    }
    
    Write-Host "Backend starting on http://localhost:3001" -ForegroundColor Green
    Write-Host ""
    
    Set-Location backend
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm start"
    Set-Location ..
}

# Function to start frontend
function Start-Frontend {
    Write-Host "Starting Frontend..." -ForegroundColor Yellow
    
    # Check if port 3000 is in use
    if (Test-Port -Port 3000) {
        Write-Host "⚠️  Port 3000 is already in use!" -ForegroundColor Red
        Write-Host "   Frontend may already be running." -ForegroundColor Yellow
        return
    }
    
    # Check if .env exists
    if (-not (Test-Path "frontend\.env")) {
        Write-Host "⚠️  Warning: frontend\.env not found!" -ForegroundColor Yellow
        Write-Host "   Creating frontend\.env with defaults..." -ForegroundColor Yellow
        $frontendEnv = @"
REACT_APP_API_URL=http://localhost:3001
REACT_APP_PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
REACT_APP_ZENZEC_MINT=YourZenZECMintAddressHere
"@
        $frontendEnv | Out-File -FilePath "frontend\.env" -Encoding utf8
    }
    
    # Check if node_modules exists
    if (-not (Test-Path "frontend\node_modules")) {
        Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
        Set-Location frontend
        npm install
        Set-Location ..
    }
    
    Write-Host "Frontend starting on http://localhost:3000" -ForegroundColor Green
    Write-Host ""
    
    Set-Location frontend
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm start"
    Set-Location ..
}

# Main execution
switch ($Service) {
    "backend" {
        Start-Backend
        Write-Host "✅ Backend started in new window" -ForegroundColor Green
        Write-Host "   Access API at: http://localhost:3001" -ForegroundColor Cyan
    }
    "frontend" {
        Start-Frontend
        Write-Host "✅ Frontend started in new window" -ForegroundColor Green
        Write-Host "   Access UI at: http://localhost:3000" -ForegroundColor Cyan
    }
    "all" {
        Start-Backend
        Start-Sleep -Seconds 2
        Start-Frontend
        Write-Host ""
        Write-Host "✅ Both services started in separate windows" -ForegroundColor Green
        Write-Host "   Backend API: http://localhost:3001" -ForegroundColor Cyan
        Write-Host "   Frontend UI: http://localhost:3000" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Press Ctrl+C to stop (or close the windows)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "For help, see SETUP_GUIDE.md" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan

