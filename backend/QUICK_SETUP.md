# Quick PostgreSQL Setup for Phase 1 Testing

## Option 1: Docker (Recommended - Easiest)

### Step 1: Install Docker Desktop
- Download: https://www.docker.com/products/docker-desktop
- Install and start Docker Desktop

### Step 2: Run PostgreSQL Container
```powershell
docker run --name flash-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:15
```

### Step 3: Create Database
```powershell
docker exec -it flash-postgres psql -U postgres -c "CREATE DATABASE flash_bridge;"
```

### Step 4: Update .env
Add to `backend/.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=flash_bridge
DB_USER=postgres
DB_PASSWORD=postgres
```

### Step 5: Test Connection
```powershell
cd backend
npm run check-db
```

---

## Option 2: Install PostgreSQL Locally

### Step 1: Download PostgreSQL
- Windows: https://www.postgresql.org/download/windows/
- Choose "Download the installer"
- Run the installer

### Step 2: During Installation
- Remember the password you set for the `postgres` user
- Port: 5432 (default)
- Components: Install all (PostgreSQL Server, pgAdmin, Command Line Tools)

### Step 3: Create Database
Open PowerShell and run:
```powershell
psql -U postgres
```

Then in psql:
```sql
CREATE DATABASE flash_bridge;
\q
```

### Step 4: Update .env
Add to `backend/.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=flash_bridge
DB_USER=postgres
DB_PASSWORD=your_password_here
```

### Step 5: Test Connection
```powershell
cd backend
npm run check-db
```

---

## Option 3: Skip Database (Demo Mode)

If you just want to test the backend without database:

The backend will work without database, but transactions won't be persisted.

1. Start backend:
```powershell
cd backend
npm start
```

2. The backend will show:
```
Database: Connection failed - transactions will not be persisted
```

3. All API endpoints will still work, but:
   - Transactions won't be saved
   - Transaction history won't be available
   - Event deduplication won't work across restarts

---

## Verify Setup

After setting up PostgreSQL, run:

```powershell
cd backend
npm run check-db
```

Expected output:
```
✓ Database connection successful!
✓ Database "flash_bridge" exists
✓ All tables exist
```

Then run migration:
```powershell
npm run migrate
```

Then run tests:
```powershell
npm run test-db
```

---

## Troubleshooting

### Docker: Container already exists
```powershell
docker rm flash-postgres
docker run --name flash-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:15
```

### Docker: Port already in use
If port 5432 is already used:
1. Find what's using it: `netstat -ano | findstr :5432`
2. Use different port: `docker run ... -p 5433:5432 ...`
3. Update `.env`: `DB_PORT=5433`

### Connection refused
- Check PostgreSQL is running
- Check firewall isn't blocking port 5432
- Verify host/port in `.env`

### Authentication failed
- Check password in `.env` matches PostgreSQL password
- For Docker, password is `postgres` (unless you changed it)

---

## Next Steps

Once database is set up:
1. ✅ `npm run check-db` - Verify setup
2. ✅ `npm run migrate` - Create tables
3. ✅ `npm run test-db` - Test database operations
4. ✅ `npm start` - Start backend with database

