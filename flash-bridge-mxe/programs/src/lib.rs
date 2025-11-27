/**
 * FLASH Bridge MXE - Solana Program
 * Custom Arcium program for privacy-preserving bridge operations
 *
 * Based on Arcium Hello World documentation
 * Uses #[arcium_program] instead of #[program] for MPC integration
 */

use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;

// Computation definition offsets for our encrypted instructions
const COMP_DEF_OFFSET_ENCRYPT_BRIDGE: u32 = comp_def_offset("encrypt_bridge_amount");
const COMP_DEF_OFFSET_VERIFY_TX: u32 = comp_def_offset("verify_bridge_transaction");
const COMP_DEF_OFFSET_CALCULATE_SWAP: u32 = comp_def_offset("calculate_swap_amount");
const COMP_DEF_OFFSET_ENCRYPT_BTC: u32 = comp_def_offset("encrypt_btc_address");

// Program ID - would be generated after deployment
declare_id!("FLASH_BRIDGE_MXE_PROGRAM_ID_HERE");

#[arcium_program]
pub mod flash_bridge_mxe {
    use super::*;

    /**
     * Initialize computation definition for bridge amount encryption
     */
    pub fn init_encrypt_bridge_comp_def(ctx: Context<InitEncryptBridgeCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, COMP_DEF_OFFSET_ENCRYPT_BRIDGE, None, None)?;
        Ok(())
    }

    /**
     * Initialize computation definition for transaction verification
     */
    pub fn init_verify_tx_comp_def(ctx: Context<InitVerifyTxCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, COMP_DEF_OFFSET_VERIFY_TX, None, None)?;
        Ok(())
    }

    /**
     * Initialize computation definition for swap calculation
     */
    pub fn init_calculate_swap_comp_def(ctx: Context<InitCalculateSwapCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, COMP_DEF_OFFSET_CALCULATE_SWAP, None, None)?;
        Ok(())
    }

    /**
     * Initialize computation definition for BTC address encryption
     */
    pub fn init_encrypt_btc_comp_def(ctx: Context<InitEncryptBtcCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, COMP_DEF_OFFSET_ENCRYPT_BTC, None, None)?;
        Ok(())
    }

    /**
     * Encrypt bridge amount using MPC
     * Core privacy operation for FLASH Bridge
     */
    pub fn encrypt_bridge_amount(
        ctx: Context<EncryptBridgeAmount>,
        computation_offset: u64,
        amount: u64,
        source_chain: String,
        dest_chain: String,
        user_pubkey: Pubkey,
    ) -> Result<()> {
        // Create bridge amount data
        let bridge_data = BridgeAmount {
            amount,
            source_chain: source_chain.clone(),
            dest_chain: dest_chain.clone(),
            timestamp: Clock::get()?.unix_timestamp as u64,
            user_pubkey: user_pubkey.to_bytes(),
        };

        // Serialize for encrypted computation
        let bridge_bytes = bridge_data.try_to_vec()?;

        // Create encrypted arguments
        let args = vec![
            Argument::EncryptedBytes(bridge_bytes),
        ];

        // Set PDA bump
        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        // Queue the MPC computation
        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![EncryptBridgeCallback::callback_ix(&[])],
            1, // Priority
        )?;

        // Emit event
        emit!(BridgeAmountEncrypted {
            user: user_pubkey,
            amount,
            source_chain,
            dest_chain,
            computation_offset,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /**
     * Callback for bridge amount encryption
     */
    #[arcium_callback(encrypted_ix = "encrypt_bridge_amount")]
    pub fn encrypt_bridge_callback(
        ctx: Context<EncryptBridgeCallback>,
        output: ComputationOutputs<EncryptBridgeOutput>,
    ) -> Result<()> {
        let result = match output {
            ComputationOutputs::Success(output) => output,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        // Store the encrypted result
        let encrypted_tx = &mut ctx.accounts.encrypted_tx;
        encrypted_tx.encrypted_amount = result.encrypted_amount;
        encrypted_tx.source_chain = result.source_chain.clone();
        encrypted_tx.dest_chain = result.dest_chain.clone();
        encrypted_tx.computation_id = result.computation_id;
        encrypted_tx.privacy_level = result.privacy_level.clone();
        encrypted_tx.bump = ctx.bumps.encrypted_tx;

        emit!(BridgeEncryptionComplete {
            user: encrypted_tx.user,
            computation_id: result.computation_id,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /**
     * Verify bridge transaction privately
     */
    pub fn verify_bridge_transaction(
        ctx: Context<VerifyBridgeTransaction>,
        computation_offset: u64,
        tx_hash: String,
        expected_amount: Vec<u8>,
        blockchain: String,
    ) -> Result<()> {
        let verification_data = BridgeVerification {
            tx_hash: tx_hash.clone(),
            expected_amount: expected_amount.clone(),
            blockchain: blockchain.clone(),
            timestamp: Clock::get()?.unix_timestamp as u64,
        };

        let verification_bytes = verification_data.try_to_vec()?;

        let args = vec![
            Argument::EncryptedBytes(verification_bytes),
        ];

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![VerifyBridgeCallback::callback_ix(&[])],
            1,
        )?;

        emit!(BridgeVerificationStarted {
            tx_hash,
            blockchain,
            computation_offset,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /**
     * Callback for bridge verification
     */
    #[arcium_callback(encrypted_ix = "verify_bridge_transaction")]
    pub fn verify_bridge_callback(
        ctx: Context<VerifyBridgeCallback>,
        output: ComputationOutputs<VerifyBridgeOutput>,
    ) -> Result<()> {
        let verified = match output {
            ComputationOutputs::Success(result) => result.verified,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        let verification = &mut ctx.accounts.verification;
        verification.verified = verified;
        verification.completed_at = Clock::get()?.unix_timestamp;
        verification.bump = ctx.bumps.verification;

        emit!(BridgeVerificationComplete {
            tx_hash: verification.tx_hash.clone(),
            verified,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /**
     * Calculate SOL swap amount on encrypted ZEC
     */
    pub fn calculate_swap_amount(
        ctx: Context<CalculateSwapAmount>,
        computation_offset: u64,
        zen_amount: Vec<u8>,
        exchange_rate: u64,
        slippage_tolerance: u64,
    ) -> Result<()> {
        let swap_data = SwapCalculation {
            zen_amount: zen_amount.clone(),
            exchange_rate,
            slippage_tolerance,
        };

        let swap_bytes = swap_data.try_to_vec()?;

        let args = vec![
            Argument::EncryptedBytes(swap_bytes),
        ];

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![CalculateSwapCallback::callback_ix(&[])],
            1,
        )?;

        emit!(SwapCalculationStarted {
            exchange_rate,
            slippage_tolerance,
            computation_offset,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /**
     * Callback for swap calculation
     */
    #[arcium_callback(encrypted_ix = "calculate_swap_amount")]
    pub fn calculate_swap_callback(
        ctx: Context<CalculateSwapCallback>,
        output: ComputationOutputs<CalculateSwapOutput>,
    ) -> Result<()> {
        let sol_amount = match output {
            ComputationOutputs::Success(result) => result.sol_amount,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        let swap = &mut ctx.accounts.swap_calculation;
        swap.sol_amount = sol_amount;
        swap.completed_at = Clock::get()?.unix_timestamp;
        swap.bump = ctx.bumps.swap_calculation;

        emit!(SwapCalculationComplete {
            sol_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /**
     * Encrypt BTC address for relayer privacy
     */
    pub fn encrypt_btc_address(
        ctx: Context<EncryptBtcAddress>,
        computation_offset: u64,
        btc_address: String,
        recipient_pubkey: Pubkey,
    ) -> Result<()> {
        let btc_data = BTCAddress {
            address: btc_address.clone(),
            recipient_pubkey: recipient_pubkey.to_bytes(),
            timestamp: Clock::get()?.unix_timestamp as u64,
        };

        let btc_bytes = btc_data.try_to_vec()?;

        let args = vec![
            Argument::EncryptedBytes(btc_bytes),
        ];

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![EncryptBtcCallback::callback_ix(&[])],
            1,
        )?;

        emit!(BtcAddressEncryptionStarted {
            recipient: recipient_pubkey,
            computation_offset,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /**
     * Callback for BTC address encryption
     */
    #[arcium_callback(encrypted_ix = "encrypt_btc_address")]
    pub fn encrypt_btc_callback(
        ctx: Context<EncryptBtcCallback>,
        output: ComputationOutputs<EncryptBtcOutput>,
    ) -> Result<()> {
        let encrypted_address = match output {
            ComputationOutputs::Success(result) => result.encrypted_address,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        let encrypted_btc = &mut ctx.accounts.encrypted_btc;
        encrypted_btc.encrypted_address = encrypted_address;
        encrypted_btc.completed_at = Clock::get()?.unix_timestamp;
        encrypted_btc.bump = ctx.bumps.encrypted_btc;

        emit!(BtcAddressEncryptionComplete {
            recipient: encrypted_btc.recipient,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

// Data structures for encrypted computations
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BridgeAmount {
    pub amount: u64,
    pub source_chain: String,
    pub dest_chain: String,
    pub timestamp: u64,
    pub user_pubkey: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct EncryptedBridgeTx {
    pub encrypted_amount: Vec<u8>,
    pub source_chain: String,
    pub dest_chain: String,
    pub computation_id: [u8; 32],
    pub privacy_level: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BridgeVerification {
    pub tx_hash: String,
    pub expected_amount: Vec<u8>,
    pub blockchain: String,
    pub timestamp: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SwapCalculation {
    pub zen_amount: Vec<u8>,
    pub exchange_rate: u64,
    pub slippage_tolerance: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BTCAddress {
    pub address: String,
    pub recipient_pubkey: [u8; 32],
    pub timestamp: u64,
}

// Account structs would be auto-generated by Arcium
// Including all the required Arcium accounts (cluster, mxe, mempool, etc.)

// Event definitions
#[event]
pub struct BridgeAmountEncrypted {
    pub user: Pubkey,
    pub amount: u64,
    pub source_chain: String,
    pub dest_chain: String,
    pub computation_offset: u64,
    pub timestamp: i64,
}

#[event]
pub struct BridgeEncryptionComplete {
    pub user: Pubkey,
    pub computation_id: [u8; 32],
    pub timestamp: i64,
}

#[event]
pub struct BridgeVerificationStarted {
    pub tx_hash: String,
    pub blockchain: String,
    pub computation_offset: u64,
    pub timestamp: i64,
}

#[event]
pub struct BridgeVerificationComplete {
    pub tx_hash: String,
    pub verified: bool,
    pub timestamp: i64,
}

#[event]
pub struct SwapCalculationStarted {
    pub exchange_rate: u64,
    pub slippage_tolerance: u64,
    pub computation_offset: u64,
    pub timestamp: i64,
}

#[event]
pub struct SwapCalculationComplete {
    pub sol_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct BtcAddressEncryptionStarted {
    pub recipient: Pubkey,
    pub computation_offset: u64,
    pub timestamp: i64,
}

#[event]
pub struct BtcAddressEncryptionComplete {
    pub recipient: Pubkey,
    pub timestamp: i64,
}

// Error codes
#[error_code]
pub enum ErrorCode {
    #[msg("Computation was aborted")]
    AbortedComputation,
    #[msg("Invalid bridge amount")]
    InvalidBridgeAmount,
    #[msg("Invalid BTC address")]
    InvalidBtcAddress,
}
