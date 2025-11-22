#!/bin/bash

# FLASH Bridge - Localnet Setup Script
# This script helps set up the local development environment

set -e

echo "======================================"
echo "FLASH Bridge - Localnet Setup"
echo "======================================"

# Check for required tools
echo "Checking for required tools..."

if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI not found. Please install: https://docs.solana.com/cli/install-solana-cli-tools"
    exit 1
fi

if ! command -v anchor &> /dev/null; then
    echo "❌ Anchor CLI not found. Please install: https://www.anchor-lang.com/docs/installation"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install: https://nodejs.org/"
    exit 1
fi

echo "✓ All required tools found"
echo ""

# Set Solana config to localnet
echo "Configuring Solana CLI for localnet..."
solana config set --url localhost

# Check if test validator is running
echo "Checking if test validator is running..."
if ! solana cluster-version &> /dev/null; then
    echo "❌ Test validator not running. Please start it with:"
    echo "   solana-test-validator --reset"
    exit 1
fi

echo "✓ Test validator is running"
echo ""

# Build the Solana program
echo "Building Solana program..."
anchor build

echo "✓ Solana program built"
echo ""

# Deploy the program
echo "Deploying program to localnet..."
anchor deploy

echo "✓ Program deployed"
echo ""

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
npm install
cd ..

echo "✓ Backend dependencies installed"
echo ""

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo "✓ Frontend dependencies installed"
echo ""

echo "======================================"
echo "Setup complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Update backend/.env with your PROGRAM_ID and ZENZEC_MINT"
echo "2. Initialize the bridge config (see README)"
echo "3. Start backend: cd backend && npm start"
echo "4. Start frontend: cd frontend && npm start"
echo ""
echo "Happy hacking! 🚀"
