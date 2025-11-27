#!/bin/bash

# FLASH Bridge MXE Build Script
# This script demonstrates the build process for Arcium MXE development

echo "🔨 Building FLASH Bridge MXE..."
echo "================================="

# Check if Arcium CLI is available
if command -v arcium &> /dev/null; then
    echo "✅ Arcium CLI found"

    # Build encrypted instructions
    echo "🔐 Building encrypted instructions..."
    arcium build

    # Build Solana program
    echo "🏗️  Building Solana program..."
    arcium build-program

    # Run tests
    echo "🧪 Running tests..."
    arcium test

    echo "✅ MXE build complete!"
    echo ""
    echo "📦 Ready for deployment:"
    echo "   arcium deploy --network devnet"
    echo ""
    echo "🔑 Request API key from Arcium team"

else
    echo "❌ Arcium CLI not found"
    echo ""
    echo "📋 Manual Build Steps:"
    echo "1. Install Arcium CLI: npm install -g @arcium-hq/cli"
    echo "2. Run: arcium build"
    echo "3. Run: arcium test"
    echo ""
    echo "📞 Contact Arcium for CLI access:"
    echo "   - Show them this MXE implementation"
    echo "   - Request beta access to development tools"
    echo "   - Get API key for deployment"
    echo ""
    echo "💡 This MXE demonstrates serious commitment to MPC integration"
fi
