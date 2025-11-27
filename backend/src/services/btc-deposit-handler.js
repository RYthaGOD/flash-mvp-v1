/**
 * BTC Deposit Handler
 * Handles BTC deposits → USDC Treasury → Jupiter Swap → User Token
 */

const { PublicKey } = require('@solana/web3.js');
const jupiterService = require('./jupiter');
const bitcoinService = require('./bitcoin');
const databaseService = require('./database');

// USDC mint addresses
const USDC_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

class BTCDepositHandler {
  constructor() {
    this.processedDeposits = new Set();
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
   * Handle BTC deposit
   * @param {Object} payment - BTC payment object from monitoring
   * @param {string} userSolanaAddress - User's Solana address
   * @param {string} outputTokenMint - Token mint address user wants to receive (optional, defaults to USDC)
   * @returns {Promise<Object>} Swap result
   */
  async handleBTCDeposit(payment, userSolanaAddress, outputTokenMint = null) {
    const depositId = `${payment.txHash}_${payment.amount}`;
    
    // Check if already processed
    if (this.processedDeposits.has(depositId)) {
      console.log(`BTC deposit ${depositId} already processed`);
      return { alreadyProcessed: true };
    }

    try {
      // Convert BTC amount to USDC equivalent
      // For demo: 1 BTC = ~$X USD, use current price or fixed rate
      const btcAmount = payment.amount / 100000000; // Convert satoshis to BTC
      const btcToUsdcRate = parseFloat(process.env.BTC_TO_USDC_RATE || '50000'); // Default: 1 BTC = 50k USDC
      const usdcAmount = btcAmount * btcToUsdcRate;

      console.log(`💰 Processing BTC deposit:`);
      console.log(`   BTC Amount: ${btcAmount} BTC`);
      console.log(`   USDC Equivalent: ${usdcAmount} USDC`);
      console.log(`   User Address: ${userSolanaAddress}`);
      console.log(`   Output Token: ${outputTokenMint || 'USDC (default)'}`);
      console.log(`   BTC TX: ${payment.txHash}`);
      console.log(`   Rate: 1 BTC = ${btcToUsdcRate} USDC`);

      // Determine output token mint
      const outputMint = outputTokenMint 
        ? new PublicKey(outputTokenMint)
        : this.getUSDCMint();

      // Swap USDC from treasury to user's desired token
      const swapResult = await jupiterService.swapUSDCForToken(
        userSolanaAddress,
        outputMint.toBase58(),
        usdcAmount
      );

      // Mark as processed
      this.processedDeposits.add(depositId);

      // Save to database
      if (databaseService.isConnected()) {
        try {
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
            outputToken: outputMint.toBase58(),
          });
        } catch (error) {
          console.error('Error saving BTC deposit to database:', error);
        }
      }

      console.log(`✅ BTC deposit processed successfully`);
      console.log(`   Swap TX: ${swapResult.signature}`);
      console.log(`   User received: ${usdcAmount} ${outputTokenMint ? 'tokens' : 'USDC'}`);

      return {
        success: true,
        btcAmount,
        usdcAmount,
        outputToken: outputMint.toBase58(),
        swapSignature: swapResult.signature,
        bitcoinTxHash: payment.txHash,
      };

    } catch (error) {
      console.error('Error handling BTC deposit:', error);
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

