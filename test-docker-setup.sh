#!/bin/bash

# Test Docker setup for FLASH Bridge demos

echo "🧪 Testing FLASH Bridge Docker Setup"
echo "====================================="
echo ""

# Check Docker installation
echo "🔍 Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    echo "   Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi
echo "✅ Docker is installed: $(docker --version)"

# Check Docker Compose
echo ""
echo "🔍 Checking Docker Compose..."
if command -v docker-compose &> /dev/null; then
    echo "✅ Docker Compose (legacy): $(docker-compose --version)"
elif docker compose version &> /dev/null; then
    echo "✅ Docker Compose (plugin): $(docker compose version)"
else
    echo "❌ Docker Compose is not available"
    echo "   Please install Docker Compose"
    exit 1
fi

# Check Docker daemon
echo ""
echo "🔍 Checking Docker daemon..."
if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running"
    echo "   Please start Docker Desktop or the Docker daemon"
    exit 1
fi
echo "✅ Docker daemon is running"

# Check available resources
echo ""
echo "🔍 Checking system resources..."
TOTAL_MEM=$(docker system info --format '{{.MemTotal}}' 2>/dev/null || echo "Unknown")
echo "   Total Memory: ${TOTAL_MEM:-Unknown}"

# Check port availability
echo ""
echo "🔍 Checking port availability..."
if lsof -i :3000 &> /dev/null; then
    echo "⚠️  Port 3000 is in use (will be used by frontend)"
else
    echo "✅ Port 3000 is available (frontend)"
fi

if lsof -i :3001 &> /dev/null; then
    echo "⚠️  Port 3001 is in use (will be used by backend)"
else
    echo "✅ Port 3001 is available (backend)"
fi

# Check required files
echo ""
echo "🔍 Checking required files..."
files=(
    "docker-poc-demo.dockerfile"
    "docker-mvp-demo.dockerfile"
    "docker-compose-poc.yml"
    "docker-compose-mvp.yml"
    "package.json"
    "demo-poc.js"
    "demo-mvp.js"
)

missing_files=()
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file missing"
        missing_files+=("$file")
    fi
done

# Summary
echo ""
echo "📊 Docker Setup Test Results"
echo "============================="

if [ ${#missing_files[@]} -eq 0 ]; then
    echo "✅ All required files present"
else
    echo "❌ Missing files: ${missing_files[*]}"
fi

echo ""
echo "🎯 Ready to run FLASH Bridge Docker demos!"
echo ""
echo "POC Demo:"
echo "  docker-compose -f docker-compose-poc.yml up --build"
echo ""
echo "MVP Demo:"
echo "  docker-compose -f docker-compose-mvp.yml up --build"
echo ""
echo "Interactive Runner:"
echo "  ./docker-demo-runner.sh"
echo ""
echo "🚀 Happy demonstrating! 🐳⚡🪙"
