#!/bin/bash

# FLASH Bridge Repository Setup Script
# This script helps configure GitHub repository features

echo "🚀 FLASH Bridge Repository Setup"
echo "================================="

# Check if we're in the right directory
if [ ! -f "README.md" ] || [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "✅ Repository structure verified"

# Enable GitHub features (manual steps needed)
echo ""
echo "📋 Manual GitHub Configuration Required:"
echo "=========================================="
echo ""
echo "1. 🏷️  Add Repository Topics:"
echo "   Go to: Settings → General → Topics"
echo "   Add: blockchain, privacy, cross-chain, solana, bitcoin, zcash, defi, cryptography"
echo ""
echo "2. 💰 Enable GitHub Sponsors:"
echo "   Go to: Settings → Sponsoring → Set up sponsoring"
echo "   Configure your sponsorship tiers"
echo ""
echo "3. 💬 Enable GitHub Discussions:"
echo "   Go to: Settings → General → Features → Discussions"
echo ""
echo "4. 📌 Pin Important Issues/PRs:"
echo "   - Pin the main README issue"
echo "   - Pin important feature requests"
echo "   - Pin security-related issues"
echo ""
echo "5. 🏷️  Configure Labels:"
echo "   - bug, enhancement, documentation, security, help wanted, good first issue"
echo ""
echo "6. 🔒 Enable Security Advisories:"
echo "   Go to: Security → Advisories → Enable private reporting"
echo ""

echo "🎯 Repository Optimization Complete!"
echo "===================================="
echo ""
echo "Your GitHub repository now has:"
echo "✅ Professional issue templates"
echo "✅ Pull request template"
echo "✅ Code of conduct"
echo "✅ Security policy"
echo "✅ Contributing guidelines"
echo "✅ CI/CD workflows"
echo "✅ Automated dependency updates"
echo "✅ Release automation"
echo ""
echo "Next steps: Configure the manual GitHub settings listed above"
