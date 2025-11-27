use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo, Burn};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("7ac8wtD5S9BRutHBMUoKMjpYepKSHVCgGaoN1etLjkd4");

#[program]
pub mod zenz_bridge {
    use super::*;

    /// Initialize the bridge config with zenZEC mint and authority
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        max_mint_per_tx: u64,
        bootstrap_btc: u64,
        bootstrap_zec: u64,
        reserve_asset: ReserveAsset,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.mint = ctx.accounts.mint.key();
        config.max_mint_per_tx = max_mint_per_tx;
        config.paused = false;
        config.total_minted = 0;
        config.total_burned = 0;
        config.btc_reserve = bootstrap_btc;
        config.zec_reserve = bootstrap_zec;
        config.bootstrap_btc = bootstrap_btc;
        config.bootstrap_zec = bootstrap_zec;
        config.reserve_asset = reserve_asset;

        msg!("Bridge config initialized");
        msg!("Authority: {}", config.authority);
        msg!("Mint: {}", config.mint);
        msg!("Max mint per tx: {}", max_mint_per_tx);
        msg!("Bootstrap BTC: {} satoshis", bootstrap_btc);
        msg!("Bootstrap ZEC: {}", bootstrap_zec);
        msg!("Reserve asset: {:?}", reserve_asset);

        Ok(())
    }

    /// Mint zenZEC tokens to a user's token account
    /// Called by backend relayer when BTC/ZEC is received
    pub fn mint_zenzec(ctx: Context<MintZenZEC>, amount: u64) -> Result<()> {
        let config = &mut ctx.accounts.config;

        require!(!config.paused, ErrorCode::BridgePaused);
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(amount <= config.max_mint_per_tx, ErrorCode::AmountExceedsMax);

        // Check reserve capacity based on reserve asset type
        let available_reserve = match config.reserve_asset {
            ReserveAsset::BTC => config.btc_reserve,
            ReserveAsset::ZEC => config.zec_reserve,
        };

        require!(
            config.total_minted + amount <= available_reserve,
            ErrorCode::InsufficientReserve
        );

        // Mint tokens to user's token account
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::mint_to(cpi_ctx, amount)?;

        config.total_minted += amount;

        msg!("Minted {} zenZEC to {}", amount, ctx.accounts.user_token_account.key());
        msg!("Reserve: {} {:?}", available_reserve, config.reserve_asset);

        Ok(())
    }

    /// Burn zenZEC tokens from user's token account
    pub fn burn_zenzec(ctx: Context<BurnZenZEC>, amount: u64) -> Result<()> {
        let config = &mut ctx.accounts.config;

        require!(amount > 0, ErrorCode::InvalidAmount);

        // Burn tokens from user's token account
        let cpi_accounts = Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::burn(cpi_ctx, amount)?;

        config.total_burned += amount;

        msg!("Burned {} zenZEC from {}", amount, ctx.accounts.user.key());

        Ok(())
    }

    /// Burn zenZEC and emit an event for the relayer to swap to SOL
    pub fn burn_and_emit(ctx: Context<BurnAndEmit>, amount: u64) -> Result<()> {
        let config = &mut ctx.accounts.config;

        require!(amount > 0, ErrorCode::InvalidAmount);

        // Burn tokens from user's token account
        let cpi_accounts = Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::burn(cpi_ctx, amount)?;

        config.total_burned += amount;

        // Emit event for off-chain relayer
        emit!(BurnSwapEvent {
            user: ctx.accounts.user.key(),
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Burned {} zenZEC and emitted swap event for {}", amount, ctx.accounts.user.key());

        Ok(())
    }

    /// Update bridge pause status (admin only)
    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.paused = paused;

        msg!("Bridge paused status set to: {}", paused);

        Ok(())
    }

    /// Update max mint per transaction (admin only)
    pub fn set_max_mint(ctx: Context<SetMaxMint>, max_mint_per_tx: u64) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.max_mint_per_tx = max_mint_per_tx;

        msg!("Max mint per tx updated to: {}", max_mint_per_tx);

        Ok(())
    }

    /// Update BTC reserve (admin only, called when BTC is received)
    pub fn update_btc_reserve(ctx: Context<UpdateReserve>, amount: u64) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.btc_reserve += amount;

        msg!("BTC reserve updated: {} satoshis", config.btc_reserve);

        Ok(())
    }

    /// Update ZEC reserve (admin only, called when ZEC is received)
    pub fn update_zec_reserve(ctx: Context<UpdateReserve>, amount: u64) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.zec_reserve += amount;

        msg!("ZEC reserve updated: {}", config.zec_reserve);

        Ok(())
    }

    /// Burn zenZEC and emit an event for the relayer to send BTC
    /// @param amount - Amount of zenZEC to burn
    /// @param btc_address - Bitcoin address to send BTC to (can be encrypted hash)
    /// @param use_privacy - Whether BTC address is encrypted
    pub fn burn_for_btc(
        ctx: Context<BurnForBTC>, 
        amount: u64,
        btc_address: String,
        use_privacy: bool
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;

        require!(!config.paused, ErrorCode::BridgePaused);
        require!(amount > 0, ErrorCode::InvalidAmount);

        // Burn tokens from user's token account
        let cpi_accounts = Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::burn(cpi_ctx, amount)?;

        config.total_burned += amount;

        // Emit event for off-chain BTC relayer
        emit!(BurnToBTCEvent {
            user: ctx.accounts.user.key(),
            amount,
            btc_address_hash: btc_address, // Can be plain address or encrypted hash
            encrypted: use_privacy,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Burned {} zenZEC and emitted BTC event for {}", amount, ctx.accounts.user.key());
        msg!("BTC address: {} (encrypted: {})", btc_address, use_privacy);

        Ok(())
    }
}

// Account Contexts

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintZenZEC<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump,
        has_one = authority,
        has_one = mint
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    
    // Use init_if_needed for ATA (optional - can also create in backend)
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: User doesn't need to sign for minting
    pub user: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BurnZenZEC<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump,
        has_one = mint
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnAndEmit<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump,
        has_one = mint
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump,
        has_one = authority
    )]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetMaxMint<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump,
        has_one = authority
    )]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateReserve<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump,
        has_one = authority
    )]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct BurnForBTC<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump,
        has_one = mint
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// State Accounts

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub max_mint_per_tx: u64,
    pub paused: bool,
    pub total_minted: u64,
    pub total_burned: u64,
    // Reserve tracking
    pub btc_reserve: u64,              // Total BTC backing (in satoshis)
    pub zec_reserve: u64,              // Total ZEC backing
    pub bootstrap_btc: u64,            // Initial BTC bootstrap
    pub bootstrap_zec: u64,            // Initial ZEC bootstrap
    pub reserve_asset: ReserveAsset,    // Primary reserve asset (BTC or ZEC)
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub enum ReserveAsset {
    BTC,  // Direct BTC backing
    ZEC,  // ZEC backing (privacy layer)
}

// Events

#[event]
pub struct BurnSwapEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct BurnToBTCEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub btc_address_hash: String,  // Can be plain address or encrypted hash
    pub encrypted: bool,            // Whether address is encrypted
    pub timestamp: i64,
}

// Errors

#[error_code]
pub enum ErrorCode {
    #[msg("Bridge is currently paused")]
    BridgePaused,
    #[msg("Invalid amount: must be greater than 0")]
    InvalidAmount,
    #[msg("Amount exceeds maximum mint per transaction")]
    AmountExceedsMax,
    #[msg("Insufficient reserve to mint requested amount")]
    InsufficientReserve,
}
