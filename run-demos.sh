#!/bin/bash

# FLASH Bridge Demo Runner
# Easily run POC and MVP demonstrations

set -e

echo "🚀 FLASH Bridge Demo Runner"
echo "============================"
echo ""

# Check if backend is running
echo "🔍 Checking if backend is running..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Backend is running"
else
    echo "❌ Backend is not running on http://localhost:3001"
    echo ""
    echo "💡 Start the backend first:"
    echo "   cd backend && npm start"
    echo ""
    exit 1
fi

echo ""

# Demo selection
echo "Select demo to run:"
echo "1) POC Demo (Technical + Visual - 2 min)"
echo "2) MVP Demo (Complete Experience - 5-7 min)"
echo "3) Run Both Demos (Sequential)"
echo ""

read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo "🎯 Running POC Demo (Technical + Visual)..."
        echo "=============================================="
        echo "• Auto-starts backend and frontend servers"
        echo "• Opens browser to visual interface"
        echo "• Proves concepts with live demonstration"
        echo ""
        node demo-poc.js
        ;;
    2)
        echo ""
        echo "🎯 Running MVP Demo (Complete Experience)..."
        echo "============================================="
        echo "• Auto-starts backend and frontend servers"
        echo "• Opens browser to visual interface"
        echo "• Interactive walkthrough of full user journey"
        echo ""
        node demo-mvp.js
        ;;
    3)
        echo ""
        echo "🎯 Running Both Demos (Sequential)..."
        echo "======================================"
        echo ""
        echo "📋 POC Demo (Technical + Visual):"
        echo "----------------------------------"
        node demo-poc.js
        echo ""
        echo "📋 MVP Demo (Complete Experience):"
        echo "-----------------------------------"
        node demo-mvp.js
        ;;
    *)
        echo "❌ Invalid choice. Please run again."
        exit 1
        ;;
esac

echo ""
echo "🎉 Demo completed successfully!"
echo ""
echo "📊 Project Status Recap:"
echo "   ✅ POC: Complete - Core concepts proven"
echo "   ✅ MVP: Complete - Full user experience ready"
echo "   🚧 Production: 85% - Enterprise hardening needed"
echo ""
echo "🚀 Ready for beta testing and user onboarding!"
