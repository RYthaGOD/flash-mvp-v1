# FLASH Bridge Frontend

React frontend for the FLASH BTC → ZEC → Solana Bridge.

## Setup

```bash
npm install
npm start
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
REACT_APP_API_URL=http://localhost:3001
```

## Features

- Solana wallet integration (Phantom, Solflare)
- Bridge interface for minting zenZEC
- Option to swap zenZEC for SOL
- Transaction status tracking

## Technology Stack

- React 18
- Solana Wallet Adapter
- Axios for API calls
- Custom CSS styling
