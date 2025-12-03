#!/bin/bash
# =============================================================================
# FLASH Bridge - Setup Script
# =============================================================================
# Prepares the environment for first-time deployment
# Usage: ./scripts/setup.sh
# =============================================================================

set -e

echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║                    FLASH Bridge Setup Script                          ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running from project root
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Error: Please run this script from the project root directory${NC}"
    exit 1
fi

# =============================================================================
# Step 1: Create directories
# =============================================================================
echo -e "${YELLOW}Step 1: Creating directories...${NC}"

mkdir -p keys
mkdir -p backend/logs

echo -e "${GREEN}✓ Directories created${NC}"

# =============================================================================
# Step 2: Create environment files from templates
# =============================================================================
echo -e "${YELLOW}Step 2: Setting up environment files...${NC}"

if [ ! -f "backend/.env" ]; then
    if [ -f "backend/env-template.txt" ]; then
        cp backend/env-template.txt backend/.env
        echo -e "${GREEN}✓ Created backend/.env from template${NC}"
        echo -e "${YELLOW}  → Please edit backend/.env with your configuration${NC}"
    else
        echo -e "${RED}✗ backend/env-template.txt not found${NC}"
    fi
else
    echo -e "${GREEN}✓ backend/.env already exists${NC}"
fi

if [ ! -f "frontend/.env" ]; then
    if [ -f "frontend/env-template.txt" ]; then
        cp frontend/env-template.txt frontend/.env
        echo -e "${GREEN}✓ Created frontend/.env from template${NC}"
        echo -e "${YELLOW}  → Please edit frontend/.env with your configuration${NC}"
    else
        echo -e "${RED}✗ frontend/env-template.txt not found${NC}"
    fi
else
    echo -e "${GREEN}✓ frontend/.env already exists${NC}"
fi

# =============================================================================
# Step 3: Generate admin API key if not set
# =============================================================================
echo -e "${YELLOW}Step 3: Checking API key...${NC}"

if grep -q "ADMIN_API_KEY=change-me" backend/.env 2>/dev/null; then
    NEW_KEY=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-f0-9' | fold -w 64 | head -n 1)
    if [ -n "$NEW_KEY" ]; then
        sed -i.bak "s/ADMIN_API_KEY=change-me.*/ADMIN_API_KEY=$NEW_KEY/" backend/.env
        rm -f backend/.env.bak
        echo -e "${GREEN}✓ Generated new ADMIN_API_KEY${NC}"
    fi
else
    echo -e "${GREEN}✓ ADMIN_API_KEY already configured${NC}"
fi

# =============================================================================
# Step 4: Check for relayer keypair
# =============================================================================
echo -e "${YELLOW}Step 4: Checking relayer keypair...${NC}"

if [ ! -f "keys/relayer-keypair.json" ]; then
    echo -e "${YELLOW}  No relayer keypair found at keys/relayer-keypair.json${NC}"
    echo ""
    echo "  To generate a new keypair, run:"
    echo -e "  ${GREEN}solana-keygen new -o keys/relayer-keypair.json${NC}"
    echo ""
    echo "  Or copy an existing keypair to keys/relayer-keypair.json"
    echo ""
else
    echo -e "${GREEN}✓ Relayer keypair found${NC}"
fi

# =============================================================================
# Step 5: Check Docker
# =============================================================================
echo -e "${YELLOW}Step 5: Checking Docker...${NC}"

if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}✓ Docker and docker-compose are installed${NC}"
else
    echo -e "${RED}✗ Docker or docker-compose not found${NC}"
    echo "  Please install Docker: https://docs.docker.com/get-docker/"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║                         Setup Complete!                               ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo ""
echo "1. Edit backend/.env with your configuration:"
echo "   - Set BITCOIN_BRIDGE_ADDRESS (your BTC address)"
echo "   - Set DB_PASSWORD (database password)"
echo "   - Configure ARCIUM_* settings"
echo ""
echo "2. Edit frontend/.env:"
echo "   - Set REACT_APP_API_URL (backend URL)"
echo "   - Set REACT_APP_SOLANA_NETWORK"
echo ""
echo "3. Add your relayer keypair:"
echo "   - solana-keygen new -o keys/relayer-keypair.json"
echo "   - Or copy existing keypair to keys/relayer-keypair.json"
echo ""
echo "4. Start the system:"
echo "   docker-compose up -d"
echo ""
echo "5. Check status:"
echo "   docker-compose ps"
echo "   curl http://localhost:3001/health"
echo ""

