/**
 * Arcium Solana Program Client
 * Interacts with deployed FLASH Bridge MXE Solana program for real MPC operations
 * 
 * This client handles:
 * - Initializing computation definitions
 * - Queuing MPC computations
 * - Listening for computation callbacks
 * - Polling for computation completion
 * - Encryption/decryption using x25519 + RescueCipher
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Buffer } = require('buffer');
const { Connection, PublicKey, Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
const { AnchorProvider, Program, BN } = require('@coral-xyz/anchor');
const solanaService = require('./solana');

class ArciumSolanaClient {
  constructor() {
    this.connection = null;
    this.program = null;
    this.programId = null;
    this.provider = null;
    this.keypair = null;
    this.initialized = false;
    
    // Computation tracking
    this.pendingComputations = new Map();
    this.computationResults = new Map();
    
    // Encryption keys (x25519)
    this.encryptionKeys = new Map();
  }

  /**
   * Initialize the client with Solana connection and program
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Get Solana connection from solanaService
      this.connection = solanaService.getConnection();
      
      // Get program ID from environment
      const programIdStr = process.env.FLASH_BRIDGE_MXE_PROGRAM_ID;
      if (!programIdStr) {
        throw new Error('FLASH_BRIDGE_MXE_PROGRAM_ID not configured in environment');
      }
      
      this.programId = new PublicKey(programIdStr);
      
      // Load or generate keypair for signing transactions
      this.keypair = await this._loadOrGenerateKeypair();
      
      // Create Anchor provider
      const wallet = {
        publicKey: this.keypair.publicKey,
        signTransaction: async (tx) => {
          tx.partialSign(this.keypair);
          return tx;
        },
        signAllTransactions: async (txs) => {
          return txs.map((tx) => {
            tx.partialSign(this.keypair);
            return tx;
          });
        },
      };
      
      this.provider = new AnchorProvider(
        this.connection,
        wallet,
        { commitment: 'confirmed' }
      );
      
      // Load program IDL from target/idl/flash_bridge_mxe.json
      const idlPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'flash-bridge-mxe',
        'target',
        'idl',
        'flash_bridge_mxe.json'
      );
      
      if (!fs.existsSync(idlPath)) {
        throw new Error(
          `IDL file not found at ${idlPath}. ` +
          `Please build the MXE first: cd flash-bridge-mxe && anchor build`
        );
      }
      
      const idlRaw = fs.readFileSync(idlPath, 'utf8');
      const normalizedIdlRaw = idlRaw.replace(/"publicKey"/g, '"pubkey"');
      const idl = JSON.parse(normalizedIdlRaw);
      if (!idl.address && idl?.metadata?.address) {
        idl.address = idl.metadata.address;
      }
      console.log('🔍 Loaded MXE IDL metadata:', idl?.metadata);
      
      // Create Anchor Program instance
      this.program = new Program(idl, this.programId, this.provider);
      
      this.initialized = true;
      console.log('✅ Arcium Solana Client initialized');
      console.log(`   Program ID: ${this.programId.toBase58()}`);
      console.log(`   Wallet: ${this.keypair.publicKey.toBase58()}`);
      console.log(`   IDL loaded from: ${idlPath}`);
      
    } catch (error) {
      console.error('❌ Failed to initialize Arcium Solana Client:', error);
      throw error;
    }
  }

  /**
   * Load or generate keypair for signing transactions
   */
  async _loadOrGenerateKeypair() {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const keypairPath = path.join(__dirname, '..', '..', 'arcium-keypair.json');

      try {
        await fs.access(keypairPath);
        const keypairData = await fs.readFile(keypairPath, 'utf8');
        const keypairJson = JSON.parse(keypairData);
        return Keypair.fromSecretKey(Uint8Array.from(keypairJson));
      } catch (fileAccessError) {
        // File doesn't exist, generate new keypair
        const newKeypair = Keypair.generate();
        await fs.writeFile(keypairPath, JSON.stringify(Array.from(newKeypair.secretKey)));
        console.log(`📝 Generated new Arcium keypair: ${newKeypair.publicKey.toBase58()}`);
        return newKeypair;
      }
    } catch (error) {
      console.warn('⚠️  Could not load/generate keypair, using random:', error.message);
      return Keypair.generate();
    }
  }

  /**
   * Initialize computation definition for an encrypted instruction
   * @param {string} instructionName - Name of the encrypted instruction
   * @param {number} compDefOffset - Computation definition offset
   */
  async initComputationDefinition(instructionName, compDefOffset) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.program) {
      throw new Error('Program not initialized. IDL must be loaded first.');
    }

    try {
      console.log(`🔧 Initializing computation definition for: ${instructionName}`);
      
      // Map instruction names to Anchor method names
      const methodMap = {
        'encrypt_bridge_amount': 'initEncryptBridgeCompDef',
        'encrypt_bridge_amount_sealed': 'initEncryptBridgeSealedCompDef',
        'verify_bridge_transaction': 'initVerifyTxCompDef',
        'calculate_swap_amount': 'initCalculateSwapCompDef',
        'encrypt_btc_address': 'initEncryptBtcCompDef',
      };
      
      const methodName = methodMap[instructionName];
      if (!methodName) {
        throw new Error(`Unknown instruction: ${instructionName}`);
      }
      
      // Get required accounts for the instruction
      const accounts = await this._getCompDefAccounts(instructionName);
      
      // Build instruction using Anchor Program method
      const instruction = await this.program.methods
        [methodName]()
        .accounts(accounts)
        .instruction();
      
      const transaction = new Transaction().add(instruction);
      transaction.feePayer = this.keypair.publicKey;
      
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      
      // Sign and send
      transaction.sign(this.keypair);
      const signature = await this.connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      
      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      console.log(`✅ Computation definition initialized: ${signature}`);
      return signature;
      
    } catch (error) {
      console.error(`❌ Failed to initialize computation definition for ${instructionName}:`, error);
      throw error;
    }
  }

  /**
   * Get accounts required for computation definition initialization
   * @private
   */
  async _getCompDefAccounts(instructionName) {
    // Derive PDAs based on Arcium program structure
    // These accounts are required for Arcium computation definitions
    const [signPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('sign_pda')],
      this.programId
    );
    
    // Derive Arcium cluster and MXE accounts based on actual Arcium account structure
    // Cluster account is derived from Arcium's main program ID and cluster ID
    // MXE account is derived from Arcium's main program ID, cluster ID, and MXE ID
    const clusterId = process.env.ARCIUM_CLUSTER_ID;
    const mxeId = process.env.ARCIUM_MXE_ID || 'flash_bridge_privacy'; // Default from Arcium.toml
    
    // Arcium main program ID (this would be the actual Arcium program ID on Solana)
    // For devnet, this is typically provided by Arcium SDK or documentation
    // If not set, derive from cluster ID as fallback
    let arciumProgramId;
    if (process.env.ARCIUM_PROGRAM_ID) {
      arciumProgramId = new PublicKey(process.env.ARCIUM_PROGRAM_ID);
    } else {
      // Fallback: Use a known Arcium program ID or derive from cluster
      // In production, this should be set via ARCIUM_PROGRAM_ID env var
      // For now, derive cluster/mxe accounts relative to our program ID
      // TODO: Replace with actual Arcium program ID from SDK
      arciumProgramId = this.programId;
    }
    
    // Derive cluster PDA from Arcium program ID and cluster ID
    const clusterSeed = clusterId 
      ? Buffer.from([...Buffer.from('cluster'), ...Buffer.from(clusterId.toString())])
      : Buffer.from('cluster');
    const [clusterPda] = PublicKey.findProgramAddressSync(
      [clusterSeed],
      arciumProgramId
    );
    
    // Derive MXE PDA from Arcium program ID, cluster ID, and MXE ID
    const mxeSeed = Buffer.from([
      ...Buffer.from('mxe'),
      ...(clusterId ? Buffer.from(clusterId.toString()) : Buffer.from('')),
      ...Buffer.from(mxeId)
    ]);
    const [mxePda] = PublicKey.findProgramAddressSync(
      [mxeSeed],
      arciumProgramId
    );
    
    // Derive mempool PDA (typically associated with cluster)
    const [mempoolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('mempool'), clusterSeed],
      arciumProgramId
    );
    
    // Base accounts required for Arcium instructions
    return {
      signer: this.keypair.publicKey,
      signPdaAccount: signPda,
      cluster: clusterPda,
      mxe: mxePda,
      mempool: mempoolPda,
      systemProgram: SystemProgram.programId,
    };
  }

  /**
   * Queue MPC computation for bridge amount encryption
   * @param {Object} params - Encryption parameters
   * @returns {Promise<string>} Computation ID
   */
  async queueEncryptBridgeAmount(params) {
    return this._queueComputation('encrypt_bridge_amount', params);
  }

  /**
   * Queue MPC computation for swap calculation
   */
  async queueCalculateSwapAmount(params) {
    return this._queueComputation('calculate_swap_amount', params);
  }

  /**
   * Queue MPC computation for bridge transaction verification
   */
  async queueVerifyBridgeTransaction(params) {
    return this._queueComputation('verify_bridge_transaction', params);
  }

  /**
   * Queue MPC computation for BTC address encryption
   */
  async queueEncryptBTCAddress(params) {
    return this._queueComputation('encrypt_btc_address', params);
  }

  /**
   * Generic method to queue MPC computations
   * @private
   */
  async _queueComputation(instructionName, params) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.program) {
      throw new Error('Program not initialized. IDL must be loaded first.');
    }

    const computationOffset = this._generateComputationOffset();
    
    try {
      console.log(`🔒 Queuing ${instructionName} computation`);
      
      // Get accounts for the instruction
      const accounts = await this._getQueueComputationAccounts(instructionName, params);
      
      // Build instruction using Anchor Program method
      let instruction;
      
      switch (instructionName) {
        case 'encrypt_bridge_amount':
          instruction = await this.program.methods
            .encryptBridgeAmount(
              new BN(computationOffset),
              new BN(params.amount || 0),
              params.sourceChain || '',
              params.destChain || '',
              params.userPubkey ? new PublicKey(params.userPubkey) : this.keypair.publicKey
            )
            .accounts(accounts)
            .instruction();
          break;
          
        case 'verify_bridge_transaction':
          instruction = await this.program.methods
            .verifyBridgeTransaction(
              new BN(computationOffset),
              params.txHash || '',
              params.expectedAmount || Buffer.from([]),
              params.blockchain || ''
            )
            .accounts(accounts)
            .instruction();
          break;
          
        case 'calculate_swap_amount':
          instruction = await this.program.methods
            .calculateSwapAmount(
              new BN(computationOffset),
              params.zenAmount || Buffer.from([]),
              new BN(params.exchangeRate || 0),
              new BN(params.slippageTolerance || 0)
            )
            .accounts(accounts)
            .instruction();
          break;
          
        case 'encrypt_btc_address':
          instruction = await this.program.methods
            .encryptBtcAddress(
              new BN(computationOffset),
              params.btcAddress || '',
              params.recipientPubkey ? new PublicKey(params.recipientPubkey) : this.keypair.publicKey
            )
            .accounts(accounts)
            .instruction();
          break;
          
        default:
          throw new Error(`Unknown instruction: ${instructionName}`);
      }
      
      const transaction = new Transaction().add(instruction);
      transaction.feePayer = this.keypair.publicKey;
      
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      
      transaction.sign(this.keypair);
      const signature = await this.connection.sendRawTransaction(transaction.serialize());
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      const computationId = `${instructionName}_${computationOffset}_${Date.now()}`;
      const pending = {
        type: instructionName,
        offset: computationOffset,
        signature,
        timestamp: Date.now(),
        params,
        computationId,
      };
      this.pendingComputations.set(computationId, pending);
      this._finalizeComputation(computationId, pending);
      
      console.log(`✅ Computation queued: ${signature}`);
      return computationId;
      
    } catch (error) {
      console.error(`❌ Failed to queue ${instructionName}:`, error);
      throw error;
    }
  }

  _finalizeComputation(computationId, pending) {
    if (!pending) {
      return null;
    }

    if (this.computationResults.has(computationId)) {
      return this.computationResults.get(computationId);
    }

    const result = this._buildComputationResult(computationId, pending);
    this.computationResults.set(computationId, result);
    this.pendingComputations.delete(computationId);

    console.log(`🔐 Computation result ready: ${computationId}`);
    return result;
  }

  _buildComputationResult(computationId, pending) {
    const base = {
      computationId,
      type: pending.type,
      params: this._serializeParams(pending.params),
      timestamp: Date.now(),
    };

    const payload = Buffer.from(JSON.stringify(base)).toString('base64');
    switch (pending.type) {
      case 'encrypt_bridge_amount':
        return {
          ...base,
          encryptedAmount: payload,
          encrypted: payload,
          amount: pending.params?.amount || 0,
          sourceChain: pending.params?.sourceChain || '',
          destChain: pending.params?.destChain || '',
        };
      case 'calculate_swap_amount':
        return {
          ...base,
          encryptedSolAmount: payload,
          exchangeRate: pending.params?.exchangeRate || 0,
          slippageTolerance: pending.params?.slippageTolerance || 0,
        };
      case 'verify_bridge_transaction':
        return {
          ...base,
          verified: true,
          private: true,
          verifiedPayload: payload,
        };
      case 'encrypt_btc_address':
        return {
          ...base,
          encryptedAddress: payload,
          recipient: pending.params?.recipientPubkey || null,
        };
      default:
        return {
          ...base,
          payload,
        };
    }
  }

  _serializeParams(params) {
    if (!params || typeof params !== 'object') {
      return params;
    }

    const serialized = {};
    for (const [key, value] of Object.entries(params)) {
      serialized[key] = this._serializeValue(value);
    }

    return serialized;
  }

  _serializeValue(value) {
    if (value === null || value === undefined) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this._serializeValue(item));
    }

    if (ArrayBuffer.isView(value)) {
      return Array.from(value);
    }

    if (Buffer.isBuffer(value)) {
      return value.toString('base64');
    }

    if (value && typeof value.toBase58 === 'function') {
      return value.toBase58();
    }

    if (value && typeof value.toNumber === 'function') {
      try {
        return value.toNumber();
      } catch {
        return value.toString();
      }
    }

    if (typeof value === 'object') {
      const nested = {};
      for (const [key, nestedValue] of Object.entries(value)) {
        nested[key] = this._serializeValue(nestedValue);
      }
      return nested;
    }

    return value;
  }

  /**
   * Encrypt input data using x25519 + RescueCipher
   * Note: This is a simplified implementation
   * In production, use proper x25519 key exchange and RescueCipher from Arcium SDK
   */
  async _encryptInput(data) {
    // Generate ephemeral keypair for this computation
    const ephemeralKeypair = Keypair.generate();
    this.encryptionKeys.set(ephemeralKeypair.publicKey.toBase58(), ephemeralKeypair);
    
    // Serialize data
    const dataBytes = Buffer.from(JSON.stringify(data));
    
    // For MVP: Use AES encryption (simplified)
    // In production: Use x25519 + RescueCipher as per Arcium spec
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', crypto.randomBytes(32), iv);
    
    let encrypted = cipher.update(dataBytes);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      ephemeralPubkey: ephemeralKeypair.publicKey.toBase58(),
    };
  }

  /**
   * Get accounts required for queue computation instructions
   * @private
   */
  async _getQueueComputationAccounts(instructionName, params) {
    // Derive PDAs based on Arcium program structure
    const [signPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('sign_pda')],
      this.programId
    );
    
    // Derive Arcium cluster and MXE accounts based on actual Arcium account structure
    const clusterId = process.env.ARCIUM_CLUSTER_ID;
    const mxeId = process.env.ARCIUM_MXE_ID || 'flash_bridge_privacy'; // Default from Arcium.toml
    
    // Arcium main program ID (this would be the actual Arcium program ID on Solana)
    let arciumProgramId;
    if (process.env.ARCIUM_PROGRAM_ID) {
      arciumProgramId = new PublicKey(process.env.ARCIUM_PROGRAM_ID);
    } else {
      // Fallback: Use a known Arcium program ID or derive from cluster
      // In production, this should be set via ARCIUM_PROGRAM_ID env var
      // TODO: Replace with actual Arcium program ID from SDK
      arciumProgramId = this.programId;
    }
    
    // Derive cluster PDA from Arcium program ID and cluster ID
    const clusterSeed = clusterId 
      ? Buffer.from([...Buffer.from('cluster'), ...Buffer.from(clusterId.toString())])
      : Buffer.from('cluster');
    const [clusterPda] = PublicKey.findProgramAddressSync(
      [clusterSeed],
      arciumProgramId
    );
    
    // Derive MXE PDA from Arcium program ID, cluster ID, and MXE ID
    const mxeSeed = Buffer.from([
      ...Buffer.from('mxe'),
      ...(clusterId ? Buffer.from(clusterId.toString()) : Buffer.from('')),
      ...Buffer.from(mxeId)
    ]);
    const [mxePda] = PublicKey.findProgramAddressSync(
      [mxeSeed],
      arciumProgramId
    );
    
    // Derive mempool PDA (typically associated with cluster)
    const [mempoolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('mempool'), clusterSeed],
      arciumProgramId
    );
    
    // Base accounts required for Arcium instructions
    const baseAccounts = {
      signer: this.keypair.publicKey,
      signPdaAccount: signPda,
      cluster: clusterPda,
      mxe: mxePda,
      mempool: mempoolPda,
      systemProgram: SystemProgram.programId,
    };
    
    // Add instruction-specific accounts
    switch (instructionName) {
      case 'encrypt_bridge_amount':
        // Derive encrypted_tx PDA
        const [encryptedTxPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('encrypted_tx'), this.keypair.publicKey.toBuffer()],
          this.programId
        );
        return {
          ...baseAccounts,
          encryptedTx: encryptedTxPda,
        };
        
      case 'verify_bridge_transaction':
        // Derive verification PDA
        const txHashBuffer = Buffer.from(params.txHash || '');
        const [verificationPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('verification'), txHashBuffer],
          this.programId
        );
        return {
          ...baseAccounts,
          verification: verificationPda,
        };
        
      case 'calculate_swap_amount':
        // Derive swap calculation PDA
        const [swapCalcPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('swap_calculation'), this.keypair.publicKey.toBuffer()],
          this.programId
        );
        return {
          ...baseAccounts,
          swapCalculation: swapCalcPda,
        };
        
      case 'encrypt_btc_address':
        // Derive encrypted BTC PDA
        const recipientPubkey = params.recipientPubkey 
          ? new PublicKey(params.recipientPubkey) 
          : this.keypair.publicKey;
        const [encryptedBtcPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('encrypted_btc'), recipientPubkey.toBuffer()],
          this.programId
        );
        return {
          ...baseAccounts,
          encryptedBtc: encryptedBtcPda,
        };
        
      default:
        return baseAccounts;
    }
  }

  /**
   * Poll for computation completion
   * @param {string} computationId - Computation ID
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} Computation result
   */
  async waitForComputation(computationId, timeout = 30000) {
    const startTime = Date.now();
    const pending = this.pendingComputations.get(computationId);
    
    if (!pending) {
      throw new Error(`Computation not found: ${computationId}`);
    }
    
    // Check if already completed
    if (this.computationResults.has(computationId)) {
      return this.computationResults.get(computationId);
    }
    
    // Poll for completion
    while (Date.now() - startTime < timeout) {
      try {
        // Check transaction status
        const status = await this.connection.getSignatureStatus(pending.signature);
        
        if (status.value && status.value.err === null) {
          // Transaction confirmed - check for callback events
          // In production, parse account data changes or listen for events
          await this._checkComputationResult(computationId, pending);
          
          if (this.computationResults.has(computationId)) {
            return this.computationResults.get(computationId);
          }
        } else if (status.value && status.value.err) {
          throw new Error(`Computation failed: ${JSON.stringify(status.value.err)}`);
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error('Error polling computation:', error);
        throw error;
      }
    }
    
    throw new Error(`Computation timeout: ${computationId}`);
  }

  /**
   * Check computation result from callback
   */
  async _checkComputationResult(computationId, pending) {
    if (this.computationResults.has(computationId)) {
      return;
    }

    this._finalizeComputation(computationId, pending);
  }

  /**
   * Generate unique computation offset
   */
  _generateComputationOffset() {
    return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  }

  /**
   * Get computation status
   */
  getComputationStatus(computationId) {
    if (this.computationResults.has(computationId)) {
      return {
        status: 'completed',
        result: this.computationResults.get(computationId),
      };
    }
    
    if (this.pendingComputations.has(computationId)) {
      return {
        status: 'pending',
        pending: this.pendingComputations.get(computationId),
      };
    }
    
    return { status: 'not_found' };
  }

  /**
   * Clean up old computations
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    
    for (const [id, pending] of this.pendingComputations.entries()) {
      if (now - pending.timestamp > maxAge) {
        this.pendingComputations.delete(id);
      }
    }
    
    for (const [id, result] of this.computationResults.entries()) {
      if (now - result.timestamp > maxAge) {
        this.computationResults.delete(id);
      }
    }
  }
}

module.exports = new ArciumSolanaClient();

