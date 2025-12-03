use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak;

const MIN_CIPHERTEXT_BYTES: usize = 8;
const MAX_CIPHERTEXT_BYTES: usize = 256;
const MAX_CHAIN_NAME_LEN: usize = 32;
const MAX_SLIPPAGE_PERCENT: u64 = 50;

declare_id!("CULoJigMJeVrmXVYPu8D9pdmfjAZnzdAwWvTqWvz1XkP");

#[program]
pub mod flash_bridge_mxe {
    use super::*;

    pub fn init_encrypt_bridge_comp_def(ctx: Context<ComputationDefinition>) -> Result<()> {
        emit_computation_def_event("encrypt_bridge_amount", ctx.accounts.payer.key())?;
        Ok(())
    }

    pub fn init_verify_tx_comp_def(ctx: Context<ComputationDefinition>) -> Result<()> {
        emit_computation_def_event("verify_bridge_transaction", ctx.accounts.payer.key())?;
        Ok(())
    }

    pub fn init_calculate_swap_comp_def(ctx: Context<ComputationDefinition>) -> Result<()> {
        emit_computation_def_event("calculate_swap_amount", ctx.accounts.payer.key())?;
        Ok(())
    }

    pub fn init_encrypt_btc_comp_def(ctx: Context<ComputationDefinition>) -> Result<()> {
        emit_computation_def_event("encrypt_btc_address", ctx.accounts.payer.key())?;
        Ok(())
    }

    pub fn encrypt_bridge_amount(
        ctx: Context<MpcOperation>,
        computation_offset: u64,
        amount: u64,
        source_chain: String,
        dest_chain: String,
        user_pubkey: Pubkey,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        let source_chain = normalize_chain(source_chain)?;
        let dest_chain = normalize_chain(dest_chain)?;

        let timestamp = Clock::get()?.unix_timestamp;
        let amount_commitment =
            commit_bridge_amount(amount, &source_chain, &dest_chain, &user_pubkey);

        msg!(
            "MXE: encrypt_bridge_amount offset={} chains={}→{}",
            computation_offset,
            source_chain,
            dest_chain
        );

        emit!(BridgeAmountEncryptionQueued {
            user: user_pubkey,
            source_chain,
            dest_chain,
            amount_commitment,
            computation_offset,
            timestamp,
        });

        Ok(())
    }

    pub fn verify_bridge_transaction(
        ctx: Context<MpcOperation>,
        computation_offset: u64,
        tx_hash: String,
        expected_amount: Vec<u8>,
        blockchain: String,
    ) -> Result<()> {
        let trimmed_hash = tx_hash.trim();
        require!(!trimmed_hash.is_empty(), ErrorCode::InvalidTxHash);
        require!(
            expected_amount.len() >= MIN_CIPHERTEXT_BYTES
                && expected_amount.len() <= MAX_CIPHERTEXT_BYTES,
            ErrorCode::InvalidEncryptedPayload
        );
        let blockchain = normalize_chain(blockchain)?;

        let timestamp = Clock::get()?.unix_timestamp;
        let tx_hash_commitment = commitment(trimmed_hash.as_bytes());
        let expected_amount_commitment = commitment(&expected_amount);

        msg!(
            "MXE: verify_bridge_transaction offset={} chain={}",
            computation_offset,
            blockchain
        );

        emit!(BridgeVerificationQueued {
            tx_hash_commitment,
            blockchain,
            computation_offset,
            expected_amount_commitment,
            timestamp,
        });

        Ok(())
    }

    pub fn calculate_swap_amount(
        ctx: Context<MpcOperation>,
        computation_offset: u64,
        zen_amount: Vec<u8>,
        exchange_rate: u64,
        slippage_tolerance: u64,
    ) -> Result<()> {
        require!(exchange_rate > 0, ErrorCode::InvalidSwapInputs);
        require!(
            slippage_tolerance <= MAX_SLIPPAGE_PERCENT,
            ErrorCode::InvalidSwapInputs
        );
        require!(
            zen_amount.len() >= MIN_CIPHERTEXT_BYTES && zen_amount.len() <= MAX_CIPHERTEXT_BYTES,
            ErrorCode::InvalidEncryptedPayload
        );

        let zen_commitment = commitment(&zen_amount);
        let zen_value = extract_u64_from_bytes(&zen_amount)?;

        let base_amount = zen_value
            .checked_mul(exchange_rate)
            .ok_or(ErrorCode::Overflow)?;
        let slippage_penalty = base_amount
            .checked_mul(slippage_tolerance)
            .and_then(|value| value.checked_div(100))
            .unwrap_or(0);
        let sol_amount = base_amount.saturating_sub(slippage_penalty);

        let timestamp = Clock::get()?.unix_timestamp;
        msg!(
            "MXE: calculate_swap_amount offset={} chains ZEN->SOL",
            computation_offset
        );

        emit!(SwapCalculationQueued {
            zen_amount_commitment: zen_commitment,
            exchange_rate,
            slippage_tolerance,
            sol_amount,
            computation_offset,
            timestamp,
        });

        Ok(())
    }

    pub fn encrypt_btc_address(
        ctx: Context<MpcOperation>,
        computation_offset: u64,
        btc_address: String,
        recipient_pubkey: Pubkey,
    ) -> Result<()> {
        require!(
            is_valid_btc_address(&btc_address),
            ErrorCode::InvalidBtcAddress
        );

        let timestamp = Clock::get()?.unix_timestamp;
        let btc_address_commitment = commitment(btc_address.trim().as_bytes());
        msg!(
            "MXE: encrypt_btc_address offset={} recipient={}",
            computation_offset,
            recipient_pubkey
        );

        emit!(BtcAddressEncryptionQueued {
            recipient: recipient_pubkey,
            btc_address_commitment,
            computation_offset,
            timestamp,
        });

        Ok(())
    }
}

fn emit_computation_def_event(name: &str, authority: Pubkey) -> Result<()> {
    emit!(ComputationDefinitionInitialized {
        name: name.to_string(),
        authority,
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}

fn extract_u64_from_bytes(bytes: &[u8]) -> Result<u64> {
    if bytes.len() < MIN_CIPHERTEXT_BYTES {
        return Err(error!(ErrorCode::InvalidEncryptedPayload));
    }
    let mut array = [0u8; 8];
    array.copy_from_slice(&bytes[..8]);
    Ok(u64::from_le_bytes(array))
}

fn is_valid_btc_address(address: &str) -> bool {
    let len = address.len();
    len >= 26 && len <= 62 && !address.contains(' ')
}

fn commitment(data: &[u8]) -> [u8; 32] {
    keccak::hash(data).to_bytes()
}

fn commit_bridge_amount(
    amount: u64,
    source_chain: &str,
    dest_chain: &str,
    user: &Pubkey,
) -> [u8; 32] {
    let mut buffer = Vec::with_capacity(8 + source_chain.len() + dest_chain.len() + 32);
    buffer.extend_from_slice(&amount.to_le_bytes());
    buffer.extend_from_slice(source_chain.as_bytes());
    buffer.extend_from_slice(dest_chain.as_bytes());
    buffer.extend_from_slice(user.as_ref());
    commitment(&buffer)
}

fn normalize_chain(chain: String) -> Result<String> {
    let trimmed = chain.trim();
    require!(!trimmed.is_empty(), ErrorCode::MissingChainInfo);
    require!(
        trimmed.len() <= MAX_CHAIN_NAME_LEN,
        ErrorCode::MissingChainInfo
    );
    Ok(trimmed.to_ascii_uppercase())
}

#[derive(Accounts)]
pub struct ComputationDefinition<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
}

#[derive(Accounts)]
pub struct MpcOperation<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
}

// Events
#[event]
pub struct ComputationDefinitionInitialized {
    pub name: String,
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct BridgeAmountEncryptionQueued {
    pub user: Pubkey,
    pub source_chain: String,
    pub dest_chain: String,
    pub amount_commitment: [u8; 32],
    pub computation_offset: u64,
    pub timestamp: i64,
}

#[event]
pub struct BridgeVerificationQueued {
    pub tx_hash_commitment: [u8; 32],
    pub blockchain: String,
    pub expected_amount_commitment: [u8; 32],
    pub computation_offset: u64,
    pub timestamp: i64,
}

#[event]
pub struct SwapCalculationQueued {
    pub zen_amount_commitment: [u8; 32],
    pub exchange_rate: u64,
    pub slippage_tolerance: u64,
    pub sol_amount: u64,
    pub computation_offset: u64,
    pub timestamp: i64,
}

#[event]
pub struct BtcAddressEncryptionQueued {
    pub recipient: Pubkey,
    pub btc_address_commitment: [u8; 32],
    pub computation_offset: u64,
    pub timestamp: i64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Bridge is not active")]
    BridgeInactive,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Missing source or destination chain information")]
    MissingChainInfo,
    #[msg("Invalid BTC address")]
    InvalidBtcAddress,
    #[msg("Invalid transaction hash")]
    InvalidTxHash,
    #[msg("Invalid encrypted payload")]
    InvalidEncryptedPayload,
    #[msg("Invalid swap inputs")]
    InvalidSwapInputs,
    #[msg("Arithmetic overflow")]
    Overflow,
}
