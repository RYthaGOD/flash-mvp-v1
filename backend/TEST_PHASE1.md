# Phase 1 Testing Guide

This guide will help you test the database integration (Phase 1).

## Prerequisites Check

### 1. Verify PostgreSQL Installation

**Windows:**
```powershell
psql --version
```

**Mac/Linux:**
```bash
psql --version
```

If not installed, download from: https://www.postgresql.org/download/

### 2. Start PostgreSQL

**Windows (if installed as service):**
- Check Services: `services.msc` → Look for "postgresql"
- Or start manually if needed

**Mac:**
```bash
brew services start postgresql
```

**Linux:**
```bash
sudo systemctl start postgresql
```

**Docker (Alternative):**
```bash
docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
```

### 3. Create Database

Connect to PostgreSQL:
```bash
psql -U postgres
```

Then run:
```sql
CREATE DATABASE flash_bridge;
\q
```

## Setup Steps

### Step 1: Install Dependencies

```bash
cd backend
npm install
```

This installs the `pg` PostgreSQL client.

### Step 2: Configure Environment

Create or update `backend/.env`:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=flash_bridge
DB_USER=postgres
DB_PASSWORD=your_password_here
```

**Note:** Replace `your_password_here` with your PostgreSQL password.

### Step 3: Run Migration

```bash
npm run migrate
```

Expected output:
```
Connecting to database...
✓ Connected to database
Running migration...
✓ Migration completed successfully

Created tables:
  - bridge_transactions
  - burn_transactions
  - processed_events
  - swap_transactions
  - transaction_status_history

✓ Database setup complete
```

### Step 4: Run Database Tests

```bash
npm run test-db
```

This runs 8 tests:
1. ✅ Database Connection
2. ✅ Save Bridge Transaction
3. ✅ Get Bridge Transaction
4. ✅ Save Swap Transaction
5. ✅ Save Burn Transaction
6. ✅ Event Deduplication
7. ✅ Get Transactions by Address
8. ✅ Get Statistics

Expected output:
```
============================================================
Database Test Suite
============================================================

Test 1: Database Connection
✓ Database connection successful

Test 2: Save Bridge Transaction
✓ Bridge transaction saved successfully

... (all tests)

============================================================
Test Summary
============================================================
✓ Passed: 8
✗ Failed: 0
Total: 8

🎉 All tests passed! Database is working correctly.
```

## Integration Testing

### Step 5: Start Backend Server

```bash
npm start
```

Look for database connection message:
```
Initializing database...
✓ Database connected successfully
Database: Connected
```

### Step 6: Test Health Endpoint

```bash
curl http://localhost:3001/health
```

Or in PowerShell:
```powershell
Invoke-RestMethod -Uri http://localhost:3001/health
```

Expected response includes:
```json
{
  "status": "ok",
  "database": true,
  "databaseStats": {
    "bridge": { "total": "0", "confirmed": "0", "pending": "0" },
    "swap": { "total": "0", "confirmed": "0", "pending": "0" },
    "burn": { "total": "0", "confirmed": "0", "pending": "0" }
  }
}
```

### Step 7: Test Transaction Persistence

#### Test Bridge Transaction

```bash
curl -X POST http://localhost:3001/api/bridge \
  -H "Content-Type: application/json" \
  -d '{
    "solanaAddress": "TestAddress1234567890123456789012345678901234",
    "amount": 1.5
  }'
```

PowerShell:
```powershell
$body = @{
    solanaAddress = "TestAddress1234567890123456789012345678901234"
    amount = 1.5
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3001/api/bridge -Method POST -Body $body -ContentType "application/json"
```

This should return a `transactionId`. Save it for the next test.

#### Query Transaction

```bash
curl http://localhost:3001/api/bridge/transaction/{transactionId}
```

Replace `{transactionId}` with the ID from the previous response.

Expected response:
```json
{
  "transactionId": "...",
  "type": "bridge",
  "solanaAddress": "...",
  "amount": 1.5,
  "status": "confirmed",
  "createdAt": "2024-...",
  "updatedAt": "2024-..."
}
```

#### Test Swap Transaction

```bash
curl -X POST http://localhost:3001/api/bridge/swap-sol-to-zenzec \
  -H "Content-Type: application/json" \
  -d '{
    "solanaAddress": "TestAddress1234567890123456789012345678901234",
    "solAmount": 0.1
  }'
```

#### Get All Transactions for Address

```bash
curl http://localhost:3001/api/bridge/transactions/TestAddress1234567890123456789012345678901234
```

Expected response:
```json
{
  "success": true,
  "address": "...",
  "transactions": {
    "bridge": [...],
    "swap": [...],
    "burn": []
  }
}
```

## Verification Checklist

- [ ] PostgreSQL is running
- [ ] Database `flash_bridge` exists
- [ ] Environment variables configured in `.env`
- [ ] Migration completed successfully (`npm run migrate`)
- [ ] Database tests pass (`npm run test-db`)
- [ ] Backend starts and connects to database
- [ ] Health endpoint shows `"database": true`
- [ ] Bridge transaction is saved and queryable
- [ ] Swap transaction is saved and queryable
- [ ] Transactions by address endpoint works

## Troubleshooting

### Database Connection Failed

**Error:** `Failed to connect to database`

**Solutions:**
1. Verify PostgreSQL is running:
   ```bash
   psql -U postgres -c "SELECT version();"
   ```

2. Check environment variables:
   ```bash
   # Windows PowerShell
   Get-Content backend\.env | Select-String "DB_"
   ```

3. Verify database exists:
   ```sql
   psql -U postgres -l
   ```

4. Check PostgreSQL is listening on port 5432:
   ```bash
   # Windows
   netstat -an | findstr 5432
   
   # Mac/Linux
   lsof -i :5432
   ```

### Migration Errors

**Error:** `relation "bridge_transactions" already exists`

**Solution:** Tables already exist. This is OK - migration is idempotent.

**Error:** `permission denied`

**Solution:** Ensure PostgreSQL user has CREATE privileges:
```sql
GRANT ALL PRIVILEGES ON DATABASE flash_bridge TO postgres;
```

### Tests Fail

**Error:** `Database connection failed`

**Solution:** 
1. Check PostgreSQL is running
2. Verify `.env` has correct credentials
3. Test connection manually:
   ```bash
   psql -U postgres -d flash_bridge -c "SELECT NOW();"
   ```

## Success Criteria

✅ All 8 database tests pass  
✅ Backend connects to database on startup  
✅ Health endpoint shows database status  
✅ Transactions are saved to database  
✅ Transactions are queryable by ID  
✅ Transactions are queryable by address  
✅ Event deduplication works  

## Next Steps

Once Phase 1 testing is complete, you're ready for:
- **Phase 2:** Real Bitcoin Integration
- **Phase 5:** Security Hardening
- **Phase 6:** Monitoring and Observability

---

**Need Help?** Check `database/README.md` for detailed setup instructions.

