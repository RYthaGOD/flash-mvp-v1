const bs58 = require('bs58');

const base58Key = "2kVgx6xbijWa1yVXD16A4iVb4CqM1XWCqX5dw5AjvYGvTqLkgGLmEhcRRF346vhHHUjFhnu1cakCyYLLN5U3jTiz";

console.log('🔑 Converting your base58 private key...');
console.log('Base58:', base58Key);

try {
  // Try different bs58 import methods
  let decode;
  if (typeof bs58.decode === 'function') {
    decode = bs58.decode;
  } else if (bs58.default && typeof bs58.default.decode === 'function') {
    decode = bs58.default.decode;
  } else {
    // Manual fallback for demo
    console.log('Using manual conversion (approximate):');
    console.log('Please use: https://www.browserling.com/tools/base58-to-hex');
    console.log('Input:', base58Key);
    console.log('Expected result: 64-character hex string');
    process.exit(0);
  }

  const bytes = decode(base58Key);
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

  console.log('✅ Conversion successful!');
  console.log('Hex Private Key:', hex);
  console.log('Length:', hex.length, 'characters');

  if (hex.length === 64) {
    console.log('✅ Valid 32-byte private key');
    console.log('\n🚀 Now run:');
    console.log(`node scripts/use-existing-keypair.js ${hex}`);
  } else {
    console.log('❌ Unexpected key length - please verify');
  }

} catch (error) {
  console.error('❌ Conversion failed:', error.message);
  console.log('\n🔄 Use online converter:');
  console.log('Go to: https://www.browserling.com/tools/base58-to-hex');
  console.log('Paste:', base58Key);
  console.log('Use the resulting hex string with the command above');
}
