# PostgreSQL Setup Script for FLASH Bridge
# This script helps verify and set up PostgreSQL for Phase 1 testing

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "PostgreSQL Setup for FLASH Bridge" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if PostgreSQL is installed
Write-Host "1. Checking PostgreSQL installation..." -ForegroundColor Yellow
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue

if (-not $psqlPath) {
    Write-Host "[!] PostgreSQL not found in PATH, searching common locations..." -ForegroundColor Yellow
    
    # Search for PostgreSQL in common locations
    $searchPaths = @(
        "C:\Program Files\PostgreSQL",
        "C:\Program Files (x86)\PostgreSQL",
        "$env:LOCALAPPDATA\Programs\PostgreSQL",
        "$env:ProgramFiles\PostgreSQL"
    )
    
    $foundPath = $null
    foreach ($basePath in $searchPaths) {
        if (Test-Path $basePath) {
            $pgDirs = Get-ChildItem -Path $basePath -Directory -ErrorAction SilentlyContinue
            foreach ($pgDir in $pgDirs) {
                $binPath = Join-Path $pgDir.FullName "bin"
                $psqlExe = Join-Path $binPath "psql.exe"
                if (Test-Path $psqlExe) {
                    $foundPath = $binPath
                    Write-Host "[OK] Found PostgreSQL at: $binPath" -ForegroundColor Green
                    break
                }
            }
            if ($foundPath) { break }
        }
    }
    
    if ($foundPath) {
        Write-Host "  Adding to PATH for this session..." -ForegroundColor Yellow
        $env:Path = "$foundPath;$env:Path"
        $psqlPath = Get-Command psql -ErrorAction SilentlyContinue
        if ($psqlPath) {
            Write-Host "[OK] PostgreSQL is now available" -ForegroundColor Green
        } else {
            Write-Host "[X] Failed to add PostgreSQL to PATH" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "[X] PostgreSQL is not installed or not in PATH" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install PostgreSQL:" -ForegroundColor Yellow
        Write-Host "  1. Download from: https://www.postgresql.org/download/windows/" -ForegroundColor White
        Write-Host "  2. Run the installer" -ForegroundColor White
        Write-Host "  3. Remember the password you set for 'postgres' user" -ForegroundColor White
        Write-Host "  4. Add PostgreSQL bin to PATH (usually: C:\Program Files\PostgreSQL\XX\bin)" -ForegroundColor White
        Write-Host ""
        Write-Host "See INSTALL_POSTGRES.md for detailed instructions" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "[OK] PostgreSQL found: $($psqlPath.Source)" -ForegroundColor Green
$version = & psql --version
Write-Host "  Version: $version" -ForegroundColor Gray
Write-Host ""

# Check if PostgreSQL service is running
Write-Host "2. Checking PostgreSQL service..." -ForegroundColor Yellow
$postgresService = Get-Service -Name "*postgres*" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($postgresService) {
    if ($postgresService.Status -eq 'Running') {
        Write-Host "[OK] PostgreSQL service is running" -ForegroundColor Green
    } else {
        Write-Host "[!] PostgreSQL service is stopped" -ForegroundColor Yellow
        Write-Host "  Attempting to start service..." -ForegroundColor Yellow
        try {
            Start-Service $postgresService.Name
            Write-Host "[OK] Service started successfully" -ForegroundColor Green
        } catch {
            Write-Host "[X] Failed to start service: $_" -ForegroundColor Red
            Write-Host "  Please start it manually from Services (services.msc)" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "[!] Could not find PostgreSQL service" -ForegroundColor Yellow
    Write-Host "  This is OK if PostgreSQL is running in a different way" -ForegroundColor Gray
}
Write-Host ""

# Check .env file
Write-Host "3. Checking .env configuration..." -ForegroundColor Yellow
$envPath = Join-Path $PSScriptRoot ".env"

if (Test-Path $envPath) {
    Write-Host "[OK] .env file exists" -ForegroundColor Green
    
    $envContent = Get-Content $envPath -Raw
    $hasDbHost = $envContent -match "DB_HOST"
    $hasDbPort = $envContent -match "DB_PORT"
    $hasDbName = $envContent -match "DB_NAME"
    $hasDbUser = $envContent -match "DB_USER"
    $hasDbPassword = $envContent -match "DB_PASSWORD"
    
    if ($hasDbHost -and $hasDbPort -and $hasDbName -and $hasDbUser -and $hasDbPassword) {
        Write-Host "[OK] Database configuration found in .env" -ForegroundColor Green
    } else {
        Write-Host "[!] Database configuration incomplete in .env" -ForegroundColor Yellow
        Write-Host "  Adding database configuration..." -ForegroundColor Yellow
        
        $dbConfig = @"

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=flash_bridge
DB_USER=postgres
DB_PASSWORD=
"@
        
        Add-Content -Path $envPath -Value $dbConfig
        Write-Host "[OK] Added database configuration template" -ForegroundColor Green
        Write-Host "  [!] IMPORTANT: Set DB_PASSWORD in .env with your PostgreSQL password!" -ForegroundColor Red
    }
} else {
    Write-Host "[!] .env file not found" -ForegroundColor Yellow
    Write-Host "  Creating .env file..." -ForegroundColor Yellow
    
    $dbConfig = @"
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=flash_bridge
DB_USER=postgres
DB_PASSWORD=
"@
    
    Set-Content -Path $envPath -Value $dbConfig
    Write-Host "[OK] Created .env file" -ForegroundColor Green
    Write-Host "  [!] IMPORTANT: Set DB_PASSWORD in .env with your PostgreSQL password!" -ForegroundColor Red
}
Write-Host ""

# Test database connection
Write-Host "4. Testing database connection..." -ForegroundColor Yellow
Write-Host "  (This will prompt for password if not set in .env)" -ForegroundColor Gray

# Load .env variables
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

$dbPassword = [Environment]::GetEnvironmentVariable("DB_PASSWORD", "Process")
$dbUser = [Environment]::GetEnvironmentVariable("DB_USER", "Process")
if (-not $dbUser) { $dbUser = "postgres" }
$dbName = [Environment]::GetEnvironmentVariable("DB_NAME", "Process")
if (-not $dbName) { $dbName = "flash_bridge" }

if (-not $dbPassword) {
    Write-Host "[!] DB_PASSWORD not set in .env" -ForegroundColor Yellow
    Write-Host "  Please add your PostgreSQL password to backend/.env" -ForegroundColor Yellow
    Write-Host "  Example: DB_PASSWORD=your_password_here" -ForegroundColor Gray
    Write-Host ""
    Write-Host "After setting password, run: npm run check-db" -ForegroundColor Yellow
    exit 0
}

# Set PGPASSWORD environment variable for psql
$env:PGPASSWORD = $dbPassword

try {
    $testResult = & psql -U $dbUser -h localhost -d postgres -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Database connection successful!" -ForegroundColor Green
    } else {
        Write-Host "[X] Database connection failed" -ForegroundColor Red
        Write-Host "  Error: $testResult" -ForegroundColor Red
        Write-Host "  Check your password in .env" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "[X] Database connection error: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Check if database exists
Write-Host "5. Checking if database exists..." -ForegroundColor Yellow
$dbExists = & psql -U $dbUser -h localhost -d postgres -t -c "SELECT 1 FROM pg_database WHERE datname = '$dbName';" 2>&1

if ($dbExists -match "1") {
    Write-Host "[OK] Database '$dbName' exists" -ForegroundColor Green
} else {
    Write-Host "[!] Database '$dbName' does not exist" -ForegroundColor Yellow
    Write-Host "  Creating database..." -ForegroundColor Yellow
    
    $createResult = & psql -U $dbUser -h localhost -d postgres -c "CREATE DATABASE $dbName;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Database created successfully" -ForegroundColor Green
    } else {
        Write-Host "[X] Failed to create database: $createResult" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# Summary
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run migration: npm run migrate" -ForegroundColor White
Write-Host "  2. Run tests: npm run test-db" -ForegroundColor White
Write-Host "  3. Start backend: npm start" -ForegroundColor White
Write-Host ""

# Clean up
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

