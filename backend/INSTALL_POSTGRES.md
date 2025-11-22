# PostgreSQL Installation Guide for Windows

## Quick Installation Steps

### Step 1: Download PostgreSQL

1. Go to: https://www.postgresql.org/download/windows/
2. Click "Download the installer"
3. Choose the latest version (15.x or 16.x recommended)
4. Download the Windows x86-64 installer

### Step 2: Install PostgreSQL

1. **Run the installer** (postgresql-XX-x64.exe)

2. **Installation Options:**
   - Installation Directory: `C:\Program Files\PostgreSQL\XX` (default is fine)
   - Components: Select all (PostgreSQL Server, pgAdmin 4, Stack Builder, Command Line Tools)
   - Data Directory: `C:\Program Files\PostgreSQL\XX\data` (default is fine)

3. **Password Setup:**
   - **IMPORTANT:** Set a password for the `postgres` superuser
   - **Remember this password!** You'll need it for the `.env` file
   - Example: `postgres123` (or choose your own)

4. **Port:**
   - Keep default: `5432`

5. **Advanced Options:**
   - Locale: `[Default locale]` (or your preference)

6. **Pre Installation Summary:**
   - Review and click "Next"

7. **Ready to Install:**
   - Click "Next" to begin installation

8. **Completing Installation:**
   - Uncheck "Launch Stack Builder" (we don't need it)
   - Click "Finish"

### Step 3: Verify Installation

Open PowerShell and test:

```powershell
psql --version
```

You should see: `psql (PostgreSQL) XX.X`

### Step 4: Create Database

```powershell
# Connect to PostgreSQL
psql -U postgres

# Enter the password you set during installation
# Then run:
CREATE DATABASE flash_bridge;

# Exit
\q
```

### Step 5: Update .env File

Open `backend/.env` and add:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=flash_bridge
DB_USER=postgres
DB_PASSWORD=your_password_here
```

**Replace `your_password_here` with the password you set during installation!**

### Step 6: Test Connection

```powershell
cd backend
npm run check-db
```

You should see:
```
✓ Database connection successful!
✓ Database "flash_bridge" exists
```

### Step 7: Run Migration

```powershell
npm run migrate
```

### Step 8: Run Tests

```powershell
npm run test-db
```

---

## Troubleshooting

### "psql is not recognized"

**Solution:** Add PostgreSQL to PATH:
1. Find PostgreSQL bin directory: `C:\Program Files\PostgreSQL\XX\bin`
2. Add to System PATH:
   - Right-click "This PC" → Properties
   - Advanced system settings → Environment Variables
   - Edit "Path" under System variables
   - Add: `C:\Program Files\PostgreSQL\XX\bin`
   - Restart PowerShell

### "Password authentication failed"

**Solution:** 
- Check password in `.env` matches the one you set during installation
- Try resetting password:
  ```powershell
  psql -U postgres
  ALTER USER postgres PASSWORD 'newpassword';
  \q
  ```
  Then update `.env` with new password

### "Database does not exist"

**Solution:** Create it:
```powershell
psql -U postgres -c "CREATE DATABASE flash_bridge;"
```

### "Connection refused"

**Solution:**
1. Check PostgreSQL service is running:
   ```powershell
   Get-Service -Name "*postgres*"
   ```
2. Start service if stopped:
   ```powershell
   Start-Service postgresql-x64-XX
   ```
   (Replace XX with your version number)

---

## Alternative: Use Chocolatey (if you have it)

```powershell
choco install postgresql15
```

Then follow steps 4-8 above.

---

## Quick Verification Commands

```powershell
# Check PostgreSQL version
psql --version

# Check if service is running
Get-Service -Name "*postgres*"

# Test connection
psql -U postgres -c "SELECT version();"

# List databases
psql -U postgres -c "\l"

# Create database (if needed)
psql -U postgres -c "CREATE DATABASE flash_bridge;"
```

---

**Once installed, continue with Phase 1 testing!**

