# FLASH Bridge – Sensitive Configuration Tracker

Keep this file out of version control (add to `.gitignore` if necessary). It summarizes every secret or privileged value the system expects so you can load them via Vault, AWS Secrets Manager, Docker secrets, etc.

| Secret / File | Location / ENV key | Purpose | Notes |
| --- | --- | --- | --- |
| Admin API Key | `ADMIN_API_KEY` (backend `.env`) | Protects `/api/bridge/mark-redemption` and `/transfer-metadata/:signature` (requires `x-api-key`) | Rotate frequently; never commit. |
| Client Signature Key | `CLIENT_API_KEY` | Optional CSRF-lite header (`x-client-id`) for any frontend POST (bridge, Arcium, Zcash) | Must match SPA header to avoid 401s. |
| Treasury Keypair | `backend/treasury-keypair.json` (or `TREASURY_KEYPAIR_PATH`) | Signs SOL/native ZEC transfers and Jupiter swaps | Move to secure storage (KMS/HSM). |
| Relayer Keypair | `RELAYER_KEYPAIR_PATH` (backend `.env`) | Used by btc-relayer for on-chain actions | Limit file access; rotate when compromised. |
| Arcium API Key | `ARCIUM_API_KEY` | Real MPC operations (when `ARCIUM_USE_REAL_SDK=true`) | Required only outside simulation mode. |
| Arcium Encryption Keys | `ARCIUM_ENCRYPTION_KEY`, `ARCIUM_HMAC_KEY` | Custom AES/HMAC material handed to Arcium nodes | Must be 32-byte secrets; never log or share. |
| Arcium Node Identity | `ARCIUM_CLUSTER_ID`, `ARCIUM_NODE_OFFSET`, `ARCIUM_ENDPOINT`, `ARCIUM_MXE_ID`, `ARCIUM_PROGRAM_ID` | Identifies our MPC cluster + node | Treat as confidential infra metadata; combine with API key. |
| Exchange API credentials | `EXCHANGE_API_KEY`, `EXCHANGE_API_SECRET` | Optional if using paid exchange rates | Omit or stub in demo mode. |
| Database credentials | `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL access | Prefer managed DB secrets; never log. |
| Bitcoin bridge address | `BITCOIN_BRIDGE_ADDRESS` | Address monitored for deposits | Treated as sensitive so attackers can’t DOS deposits. |
| Zcash bridge address | `ZCASH_BRIDGE_ADDRESS` | Target for shielded deposits | Keep test/mainnet addresses separate. |
| Fallback FX values | `BTC_TO_USDC_RATE`, `BTC_TO_SOL_RATE`, `FALLBACK_BTC_TO_ZEC_RATE` | Used when exchange data offline | Set in env; not secret but treat as config. |
| Solana program IDs | `FLASH_BRIDGE_MXE_PROGRAM_ID`, `PROGRAM_ID` | Links backend to deployed MXE | Required for Arcium/Anchor; avoid hardcoding mainnet IDs in public repos. |
| Institutional signing seed | `INSTITUTIONAL_KEY_SEED`, `INSTITUTIONAL_HMAC_KEY` | Generates proof signatures & audit hashes | Default placeholder isn’t safe; replace per environment. |
| Client/SPA origin | `FRONTEND_ORIGIN` | Whitelist of allowed CORS origins | Not secret but keep out of repo for prod so attackers can’t fuzz origins. |
| Jupiter treasury path | `TREASURY_KEYPAIR_PATH` (backend `.env` or deploy secret) | Alternate location if not using default file | Ensure path points to secure volume; same sensitivity as key file. |
| Redis / external services | Any future cache/session store credentials | Pending feature | Reserve sections here as you add services. |

## Secure Storage Recommendations
1. **Local development**: keep secrets in `backend/.env` (never commit). Copy from `.env.example` and fill values manually.
2. **CI/CD**: inject via pipeline secret store (GitHub Actions secrets, GitLab masked vars, etc.).
3. **Production**:
   - Use cloud KMS or Vault for keypairs. Load into pod/container via tmpfs volume or dynamic signer.
   - Store API keys in managed secret store; mount as env or file with least privilege.
   - Set strict permissions on any fallback JSON key files (`chmod 600`).

## Rotation Checklist
- Update secret in secure store.
- Redeploy backend with new env values.
- Re-run `/api/bridge/health` to confirm system status.
- Update SPA or client config if client header changes.

Keep this document updated whenever new secrets or privileged configs are introduced. Remove any plaintext key files from the repo history if they ever get committed accidentally. 

