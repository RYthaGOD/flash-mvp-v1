# ✅ FLASH Bridge - Production Deployment Checklist

Use this checklist before deploying to production.

## Pre-Deployment

### Infrastructure
- [ ] Docker and Docker Compose installed
- [ ] Minimum 4GB RAM available
- [ ] Minimum 20GB disk space
- [ ] SSL/TLS certificates obtained (for HTTPS)
- [ ] Domain name configured

### Configuration Files
- [ ] `backend/.env` created from `backend/env-template.txt`
- [ ] `frontend/.env` created from `frontend/env-template.txt`
- [ ] All placeholders replaced with real values

### Security
- [ ] `ADMIN_API_KEY` is a secure 64-character hex string
- [ ] `DB_PASSWORD` is strong and unique
- [ ] `CLIENT_API_KEY` set (if using frontend authentication)
- [ ] No secrets committed to git
- [ ] `.env` files in `.gitignore`

### Solana Configuration
- [ ] `SOLANA_NETWORK` set to `mainnet-beta`
- [ ] `SOLANA_RPC_URL` using a reliable provider (Helius, QuickNode, etc.)
- [ ] `FLASH_BRIDGE_MXE_PROGRAM_ID` is your deployed program
- [ ] `RELAYER_KEYPAIR_PATH` points to valid keypair
- [ ] Relayer wallet funded with SOL

### Bitcoin Configuration
- [ ] `BITCOIN_NETWORK` set to `mainnet`
- [ ] `BITCOIN_BRIDGE_ADDRESS` is your mainnet address
- [ ] `BITCOIN_REQUIRED_CONFIRMATIONS` set to 3+ for mainnet
- [ ] Bridge address has been tested with small amount

### Arcium MPC Configuration
- [ ] `ENABLE_ARCIUM_MPC` is `true`
- [ ] `ARCIUM_SIMULATED` is `false` (production)
- [ ] `ARCIUM_USE_REAL_SDK` is `true`
- [ ] `ARCIUM_CLUSTER_ID` set from Arcium registration
- [ ] `ARCIUM_NODE_OFFSET` configured
- [ ] Arcium node accessible

### Database Configuration
- [ ] `DB_HOST` configured for production database
- [ ] `DB_PASSWORD` is strong
- [ ] Database schema applied
- [ ] Backups configured

### Redis Configuration
- [ ] `REDIS_URL` configured
- [ ] Redis persistence enabled

---

## Deployment Steps

### Step 1: Initial Setup
```bash
# Windows
.\scripts\setup.ps1

# Linux/Mac
./scripts/setup.sh
```

### Step 2: Configure Environment
Edit `backend/.env`:
```env
NODE_ENV=production
SOLANA_NETWORK=mainnet-beta
BITCOIN_NETWORK=mainnet
ARCIUM_SIMULATED=false
```

### Step 3: Generate Keypairs
```bash
solana-keygen new -o keys/relayer-keypair.json
```

### Step 4: Fund Relayer
```bash
# Check balance
solana balance keys/relayer-keypair.json

# Fund from your wallet
solana transfer <RELAYER_PUBKEY> 1 --from <YOUR_WALLET>
```

### Step 5: Run Preflight Check
```bash
cd backend
npm run preflight
```

### Step 6: Deploy
```bash
# Windows
.\scripts\deploy.ps1 production

# Linux/Mac
./scripts/deploy.sh production
```

### Step 7: Configure HTTPS
Follow `docs/HTTPS_SETUP.md` to set up SSL/TLS.

---

## Post-Deployment Verification

### Health Checks
- [ ] Backend health: `curl https://your-domain.com/health`
- [ ] API accessible: `curl https://your-domain.com/api/v1/bridge/info`
- [ ] Frontend loads: `https://your-domain.com`

### Functional Tests
- [ ] Wallet connection works
- [ ] Bridge info displays correctly
- [ ] BTC address allocation works
- [ ] Small test transaction succeeds

### Monitoring Setup
- [ ] Log aggregation configured
- [ ] Alerting for errors
- [ ] Uptime monitoring
- [ ] Database backup verification

---

## Security Hardening

### Network
- [ ] Firewall configured (only ports 80, 443 open)
- [ ] SSH key-only authentication
- [ ] Fail2ban installed
- [ ] DDoS protection enabled

### Application
- [ ] Rate limiting tested
- [ ] CORS configured correctly
- [ ] Security headers verified
- [ ] No debug mode in production

### Secrets
- [ ] All secrets rotated from development
- [ ] Secrets manager used (optional but recommended)
- [ ] No secrets in logs or error messages

---

## Rollback Plan

If deployment fails:

```bash
# Stop all services
docker-compose down

# Restore from backup
docker-compose -f docker-compose.backup.yml up -d

# Or rollback to previous version
git checkout <previous-tag>
docker-compose up -d --build
```

---

## Emergency Contacts

| Role | Contact |
|------|---------|
| DevOps Lead | |
| Security | |
| On-Call | |

---

## Sign-Off

| Step | Completed By | Date |
|------|-------------|------|
| Pre-deployment checklist | | |
| Deployment | | |
| Post-deployment verification | | |
| Security hardening | | |

---

**Deployment approved by:** ___________________  
**Date:** ___________________

