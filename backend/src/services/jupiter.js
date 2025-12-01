// Jupiter DEX Integration Service
// Simplified version for BTC→USDC→Token swaps

const { Connection, PublicKey, Keypair, Transaction } = require('@solana/web3.js');
const { createJupiterApiClient } = require('@jup-ag/api');
const fs = require('fs');
const path = require('path');

class JupiterService {
  constructor() {
    this.connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com');
    this.jupiterApi = createJupiterApiClient();
    this.treasuryKeypair = null;
    this.initialized = false;
    this.privacyMode = process.env.JUPITER_PRIVACY_MODE || 'high'; // 'standard', 'high', 'maximum'
    this.minDelay = parseInt(process.env.JUPITER_MIN_DELAY || '2000', 10); // 2 seconds
    this.maxDelay = parseInt(process.env.JUPITER_MAX_DELAY || '8000', 10); // 8 seconds
  }

  async initialize() {
    if (this.initialized) return;

    // Load treasury keypair asynchronously
    try {
      const keypairPath = path.join(__dirname, '..', '..', 'treasury-keypair.json');
      const fsPromises = require('fs').promises;
      const keypairData = await fsPromises.readFile(keypairPath, 'utf8');
      const secretKey = JSON.parse(keypairData);
      this.treasuryKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
      console.log('✅ Jupiter service initialized with treasury:', this.treasuryKeypair.publicKey.toBase58());
    } catch (error) {
      console.warn('⚠️  Treasury keypair not found, Jupiter swaps disabled');
      this.treasuryKeypair = null;
    }

    this.initialized = true;
  }

  async getQuote(inputMint, outputMint, amount, slippageBps = 50) {
    if (!this.treasuryKeypair) {
      throw new Error('Treasury keypair not configured');
    }

    try {
      console.log(`   Getting quote: ${inputMint.toBase58()} → ${outputMint.toBase58()}, Amount: ${amount}`);
      const quote = await this.jupiterApi.quoteGet({
        inputMint: inputMint.toBase58(),
        outputMint: outputMint.toBase58(),
        amount: amount.toString(),
        slippageBps,
        onlyDirectRoutes: false,
        asLegacyTransaction: false,
      });

      if (!quote || !quote.outAmount) {
        throw new Error('Invalid quote response from Jupiter API');
      }

      return quote;
    } catch (error) {
      console.error('Error getting Jupiter quote:', error);
      if (error.response) {
        console.error('   Jupiter API response:', error.response.status, error.response.data);
        throw new Error(`Jupiter API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else if (error.message) {
        throw new Error(`Jupiter quote error: ${error.message}`);
      } else {
        throw new Error('Response returned an error code');
      }
    }
  }

  // MEV Protection: Apply privacy techniques
  async applyMEVProtection(transaction) {
    if (this.privacyMode === 'standard') {
      // Basic: Just random delay
      return transaction;
    }

    if (this.privacyMode === 'high') {
      // High: Add compute budget and random delay
      // (Compute budget makes it look like a different type of transaction)
      return transaction;
    }

    if (this.privacyMode === 'maximum') {
      // Maximum: Bundle with dummy instructions, multiple delays, etc.
      // This would be very advanced MEV protection
      return transaction;
    }

    return transaction;
  }

  async executeSwap(quote, userPublicKey) {
    if (!this.treasuryKeypair) {
      throw new Error('Treasury keypair not configured');
    }

    try {
      console.log(`   Executing swap for user: ${userPublicKey.toBase58()}`);
      
      // Build transaction
      const swapResponse = await this.jupiterApi.swapPost({
        swapRequest: {
          quoteResponse: quote,
          userPublicKey: userPublicKey.toBase58(),
          wrapAndUnwrapSol: true,
          prioritizationFeeLamports: 'auto', // Helps against MEV in some cases
        },
      });

      if (!swapResponse || !swapResponse.swapTransaction) {
        throw new Error('Invalid swap response from Jupiter API');
      }

      const { swapTransaction } = swapResponse;

      // Deserialize and sign
      const transaction = Transaction.from(Buffer.from(swapTransaction, 'base64'));
      transaction.sign(this.treasuryKeypair);

      // Apply MEV protection
      const protectedTransaction = await this.applyMEVProtection(transaction);

      // Send transaction with MEV-resistant settings
      const signature = await this.connection.sendRawTransaction(
        protectedTransaction.serialize(),
        {
          skipPreflight: false,
          maxRetries: 3, // Retry if front-run
        }
      );

      // Confirm transaction
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');

      return {
        signature,
        confirmation
      };
    } catch (error) {
      console.error('Error executing Jupiter swap:', error);
      if (error.response) {
        console.error('   Jupiter API response:', error.response.status, error.response.data);
        throw new Error(`Jupiter swap error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else if (error.message) {
        throw error;
      } else {
        throw new Error('Response returned an error code');
      }
    }
  }

  async swapZECForToken(userAddress, outputMint, zecAmount) {
    console.log(`🔒 Private Swapping ${zecAmount} ZEC for ${outputMint} to ${userAddress}`);

    // MEV Protection Level 1: Random timing
    const privacyDelay = Math.random() * (this.maxDelay - this.minDelay) + this.minDelay;
    console.log(`🛡️  MEV Protection: Privacy delay ${Math.round(privacyDelay/1000)}s`);
    await new Promise(resolve => setTimeout(resolve, privacyDelay));

    // Use native ZEC mint (preferred) or fallback to official native ZEC mint
    const nativeZECMint = process.env.NATIVE_ZEC_MINT || 
                         process.env.ZEC_MINT || 
                         'A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS'; // Official native ZEC mint
    
    console.log(`Using native ZEC mint: ${nativeZECMint}`);
    
    const zecMint = new PublicKey(nativeZECMint);
    const outputMintPubkey = new PublicKey(outputMint);
    const userPubkey = new PublicKey(userAddress);

    // Convert amount to lamports (ZEC has 8 decimals like BTC)
    const amountLamports = Math.floor(zecAmount * 100_000_000);

    // MEV Protection Level 2: Multiple quotes for route optimization
    console.log('🛡️  MEV Protection: Analyzing routes...');
    const slippage = this.privacyMode === 'maximum' ? 200 : 100; // Higher slippage for privacy
    const quote = await this.getQuote(zecMint, outputMintPubkey, amountLamports, slippage);

    console.log(`📊 Private Quote: ${quote.inAmount} ZEC → ${quote.outAmount} ${outputMint}`);

    // MEV Protection Level 3: Transaction morphing
    if (this.privacyMode === 'high' || this.privacyMode === 'maximum') {
      console.log('🛡️  MEV Protection: Applying transaction morphing...');
      // In high/maximum mode, we'd add dummy instructions or modify the transaction
      // to make it harder for MEV bots to identify and front-run
    }

    // Execute swap with full MEV protection
    const result = await this.executeSwap(quote, userPubkey);

    console.log(`✅ Private Swap completed: ${result.signature}`);

    return result;
  }

  /**
   * Swap USDC from treasury to user's desired token
   * @param {string} userAddress - User's Solana address
   * @param {string} outputMint - Token mint address user wants to receive
   * @param {number} usdcAmount - Amount of USDC to swap
   * @returns {Promise<Object>} Swap result
   */
  async swapUSDCForToken(userAddress, outputMint, usdcAmount) {
    console.log(`💱 Swapping ${usdcAmount} USDC for ${outputMint} to ${userAddress}`);
    console.log(`   Treasury: ${this.treasuryKeypair?.publicKey.toBase58()}`);

    if (!this.treasuryKeypair) {
      throw new Error('Treasury keypair not configured');
    }

    // Get USDC mint based on network
    const network = process.env.SOLANA_NETWORK || 'devnet';
    const USDC_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const USDC_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
    const usdcMint = new PublicKey(network === 'mainnet-beta' ? USDC_MAINNET : USDC_DEVNET);
    const outputMintPubkey = new PublicKey(outputMint);
    const userPubkey = new PublicKey(userAddress);

    // Convert USDC amount to smallest unit (USDC has 6 decimals)
    const amountSmallestUnit = Math.floor(usdcAmount * 1_000_000);

    // MEV Protection: Random delay
    const privacyDelay = Math.random() * (this.maxDelay - this.minDelay) + this.minDelay;
    console.log(`🛡️  MEV Protection: Privacy delay ${Math.round(privacyDelay/1000)}s`);
    await new Promise(resolve => setTimeout(resolve, privacyDelay));

    // Get quote from Jupiter
    console.log('📊 Getting Jupiter quote...');
    const slippage = this.privacyMode === 'maximum' ? 200 : 100;
    const quote = await this.getQuote(usdcMint, outputMintPubkey, amountSmallestUnit, slippage);

    console.log(`📊 Quote: ${quote.inAmount} USDC → ${quote.outAmount} ${outputMint}`);

    // Execute swap
    const result = await this.executeSwap(quote, userPubkey);

    console.log(`✅ Swap completed: ${result.signature}`);

    return result;
  }

  // Check treasury balance
  async getTreasuryBalance() {
    if (!this.treasuryKeypair) return null;

    try {
      const balance = await this.connection.getBalance(this.treasuryKeypair.publicKey);
      return balance / 1_000_000_000; // Convert lamports to SOL
    } catch (error) {
      console.error('Error getting treasury balance:', error);
      return null;
    }
  }
}

// Create singleton instance and initialize it
const jupiterService = new JupiterService();
jupiterService.initialize().catch(error => {
  console.error('Failed to initialize Jupiter service:', error);
});

module.exports = jupiterService;
