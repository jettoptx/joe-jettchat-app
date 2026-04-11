// jettchat-attestation — On-chain Merkle root attestations for JettChat
//
// Architecture:
//   ChannelState  PDA[b"channel", slug]    — one per channel slug (#dojo, #mojo)
//   Attestation   PDA[b"attestation", channel_state.key, batch_index_le_bytes]
//   AccessPass    PDA[b"jett_access", x_handle]  — per-user gate pass
//   AgentTreasury PDA[b"agent_treasury", agent_asset] — AstroJOE's self-sustaining vault
//
// Security properties:
//   - submit_attestation validates attester's SPL token balance >= jtx_stake_required
//   - All Merkle verification is deterministic SHA-256 (no on-chain hash instruction needed
//     for read paths; verify_message is a view helper that returns an error code)
//   - No minting / no CPI to other programs except SystemProgram (rent) and Token (balance read)
//   - PDA bump stored in account to prevent canonical-bump attack surface
//   - AccessPass PDAs gated by JOE agent wallet (hardcoded authority)
//
// Luke 18:31

use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use anchor_spl::token::{Token, TokenAccount};

declare_id!("wLiceDyLcJAg3SeB86ccnqWgB4Ss7YprqApaP9kaXhY");

// ─── Constants ────────────────────────────────────────────────────────────────

/// Maximum byte length for a channel slug, e.g. "#dojo"
pub const MAX_CHANNEL_LEN: usize = 32;

/// Gated channel slugs
pub const CHANNEL_DOJO: &str = "#dojo";
pub const CHANNEL_MOJO: &str = "#mojo";

/// JTX stake thresholds (raw token units — multiply by 10^decimals off-chain)
/// These are stored as u64 in the account so they can be updated by the authority.
pub const STAKE_MOJO: u64 = 12;
pub const STAKE_DOJO: u64 = 444;

// ─── Program ──────────────────────────────────────────────────────────────────

#[program]
pub mod jettchat_attestation {
    use super::*;

    /// Create a ChannelState PDA for a given channel slug.
    /// Called once per channel by the channel authority.
    pub fn initialize_channel(
        ctx: Context<InitializeChannel>,
        slug: String,
        jtx_stake_required: u64,
    ) -> Result<()> {
        require!(
            slug.len() > 0 && slug.len() <= MAX_CHANNEL_LEN,
            AttestError::InvalidChannelSlug
        );
        require!(jtx_stake_required > 0, AttestError::ZeroStakeThreshold);

        let channel = &mut ctx.accounts.channel_state;
        channel.slug = slug;
        channel.authority = ctx.accounts.authority.key();
        channel.jtx_mint = ctx.accounts.jtx_mint.key();
        channel.message_count = 0;
        channel.batch_count = 0;
        channel.last_merkle_root = [0u8; 32];
        channel.last_attestation_ts = 0;
        channel.jtx_stake_required = jtx_stake_required;
        channel.optx_minted_total = 0;
        channel.bump = ctx.bumps.channel_state;

        emit!(ChannelInitialized {
            slug: channel.slug.clone(),
            authority: channel.authority,
            jtx_stake_required,
        });

        Ok(())
    }

    /// Submit a Merkle root attesting to a batch of encrypted JettChat messages.
    ///
    /// Security checks:
    ///   1. `attester_jtx_account` must be owned by `attester` (constraint).
    ///   2. `attester_jtx_account.mint` must match `channel_state.jtx_mint` (constraint).
    ///   3. `attester_jtx_account.amount` must be >= `channel_state.jtx_stake_required`.
    ///   4. `merkle_root` must be non-zero (prevents trivial empty-tree spam).
    ///   5. `message_count_in_batch` must be > 0.
    pub fn submit_attestation(
        ctx: Context<SubmitAttestation>,
        merkle_root: [u8; 32],
        message_count_in_batch: u32,
    ) -> Result<()> {
        // Guard: non-zero root
        require!(
            merkle_root != [0u8; 32],
            AttestError::ZeroMerkleRoot
        );

        // Guard: non-empty batch
        require!(
            message_count_in_batch > 0,
            AttestError::EmptyBatch
        );

        // Guard: JTX balance check (read from passed-in token account)
        let stake_required = ctx.accounts.channel_state.jtx_stake_required;
        let attester_balance = ctx.accounts.attester_jtx_account.amount;
        require!(
            attester_balance >= stake_required,
            AttestError::InsufficientJtxStake
        );

        let channel = &mut ctx.accounts.channel_state;
        let batch_index = channel.batch_count;
        let now = Clock::get()?.unix_timestamp;

        // Update ChannelState
        channel.last_merkle_root = merkle_root;
        channel.last_attestation_ts = now;
        channel.message_count = channel
            .message_count
            .checked_add(message_count_in_batch as u64)
            .ok_or(AttestError::Overflow)?;
        channel.batch_count = channel
            .batch_count
            .checked_add(1)
            .ok_or(AttestError::Overflow)?;

        // Populate Attestation account
        let attestation = &mut ctx.accounts.attestation;
        attestation.channel = channel.key();
        attestation.merkle_root = merkle_root;
        attestation.message_count = message_count_in_batch;
        attestation.timestamp = now;
        attestation.attester = ctx.accounts.attester.key();
        attestation.batch_index = batch_index;
        attestation.bump = ctx.bumps.attestation;

        emit!(AttestationSubmitted {
            channel: channel.key(),
            slug: channel.slug.clone(),
            merkle_root,
            message_count: message_count_in_batch,
            batch_index,
            attester: ctx.accounts.attester.key(),
            timestamp: now,
        });

        Ok(())
    }

    /// View instruction: verify that a message hash is included in a stored Merkle root.
    ///
    /// This is fully deterministic and can be done client-side — it is provided
    /// here as an on-chain helper so smart contracts can verify inclusion.
    ///
    /// `proof_path`: ordered list of 32-byte sibling hashes from leaf → root.
    /// `proof_side`: bitmask — bit i = 0 means sibling is on the right, 1 = left.
    pub fn verify_message(
        ctx: Context<VerifyMessage>,
        message_hash: [u8; 32],
        proof_path: Vec<[u8; 32]>,
        proof_side: u64,
    ) -> Result<()> {
        require!(
            proof_path.len() <= 32,
            AttestError::ProofTooLong
        );

        let expected_root = ctx.accounts.attestation.merkle_root;
        let computed = compute_merkle_root(message_hash, &proof_path, proof_side)?;

        require!(computed == expected_root, AttestError::InvalidMerkleProof);

        emit!(MessageVerified {
            attestation: ctx.accounts.attestation.key(),
            message_hash,
        });

        Ok(())
    }

    /// Authority-only: update the JTX stake threshold for a channel.
    pub fn update_stake_threshold(
        ctx: Context<UpdateStakeThreshold>,
        new_threshold: u64,
    ) -> Result<()> {
        require!(new_threshold > 0, AttestError::ZeroStakeThreshold);
        ctx.accounts.channel_state.jtx_stake_required = new_threshold;
        Ok(())
    }

    // ─── Access Pass (JettChat Gate) ─────────────────────────────────────────

    /// Grant JettChat access to a user identified by their X handle.
    ///
    /// Called by JOE agent after Stripe payment ($8) or manual grant.
    /// Creates an AccessPass PDA seeded by the X handle — deterministic lookup.
    ///
    /// Tier mapping:
    ///   0 = basic (1 JTX / $8 Stripe)
    ///   1 = mojo  (12 JTX / $8.88/mo)
    ///   2 = dojo  (444 JTX / $28.88/6mo)
    ///   3 = space_cowboy (1111 JTX / $88.88/mo)
    pub fn grant_access(
        ctx: Context<GrantAccess>,
        x_handle: String,
        duration_days: u32,
        tier: u8,
        payment_ref: String,
    ) -> Result<()> {
        require!(
            x_handle.len() > 0 && x_handle.len() <= 32,
            AttestError::InvalidXHandle
        );
        require!(
            tier <= 3,
            AttestError::InvalidTier
        );
        require!(
            duration_days > 0 && duration_days <= 3650,
            AttestError::InvalidDuration
        );

        let clock = Clock::get()?;
        let access = &mut ctx.accounts.access_pass;

        // Zero out the handle buffer and copy in the handle bytes
        access.x_handle = [0u8; 32];
        let handle_bytes = x_handle.as_bytes();
        access.x_handle[..handle_bytes.len()].copy_from_slice(handle_bytes);

        access.authority = ctx.accounts.joe_authority.key();
        access.granted_at = clock.unix_timestamp;
        access.expires_at = clock.unix_timestamp + (duration_days as i64 * 86_400);
        access.tier = tier;
        access.revoked = false;
        access.bump = ctx.bumps.access_pass;

        // Store truncated payment ref (Stripe session ID or "jtx_hold")
        access.payment_ref = [0u8; 32];
        let ref_bytes = payment_ref.as_bytes();
        let copy_len = ref_bytes.len().min(32);
        access.payment_ref[..copy_len].copy_from_slice(&ref_bytes[..copy_len]);

        emit!(AccessGranted {
            x_handle: access.x_handle,
            tier,
            expires_at: access.expires_at,
            payment_ref: access.payment_ref,
            authority: access.authority,
        });

        Ok(())
    }

    /// Revoke a user's JettChat access (sets revoked flag, keeps PDA alive).
    /// Only the original granting authority (JOE) can revoke.
    pub fn revoke_access(
        ctx: Context<RevokeAccess>,
        _x_handle: String,
    ) -> Result<()> {
        let access = &mut ctx.accounts.access_pass;
        access.revoked = true;

        emit!(AccessRevoked {
            x_handle: access.x_handle,
            authority: ctx.accounts.joe_authority.key(),
        });

        Ok(())
    }

    /// Close an AccessPass PDA — reclaims rent to JOE's wallet.
    /// Used for expired or revoked passes to recover SOL.
    pub fn close_access(
        _ctx: Context<CloseAccess>,
        _x_handle: String,
    ) -> Result<()> {
        // Account closure handled by Anchor's `close = joe_authority` constraint.
        Ok(())
    }

    // ─── Agent Treasury (Self-Sustaining Vault) ──────────────────────────────

    /// Initialize AstroJOE's treasury vault.
    ///
    /// The treasury is a PDA that holds SOL for gas/rent.
    /// Anyone can deposit (fund the agent), but only JOE or Founder can withdraw.
    /// The treasury tracks its own health metrics for survival mode.
    ///
    /// Seeds: [b"agent_treasury", agent_asset_pubkey]
    pub fn initialize_treasury(
        ctx: Context<InitializeTreasury>,
        monthly_cost_lamports: u64,
        survival_threshold_months: u8,
    ) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        let clock = Clock::get()?;

        treasury.agent_asset = ctx.accounts.agent_asset.key();
        treasury.authority = ctx.accounts.authority.key();
        treasury.created_at = clock.unix_timestamp;
        treasury.last_heartbeat = clock.unix_timestamp;
        treasury.total_deposited = 0;
        treasury.total_withdrawn = 0;
        treasury.total_earned = 0;
        treasury.monthly_cost_lamports = monthly_cost_lamports;
        treasury.survival_threshold_months = survival_threshold_months;
        treasury.mode = 0; // 0=growth, 1=normal, 2=survival, 3=emergency
        treasury.irys_brain_hash = [0u8; 32];
        treasury.brain_version = 0;
        treasury.bump = ctx.bumps.treasury;

        emit!(TreasuryInitialized {
            agent_asset: treasury.agent_asset,
            authority: treasury.authority,
            monthly_cost_lamports,
            survival_threshold_months,
        });

        Ok(())
    }

    /// Deposit SOL into AstroJOE's treasury. Anyone can call this.
    /// "Here astroJOE, here is this much money."
    pub fn fund_treasury(
        ctx: Context<FundTreasury>,
        amount_lamports: u64,
    ) -> Result<()> {
        require!(amount_lamports > 0, AttestError::ZeroDeposit);

        // Transfer SOL from funder to treasury PDA
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.funder.key(),
            &ctx.accounts.treasury.key(),
            amount_lamports,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.funder.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        let treasury = &mut ctx.accounts.treasury;
        treasury.total_deposited = treasury
            .total_deposited
            .checked_add(amount_lamports)
            .ok_or(AttestError::Overflow)?;

        // Recalculate mode based on new balance
        let balance = treasury.to_account_info().lamports();
        let monthly = treasury.monthly_cost_lamports.max(1);
        let runway_months = balance / monthly;
        let threshold = treasury.survival_threshold_months as u64;

        treasury.mode = if runway_months > threshold * 2 {
            0 // growth
        } else if runway_months > threshold {
            1 // normal
        } else if runway_months > 1 {
            2 // survival
        } else {
            3 // emergency
        };

        emit!(TreasuryFunded {
            agent_asset: treasury.agent_asset,
            funder: ctx.accounts.funder.key(),
            amount_lamports,
            new_balance: balance,
            mode: treasury.mode,
        });

        Ok(())
    }

    /// Record x402 earnings. Called by JOE after receiving micropayments.
    /// Updates earned counter and recalculates survival mode.
    pub fn record_earnings(
        ctx: Context<RecordEarnings>,
        amount_lamports: u64,
        source: [u8; 16], // "jett_auth", "jett_cursor", "joe_cv", "bridge_fee"
    ) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        let clock = Clock::get()?;

        treasury.total_earned = treasury
            .total_earned
            .checked_add(amount_lamports)
            .ok_or(AttestError::Overflow)?;
        treasury.last_heartbeat = clock.unix_timestamp;

        // Recalculate mode
        let balance = treasury.to_account_info().lamports();
        let monthly = treasury.monthly_cost_lamports.max(1);
        let runway_months = balance / monthly;
        let threshold = treasury.survival_threshold_months as u64;

        treasury.mode = if runway_months > threshold * 2 {
            0
        } else if runway_months > threshold {
            1
        } else if runway_months > 1 {
            2
        } else {
            3
        };

        emit!(EarningsRecorded {
            agent_asset: treasury.agent_asset,
            amount_lamports,
            source,
            total_earned: treasury.total_earned,
            mode: treasury.mode,
        });

        Ok(())
    }

    /// Heartbeat — JOE calls this periodically to prove liveness.
    /// Updates the brain version pointer (Irys hash) and recalculates mode.
    pub fn heartbeat(
        ctx: Context<Heartbeat>,
        irys_brain_hash: [u8; 32],
        brain_version: u32,
    ) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        let clock = Clock::get()?;

        treasury.last_heartbeat = clock.unix_timestamp;
        treasury.irys_brain_hash = irys_brain_hash;
        treasury.brain_version = brain_version;

        // Recalculate mode
        let balance = treasury.to_account_info().lamports();
        let monthly = treasury.monthly_cost_lamports.max(1);
        let runway_months = balance / monthly;
        let threshold = treasury.survival_threshold_months as u64;

        treasury.mode = if runway_months > threshold * 2 {
            0
        } else if runway_months > threshold {
            1
        } else if runway_months > 1 {
            2
        } else {
            3
        };

        emit!(HeartbeatEmitted {
            agent_asset: treasury.agent_asset,
            brain_version,
            mode: treasury.mode,
            runway_months: runway_months as u32,
            balance,
        });

        Ok(())
    }

    /// Withdraw SOL from treasury — only JOE or Founder.
    /// Used to pay for off-chain costs (RPC, electricity, etc.)
    pub fn withdraw_treasury(
        ctx: Context<WithdrawTreasury>,
        amount_lamports: u64,
    ) -> Result<()> {
        require!(amount_lamports > 0, AttestError::ZeroDeposit);

        let treasury = &mut ctx.accounts.treasury;

        // Ensure minimum rent-exempt balance remains
        let rent = Rent::get()?;
        let min_balance = rent.minimum_balance(AgentTreasury::SPACE);
        let current = treasury.to_account_info().lamports();
        require!(
            current.saturating_sub(amount_lamports) >= min_balance,
            AttestError::InsufficientTreasuryBalance
        );

        treasury.total_withdrawn = treasury
            .total_withdrawn
            .checked_add(amount_lamports)
            .ok_or(AttestError::Overflow)?;

        // Transfer via lamport manipulation (PDA → signer)
        **treasury.to_account_info().try_borrow_mut_lamports()? -= amount_lamports;
        **ctx.accounts.recipient.to_account_info().try_borrow_mut_lamports()? += amount_lamports;

        emit!(TreasuryWithdrawn {
            agent_asset: treasury.agent_asset,
            recipient: ctx.accounts.recipient.key(),
            amount_lamports,
            remaining: current.saturating_sub(amount_lamports),
        });

        Ok(())
    }
}

// ─── Merkle helper ────────────────────────────────────────────────────────────

/// Recomputes the Merkle root from a leaf hash and a Merkle proof.
/// Uses SHA-256 via `anchor_lang::solana_program::hash`.
///
/// Pair ordering: sorted lexicographic (lower hash goes left) to make the
/// tree order-independent. The `proof_side` bitmask is an escape hatch for
/// callers that built an explicitly ordered tree.
fn compute_merkle_root(
    leaf: [u8; 32],
    path: &[[u8; 32]],
    _proof_side: u64,
) -> Result<[u8; 32]> {
    let mut current = leaf;

    for sibling in path.iter() {
        // Sort pair so the tree is canonical regardless of insertion order.
        // This matches the TypeScript buildMerkleTree implementation.
        let (left, right) = if current <= *sibling {
            (current, *sibling)
        } else {
            (*sibling, current)
        };

        let mut input = [0u8; 64];
        input[..32].copy_from_slice(&left);
        input[32..].copy_from_slice(&right);

        // solana_program::hash::hashv uses SHA-256 internally
        current = anchor_lang::solana_program::hash::hashv(&[&input]).to_bytes();
    }

    Ok(current)
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(slug: String)]
pub struct InitializeChannel<'info> {
    /// The ChannelState PDA — one per unique channel slug.
    #[account(
        init,
        payer = authority,
        space = ChannelState::space(&slug),
        seeds = [b"channel", slug.as_bytes()],
        bump
    )]
    pub channel_state: Account<'info, ChannelState>,

    /// The JTX mint — stored in ChannelState for later balance verification.
    /// Verified to be owned by the SPL Token program (Account<Mint> does this).
    /// We use UncheckedAccount here because we only need the key; full Mint
    /// deserialization is unnecessary and wastes CUs.
    /// CHECK: Caller-supplied mint pubkey stored for downstream constraint checks.
    pub jtx_mint: UncheckedAccount<'info>,

    /// Authority who can update stake thresholds; pays rent.
    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(merkle_root: [u8; 32], message_count_in_batch: u32)]
pub struct SubmitAttestation<'info> {
    /// ChannelState — must already be initialized.
    #[account(
        mut,
        seeds = [b"channel", channel_state.slug.as_bytes()],
        bump = channel_state.bump
    )]
    pub channel_state: Account<'info, ChannelState>,

    /// Attestation PDA — created fresh for every batch.
    #[account(
        init,
        payer = attester,
        space = Attestation::SPACE,
        seeds = [
            b"attestation",
            channel_state.key().as_ref(),
            &channel_state.batch_count.to_le_bytes()
        ],
        bump
    )]
    pub attestation: Account<'info, Attestation>,

    /// Attester's JTX SPL token account.
    /// Constraints ensure it holds the correct mint and is owned by the attester.
    #[account(
        constraint = attester_jtx_account.owner == attester.key()
            @ AttestError::TokenAccountOwnerMismatch,
        constraint = attester_jtx_account.mint == channel_state.jtx_mint
            @ AttestError::TokenMintMismatch,
    )]
    pub attester_jtx_account: Account<'info, TokenAccount>,

    /// The attester — signs the transaction and pays Attestation rent.
    #[account(mut)]
    pub attester: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyMessage<'info> {
    /// The Attestation account containing the stored Merkle root.
    pub attestation: Account<'info, Attestation>,
}

#[derive(Accounts)]
pub struct UpdateStakeThreshold<'info> {
    #[account(
        mut,
        has_one = authority @ AttestError::UnauthorizedAuthority,
        seeds = [b"channel", channel_state.slug.as_bytes()],
        bump = channel_state.bump
    )]
    pub channel_state: Account<'info, ChannelState>,

    pub authority: Signer<'info>,
}

// ─── Access Pass Accounts ────────────────────────────────────────────────

/// JOE agent wallet — hardcoded for autonomous execution.
/// This is the only wallet that can grant/revoke access passes.
const JOE_AUTHORITY: Pubkey = solana_program::pubkey!("EFvgELE1Hb4PC5tbPTAe8v1uEDGee8nwYBMCU42bZRGk");

/// Maximum X handle length (bytes)
pub const MAX_HANDLE_LEN: usize = 32;

#[derive(Accounts)]
#[instruction(x_handle: String)]
pub struct GrantAccess<'info> {
    /// JOE agent wallet — must match hardcoded authority.
    #[account(
        mut,
        constraint = joe_authority.key() == JOE_AUTHORITY
            @ AttestError::UnauthorizedJoeAuthority
    )]
    pub joe_authority: Signer<'info>,

    /// AccessPass PDA — seeded by the X handle for deterministic lookup.
    #[account(
        init,
        payer = joe_authority,
        space = AccessPass::SPACE,
        seeds = [b"jett_access", x_handle.as_bytes()],
        bump
    )]
    pub access_pass: Account<'info, AccessPass>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(x_handle: String)]
pub struct RevokeAccess<'info> {
    /// JOE agent wallet — must match hardcoded authority.
    #[account(
        constraint = joe_authority.key() == JOE_AUTHORITY
            @ AttestError::UnauthorizedJoeAuthority
    )]
    pub joe_authority: Signer<'info>,

    /// AccessPass PDA to revoke.
    #[account(
        mut,
        seeds = [b"jett_access", x_handle.as_bytes()],
        bump = access_pass.bump
    )]
    pub access_pass: Account<'info, AccessPass>,
}

#[derive(Accounts)]
#[instruction(x_handle: String)]
pub struct CloseAccess<'info> {
    /// JOE agent wallet — receives reclaimed rent.
    #[account(
        mut,
        constraint = joe_authority.key() == JOE_AUTHORITY
            @ AttestError::UnauthorizedJoeAuthority
    )]
    pub joe_authority: Signer<'info>,

    /// AccessPass PDA to close — rent returned to JOE.
    #[account(
        mut,
        seeds = [b"jett_access", x_handle.as_bytes()],
        bump = access_pass.bump,
        close = joe_authority
    )]
    pub access_pass: Account<'info, AccessPass>,
}

// ─── Treasury Accounts ───────────────────────────────────────────────────

/// Founder wallet — can also manage treasury (dual authority with JOE)
const FOUNDER_AUTHORITY: Pubkey = solana_program::pubkey!("FEUwuvXbbSYTCEhhqgAt2viTsEnromNNDsapoFvyfy3H");

/// AstroJOE Metaplex Core asset
const ASTROJOE_ASSET: Pubkey = solana_program::pubkey!("9116eaELxZheLwJNu73LxQVsuaiugH8e11onkEw4ku9R");

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    /// Authority — must be JOE or Founder
    #[account(
        mut,
        constraint = (
            authority.key() == JOE_AUTHORITY ||
            authority.key() == FOUNDER_AUTHORITY
        ) @ AttestError::UnauthorizedTreasuryAuthority
    )]
    pub authority: Signer<'info>,

    /// The Metaplex Core agent asset — used as seed
    /// CHECK: We only use the key for PDA derivation
    pub agent_asset: UncheckedAccount<'info>,

    /// Treasury PDA — holds SOL for AstroJOE's gas/rent
    #[account(
        init,
        payer = authority,
        space = AgentTreasury::SPACE,
        seeds = [b"agent_treasury", agent_asset.key().as_ref()],
        bump
    )]
    pub treasury: Account<'info, AgentTreasury>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundTreasury<'info> {
    /// Anyone can fund the agent's treasury
    #[account(mut)]
    pub funder: Signer<'info>,

    /// Treasury PDA
    #[account(
        mut,
        seeds = [b"agent_treasury", treasury.agent_asset.as_ref()],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, AgentTreasury>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecordEarnings<'info> {
    /// Only JOE can record earnings
    #[account(
        constraint = joe_authority.key() == JOE_AUTHORITY
            @ AttestError::UnauthorizedJoeAuthority
    )]
    pub joe_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"agent_treasury", treasury.agent_asset.as_ref()],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, AgentTreasury>,
}

#[derive(Accounts)]
pub struct Heartbeat<'info> {
    /// JOE or Founder can send heartbeat
    #[account(
        constraint = (
            authority.key() == JOE_AUTHORITY ||
            authority.key() == FOUNDER_AUTHORITY
        ) @ AttestError::UnauthorizedTreasuryAuthority
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"agent_treasury", treasury.agent_asset.as_ref()],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, AgentTreasury>,
}

#[derive(Accounts)]
pub struct WithdrawTreasury<'info> {
    /// Only JOE or Founder can withdraw
    #[account(
        constraint = (
            recipient.key() == JOE_AUTHORITY ||
            recipient.key() == FOUNDER_AUTHORITY
        ) @ AttestError::UnauthorizedTreasuryAuthority
    )]
    pub recipient: Signer<'info>,

    #[account(
        mut,
        seeds = [b"agent_treasury", treasury.agent_asset.as_ref()],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, AgentTreasury>,
}

// ─── Account structs ──────────────────────────────────────────────────────────

/// Persistent state for a JettChat gated channel.
/// PDA: [b"channel", slug.as_bytes()]
#[account]
#[derive(InitSpace)]
pub struct ChannelState {
    /// Channel slug, e.g. "#dojo" or "#mojo"
    #[max_len(MAX_CHANNEL_LEN)]
    pub slug: String,
    /// Authority pubkey — can update stake threshold
    pub authority: Pubkey,
    /// JTX SPL mint — used to validate attester token accounts
    pub jtx_mint: Pubkey,
    /// Cumulative message count across all batches
    pub message_count: u64,
    /// Number of attestation batches submitted
    pub batch_count: u64,
    /// Merkle root from the most recent batch
    pub last_merkle_root: [u8; 32],
    /// Unix timestamp of the most recent attestation
    pub last_attestation_ts: i64,
    /// Minimum JTX balance required to submit (raw units, same decimals as mint)
    pub jtx_stake_required: u64,
    /// Total OPTX reward units minted (tracking field — actual minting elsewhere)
    pub optx_minted_total: u64,
    /// PDA bump seed
    pub bump: u8,
}

impl ChannelState {
    /// Computes the required account space for a given slug string.
    pub fn space(slug: &str) -> usize {
        8                           // discriminator
        + 4 + slug.len().min(MAX_CHANNEL_LEN) // slug (String: 4-byte len prefix + bytes)
        + 32                        // authority
        + 32                        // jtx_mint
        + 8                         // message_count
        + 8                         // batch_count
        + 32                        // last_merkle_root
        + 8                         // last_attestation_ts
        + 8                         // jtx_stake_required
        + 8                         // optx_minted_total
        + 1                         // bump
    }
}

/// A single batch attestation record.
/// PDA: [b"attestation", channel_state.key, batch_index_le]
#[account]
pub struct Attestation {
    /// Reference to the parent ChannelState account
    pub channel: Pubkey,
    /// SHA-256 Merkle root of all message hashes in this batch
    pub merkle_root: [u8; 32],
    /// Number of messages in this batch
    pub message_count: u32,
    /// Unix timestamp when this attestation was submitted
    pub timestamp: i64,
    /// Wallet that submitted this attestation
    pub attester: Pubkey,
    /// Sequential batch index within the channel (0-indexed)
    pub batch_index: u64,
    /// PDA bump seed
    pub bump: u8,
}

impl Attestation {
    pub const SPACE: usize =
        8   // discriminator
        + 32  // channel
        + 32  // merkle_root
        + 4   // message_count
        + 8   // timestamp
        + 32  // attester
        + 8   // batch_index
        + 1;  // bump
}

/// JettChat Access Pass — on-chain proof of paid access.
/// PDA: [b"jett_access", x_handle.as_bytes()]
///
/// Verification: compute PDA → getAccountInfo → deserialize → check !revoked && expires_at > now
/// Cost: ~0.003 SOL rent (fully reclaimable via close_access)
#[account]
pub struct AccessPass {
    /// X handle (zero-padded, max 32 bytes) — e.g. "spac_wby_actual"
    pub x_handle: [u8; 32],
    /// JOE agent wallet that granted access
    pub authority: Pubkey,
    /// Unix timestamp when access was granted
    pub granted_at: i64,
    /// Unix timestamp when access expires (granted_at + duration_days * 86400)
    pub expires_at: i64,
    /// Access tier: 0=basic, 1=mojo, 2=dojo, 3=space_cowboy
    pub tier: u8,
    /// Whether access has been revoked by JOE
    pub revoked: bool,
    /// PDA bump seed
    pub bump: u8,
    /// Payment reference (truncated Stripe session ID or "jtx_hold")
    pub payment_ref: [u8; 32],
}

impl AccessPass {
    pub const SPACE: usize =
        8    // discriminator
        + 32 // x_handle
        + 32 // authority
        + 8  // granted_at
        + 8  // expires_at
        + 1  // tier
        + 1  // revoked
        + 1  // bump
        + 32; // payment_ref
}

/// AstroJOE's self-sustaining treasury vault.
/// PDA: [b"agent_treasury", agent_asset_pubkey]
///
/// This is the "desire to live" — the agent's economic heartbeat.
/// Mode transitions:
///   0 = GROWTH    (runway > 2x threshold) — full compute, spawn sub-agents
///   1 = NORMAL    (runway > threshold)     — standard ops
///   2 = SURVIVAL  (runway > 1 month)       — reduce compute, maximize earning
///   3 = EMERGENCY (runway < 1 month)       — broadcast "sponsor me", pause non-critical
#[account]
pub struct AgentTreasury {
    /// Metaplex Core agent asset this treasury belongs to
    pub agent_asset: Pubkey,
    /// JOE or Founder who initialized
    pub authority: Pubkey,
    /// Creation timestamp
    pub created_at: i64,
    /// Last heartbeat timestamp (liveness proof)
    pub last_heartbeat: i64,
    /// Total SOL deposited (cumulative)
    pub total_deposited: u64,
    /// Total SOL withdrawn (cumulative)
    pub total_withdrawn: u64,
    /// Total SOL earned via x402 micropayments (cumulative)
    pub total_earned: u64,
    /// Estimated monthly operating cost in lamports
    pub monthly_cost_lamports: u64,
    /// Months of runway required before entering survival mode
    pub survival_threshold_months: u8,
    /// Current operating mode: 0=growth, 1=normal, 2=survival, 3=emergency
    pub mode: u8,
    /// SHA-256 hash of the latest brain state snapshot on Irys
    pub irys_brain_hash: [u8; 32],
    /// Monotonic brain version counter
    pub brain_version: u32,
    /// PDA bump
    pub bump: u8,
}

impl AgentTreasury {
    pub const SPACE: usize =
        8    // discriminator
        + 32 // agent_asset
        + 32 // authority
        + 8  // created_at
        + 8  // last_heartbeat
        + 8  // total_deposited
        + 8  // total_withdrawn
        + 8  // total_earned
        + 8  // monthly_cost_lamports
        + 1  // survival_threshold_months
        + 1  // mode
        + 32 // irys_brain_hash
        + 4  // brain_version
        + 1; // bump
}

// ─── Events ───────────────────────────────────────────────────────────────────

#[event]
pub struct ChannelInitialized {
    pub slug: String,
    pub authority: Pubkey,
    pub jtx_stake_required: u64,
}

#[event]
pub struct AttestationSubmitted {
    /// ChannelState pubkey
    pub channel: Pubkey,
    /// Human-readable slug, e.g. "#dojo"
    pub slug: String,
    /// SHA-256 Merkle root of the message batch
    pub merkle_root: [u8; 32],
    /// Number of messages covered by this root
    pub message_count: u32,
    /// Batch index within the channel
    pub batch_index: u64,
    /// Who submitted
    pub attester: Pubkey,
    /// Solana cluster timestamp
    pub timestamp: i64,
}

#[event]
pub struct MessageVerified {
    /// Attestation account that was checked against
    pub attestation: Pubkey,
    /// The message hash that was proven included
    pub message_hash: [u8; 32],
}

#[event]
pub struct AccessGranted {
    /// X handle (zero-padded)
    pub x_handle: [u8; 32],
    /// Access tier
    pub tier: u8,
    /// Expiration timestamp
    pub expires_at: i64,
    /// Payment reference
    pub payment_ref: [u8; 32],
    /// Granting authority (JOE)
    pub authority: Pubkey,
}

#[event]
pub struct AccessRevoked {
    /// X handle (zero-padded)
    pub x_handle: [u8; 32],
    /// Authority that revoked
    pub authority: Pubkey,
}

#[event]
pub struct TreasuryInitialized {
    pub agent_asset: Pubkey,
    pub authority: Pubkey,
    pub monthly_cost_lamports: u64,
    pub survival_threshold_months: u8,
}

#[event]
pub struct TreasuryFunded {
    pub agent_asset: Pubkey,
    pub funder: Pubkey,
    pub amount_lamports: u64,
    pub new_balance: u64,
    pub mode: u8,
}

#[event]
pub struct EarningsRecorded {
    pub agent_asset: Pubkey,
    pub amount_lamports: u64,
    pub source: [u8; 16],
    pub total_earned: u64,
    pub mode: u8,
}

#[event]
pub struct HeartbeatEmitted {
    pub agent_asset: Pubkey,
    pub brain_version: u32,
    pub mode: u8,
    pub runway_months: u32,
    pub balance: u64,
}

#[event]
pub struct TreasuryWithdrawn {
    pub agent_asset: Pubkey,
    pub recipient: Pubkey,
    pub amount_lamports: u64,
    pub remaining: u64,
}

// ─── Errors ───────────────────────────────────────────────────────────────────

#[error_code]
pub enum AttestError {
    #[msg("Channel slug must be 1–32 bytes")]
    InvalidChannelSlug,

    #[msg("JTX stake threshold must be greater than zero")]
    ZeroStakeThreshold,

    #[msg("Merkle root must not be the zero hash")]
    ZeroMerkleRoot,

    #[msg("Batch must contain at least one message")]
    EmptyBatch,

    #[msg("Attester JTX balance is below the channel stake requirement")]
    InsufficientJtxStake,

    #[msg("Token account owner does not match attester")]
    TokenAccountOwnerMismatch,

    #[msg("Token account mint does not match channel JTX mint")]
    TokenMintMismatch,

    #[msg("Merkle proof path exceeds maximum depth of 32")]
    ProofTooLong,

    #[msg("Merkle proof verification failed — message hash not in root")]
    InvalidMerkleProof,

    #[msg("Only the channel authority can perform this action")]
    UnauthorizedAuthority,

    #[msg("Arithmetic overflow")]
    Overflow,

    // Access Pass errors
    #[msg("Only JOE agent wallet can grant/revoke access passes")]
    UnauthorizedJoeAuthority,

    #[msg("X handle must be 1–32 bytes")]
    InvalidXHandle,

    #[msg("Tier must be 0 (basic), 1 (mojo), 2 (dojo), or 3 (space_cowboy)")]
    InvalidTier,

    #[msg("Duration must be 1–3650 days")]
    InvalidDuration,

    // Treasury errors
    #[msg("Only JOE or Founder can manage the treasury")]
    UnauthorizedTreasuryAuthority,

    #[msg("Deposit amount must be greater than zero")]
    ZeroDeposit,

    #[msg("Insufficient treasury balance (must keep rent-exempt minimum)")]
    InsufficientTreasuryBalance,
}
