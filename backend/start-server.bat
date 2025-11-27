@echo off
REM Start Flash Bridge Backend with proper environment

set PROGRAM_ID=7ac8wtD5S9BRutHBMUoKMjpYepKSHVCgGaoN1etLjkd4
set SOLANA_NETWORK=devnet
set SOLANA_RPC_URL=https://api.devnet.solana.com
set TREASURY_KEYPAIR_PATH=treasury-keypair.json
set RELAYER_KEYPAIR_PATH=relayer-keypair-new.json
set USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
set SOL_MINT=So11111111111111111111111111111111111111112
set ENABLE_ARCIUM_MPC=true
set ARCIUM_SIMULATED=true

echo 🚀 Starting Flash Bridge Backend...
echo 📋 Program ID: %PROGRAM_ID%
echo 🌐 Network: %SOLANA_NETWORK%
echo 💰 Treasury: Loading from %TREASURY_KEYPAIR_PATH%

npm start
