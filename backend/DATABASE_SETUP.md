# Database Setup - Quick Start

## Phase 1: Database and Persistence - Implementation Complete ✅

The database layer has been fully implemented. Follow these steps to set it up:

## Prerequisites

1. **Install PostgreSQL**
   - Windows: Download from https://www.postgresql.org/download/windows/
   - Mac: `brew install postgresql`
   - Linux: `sudo apt-get install postgresql`
   - Or use Docker: `docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres`

2. **Create Database**
   ```sql
   CREATE DATABASE flash_bridge;
   ```

## Setup Steps

### 1. Install Dependencies

```bash
cd backend
npm install
```

This will install `pg` (PostgreSQL client) and `pg-hstore`.

### 2. Configure Environment

Add to `backend/.env`:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=flash_bridge
DB_USER=postgres
DB_PASSWORD=your_password_here
```

### 3. Run Migration

```bash
npm run migrate
```

Or:

```bash
node database/migrate.js
```

This creates:
- ✅ 5 tables (bridge_transactions, swap_transactions, burn_transactions, processed_events, transaction_status_history)
- ✅ Indexes for performance
- ✅ Triggers for auto-updating timestamps

### 4. Start Backend

```bash
npm start
```

The backend will:
- ✅ Connect to database on startup
- ✅ Continue working even if database is unavailable (graceful degradation)
- ✅ Log database connection status

## What's Implemented

### ✅ Database Service (`src/services/database.js`)
- Connection pooling
- Transaction persistence
- Event deduplication
- Status tracking
- Query methods

### ✅ Routes Updated
- `POST /api/bridge` - Saves bridge transactions
- `POST /api/bridge/swap-sol-to-zenzec` - Saves swap transactions
- `GET /api/bridge/transaction/:txId` - Queries from database
- `GET /api/bridge/transactions/:address` - Gets all transactions for address

### ✅ Relayer Services Updated
- `relayer.js` - Checks database before processing events
- `btc-relayer.js` - Checks database before processing events
- Both save burn transactions to database

### ✅ Health Endpoint
- `GET /health` - Includes database connection status and statistics

## Verification

### Check Database Connection

```bash
curl http://localhost:3001/health
```

Response includes:
```json
{
  "database": true,
  "databaseStats": {
    "bridge": { "total": 5, "confirmed": 4, "pending": 1 },
    "swap": { "total": 2, "confirmed": 2 },
    "burn": { "total": 3, "confirmed": 3 }
  }
}
```

### Test Transaction Persistence

1. Make a bridge transaction:
   ```bash
   curl -X POST http://localhost:3001/api/bridge \
     -H "Content-Type: application/json" \
     -d '{"solanaAddress":"...","amount":1.5}'
   ```

2. Query the transaction:
   ```bash
   curl http://localhost:3001/api/bridge/transaction/{txId}
   ```

3. Get all transactions for an address:
   ```bash
   curl http://localhost:3001/api/bridge/transactions/{address}
   ```

## Database Schema

See `database/schema.sql` for complete schema.

### Key Tables

1. **bridge_transactions** - BTC/ZEC → zenZEC operations
2. **swap_transactions** - SOL ↔ zenZEC swaps
3. **burn_transactions** - zenZEC → SOL/BTC burns
4. **processed_events** - Prevents duplicate event processing
5. **transaction_status_history** - Audit trail

## Troubleshooting

### Database Not Connecting

1. Verify PostgreSQL is running:
   ```bash
   psql -U postgres -c "SELECT version();"
   ```

2. Check environment variables in `.env`

3. Verify database exists:
   ```sql
   \l
   ```

### Migration Errors

- Check PostgreSQL user has CREATE privileges
- Verify database exists before running migration
- Check PostgreSQL logs for detailed errors

### Performance

- Connection pooling is configured (max 20 connections)
- Indexes are created for frequently queried fields
- For production, consider read replicas

## Next Steps

Phase 1 is complete! The database is fully integrated. You can now:

1. ✅ All transactions are persisted
2. ✅ Query transaction history
3. ✅ Prevent duplicate event processing
4. ✅ Track transaction status changes

**Ready for Phase 2: Real Bitcoin Integration**

