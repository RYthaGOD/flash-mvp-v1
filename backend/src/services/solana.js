// Lazy load Solana dependencies to avoid import issues in tests
let solanaDeps = null;

const getSolanaDeps = () => {
  if (!solanaDeps) {
    try {
      const { Connection, PublicKey, Keypair, clusterApiUrl, Transaction } = require('@solana/web3.js');
      const { AnchorProvider, Program, web3, BN } = require('@coral-xyz/anchor');
      const {
        getAssociatedTokenAddress,
        createAssociatedTokenAccountInstruction,
        createTransferInstruction,
        getAccount,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      } = require('@solana/spl-token');

      solanaDeps = {
        Connection,
        PublicKey,
        Keypair,
        clusterApiUrl,
        Transaction,
        AnchorProvider,
        Program,
        web3,
        BN,
        getAssociatedTokenAddress,
        createAssociatedTokenAccountInstruction,
        createTransferInstruction,
        getAccount,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      };
    } catch (error) {
      console.warn('Solana dependencies not available:', error.message);
      // Provide mock implementations for testing
      const MockPublicKey = class MockPublicKey {
        constructor(addr) { this.address = addr; }
        toString() { return this.address; }
        toBase58() { return this.address; }
        equals(other) { return other.toString() === this.address; }
      };

      solanaDeps = {
        Connection: class MockConnection {},
        PublicKey: MockPublicKey,
        Keypair: { generate: () => ({ publicKey: new MockPublicKey('mock'), secretKey: new Uint8Array(64) }) },
        clusterApiUrl: () => 'http://mock-rpc.com',
        Transaction: class MockTransaction {},
        AnchorProvider: class MockAnchorProvider {},
        Program: class MockProgram {},
        web3: { SystemProgram: {}, SYSVAR_RENT_PUBKEY: new MockPublicKey('SysvarRent111111111111111111111111111111111') },
        BN: class MockBN {},
        getAssociatedTokenAddress: async () => new MockPublicKey('mock-token-account'),
        createAssociatedTokenAccountInstruction: () => ({}),
        createTransferInstruction: () => ({}),
        getAccount: async () => ({ amount: '1000000000' }),
        TOKEN_PROGRAM_ID: new MockPublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        ASSOCIATED_TOKEN_PROGRAM_ID: new MockPublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
      };
    }
  }
  return solanaDeps;
};
const fs = require('fs');
const path = require('path');

// Load IDL - Try flash_bridge_mxe first (actual program), fallback to zenz_bridge for backward compatibility
let idl;
try {
  // Try flash_bridge_mxe IDL first (correct program)
  const flashBridgeIdlPath = path.join(__dirname, '../../../flash-bridge-mxe/target/idl/flash_bridge_mxe.json');
  if (fs.existsSync(flashBridgeIdlPath)) {
    idl = JSON.parse(fs.readFileSync(flashBridgeIdlPath, 'utf8'));
    console.log('✅ Loaded flash_bridge_mxe IDL');
  } else {
    // Fallback to old path for backward compatibility
    const oldIdlPath = path.join(__dirname, '../../../target/idl/zenz_bridge.json');
    if (fs.existsSync(oldIdlPath)) {
      idl = JSON.parse(fs.readFileSync(oldIdlPath, 'utf8'));
      console.warn('⚠️  Using old zenz_bridge IDL (flash_bridge_mxe not found)');
    }
  }
} catch (error) {
  console.warn('IDL not found, some functionality may be limited:', error.message);
}

class SolanaService {
  constructor() {
    const deps = getSolanaDeps();
    const network = process.env.SOLANA_NETWORK || 'devnet';
    const rpcUrl = process.env.SOLANA_RPC_URL || deps.clusterApiUrl(network);

    this.connection = new deps.Connection(rpcUrl, 'confirmed');

    // Initialize programId - prefer FLASH_BRIDGE_MXE_PROGRAM_ID, fallback to PROGRAM_ID
    const flashBridgeProgramId = process.env.FLASH_BRIDGE_MXE_PROGRAM_ID || process.env.PROGRAM_ID;
    if (flashBridgeProgramId && flashBridgeProgramId !== '') {
      this.programId = new deps.PublicKey(flashBridgeProgramId);
      console.log(`✅ Program ID initialized: ${this.programId.toString()}`);
    } else {
      this.programId = null; // Not using program features
      console.warn('⚠️  No program ID configured (FLASH_BRIDGE_MXE_PROGRAM_ID or PROGRAM_ID)');
    }

    // Initialize keypair as null, will be loaded asynchronously
    this.relayerKeypair = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    // Load relayer keypair asynchronously
    this.relayerKeypair = await this.loadRelayerKeypair();
    this.initialized = true;
  }

  async loadRelayerKeypair() {
    try {
      const deps = getSolanaDeps();
      const keypairPath = process.env.RELAYER_KEYPAIR_PATH || path.join(__dirname, '..', '..', 'backend', 'relayer-keypair-new.json');
      const fsPromises = require('fs').promises;

      try {
        await fsPromises.access(keypairPath);
        const keypairData = await fsPromises.readFile(keypairPath, 'utf8');
        const keypairJson = JSON.parse(keypairData);
        return deps.Keypair.fromSecretKey(Uint8Array.from(keypairJson));
      } catch (fileError) {
        // File doesn't exist or can't be read
        return null;
      }
    } catch (error) {
      console.warn('Relayer keypair not loaded:', error.message);
    }
    return null;
  }

  getConnection() {
    return this.connection;
  }

  getProgram() {
    if (!this.programId) {
      throw new Error('Solana program not configured. Set FLASH_BRIDGE_MXE_PROGRAM_ID or PROGRAM_ID in .env to enable program features.');
    }

    if (!idl || !this.relayerKeypair) {
      throw new Error('IDL or relayer keypair not available. Ensure flash_bridge_mxe is built: cd flash-bridge-mxe && anchor build');
    }

    const deps = getSolanaDeps();
    const wallet = {
      publicKey: this.relayerKeypair.publicKey,
      signTransaction: async (tx) => {
        tx.partialSign(this.relayerKeypair);
        return tx;
      },
      signAllTransactions: async (txs) => {
        return txs.map((tx) => {
          tx.partialSign(this.relayerKeypair);
          return tx;
        });
      },
    };

    const provider = new deps.AnchorProvider(
      this.connection,
      wallet,
      { commitment: 'confirmed' }
    );

    return new deps.Program(idl, this.programId, provider);
  }

  async getConfigPDA() {
    if (!this.programId) {
      throw new Error('Solana program not configured. Set PROGRAM_ID in .env to enable zenZEC features.');
    }

    const deps = getSolanaDeps();
    const [configPda] = await deps.PublicKey.findProgramAddress(
      [Buffer.from('config')],
      this.programId
    );
    return configPda;
  }

  /**
   * Retry wrapper for transaction operations
   * @param {Function} fn - Async function to retry
   * @param {number} maxRetries - Maximum retry attempts
   * @param {number} baseDelay - Base delay in ms for exponential backoff
   * @returns {Promise} Result of function
   */
  async retryOperation(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        // Don't retry on certain errors (e.g., validation errors, insufficient funds)
        if (error.message?.includes('Invalid') || 
            error.message?.includes('Insufficient') ||
            error.message?.includes('not configured')) {
          throw error;
        }
        
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  /**
   * DEPRECATED: Mint zenZEC tokens (custom token)
   * NOTE: This function requires a Solana program with mintZenZec instruction.
   * The current flash_bridge_mxe program does NOT have this instruction.
   * Use transferNativeZEC() instead, which transfers native ZEC from treasury.
   * 
   * This function is kept for backward compatibility but will fail if called.
   */
  async mintZenZEC(userAddress, amount) {
    console.warn('⚠️  DEPRECATED: mintZenZEC() called. This requires a program with mintZenZec instruction.');
    console.warn('⚠️  The current flash_bridge_mxe program does not support minting. Use native ZEC transfers instead.');
    console.warn('⚠️  This operation will likely fail. Consider using transferNativeZEC() instead.');
    
    if (!this.relayerKeypair) {
      throw new Error('Relayer keypair not configured');
    }

    // Try to get program, but expect it to fail or not have the instruction
    try {
      const program = this.getProgram();
      const configPda = await this.getConfigPDA();
      const userPubkey = new PublicKey(userAddress);
      const mintPubkey = new PublicKey(process.env.ZENZEC_MINT);

      // Check if program has mintZenZec instruction
      if (!program.methods.mintZenZec) {
        throw new Error(
          'Program does not have mintZenZec instruction. ' +
          'The flash_bridge_mxe program does not support custom token minting. ' +
          'Use transferNativeZEC() to transfer native ZEC from treasury instead.'
        );
      }

      // Get or create user token account (ATA)
      const userTokenAccount = await this.getOrCreateTokenAccount(userPubkey);

      // Retry minting operation with exponential backoff
      return await this.retryOperation(async () => {
        const tx = await program.methods
          .mintZenZec(new BN(amount))
          .accounts({
            config: configPda,
            mint: mintPubkey,
            userTokenAccount: userTokenAccount,
            authority: this.relayerKeypair.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();

        console.log(`Minted ${amount} zenZEC to ${userAddress}`);
        console.log(`Transaction: ${tx}`);
        return tx;
      }, 3, 2000); // 3 retries, 2s base delay
    } catch (error) {
      // Provide helpful error message
      throw new Error(
        `mintZenZEC() is not supported with the current program. ` +
        `Error: ${error.message}. ` +
        `Use transferNativeZEC() to transfer native ZEC from treasury instead.`
      );
    }
  }

  async getOrCreateTokenAccount(userPubkey, mintAddress = null) {
    const mintPubkey = new PublicKey(mintAddress || process.env.ZENZEC_MINT);
    
    // Get ATA address (deterministic)
    const ata = await getAssociatedTokenAddress(
      mintPubkey,
      userPubkey,
      false, // allowOwnerOffCurve
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    // Check if account exists
    const accountInfo = await this.connection.getAccountInfo(ata);
    
    if (!accountInfo) {
      // Create ATA if it doesn't exist
      const createIx = createAssociatedTokenAccountInstruction(
        this.relayerKeypair.publicKey, // payer
        ata,                            // ata
        userPubkey,                     // owner
        mintPubkey,                     // mint
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      
      // Create and send transaction
      const transaction = new Transaction().add(createIx);
      
      // Get blockhash with expiry info
      let { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
      
      // Check if blockhash is still valid before sending
      const currentBlockHeight = await this.connection.getBlockHeight();
      if (currentBlockHeight > lastValidBlockHeight) {
        // Blockhash expired, get a new one
        const blockhashInfo = await this.connection.getLatestBlockhash('confirmed');
        blockhash = blockhashInfo.blockhash;
        lastValidBlockHeight = blockhashInfo.lastValidBlockHeight;
        console.log('Blockhash expired during ATA creation, using new blockhash');
      }
      
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.relayerKeypair.publicKey;
      
      // Sign and send
      transaction.sign(this.relayerKeypair);
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        { skipPreflight: false }
      );
      
      // Wait for confirmation using blockhash-based strategy
      await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      console.log(`Created ATA: ${ata.toString()}`);
    }
    
    return ata;
  }

  /**
   * Get native ZEC mint address
   * @returns {PublicKey} Native ZEC mint address
   */
  getNativeZECMint() {
    const deps = getSolanaDeps();
    // Official native ZEC mint address on Solana
    const OFFICIAL_NATIVE_ZEC_MINT = 'A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS';
    
    const nativeZECMint = process.env.NATIVE_ZEC_MINT || 
                         process.env.ZEC_MINT || 
                         OFFICIAL_NATIVE_ZEC_MINT;
    
    return new deps.PublicKey(nativeZECMint);
  }

  /**
   * Get treasury's ZEC token account
   * @param {PublicKey} zecMint - Native ZEC mint address
   * @returns {Promise<PublicKey>} Treasury ZEC token account address
   */
  async getTreasuryZECAccount(zecMint) {
    if (!this.relayerKeypair) {
      throw new Error('Relayer keypair not configured');
    }

    const deps = getSolanaDeps();
    const treasuryPubkey = this.relayerKeypair.publicKey;
    
    const treasuryZECAccount = await deps.getAssociatedTokenAddress(
      zecMint,
      treasuryPubkey,
      false,
      deps.TOKEN_PROGRAM_ID,
      deps.ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    // Check if treasury account exists
    const accountInfo = await this.connection.getAccountInfo(treasuryZECAccount);
    if (!accountInfo) {
      throw new Error(
        `Treasury ZEC account does not exist: ${treasuryZECAccount.toString()}. ` +
        `Please fund the treasury with native ZEC first.`
      );
    }
    
    return treasuryZECAccount;
  }

  /**
   * Get treasury's native ZEC balance
   * @returns {Promise<number>} Balance in smallest unit (lamports)
   */
  async getTreasuryZECBalance() {
    if (!this.relayerKeypair) {
      throw new Error('Relayer keypair not configured');
    }

    try {
      const zecMint = this.getNativeZECMint();
      const treasuryZECAccount = await this.getTreasuryZECAccount(zecMint);
      
      const deps = getSolanaDeps();
      const accountInfo = await deps.getAccount(
        this.connection,
        treasuryZECAccount,
      );
      
      return BigInt(accountInfo.amount.toString());
    } catch (error) {
      if (error.message.includes('does not exist')) {
        return BigInt(0);
      }
      throw error;
    }
  }

  /**
   * Transfer native ZEC from treasury to user
   * @param {string} userAddress - User's Solana address
   * @param {number} amount - Amount in smallest unit (lamports)
   * @returns {Promise<string>} Transaction signature
   */
  async transferNativeSOL(userAddress, amount) {
    if (!this.relayerKeypair) {
      throw new Error('Relayer keypair not configured');
    }

    const deps = getSolanaDeps();
    const userPubkey = new deps.PublicKey(userAddress);

    // Check treasury SOL balance
    const treasuryBalance = await this.connection.getBalance(this.relayerKeypair.publicKey);
    if (treasuryBalance < amount) {
      throw new Error(
        `Insufficient SOL reserves. Requested: ${amount}, Available: ${treasuryBalance}`
      );
    }

    // Create SOL transfer instruction
    const transferIx = deps.SystemProgram.transfer({
      fromPubkey: this.relayerKeypair.publicKey, // Source: Bridge treasury
      toPubkey: userPubkey,                      // Destination: User
      lamports: amount,                          // Amount in lamports
    });

    // Create and send transaction
    const transaction = new deps.Transaction().add(transferIx);

    // Get blockhash with expiry info
    let { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');

    // Check if blockhash is still valid
    const currentBlockHeight = await this.connection.getBlockHeight();
    if (currentBlockHeight > lastValidBlockHeight) {
      const blockhashInfo = await this.connection.getLatestBlockhash('confirmed');
      blockhash = blockhashInfo.blockhash;
      lastValidBlockHeight = blockhashInfo.lastValidBlockHeight;
      console.log('Blockhash expired during transfer, using new blockhash');
    }

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.relayerKeypair.publicKey;
    transaction.sign(this.relayerKeypair);
    
    const signature = await this.connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false }
    );
    
    // Wait for confirmation
    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed');
    
    console.log(`✓ Transferred ${amount / 1e9} SOL to ${userAddress}`);
    console.log(`  Transaction: ${signature}`);

    return signature;
  }

  /**
   * Swap SOL to zenZEC
   * User sends SOL, receives zenZEC
   * @param {string} userAddress - User's Solana address
   * @param {number} solAmount - Amount of SOL to swap (in SOL, not lamports)
   * @returns {Promise<string>} Transaction signature
   */
  async swapSOLToZenZEC(userAddress, solAmount) {
    if (!this.relayerKeypair) {
      throw new Error('Relayer keypair not configured');
    }

    const userPubkey = new PublicKey(userAddress);
    const mintPubkey = new PublicKey(process.env.ZENZEC_MINT);
    
    // Calculate zenZEC amount (using exchange rate)
    const exchangeRate = parseFloat(process.env.SOL_TO_ZENZEC_RATE || '100'); // 1 SOL = 100 zenZEC
    const zenZECAmount = Math.floor(solAmount * exchangeRate * 1e8); // Convert to smallest unit

    // Get or create user token account
    const userTokenAccount = await this.getOrCreateTokenAccount(userPubkey);

    // Create transaction: Transfer SOL from user to relayer, then mint zenZEC
    const transaction = new Transaction();
    
    // Step 1: Transfer SOL from user to relayer (for MVP, we'll mint first and trust user will send SOL)
    // In production, this would use an escrow or require SOL payment first
    // For MVP, we assume user has already sent SOL or will send it separately
    
    // Step 2: Mint zenZEC to user
    const program = this.getProgram();
    const configPda = await this.getConfigPDA();
    
    const mintIx = await program.methods
      .mintZenZec(new BN(zenZECAmount))
      .accounts({
        config: configPda,
        mint: mintPubkey,
        userTokenAccount: userTokenAccount,
        user: userPubkey,
        authority: this.relayerKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    transaction.add(mintIx);

    // Get blockhash
    let { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    
    // Check if blockhash is still valid
    const currentBlockHeight = await this.connection.getBlockHeight();
    if (currentBlockHeight > lastValidBlockHeight) {
      const blockhashInfo = await this.connection.getLatestBlockhash('confirmed');
      blockhash = blockhashInfo.blockhash;
      lastValidBlockHeight = blockhashInfo.lastValidBlockHeight;
    }
    
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.relayerKeypair.publicKey;
    
    // Sign and send
    transaction.sign(this.relayerKeypair);
    const signature = await this.connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false }
    );
    
    // Confirm transaction
    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed');

    console.log(`Swapped ${solAmount} SOL to ${zenZECAmount / 1e8} zenZEC for ${userAddress}`);
    return signature;
  }

  /**
   * DEPRECATED: Create burn_for_btc transaction (without signing)
   * 
   * ⚠️  WARNING: This function requires a burnForBtc instruction that does NOT exist
   * in the flash_bridge_mxe program. This will fail if called.
   * 
   * Use transferNativeZEC() to transfer native ZEC from treasury instead.
   * For BTC redemptions, use the hybrid automation in btc-relayer.js which handles
   * native ZEC transfers automatically.
   * 
   * @param {string} userAddress - User's Solana address
   * @param {number} amount - Amount of zenZEC to burn (in zenZEC, not smallest unit)
   * @param {string} btcAddress - Bitcoin address to send BTC to (can be encrypted)
   * @param {boolean} usePrivacy - Whether BTC address is encrypted
   * @returns {Promise<Transaction>} Transaction ready to sign
   */
  async createBurnForBTCTransaction(userAddress, amount, btcAddress, usePrivacy = false) {
    console.warn('⚠️  DEPRECATED: createBurnForBTCTransaction() called');
    console.warn('⚠️  burnForBtc instruction does not exist in flash_bridge_mxe program');
    console.warn('⚠️  This operation will fail. Use native ZEC transfers instead.');
    
    try {
      const userPubkey = new PublicKey(userAddress);
      const mintPubkey = new PublicKey(process.env.ZENZEC_MINT);
      const program = this.getProgram();
      const configPda = await this.getConfigPDA();
      
      // Check if program has burnForBtc method
      if (!program.methods.burnForBtc) {
        throw new Error(
          'Program does not have burnForBtc instruction. ' +
          'The flash_bridge_mxe program does not support burn operations. ' +
          'Use transferNativeZEC() or the hybrid automation in btc-relayer.js instead.'
        );
      }
      
      // Get user token account
      const userTokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        userPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Convert amount to smallest unit
      const amountBN = new BN(Math.floor(amount * 1e8));

      // Create burn_for_btc instruction (will fail if instruction doesn't exist)
      const burnIx = await program.methods
        .burnForBtc(amountBN, btcAddress, usePrivacy)
        .accounts({
          config: configPda,
          mint: mintPubkey,
          userTokenAccount: userTokenAccount,
          user: userPubkey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();

      // Create transaction
      const transaction = new Transaction().add(burnIx);
      
      // Get blockhash
      let { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
      
      // Check if blockhash is still valid
      const currentBlockHeight = await this.connection.getBlockHeight();
      if (currentBlockHeight > lastValidBlockHeight) {
        const blockhashInfo = await this.connection.getLatestBlockhash('confirmed');
        blockhash = blockhashInfo.blockhash;
        lastValidBlockHeight = blockhashInfo.lastValidBlockHeight;
      }
      
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userPubkey;

      return transaction;
    } catch (error) {
      // Provide helpful error message
      throw new Error(
        `createBurnForBTCTransaction() is not supported with the current program. ` +
        `Error: ${error.message}. ` +
        `Use transferNativeZEC() or the hybrid automation in btc-relayer.js for BTC redemptions.`
      );
    }
  }

  /**
   * DEPRECATED: Burn zenZEC for BTC
   * 
   * ⚠️  WARNING: This function requires a burnForBtc instruction that does NOT exist
   * in the flash_bridge_mxe program. This will fail if called.
   * 
   * Use transferNativeZEC() to transfer native ZEC from treasury instead.
   * For BTC redemptions, use the hybrid automation in btc-relayer.js which handles
   * native ZEC transfers automatically.
   * 
   * @param {string} userAddress - User's Solana address
   * @param {number} amount - Amount of zenZEC to burn (in zenZEC, not smallest unit)
   * @param {string} btcAddress - Bitcoin address to send BTC to
   * @param {boolean} usePrivacy - Whether to encrypt BTC address
   * @param {Object} signTransaction - Function to sign transaction (from wallet)
   * @returns {Promise<string>} Transaction signature
   */
  async burnZenZECForBTC(userAddress, amount, btcAddress, usePrivacy = false, signTransaction) {
    console.warn('⚠️  DEPRECATED: burnZenZECForBTC() called');
    console.warn('⚠️  burnForBtc instruction does not exist in flash_bridge_mxe program');
    console.warn('⚠️  Use native ZEC transfers or hybrid automation instead.');
    
    if (!signTransaction) {
      throw new Error('User must sign transaction for burning');
    }

    const transaction = await this.createBurnForBTCTransaction(userAddress, amount, btcAddress, usePrivacy);
    const userPubkey = new PublicKey(userAddress);

    // User signs the transaction
    const signedTx = await signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(
      signedTx.serialize(),
      { skipPreflight: false }
    );
    
    // Get blockhash for confirmation
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    
    // Confirm transaction
    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed');

    console.log(`Burned ${amount} zenZEC for BTC to ${btcAddress.substring(0, 20)}... (encrypted: ${usePrivacy})`);
    return signature;
  }
}

// Create singleton instance and initialize it
const solanaService = new SolanaService();
solanaService.initialize().catch(error => {
  console.error('Failed to initialize Solana service:', error);
});

module.exports = solanaService;
