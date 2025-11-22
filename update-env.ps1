# Update .env files with complete configuration
Write-Host "Updating .env files..." -ForegroundColor Cyan

# Backend .env content
$backendLines = @(
    "PORT=3001",
    "SOLANA_RPC_URL=https://api.devnet.solana.com",
    "SOLANA_NETWORK=devnet",
    "PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS",
    "ZENZEC_MINT=YourZenZECMintAddressHere",
    "ENABLE_RELAYER=false",
    "RELAYER_KEYPAIR_PATH=$env:USERPROFILE\.config\solana\id.json",
    "",
    "# Exchange rates for reverse workflow",
    "SOL_TO_ZENZEC_RATE=100",
    "ZENZEC_TO_BTC_RATE=0.001",
    "",
    "# BTC Relayer",
    "ENABLE_BTC_RELAYER=false",
    "ZENZEC_TO_SOL_RATE=0.001",
    "",
    "# Optional: Zcash integration",
    "ZCASH_NETWORK=mainnet",
    "ZCASH_BRIDGE_ADDRESS=",
    "ZCASH_LIGHTWALLETD_URL=https://zcash-mainnet.chainsafe.dev",
    "ZCASH_EXPLORER_URL=https://zcashblockexplorer.com",
    "",
    "# Zcash Wallet (zecwallet-light-cli)",
    "USE_ZECWALLET_CLI=false",
    "ZECWALLET_CLI_PATH=zecwallet-cli",
    "ZCASH_WALLET_DIR=~/.zcash",
    "ENABLE_ZCASH_MONITORING=false",
    "",
    "# Optional: Bitcoin integration",
    "BITCOIN_NETWORK=mainnet",
    "BITCOIN_BRIDGE_ADDRESS=bc1qtq493cpzfu2frc2rumpm6225mafapmgl2q7auz",
    "BITCOIN_EXPLORER_URL=https://blockstream.info/api",
    "ENABLE_BITCOIN_MONITORING=false",
    "",
    "# Optional: Arcium MPC privacy",
    "ENABLE_ARCIUM_MPC=false",
    "ARCIUM_ENDPOINT=http://localhost:9090",
    "",
    "# Exchange rates for reverse workflow",
    "SOL_TO_ZENZEC_RATE=100",
    "ZENZEC_TO_BTC_RATE=0.001",
    "",
    "# BTC Relayer",
    "ENABLE_BTC_RELAYER=false"
)

# Frontend .env content
$frontendLines = @(
    "REACT_APP_API_URL=http://localhost:3001",
    "REACT_APP_PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS",
    "REACT_APP_ZENZEC_MINT=YourZenZECMintAddressHere"
)

# Write files
Write-Host "Updating backend/.env..." -ForegroundColor Yellow
$backendLines | Out-File -FilePath "backend\.env" -Encoding utf8
Write-Host "Updated backend/.env" -ForegroundColor Green

Write-Host "Updating frontend/.env..." -ForegroundColor Yellow
$frontendLines | Out-File -FilePath "frontend\.env" -Encoding utf8
Write-Host "Updated frontend/.env" -ForegroundColor Green

Write-Host ""
Write-Host ".env files updated successfully!" -ForegroundColor Green
Write-Host "Note: Update ZENZEC_MINT when you deploy the Solana program." -ForegroundColor Yellow
