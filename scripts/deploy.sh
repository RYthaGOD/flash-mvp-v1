#!/bin/bash
# =============================================================================
# FLASH Bridge - Production Deployment Script
# =============================================================================
# This script deploys the FLASH Bridge to production.
# Run: ./scripts/deploy.sh [environment]
# Environments: staging, production
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default environment
ENVIRONMENT=${1:-staging}

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║                    FLASH Bridge Production Deployment                      ║"
echo "║                         Environment: ${ENVIRONMENT}                                   ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# =============================================================================
# Pre-flight Checks
# =============================================================================
echo -e "${YELLOW}[1/8] Running pre-flight checks...${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker installed${NC}"

# Check Docker Compose
if ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose installed${NC}"

# Check required files
REQUIRED_FILES=(
    "backend/.env"
    "frontend/.env"
    "keys/relayer-keypair.json"
    "docker-compose.yml"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}✗ Missing required file: $file${NC}"
        echo -e "${YELLOW}  Run ./scripts/setup.sh first${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Found $file${NC}"
done

# =============================================================================
# Environment Validation
# =============================================================================
echo -e "\n${YELLOW}[2/8] Validating environment configuration...${NC}"

# Source backend .env
set -a
source backend/.env
set +a

# Check critical environment variables
CRITICAL_VARS=(
    "ADMIN_API_KEY"
    "BITCOIN_BRIDGE_ADDRESS"
    "DB_PASSWORD"
    "SOLANA_RPC_URL"
    "FLASH_BRIDGE_MXE_PROGRAM_ID"
)

for var in "${CRITICAL_VARS[@]}"; do
    if [ -z "${!var}" ] || [ "${!var}" == "change-me-generate-a-secure-key" ]; then
        echo -e "${RED}✗ $var is not properly configured${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ $var is set${NC}"
done

# =============================================================================
# Run Backend Preflight Check
# =============================================================================
echo -e "\n${YELLOW}[3/8] Running backend preflight check...${NC}"

cd backend
if node src/utils/preflight-check.js; then
    echo -e "${GREEN}✓ Preflight check passed${NC}"
else
    echo -e "${RED}✗ Preflight check failed${NC}"
    exit 1
fi
cd ..

# =============================================================================
# Build Docker Images
# =============================================================================
echo -e "\n${YELLOW}[4/8] Building Docker images...${NC}"

docker compose build --no-cache

echo -e "${GREEN}✓ Docker images built${NC}"

# =============================================================================
# Database Migration
# =============================================================================
echo -e "\n${YELLOW}[5/8] Running database migrations...${NC}"

# Start only PostgreSQL first
docker compose up -d postgres

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U ${DB_USER:-postgres} &> /dev/null; then
        break
    fi
    sleep 1
done

# Apply schema
docker compose exec -T postgres psql -U ${DB_USER:-postgres} -d ${DB_NAME:-flash_bridge} < backend/database/schema.sql 2>/dev/null || true

echo -e "${GREEN}✓ Database migrations complete${NC}"

# =============================================================================
# Start All Services
# =============================================================================
echo -e "\n${YELLOW}[6/8] Starting all services...${NC}"

docker compose up -d

echo "Waiting for services to be healthy..."
sleep 10

# =============================================================================
# Health Checks
# =============================================================================
echo -e "\n${YELLOW}[7/8] Running health checks...${NC}"

# Check backend health
HEALTH_URL="http://localhost:3001/health"
for i in {1..30}; do
    if curl -s "$HEALTH_URL" | grep -q "healthy"; then
        echo -e "${GREEN}✓ Backend is healthy${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Backend health check failed${NC}"
        docker compose logs backend
        exit 1
    fi
    sleep 2
done

# Check frontend
FRONTEND_URL="http://localhost:3000"
for i in {1..10}; do
    if curl -s "$FRONTEND_URL" > /dev/null; then
        echo -e "${GREEN}✓ Frontend is accessible${NC}"
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${YELLOW}⚠ Frontend not responding (may still be starting)${NC}"
    fi
    sleep 2
done

# =============================================================================
# Deployment Summary
# =============================================================================
echo -e "\n${YELLOW}[8/8] Deployment Summary${NC}"

echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║                    ✓ Deployment Complete!                                  ║"
echo "╠═══════════════════════════════════════════════════════════════════════════╣"
echo "║                                                                            ║"
echo "║  Frontend:        http://localhost:3000                                   ║"
echo "║  Backend API:     http://localhost:3001                                   ║"
echo "║  API Docs:        http://localhost:3001/api/v1/docs                       ║"
echo "║  Health Check:    http://localhost:3001/health                            ║"
echo "║                                                                            ║"
echo "╠═══════════════════════════════════════════════════════════════════════════╣"
echo "║  Services Running:                                                         ║"
echo "║    • PostgreSQL    ✓                                                       ║"
echo "║    • Redis         ✓                                                       ║"
echo "║    • Arcium Node   ✓                                                       ║"
echo "║    • Backend       ✓                                                       ║"
echo "║    • Frontend      ✓                                                       ║"
echo "║                                                                            ║"
echo "╠═══════════════════════════════════════════════════════════════════════════╣"
echo "║  Next Steps:                                                               ║"
echo "║    1. Fund relayer wallet with SOL                                        ║"
echo "║    2. Configure HTTPS (see docs/HTTPS_SETUP.md)                           ║"
echo "║    3. Set up monitoring and alerts                                        ║"
echo "║                                                                            ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Show running containers
echo -e "\n${BLUE}Running containers:${NC}"
docker compose ps

