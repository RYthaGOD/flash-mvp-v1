const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

// Read current .env
let envContent = fs.readFileSync(envPath, 'utf8');

// Split into lines
const lines = envContent.split('\n');
const newLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Comment out database-related lines
  if (line.startsWith('DB_HOST=') || 
      line.startsWith('DB_PORT=') || 
      line.startsWith('DB_NAME=') || 
      line.startsWith('DB_USER=') || 
      line.startsWith('DB_PASSWORD=')) {
    // Comment it out if not already commented
    if (!line.trim().startsWith('#')) {
      newLines.push('#' + line);
    } else {
      newLines.push(line);
    }
  } else {
    newLines.push(line);
  }
}

// Write back
fs.writeFileSync(envPath, newLines.join('\n'), 'utf8');

console.log('✅ Database configuration disabled in .env');
console.log('\n📝 Database variables have been commented out');
console.log('   The system will now run without database (transactions won\'t be persisted)');
console.log('   This is fine for testing the bridge address flow!');

