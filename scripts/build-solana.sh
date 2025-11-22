#!/bin/bash

# FLASH Bridge - Solana Program Build Script
# This script builds the Solana program with proper error handling

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║         FLASH Bridge - Solana Program Build                  ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BUILD_MODE="${1:-default}"

echo "Build mode: $BUILD_MODE"
echo ""

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo -e "${RED}✗ Rust/Cargo not found${NC}"
    echo "Please install Rust: https://rustup.rs/"
    exit 1
fi

echo -e "${GREEN}✓ Rust version: $(rustc --version)${NC}"
echo -e "${GREEN}✓ Cargo version: $(cargo --version)${NC}"
echo ""

# Build based on mode
case $BUILD_MODE in
    "anchor")
        echo "Building with Anchor CLI..."
        if ! command -v anchor &> /dev/null; then
            echo -e "${RED}✗ Anchor CLI not found${NC}"
            echo "Install with: cargo install --git https://github.com/coral-xyz/anchor --tag v0.32.1 anchor-cli --locked"
            exit 1
        fi
        echo -e "${GREEN}✓ Anchor version: $(anchor --version)${NC}"
        anchor build
        ;;
    "arcium")
        echo "Building with Arcium feature..."
        cargo build --manifest-path programs/zenz_bridge/Cargo.toml --features arcium --release
        ;;
    "release")
        echo "Building release version..."
        cargo build --manifest-path programs/zenz_bridge/Cargo.toml --release
        ;;
    "default"|*)
        echo "Building development version..."
        cargo build --manifest-path programs/zenz_bridge/Cargo.toml
        ;;
esac

echo ""
echo -e "${GREEN}✓ Build completed successfully!${NC}"
echo ""

# Show build artifacts
if [ -f "target/deploy/zenz_bridge.so" ]; then
    echo "Anchor build artifact:"
    ls -lh target/deploy/zenz_bridge.so
elif [ -f "target/release/libzenz_bridge.so" ]; then
    echo "Cargo release build artifact:"
    ls -lh target/release/libzenz_bridge.so
elif [ -f "target/debug/libzenz_bridge.so" ]; then
    echo "Cargo debug build artifact:"
    ls -lh target/debug/libzenz_bridge.so
fi
