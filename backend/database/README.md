# Database Setup Guide

This directory contains the database schema and migration scripts for the FLASH Bridge backend.

## Prerequisites

1. **PostgreSQL** installed and running
   - Download from: https://www.postgresql.org/download/
   - Or use Docker: `docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres`

2. **Database created**
   ```sql
   CREATE DATABASE flash_bridge;
   ```

## Setup Steps

### 1. Configure Environment Variables

Add database configuration to `backend/.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=flash_bridge
DB_USER=postgres
DB_PASSWORD=your_password
```

### 2. Run Migration

From the `backend` directory:

```bash
npm run migrate
```

Or directly:

```bash
node database/migrate.js
```

This will:
- Create all necessary tables
- Set up indexes for performance
- Create triggers for auto-updating timestamps

## Database Schema

### Tables

1. **bridge_transactions** - Stores BTC/ZEC → zenZEC bridge operations
2. **swap_transactions** - Stores SOL ↔ zenZEC swap operations
3. **burn_transactions** - Stores zenZEC → SOL/BTC burn operations
4. **processed_events** - Prevents duplicate event processing
5. **transaction_status_history** - Audit trail of status changes

### Schema Details

See `schema.sql` for complete table definitions, indexes, and triggers.

## Usage

The database service is automatically initialized when the backend starts. If the database is not available, the backend will continue to function but transactions will not be persisted.

### Checking Database Status

The `/health` endpoint includes database connection status:

```bash
curl http://localhost:3001/health
```

### Querying Transactions

Use the API endpoints:

- `GET /api/bridge/transaction/:txId` - Get transaction by ID
- `GET /api/bridge/transactions/:address` - Get all transactions for an address

## Troubleshooting

### Connection Errors

1. Verify PostgreSQL is running:
   ```bash
   psql -U postgres -c "SELECT version();"
   ```

2. Check environment variables match your PostgreSQL setup

3. Verify database exists:
   ```sql
   \l
   ```

### Migration Errors

If migration fails:

1. Check PostgreSQL logs
2. Verify user has CREATE TABLE permissions
3. Try running SQL manually from `schema.sql`

### Performance

For production, consider:
- Connection pooling (already configured)
- Read replicas for query-heavy workloads
- Regular VACUUM and ANALYZE
- Monitoring slow queries

## Backup

Regular backups are recommended:

```bash
pg_dump -U postgres flash_bridge > backup_$(date +%Y%m%d).sql
```

## Reset Database

To reset the database (⚠️ deletes all data):

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

Then run migration again.

