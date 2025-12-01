## Production-Ready Project Structure

This repository now supports three deployable surfaces:

| Surface | Path | Purpose | Runtime Notes |
| --- | --- | --- | --- |
| Backend API | `backend/` | Express + Arcium MPC services, BTC/ZEC orchestrations | Runs on Node 18+, expects `.env` filled from Vault/Secrets Manager |
| Frontend SPA | `frontend/` | React dashboard for operators and demo wallet UX | Built with `npm run build`, deploy to CDN/S3/Static host |
| Solana Program | `flash-bridge-mxe/` | Anchor program + encrypted IX helpers | Built with `anchor build`, deploy separately per cluster |

### Backend layout (`backend/`)

```
backend/
  src/
    index.js                -> bootstraps server (logger + env validation)
    routes/                 -> API surfaces (bridge, arcium, zcash, admin)
    services/               -> blockchain + MPC integrations
    middleware/             -> auth, validation, rate limits, error handler
    utils/                  -> logger, config validators, service coordinator
    __tests__/              -> Jest suites (status, concurrency, etc.)
  database/
    schema.sql              -> canonical Postgres schema
    migrations/             -> incremental upgrades (use with migrate.js)
  logs/                     -> crash + audit logs (mount persistent volume)
  scripts/                  -> operator tooling (key rotation, monitors)
  .env.example              -> required env map (copy to `.env` locally)
```

**Production prep checklist**

1. Copy `backend/.env.example` → `.env` (outside repo for prod) and fill:
   - `FRONTEND_ORIGIN`, `ADMIN_API_KEY`, `CLIENT_API_KEY`
   - Bridge addresses (`BITCOIN_BRIDGE_ADDRESS`, `ZCASH_BRIDGE_ADDRESS`)
   - Database credentials + pool settings
   - Keypair file paths (mount secrets to `/secrets` or use KMS signer)
2. Run `npm ci` and `npm run check` (config validator) before deploying.
3. Start service with `NODE_ENV=production npm start` behind a process manager (PM2/systemd). Set `LOG_LEVEL=info`.
4. Mount `/app/backend/logs` (or override `LOG_DIR`) for crash history.

### Frontend layout (`frontend/`)

```
frontend/
  src/
    components/
      tabs/                -> BridgeTab, ArciumTab, ZcashTab, etc.
      SystemHealth.js      -> polls backend /health
      ErrorBoundary.js     -> wraps app to prevent white screens
    services/apiClient.js  -> central axios client + interceptors
    utils/                 -> wallet generator, storage guards
  public/                  -> static index.html + manifest
  config-overrides.js      -> CRA rewired build tweaks
```

**Production prep checklist**

1. Copy `ENV_EXAMPLE_FRONTEND.txt` to `.env` (or CI variables) with:
   - `REACT_APP_API_URL=https://api.flash-bridge.example`
   - `REACT_APP_CLIENT_ID` (matches `CLIENT_API_KEY`)
2. Install with `npm ci --legacy-peer-deps` (documented due to wallet deps).
3. Build with `npm run build`; deploy `frontend/build/` to CDN or static host.
4. Configure reverse proxy/CORS so backend `FRONTEND_ORIGIN` matches actual host(s).

### Solana program (`flash-bridge-mxe/`)

```
flash-bridge-mxe/
  programs/src/lib.rs       -> Anchor entrypoint
  encrypted-ixs/            -> Rust modules for Arcium integration
  Anchor.toml / Cargo.toml  -> workspace metadata
  scripts/build.sh          -> helper for CI
```

**Production prep checklist**

1. Install Anchor/Rust stable toolchains on build agent.
2. Run `anchor build && anchor deploy` per environment; capture program IDs.
3. Update backend env (`PROGRAM_ID`, `FLASH_BRIDGE_MXE_PROGRAM_ID`) post-deploy.

### Operational scripts (root `scripts/`)

Operator automation (keypair rotation, test harness, localnet setup) live in `scripts/`. For production CI, only surface:

- `scripts/setup-localnet.sh` (integration tests)
- `scripts/regenerate-keys.js` (trigger via secure runner)
- `scripts/build-solana.sh` (dockerized anchor builds)

Document in your CI README which scripts are safe vs. local-only.

---

## Business Logic Review

### Bridge flows

| Flow | Status | Remaining Work |
| --- | --- | --- |
| BTC → SOL (USDC swap) | `btc-deposit-handler` async path, `/api/bridge/btc-deposit` endpoint live | Frontend still needs to submit `x-client-id`; add end-to-end e2e once client header shipped |
| ZEC → SOL mint | `bridge.js` handles native mint or treasury transfer with reserve checks | Configure `USE_NATIVE_ZEC` + treasury funding in prod; add alert if treasury falls below threshold |
| Arcium MPC | `services/arcium.js` fixed decryption bug, `/api/arcium/*` protected by client signature | Add monitoring to ensure MPC failures bubble to `/health`; consider circuit-breaker when `ARCIUM_USE_REAL_SDK=true` |
| Proofs/compliance | Proof routes locked behind `ADMIN_API_KEY`; proofs persisted | Need admin audit log of proof access + CLI to purge expired proofs |
| Service coordination | Fail-closed DB locking + cleanup job | Expose admin endpoint to inspect stuck transactions (already on TODO) |

### Security requirements

- Secrets tracked in `SECURITY_SECRETS.md`; `.gitignore` blocks `.env`/key files.
- Pre-commit hook (`.git/hooks/pre-commit`) blocks accidental key commits.
- Rate limiting enforced per IP + wallet; add global burst metrics in logging backlog.
- Pending: enforce client signature header across frontend/Postman collections.

### Reliability / Monitoring

- `/health` currently returns relayer, reserves, DB, Arcium. Expand to include:
  - Bitcoin/Zcash explorer status
  - Fallback rate indicator from `converter.js`
  - Last successful MPC call timestamp
- Add structured audit logs (via `createLogger`) for:
  - Admin endpoints (`mark-redemption`, proof fetch/verify)
  - BTC relayer state changes (already partly done)

### Dependency / build

- Backend `npm audit` still flags high severity packages (bigint-buffer/postcss). Schedule upgrade sprint—branch off and modernize `@solana/spl-token`, `react-scripts` peer dependencies, etc.
- Frontend install requires `--legacy-peer-deps`; document this in `frontend/README.md` and pin TypeScript (done).

### Testing / Deployment

- Backend: run `npm test` (Jest) + `npm run check`. Add smoke test hitting `/api/bridge/btc-deposit` with mocked DB in CI.
- Frontend: add Cypress/Playwright smoke covering Bridge tab + BTC deposit form.
- Solana program: `anchor test` gating before merges; ensure deterministic IDL exported for backend to consume.

---

## Next Actions

1. **Client auth adoption** – update SPA to send `x-client-id` for every POST and document header in API docs.
2. **Admin audit logging** – create middleware to log admin route access (user, IP, action) to persistent storage.
3. **Health expansion** – extend `/health` with explorer/MPC/fallback metrics; wire to dashboards.
4. **Dependency upgrades** – plan sprint to move to latest wallet adapters / React 18 alignment without peer overrides.
5. **CI pipeline** – add jobs:
   - `backend`: lint, test, `npm run check`, docker build.
   - `frontend`: `npm ci --legacy-peer-deps`, `npm run build`, upload artifacts.
   - `program`: `anchor build`, upload IDL/program IDs as artifacts.

This structure + checklist keeps the repo production-friendly while highlighting remaining business-logic risks. Update this document whenever you add services or change deployment topology.***

