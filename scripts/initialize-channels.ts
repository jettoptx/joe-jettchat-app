#!/usr/bin/env npx ts-node
/**
 * initialize-channels.ts — Initialize ChannelState PDAs on Solana devnet
 *
 * Creates on-chain ChannelState for #dojo, #mojo, and #intro.
 * Must be run by the Founder wallet (authority for initialize_channel).
 *
 * Usage:
 *   FOUNDER_KEYPAIR=~/.config/solana/id.json npx ts-node scripts/initialize-channels.ts
 *
 * Luke 18:31
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { readFileSync } from "fs";
import { createHash } from "crypto";

// ─── Config ──────────────────────────────────────────────────────────────────

const RPC_URL =
  process.env.RPC_URL ??
  "https://devnet.helius-rpc.com/?api-key=98ca6456-20a8-4518-8393-1b9ee6c2b7f3";

const PROGRAM_ID = new PublicKey(
  "wLiceDyLcJAg3SeB86ccnqWgB4Ss7YprqApaP9kaXhY"
);

// $JTX governance token mint (mainnet — stored as reference in channel state)
const JTX_MINT = new PublicKey(
  "9XpJiKEYzq5yDo5pJzRfjSRMPL2yPfDQXgiN7uYtBhUj"
);

// Channels to initialize
const CHANNELS = [
  { slug: "#intro", stakeRequired: 1 },    // Public — 1 JTX (effectively open)
  { slug: "#mojo", stakeRequired: 12 },     // MOJO tier
  { slug: "#dojo", stakeRequired: 444 },    // DOJO tier
];

// ─── Anchor discriminator helper ─────────────────────────────────────────────

function anchorDiscriminator(namespace: string, name: string): Buffer {
  const hash = createHash("sha256")
    .update(`${namespace}:${name}`)
    .digest();
  return hash.slice(0, 8);
}

// ─── Instruction builder ─────────────────────────────────────────────────────

function buildInitializeChannelIx(
  authority: PublicKey,
  slug: string,
  jtxStakeRequired: bigint,
): TransactionInstruction {
  // Derive ChannelState PDA
  const [channelState] = PublicKey.findProgramAddressSync(
    [Buffer.from("channel"), Buffer.from(slug)],
    PROGRAM_ID
  );

  // Anchor instruction data:
  //   [8 bytes discriminator] [4 bytes string len + string bytes] [8 bytes u64]
  const discriminator = anchorDiscriminator("global", "initialize_channel");
  const slugBytes = Buffer.from(slug, "utf-8");
  const slugLen = Buffer.alloc(4);
  slugLen.writeUInt32LE(slugBytes.length);
  const stakeBytes = Buffer.alloc(8);
  stakeBytes.writeBigUInt64LE(jtxStakeRequired);

  const data = Buffer.concat([discriminator, slugLen, slugBytes, stakeBytes]);

  // Account metas match InitializeChannel struct:
  //   channel_state (init, writable)
  //   jtx_mint (read)
  //   authority (signer, writable — pays rent)
  //   system_program (read)
  const keys = [
    { pubkey: channelState, isSigner: false, isWritable: true },
    { pubkey: JTX_MINT, isSigner: false, isWritable: false },
    { pubkey: authority, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== JettChat Channel Initialization ===\n");
  console.log(`Program: ${PROGRAM_ID.toBase58()}`);
  console.log(`RPC: ${RPC_URL.split("?")[0]}...\n`);

  // Load Founder keypair
  const keypairPath =
    process.env.FOUNDER_KEYPAIR ?? `${process.env.HOME}/.config/solana/id.json`;
  console.log(`Loading keypair from: ${keypairPath}`);

  let founder: Keypair;
  try {
    const raw = JSON.parse(readFileSync(keypairPath, "utf-8"));
    founder = Keypair.fromSecretKey(new Uint8Array(raw));
  } catch (err) {
    console.error("Failed to load keypair:", err);
    console.error("Set FOUNDER_KEYPAIR env var to your keypair file path.");
    process.exit(1);
  }

  console.log(`Founder: ${founder.publicKey.toBase58()}\n`);

  const connection = new Connection(RPC_URL, "confirmed");

  for (const ch of CHANNELS) {
    const [channelPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("channel"), Buffer.from(ch.slug)],
      PROGRAM_ID
    );

    // Check if already initialized
    const existing = await connection.getAccountInfo(channelPDA);
    if (existing) {
      console.log(`✓ ${ch.slug} already initialized (${channelPDA.toBase58()})`);
      continue;
    }

    console.log(`Initializing ${ch.slug} (stake: ${ch.stakeRequired} JTX)...`);

    const ix = buildInitializeChannelIx(
      founder.publicKey,
      ch.slug,
      BigInt(ch.stakeRequired),
    );

    const tx = new Transaction().add(ix);
    try {
      const sig = await sendAndConfirmTransaction(connection, tx, [founder], {
        commitment: "confirmed",
      });
      console.log(`  ✓ ${ch.slug} initialized!`);
      console.log(`    PDA: ${channelPDA.toBase58()}`);
      console.log(`    Tx: ${sig}\n`);
    } catch (err: any) {
      console.error(`  ✗ ${ch.slug} failed:`, err?.message || err);
    }
  }

  console.log("\nDone.");
}

main().catch(console.error);
