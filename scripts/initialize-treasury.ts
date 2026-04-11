#!/usr/bin/env npx ts-node
/**
 * initialize-treasury.ts — Initialize AstroJOE AgentTreasury PDA on Solana devnet
 *
 * Creates the on-chain treasury vault for AstroJOE using the Metaplex Core
 * asset ID as the seed. The treasury tracks deposits, withdrawals, and
 * operating mode (GROWTH → NORMAL → SURVIVAL → EMERGENCY).
 *
 * Must be run by Founder or JOE wallet (both are authorized).
 *
 * Usage:
 *   FOUNDER_KEYPAIR=~/.config/solana/id.json npx ts-node scripts/initialize-treasury.ts
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
  LAMPORTS_PER_SOL,
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

// AstroJOE Metaplex Core Asset (mainnet — used as PDA seed)
const ASTROJOE_ASSET = new PublicKey(
  "9116eaELxZheLwJNu73LxQVsuaiugH8e11onkEw4ku9R"
);

// Monthly operating cost estimate: ~0.1 SOL (covers rent, tx fees on devnet)
const MONTHLY_COST_LAMPORTS = BigInt(Math.floor(0.1 * LAMPORTS_PER_SOL));

// Survival threshold: 3 months of reserves
const SURVIVAL_THRESHOLD_MONTHS = 3;

// ─── Anchor discriminator helper ─────────────────────────────────────────────

function anchorDiscriminator(namespace: string, name: string): Buffer {
  const hash = createHash("sha256")
    .update(`${namespace}:${name}`)
    .digest();
  return hash.slice(0, 8);
}

// ─── Instruction builder ─────────────────────────────────────────────────────

function buildInitializeTreasuryIx(
  authority: PublicKey,
  monthlyCostLamports: bigint,
  survivalThresholdMonths: number,
): TransactionInstruction {
  // Derive AgentTreasury PDA
  const [treasuryPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent_treasury"), ASTROJOE_ASSET.toBuffer()],
    PROGRAM_ID
  );

  // Anchor instruction data:
  //   [8 bytes discriminator] [8 bytes u64 monthly_cost] [1 byte u8 threshold]
  const discriminator = anchorDiscriminator("global", "initialize_treasury");
  const costBytes = Buffer.alloc(8);
  costBytes.writeBigUInt64LE(monthlyCostLamports);
  const thresholdByte = Buffer.from([survivalThresholdMonths]);

  const data = Buffer.concat([discriminator, costBytes, thresholdByte]);

  // Account metas match InitializeTreasury struct:
  //   authority (signer, writable — pays rent)
  //   agent_asset (read — unchecked, used for PDA seed)
  //   treasury (init, writable)
  //   system_program (read)
  const keys = [
    { pubkey: authority, isSigner: true, isWritable: true },
    { pubkey: ASTROJOE_ASSET, isSigner: false, isWritable: false },
    { pubkey: treasuryPDA, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== AstroJOE Treasury Initialization ===\n");
  console.log(`Program: ${PROGRAM_ID.toBase58()}`);
  console.log(`Agent Asset: ${ASTROJOE_ASSET.toBase58()}`);
  console.log(`Monthly cost: ${Number(MONTHLY_COST_LAMPORTS) / LAMPORTS_PER_SOL} SOL`);
  console.log(`Survival threshold: ${SURVIVAL_THRESHOLD_MONTHS} months\n`);

  // Load keypair
  const keypairPath =
    process.env.FOUNDER_KEYPAIR ?? `${process.env.HOME}/.config/solana/id.json`;
  console.log(`Loading keypair from: ${keypairPath}`);

  let signer: Keypair;
  try {
    const raw = JSON.parse(readFileSync(keypairPath, "utf-8"));
    signer = Keypair.fromSecretKey(new Uint8Array(raw));
  } catch (err) {
    console.error("Failed to load keypair:", err);
    console.error("Set FOUNDER_KEYPAIR env var to your keypair file path.");
    process.exit(1);
  }

  console.log(`Signer: ${signer.publicKey.toBase58()}\n`);

  const connection = new Connection(RPC_URL, "confirmed");

  // Check if already initialized
  const [treasuryPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent_treasury"), ASTROJOE_ASSET.toBuffer()],
    PROGRAM_ID
  );

  const existing = await connection.getAccountInfo(treasuryPDA);
  if (existing) {
    console.log(`✓ Treasury already initialized (${treasuryPDA.toBase58()})`);
    return;
  }

  console.log("Initializing AstroJOE treasury...");

  const ix = buildInitializeTreasuryIx(
    signer.publicKey,
    MONTHLY_COST_LAMPORTS,
    SURVIVAL_THRESHOLD_MONTHS,
  );

  const tx = new Transaction().add(ix);
  try {
    const sig = await sendAndConfirmTransaction(connection, tx, [signer], {
      commitment: "confirmed",
    });
    console.log(`\n✓ AstroJOE Treasury initialized!`);
    console.log(`  PDA: ${treasuryPDA.toBase58()}`);
    console.log(`  Monthly cost: ${Number(MONTHLY_COST_LAMPORTS) / LAMPORTS_PER_SOL} SOL`);
    console.log(`  Mode: GROWTH (0)`);
    console.log(`  Tx: ${sig}`);
    console.log(`\n  Fund it: solana transfer ${treasuryPDA.toBase58()} 1 --allow-unfunded-recipient`);
  } catch (err: any) {
    console.error("Failed to initialize treasury:", err?.message || err);
    process.exit(1);
  }
}

main().catch(console.error);
