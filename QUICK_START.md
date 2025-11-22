# Quick Start Guide

## Prerequisites

- Node.js v18+
- npm or yarn
- Solana CLI (for localnet testing)
- Anchor CLI (optional)

## Quick Start

### Option 1: Using PowerShell Script (Windows)

```powershell
# Start both backend and frontend
.\run.ps1

# Or start individually
.\run.ps1 backend
.\run.ps1 frontend
```

### Option 2: Using npm Scripts

```bash
# Install all dependencies
npm run install:all

# Start backend (Terminal 1)
npm run start:backend

# Start frontend (Terminal 2)
npm run start:frontend
```

### Option 3: Manual Start

```bash
# Terminal 1: Backend
cd backend
npm install
npm start

# Terminal 2: Frontend
cd frontend
npm install
npm start
```

## Environment Setup

### Backend (.env)

Create `backend/.env`:

```env
PORT=3001
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
ZENZEC_MINT=YourZenZECMintAddressHere
ENABLE_RELAYER=false
ZENZEC_TO_SOL_RATE=0.001
```

### Frontend (.env)

Create `frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:3001
```

## Access Points

- **Frontend UI:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **API Health:** http://localhost:3001/health

## Testing the Bridge

1. Open http://localhost:3000
2. Connect your Solana wallet (Phantom, Solflare)
3. Enter amount (e.g., 1.5 zenZEC)
4. Click "Bridge to Solana"

## Troubleshooting

### Port Already in Use
- Backend (3001): Stop existing process or change PORT in .env
- Frontend (3000): Stop existing process

### Dependencies Not Installed
```bash
cd backend && npm install
cd ../frontend && npm install
```

### Environment Variables Missing
- Check that `.env` files exist in both `backend/` and `frontend/`
- See SETUP_GUIDE.md for full configuration

## Next Steps

- See `SETUP_GUIDE.md` for detailed setup
- See `HACKATHON_DEMO.md` for demo workflows
- See `CORE_SYSTEM_COMPLETE.md` for system status

