/**
 * BTC Deposit Handler
 * Handles BTC deposits → USDC Treasury → Jupiter Swap → User Token
 * 
 * Revenue Integration:
 * - Fee calculation at deposit time
 * - Fee deduction before user payout
 * - Fee recording for analytics
 */

const { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const jupiterService = require('./jupiter');
const bitcoinService = require('./bitcoin');
const databaseService = require('./database');
const solanaService = require('./solana');
const feeService = require('./fee-service');
const { createLogger } = require('../utils/logger');

// USDC mint addresses
const USDC_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const logger = createLogger('btc-deposit-handler');

class BTCDepositHandler {
  constructor() {
    // Removed in-memory Set - using database as source of truth
  }

  /**
   * Get USDC mint address based on network
   */
  getUSDCMint() {
    const network = process.env.SOLANA_NETWORK || 'devnet';
    return network === 'mainnet-beta' 
      ? new PublicKey(USDC_MAINNET)
      : new PublicKey(USDC_DEVNET);
  }

  /**
   * Handle BTC deposit with database-level locking to prevent race conditions
   * @param {Object} payment - BTC payment object from monitoring
   * @param {string} userSolanaAddress - User's Solana address
   * @param {string} outputTokenMint - Token mint address user wants to receive (optional, defaults to USDC)
   * @param {Object} options - Additional options
   * @param {string} options.tier - Service tier: 'basic', 'fast', 'private', 'premium'
   * @param {boolean} options.usePrivacy - Whether to use Arcium MPC encryption
   * @param {string} options.referralCode - Referral code for discounts
   * @returns {Promise<Object>} Swap result with fee breakdown
   */
  async handleBTCDeposit(payment, userSolanaAddress, outputTokenMint = null, options = {}) {
    const { tier = 'basic', usePrivacy = false, referralCode = null } = options;
    // Validate inputs
    if (!payment || !payment.txHash) {
      throw new Error('Invalid payment object: missing txHash');
    }
    if (!userSolanaAddress) {
      throw new Error('User Solana address is required');
    }

    // Validate Solana address format
    try {
      new PublicKey(userSolanaAddress);
    } catch (error) {
      throw new Error(`Invalid Solana address format: ${userSolanaAddress}`);
    }

    // Validate output token if provided
    let outputMint = null;
    if (outputTokenMint) {
      try {
        outputMint = new PublicKey(outputTokenMint);
      } catch (error) {
        throw new Error(`Invalid output token mint address: ${outputTokenMint}`);
      }
    }

    // Use database transaction with row-level locking
    const client = databaseService.isConnected() 
      ? await databaseService.pool.connect() 
      : null;

    try {
      // Start transaction if database is connected
      if (client) {
        await client.query('BEGIN');
      }

      // Lock row and check status using SELECT FOR UPDATE
      let deposit = null;
      if (client) {
        deposit = await databaseService.getBTCDepositWithLock(payment.txHash, client);
        
        // Check if deposit exists and is already processed
        if (deposit && deposit.status === 'processed') {
          await client.query('ROLLBACK');
          client.release();
          logger.info(`BTC deposit ${payment.txHash} already processed`);
          return { 
            alreadyProcessed: true,
            bitcoinTxHash: payment.txHash,
            solanaAddress: deposit.solana_address,
            solanaTxSignature: deposit.solana_tx_signature,
          };
        }

        // Check if deposit is currently being processed
        if (deposit && deposit.status === 'processing') {
          await client.query('ROLLBACK');
          client.release();
          logger.info(`BTC deposit ${payment.txHash} is currently being processed`);
          return { 
            alreadyProcessed: true,
            processing: true,
            bitcoinTxHash: payment.txHash,
          };
        }

        // Mark as processing atomically
        deposit = await databaseService.markBTCDepositProcessing(
          payment.txHash, 
          userSolanaAddress, 
          client
        );

        if (!deposit) {
          // Deposit doesn't exist or can't be marked as processing
          await client.query('ROLLBACK');
          client.release();
          throw new Error(`Deposit ${payment.txHash} not found or cannot be processed`);
        }
      } else {
        // Fallback: check without lock if database not connected
        deposit = await databaseService.getBTCDeposit(payment.txHash);
        if (deposit && deposit.status === 'processed') {
          logger.info(`BTC deposit ${payment.txHash} already processed (no DB lock)`);
          return { alreadyProcessed: true };
        }
      }

      try {
        // Convert BTC amount to USDC equivalent
        // For demo: 1 BTC = ~$X USD, use current price or fixed rate
        const btcAmount = payment.amount / 100000000; // Convert satoshis to BTC
        const btcToUsdcRate = parseFloat(process.env.BTC_TO_USDC_RATE || '50000'); // Default: 1 BTC = 50k USDC
        const grossUsdcAmount = btcAmount * btcToUsdcRate;

        // =================================================================
        // FEE CALCULATION - Revenue Generation
        // =================================================================
        const feeCalculation = feeService.calculateFees({
          amountUSD: grossUsdcAmount,
          amountBTC: btcAmount,
          tier,
          usePrivacy,
          referralCode,
        });

        const feeUSD = feeCalculation.totalFeeUSD;
        const usdcAmount = feeCalculation.userReceivesUSD; // Amount after fees
        
        logger.info(`💰 Processing BTC deposit:`);
        logger.info(`   BTC Amount: ${btcAmount} BTC`);
        logger.info(`   Gross USD Value: $${grossUsdcAmount.toFixed(2)}`);
        logger.info(`   Fee (${feeCalculation.tierName}): $${feeUSD.toFixed(2)} (${feeCalculation.feePercentEffective}%)`);
        logger.info(`   User Receives: $${usdcAmount.toFixed(2)}`);
        logger.info(`   User Address: ${userSolanaAddress}`);
        logger.info(`   Output Token: ${outputTokenMint || 'USDC (default)'}`);
        logger.info(`   BTC TX: ${payment.txHash}`);
        logger.info(`   Rate: 1 BTC = ${btcToUsdcRate} USDC`);
        logger.info(`   Tier: ${feeCalculation.tierName}`);
        if (referralCode) {
          logger.info(`   Referral: ${referralCode} (discount: $${feeCalculation.breakdown.referralDiscount})`);
        }

        // TEST MODE: If BTC_TEST_MODE=true, just send SOL directly (no swap)
        const testMode = process.env.BTC_TEST_MODE === 'true';
        
        let swapResult;
        
        if (testMode) {
          logger.info(`🧪 TEST MODE: Sending SOL directly (no swap)`);
          
          // Convert BTC to SOL amount (simple rate for testing)
          const btcToSolRate = parseFloat(process.env.BTC_TO_SOL_RATE || '0.01'); // Default: 0.01 BTC = 1 SOL
          const solAmount = btcAmount * btcToSolRate;
          
          logger.info(`   Converting ${btcAmount} BTC to ${solAmount} SOL (rate: ${btcToSolRate} BTC/SOL)`);
          
          // Get treasury keypair (from Jupiter service or load directly)
          let treasuryKeypair = jupiterService.treasuryKeypair;
          
          // If not available from Jupiter, load it directly
          if (!treasuryKeypair) {
            const fs = require('fs').promises;
            const path = require('path');
            try {
              const keypairPath = path.join(__dirname, '..', '..', 'treasury-keypair.json');
              const keypairData = await fs.readFile(keypairPath, 'utf8');
              const secretKey = JSON.parse(keypairData);
              treasuryKeypair = require('@solana/web3.js').Keypair.fromSecretKey(Uint8Array.from(secretKey));
            } catch (error) {
              throw new Error('Treasury keypair not configured');
            }
          }
          
          // Check treasury balance
          const connection = solanaService.getConnection();
          const treasuryBalance = await connection.getBalance(treasuryKeypair.publicKey);
          const requiredLamports = Math.ceil(solAmount * LAMPORTS_PER_SOL);
          
          if (treasuryBalance < requiredLamports) {
            throw new Error(
              `Insufficient treasury balance: ${treasuryBalance / LAMPORTS_PER_SOL} SOL, need ${solAmount} SOL`
            );
          }
          
          // Create SOL transfer transaction
          const userPubkey = new PublicKey(userSolanaAddress);
          const transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: treasuryKeypair.publicKey,
              toPubkey: userPubkey,
              lamports: requiredLamports,
            })
          );
          
          // Get blockhash
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = treasuryKeypair.publicKey;
          
          // Sign and send
          transaction.sign(treasuryKeypair);
          const signature = await connection.sendRawTransaction(
            transaction.serialize(),
            { skipPreflight: false }
          );
          
          // Confirm transaction
          await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight,
          }, 'confirmed');
          
          swapResult = {
            signature,
            confirmation: { slot: null },
          };
          
          logger.info(`✅ SOL sent: ${solAmount} SOL to ${userSolanaAddress}`);
          logger.info(`   Transaction: ${signature}`);
        } else {
          // PRODUCTION MODE: Do Jupiter swap
          // Determine output token mint
          const finalOutputMint = outputMint || this.getUSDCMint();

          // Swap USDC from treasury to user's desired token
          swapResult = await jupiterService.swapUSDCForToken(
            userSolanaAddress,
            finalOutputMint.toBase58(),
            usdcAmount
          );
        }

        // Only mark as processed AFTER successful swap
        // Update BTC deposit in database to mark as processed
        if (client) {
          try {
            // Update btc_deposits table within transaction
            await databaseService.updateBTCDepositStatus(payment.txHash, 'processed', {
              solanaAddress: userSolanaAddress,
              solanaTxSignature: swapResult.signature,
              outputToken: (outputMint || this.getUSDCMint()).toBase58(),
            }, client);

            // Also save to bridge_transactions table for transaction history
            const txId = `btc_deposit_${payment.txHash.substring(0, 16)}`;
            await databaseService.saveBridgeTransaction({
              txId,
              solanaAddress: userSolanaAddress,
              amount: usdcAmount,
              reserveAsset: 'BTC',
              status: 'confirmed',
              solanaTxSignature: swapResult.signature,
              bitcoinTxHash: payment.txHash,
              zcashTxHash: null,
              demoMode: false,
              outputToken: (outputMint || this.getUSDCMint()).toBase58(),
            });

            // =================================================================
            // RECORD FEE COLLECTION - Revenue Tracking
            // =================================================================
            try {
              await client.query(`
                INSERT INTO fee_collections (
                  transaction_id, transaction_type, fee_usd, fee_btc,
                  base_fee_usd, privacy_fee_usd, referral_discount_usd,
                  amount_usd, amount_btc, fee_percent_effective,
                  tier, features, user_address, referral_code,
                  collection_tx_signature, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
              `, [
                txId,
                'bridge',
                feeCalculation.totalFeeUSD,
                feeCalculation.feeBTC,
                feeCalculation.breakdown.baseFee,
                feeCalculation.breakdown.privacyFee,
                feeCalculation.breakdown.referralDiscount,
                grossUsdcAmount,
                btcAmount,
                feeCalculation.feePercentEffective,
                tier,
                feeCalculation.features,
                userSolanaAddress,
                referralCode,
                swapResult.signature,
                'collected'
              ]);
              
              // Record fee in memory stats
              feeService.recordFee({
                tier,
                totalFeeUSD: feeCalculation.totalFeeUSD,
                txId,
              });
              
              logger.info(`💰 Fee recorded: $${feeCalculation.totalFeeUSD.toFixed(2)}`);
            } catch (feeError) {
              logger.error('Error recording fee (non-critical):', feeError.message);
              // Don't fail transaction - fee recording is not critical
            }

            // Commit transaction
            await client.query('COMMIT');
          } catch (error) {
            // Rollback on database error
            await client.query('ROLLBACK');
            logger.error('Error saving BTC deposit to database:', error);
            throw new Error(`Failed to save deposit status: ${error.message}`);
          } finally {
            client.release();
          }
        } else if (databaseService.isConnected()) {
          // Fallback: update without transaction if client not available
          try {
            await databaseService.updateBTCDepositStatus(payment.txHash, 'processed', {
              solanaAddress: userSolanaAddress,
              solanaTxSignature: swapResult.signature,
              outputToken: (outputMint || this.getUSDCMint()).toBase58(),
            });

            await databaseService.saveBridgeTransaction({
              txId: `btc_deposit_${payment.txHash.substring(0, 16)}`,
              solanaAddress: userSolanaAddress,
              amount: usdcAmount,
              reserveAsset: 'BTC',
              status: 'confirmed',
              solanaTxSignature: swapResult.signature,
              bitcoinTxHash: payment.txHash,
              zcashTxHash: null,
              demoMode: false,
              outputToken: (outputMint || this.getUSDCMint()).toBase58(),
            });
          } catch (error) {
            logger.error('Error saving BTC deposit to database:', error);
            // Don't throw - swap already succeeded, just log error
          }
        }

        logger.info(`✅ BTC deposit processed successfully`);
        logger.info(`   Transaction: ${swapResult.signature}`);
        logger.info(`   Fee collected: $${feeCalculation.totalFeeUSD.toFixed(2)}`);
        
        if (testMode) {
          const btcToSolRate = parseFloat(process.env.BTC_TO_SOL_RATE || '0.01');
          const solAmount = btcAmount * btcToSolRate;
          logger.info(`   User received: ${solAmount} SOL (TEST MODE)`);
        } else {
          logger.info(`   User received: $${usdcAmount.toFixed(2)} ${outputTokenMint ? 'tokens' : 'USDC'}`);
        }

        return {
          success: true,
          btcAmount,
          grossAmountUSD: grossUsdcAmount,
          usdcAmount: testMode ? null : usdcAmount,
          solAmount: testMode ? (btcAmount * parseFloat(process.env.BTC_TO_SOL_RATE || '0.01')) : null,
          outputToken: testMode ? 'SOL' : ((outputMint || this.getUSDCMint()).toBase58()),
          swapSignature: swapResult.signature,
          bitcoinTxHash: payment.txHash,
          testMode: testMode,
          // Fee information
          fee: {
            amountUSD: feeCalculation.totalFeeUSD,
            percentEffective: feeCalculation.feePercentEffective,
            tier: feeCalculation.tierName,
            breakdown: feeCalculation.breakdown,
          },
        };

      } catch (error) {
        // Rollback transaction on any error during processing
        // Note: ROLLBACK will automatically revert the status change from 'pending'/'confirmed' to 'processing'
        if (client) {
          try {
            await client.query('ROLLBACK');
            // No need to manually reset status - ROLLBACK handles it
          } catch (rollbackError) {
            logger.error('Error during rollback:', rollbackError);
          } finally {
            client.release();
          }
        }
        
        logger.error('Error handling BTC deposit:', error);
        throw error;
      }
    } catch (error) {
      // Handle errors before transaction starts
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          logger.error('Error during rollback:', rollbackError);
        } finally {
          client.release();
        }
      }
      logger.error('Error handling BTC deposit:', error);
      throw error;
    }
  }

  /**
   * Handle BTC deposit with automatic token selection
   * Uses default token or allows user to specify
   */
  async handleBTCDepositAuto(payment, userSolanaAddress, preferredToken = null) {
    // If no preferred token, use USDC
    const outputToken = preferredToken || this.getUSDCMint().toBase58();
    return this.handleBTCDeposit(payment, userSolanaAddress, outputToken);
  }
}

module.exports = new BTCDepositHandler();

