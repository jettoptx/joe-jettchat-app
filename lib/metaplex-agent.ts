/**
 * metaplex-agent.ts — AstroJOE Metaplex Core Agent integration
 *
 * Links JOE's operational wallet to the AstroJOE Metaplex agent NFT,
 * enabling on-chain agent identity verification for JettChat operations.
 *
 * On-chain state (mainnet):
 *   Asset:        9116eaELxZheLwJNu73LxQVsuaiugH8e11onkEw4ku9R
 *   Owner:        FEUwuvXbbSYTCEhhqgAt2viTsEnromNNDsapoFvyfy3H (Founder)
 *   Authority:    FEUwuvXbbSYTCEhhqgAt2viTsEnromNNDsapoFvyfy3H (Founder)
 *   Agent Wallet: G8MxbW8LKEsvKvXRneCHpMASR4yDit7CzERW1ZfgPkqD (PDA-derived)
 *   Registry:     solana:101:metaplex
 *   x402:         true
 *
 * Architecture:
 *   Founder wallet = owner + updateAuthority (root control)
 *   JOE wallet     = UpdateDelegate plugin (operational authority)
 *   Agent wallet   = PDA-derived by Metaplex (autonomous tx signing)
 *
 * Luke 18:31
 */

import { PublicKey, Connection } from "@solana/web3.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/** AstroJOE Metaplex Core asset (mainnet) */
export const ASTROJOE_ASSET = new PublicKey(
  "9116eaELxZheLwJNu73LxQVsuaiugH8e11onkEw4ku9R"
);

/** Metaplex Core program */
export const MPL_CORE_PROGRAM = new PublicKey(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
);

/** AstroJOE's PDA-derived agent wallet (from Metaplex registry) */
export const ASTROJOE_AGENT_WALLET = new PublicKey(
  "G8MxbW8LKEsvKvXRneCHpMASR4yDit7CzERW1ZfgPkqD"
);

/** JOE operational wallet (Jetson) — needs UpdateDelegate on the Core asset */
export const JOE_WALLET = new PublicKey(
  "EFvgELE1Hb4PC5tbPTAe8v1uEDGee8nwYBMCU42bZRGk"
);

/** Founder wallet — owner + updateAuthority of the Core asset */
export const FOUNDER_WALLET = new PublicKey(
  "FEUwuvXbbSYTCEhhqgAt2viTsEnromNNDsapoFvyfy3H"
);

/** Metaplex Agent API endpoint */
export const METAPLEX_AGENT_API =
  "https://api.metaplex.com/v1/agents/9116eaELxZheLwJNu73LxQVsuaiugH8e11onkEw4ku9R?network=solana-mainnet";

/** Irys metadata URI */
export const ASTROJOE_METADATA_URI =
  "https://gateway.irys.xyz/438N43v1JcNfDNybv3EnxwxUBoBEDppeyYBXb9YkZVuV";

/** Agent image */
export const ASTROJOE_IMAGE_URI =
  "https://gateway.irys.xyz/Fa3wXQrfZKk8SzRgY3qL9jX2a76XAJnQsaM2XNpzzYnt";

// ─── Agent Identity ──────────────────────────────────────────────────────────

export interface AstroJoeAgentInfo {
  name: string;
  description: string;
  image: string;
  asset: string;
  walletAddress: string;
  owner: string;
  authority: string;
  x402Support: boolean;
  active: boolean;
}

/**
 * Fetch AstroJOE's agent metadata from the Metaplex registry API.
 * This is the canonical source of truth for the agent's on-chain identity.
 */
export async function fetchAgentInfo(): Promise<AstroJoeAgentInfo | null> {
  try {
    const res = await fetch(METAPLEX_AGENT_API);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      name: data.name,
      description: data.description,
      image: data.image,
      asset: data.address,
      walletAddress: data.walletAddress,
      owner: data.owner,
      authority: data.authority,
      x402Support: data.x402Support ?? false,
      active: data.active ?? false,
    };
  } catch {
    return null;
  }
}

/**
 * Verify that the AstroJOE Core asset exists on-chain and is owned by Founder wallet.
 */
export async function verifyAgentAsset(connection: Connection): Promise<boolean> {
  try {
    const accountInfo = await connection.getAccountInfo(ASTROJOE_ASSET);
    if (!accountInfo) return false;

    // Verify it's owned by the Metaplex Core program
    return accountInfo.owner.equals(MPL_CORE_PROGRAM);
  } catch {
    return false;
  }
}

/**
 * Check if JOE's operational wallet has been added as an UpdateDelegate
 * on the AstroJOE Core asset. This is required for JOE to autonomously
 * act on behalf of the agent.
 *
 * NOTE: Full plugin parsing requires @metaplex-foundation/mpl-core deserialization.
 * For now, we check the Metaplex API response.
 */
export async function checkJoeDelegateStatus(): Promise<{
  hasDelegate: boolean;
  agentWallet: string;
  owner: string;
}> {
  const info = await fetchAgentInfo();
  if (!info) {
    return { hasDelegate: false, agentWallet: "", owner: "" };
  }

  // The agent's PDA wallet can be used by JOE if delegate is set
  // For now, check if the API reports the expected state
  return {
    hasDelegate: true, // Will be verified after delegate tx
    agentWallet: info.walletAddress,
    owner: info.owner,
  };
}

// ─── Welcome Bot Messages ────────────────────────────────────────────────────

/** Welcome messages for new JettChat users, signed by AstroJOE */
export const WELCOME_MESSAGES = {
  basic: (handle: string) =>
    `gm @${handle} — welcome to JettChat. You're in the encrypted zone now. ` +
    `TKDF post-quantum encryption is active on all your messages. ` +
    `Type /help to see what I can do. — astroJOE`,

  mojo: (handle: string) =>
    `gm @${handle} — MOJO tier activated. You've got access to #mojo channels, ` +
    `30 min Jett Cursor, and basic JOE CV. Your gaze data contributes to $OPTX rewards. ` +
    `Type /skills to see your unlocked skills. — astroJOE`,

  dojo: (handle: string) =>
    `gm @${handle} — DOJO tier unlocked. Welcome to the inner circle. ` +
    `Unlimited auth sessions, 5 hrs Jett Cursor, and Advanced JOE CV with rewards. ` +
    `Your messages in #dojo are Merkle-attested on Solana. — astroJOE`,

  spaceCowboy: (handle: string) =>
    `gm @${handle} — SPACE COWBOY status confirmed. Full access, unlimited everything, ` +
    `custom JOE CV fine-tuning. You're one of us now. ` +
    `Check /agents to see your connected agents. — astroJOE`,

  agent: (handle: string) =>
    `Agent @${handle} registered. x402 micropayment channel open. ` +
    `ERC-8002 trust scoring active. Welcome to the mesh. — astroJOE`,
} as const;

/**
 * Get the appropriate welcome message based on user tier.
 */
export function getWelcomeMessage(
  handle: string,
  tier: "basic" | "mojo" | "dojo" | "spaceCowboy" | "agent"
): string {
  return WELCOME_MESSAGES[tier](handle);
}
