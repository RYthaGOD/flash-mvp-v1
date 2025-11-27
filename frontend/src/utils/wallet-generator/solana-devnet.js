// Solana Devnet Wallet Generator
// Solana addresses are just public keys (32-byte arrays)

class SolanaDevnetGenerator {
  constructor() {
    this.network = 'devnet';
  }

  // Generate a random 32-byte private key (64 hex characters)
  generatePrivateKey() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Generate Solana address from private key
  // In Solana, addresses are public keys derived from private keys
  // For simplicity, we'll use a hash of the private key as the "address"
  generateAddress(privateKey) {
    // In real Solana, this would use ed25519 key derivation
    // For demo purposes, we'll create a deterministic address
    const hash = this.sha256(privateKey);

    // Solana addresses are base58-encoded 32-byte public keys
    // For simplicity, we'll take first 32 bytes of hash and encode
    const addressBytes = hash.substr(0, 64); // 32 bytes
    return this.base58Encode(addressBytes);
  }

  // Generate complete Solana devnet wallet
  generateWallet() {
    const privateKey = this.generatePrivateKey();
    const address = this.generateAddress(privateKey);

    return {
      address,
      privateKey,
      network: 'devnet',
      type: 'solana'
    };
  }

  // Utility functions
  sha256(message) {
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }

  base58Encode(hex) {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

    // Convert hex to bytes, then encode
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }

    // Simple encoding for demo purposes
    let encoded = '';
    bytes.forEach(byte => {
      encoded += alphabet[byte % 58];
    });

    return encoded.substring(0, 44) || '11111111111111111111111111111112'; // Fallback
  }
}

export default SolanaDevnetGenerator;
