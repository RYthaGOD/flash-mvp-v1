#!/usr/bin/env node

/**
 * Quick Setup Check
 * Verifies PostgreSQL is accessible before running tests
 */

const { Pool } = require('pg');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: envPath });

async function checkSetup() {
  console.log('='.repeat(60));
  console.log('Phase 1 Setup Check');
  console.log('='.repeat(60));
  console.log('');

  // Check environment variables
  console.log('1. Checking Environment Variables...');
  console.log(`   Loading .env from: ${envPath}`);
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'flash_bridge',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  };

  console.log(`   DB_HOST: ${dbConfig.host}`);
  console.log(`   DB_PORT: ${dbConfig.port}`);
  console.log(`   DB_NAME: ${dbConfig.database}`);
  console.log(`   DB_USER: ${dbConfig.user}`);
  console.log(`   DB_PASSWORD: ${dbConfig.password ? '***' : '(not set)'}`);
  console.log('');

  if (!dbConfig.password) {
    console.log('⚠️  WARNING: DB_PASSWORD not set in .env');
    console.log('   If PostgreSQL requires a password, add it to backend/.env');
    console.log('');
  }

  // Try to connect
  console.log('2. Testing Database Connection...');
  const pool = new Pool(dbConfig);

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW(), version()');
    client.release();
    
    console.log('✓ Database connection successful!');
    console.log(`   PostgreSQL Version: ${result.rows[0].version.split(',')[0]}`);
    console.log(`   Server Time: ${result.rows[0].now}`);
    console.log('');

    // Check if database exists
    console.log('3. Checking Database...');
    const dbCheck = await pool.query(
      "SELECT datname FROM pg_database WHERE datname = $1",
      [dbConfig.database]
    );

    if (dbCheck.rows.length > 0) {
      console.log(`✓ Database "${dbConfig.database}" exists`);
    } else {
      console.log(`✗ Database "${dbConfig.database}" does not exist`);
      console.log('');
      console.log('   Create it with:');
      console.log(`   psql -U ${dbConfig.user} -c "CREATE DATABASE ${dbConfig.database};"`);
      await pool.end();
      process.exit(1);
    }
    console.log('');

    // Check if tables exist
    console.log('4. Checking Tables...');
    const tablesCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('bridge_transactions', 'swap_transactions', 'burn_transactions', 'processed_events', 'transaction_status_history')
      ORDER BY table_name
    `);

    const expectedTables = ['bridge_transactions', 'swap_transactions', 'burn_transactions', 'processed_events', 'transaction_status_history'];
    const existingTables = tablesCheck.rows.map(r => r.table_name);

    if (existingTables.length === expectedTables.length) {
      console.log('✓ All tables exist');
      existingTables.forEach(t => console.log(`   - ${t}`));
    } else {
      console.log('⚠️  Some tables are missing');
      console.log('   Existing:', existingTables.join(', '));
      console.log('   Missing:', expectedTables.filter(t => !existingTables.includes(t)).join(', '));
      console.log('');
      console.log('   Run migration: npm run migrate');
    }
    console.log('');

    await pool.end();

    console.log('='.repeat(60));
    console.log('✓ Setup Check Complete');
    console.log('='.repeat(60));
    console.log('');
    console.log('Next steps:');
    if (existingTables.length < expectedTables.length) {
      console.log('  1. Run migration: npm run migrate');
    }
    console.log('  2. Run tests: npm run test-db');
    console.log('  3. Start backend: npm start');
    console.log('');

  } catch (error) {
    console.log('✗ Database connection failed');
    console.log('');
    console.log('Error:', error.message);
    console.log('');
    console.log('Troubleshooting:');
    console.log('  1. Is PostgreSQL running?');
    console.log('     Windows: Check Services (services.msc)');
    console.log('     Mac: brew services list');
    console.log('     Linux: sudo systemctl status postgresql');
    console.log('');
    console.log('  2. Verify connection details in backend/.env');
    console.log('');
    console.log('  3. Test connection manually:');
    console.log(`     psql -U ${dbConfig.user} -h ${dbConfig.host} -p ${dbConfig.port} -d ${dbConfig.database}`);
    console.log('');
    console.log('  4. If using Docker:');
    console.log('     docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres');
    console.log('');

    await pool.end();
    process.exit(1);
  }
}

checkSetup().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

