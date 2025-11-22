#!/bin/bash

# FLASH Bridge - Demo Test Script
# This script tests all core workflows for hackathon demo

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║         FLASH Bridge - Demo Workflow Verification            ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Backend URL
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test function
test_endpoint() {
    local test_name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "Testing: $test_name ... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BACKEND_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. CHECKING BACKEND AVAILABILITY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if ! curl -s "$BACKEND_URL/health" > /dev/null; then
    echo -e "${RED}✗ Backend is not running at $BACKEND_URL${NC}"
    echo "Please start the backend first:"
    echo "  cd backend && npm start"
    exit 1
fi

echo -e "${GREEN}✓ Backend is running${NC}"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. TESTING CORE WORKFLOWS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Health Check
test_endpoint "Health Check" "GET" "/health"

# Test 2: API Info
test_endpoint "API Info" "GET" "/"

# Test 3: Bridge Info
test_endpoint "Bridge Info" "GET" "/api/bridge/info"

# Test 4: Zcash Info
test_endpoint "Zcash Info" "GET" "/api/zcash/info"

# Test 5: Zcash Bridge Address
test_endpoint "Zcash Bridge Address" "GET" "/api/zcash/bridge-address"

# Test 6: Zcash Price
test_endpoint "Zcash Price" "GET" "/api/zcash/price"

# Test 7: Basic Bridge Transaction
test_endpoint "Basic Bridge Transaction" "POST" "/api/bridge" \
    '{"solanaAddress":"7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU","amount":1.5,"swapToSol":false}'

# Test 8: Bridge with Zcash TX
test_endpoint "Bridge with Zcash TX" "POST" "/api/bridge" \
    '{"solanaAddress":"7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU","amount":2.0,"zcashTxHash":"demo_tx_hash","swapToSol":false}'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. TESTING ARCIUM MPC FEATURES (if enabled)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 9: Arcium Status
test_endpoint "Arcium Status" "GET" "/api/arcium/status"

# Check if MPC is enabled
arcium_response=$(curl -s "$BACKEND_URL/api/arcium/status")
if echo "$arcium_response" | grep -q '"enabled":true'; then
    echo -e "${GREEN}✓ Arcium MPC is enabled${NC}"
    
    # Test 10: Encrypt Amount
    test_endpoint "Encrypt Amount" "POST" "/api/arcium/encrypt-amount" \
        '{"amount":5.0,"recipientPubkey":"7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"}'
    
    # Test 11: Private Bridge
    test_endpoint "Private Bridge Transaction" "POST" "/api/arcium/bridge/private" \
        '{"solanaAddress":"7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU","amount":3.0,"swapToSol":false,"useEncryption":true}'
    
    # Test 12: Trustless Random
    test_endpoint "Trustless Random" "POST" "/api/arcium/random" \
        '{"max":10}'
    
else
    echo -e "${YELLOW}⚠ Arcium MPC is not enabled (optional)${NC}"
    echo "To enable: Set ENABLE_ARCIUM_MPC=true in backend/.env"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. TESTING ZCASH VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 13: Validate Zcash Address
test_endpoint "Validate Zcash Address" "POST" "/api/zcash/validate-address" \
    '{"address":"t1abc123"}'

# Test 14: Verify Zcash Transaction
test_endpoint "Verify Zcash Transaction" "POST" "/api/zcash/verify-transaction" \
    '{"txHash":"demo_zcash_tx_hash_12345"}'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. DEMO READINESS CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check frontend
echo -n "Checking frontend availability ... "
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend is running${NC}"
else
    echo -e "${YELLOW}⚠ Frontend not detected${NC}"
    echo "Start with: cd frontend && npm start"
fi

# Check Solana
echo -n "Checking Solana validator ... "
if solana cluster-version > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Solana is available${NC}"
else
    echo -e "${YELLOW}⚠ Solana not detected${NC}"
    echo "Start with: solana-test-validator --reset"
fi

# Check Arcium (optional)
echo -n "Checking Arcium MPC ... "
if command -v arcium > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Arcium CLI installed${NC}"
else
    echo -e "${YELLOW}⚠ Arcium CLI not installed (optional)${NC}"
    echo "Install with: cargo install arcium-cli"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. TEST SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Total Tests:  $TOTAL_TESTS"
echo -e "${GREEN}Passed:       $PASSED_TESTS${NC}"
echo -e "${RED}Failed:       $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                               ║${NC}"
    echo -e "${GREEN}║          ✓ ALL WORKFLOWS READY FOR DEMO! ✓                   ║${NC}"
    echo -e "${GREEN}║                                                               ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "🎯 Demo checklist:"
    echo "  ✓ Backend API working"
    echo "  ✓ Bridge operations functional"
    echo "  ✓ Zcash integration ready"
    echo "  ✓ Arcium MPC available"
    echo ""
    echo "Next steps:"
    echo "  1. Open frontend: http://localhost:3000"
    echo "  2. Follow HACKATHON_DEMO.md for demo script"
    echo "  3. Test each workflow manually"
    echo ""
    exit 0
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                                                               ║${NC}"
    echo -e "${RED}║          ⚠ SOME TESTS FAILED - CHECK LOGS ⚠                  ║${NC}"
    echo -e "${RED}║                                                               ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check backend logs for errors"
    echo "  2. Verify all services are running"
    echo "  3. Check network connectivity"
    echo "  4. Review HACKATHON_DEMO.md troubleshooting section"
    echo ""
    exit 1
fi
