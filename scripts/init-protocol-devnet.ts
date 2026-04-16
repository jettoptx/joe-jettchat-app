#!/usr/bin/env npx ts-node
/**
 * init-protocol-devnet.ts — One-time initialization for Jett Optical Trust Protocol
 *
 * Steps performed:
 *   1. Load a funded devnet keypair (defaults to ~/.config/solana/id.json)
 *   2. Create the OPTX Token-2022 mint (or reuse if it already exists)
 *   3. Derive the protocol-config PDA
 *   4. Set the mint authority to the protocol-config PDA (Token-2022 SetAuthority)
 *   5. Call `initialize` on the program to create the ProtocolConfig account
 *   6. Print all addresses for use as env vars
 *
 * Usage:
 *   KEYPAIR=~/.config/solana/id.json npx ts-node scripts/init-protocol-devnet.ts
 *
 * Env vars:
 *   KEYPAIR       — path to funded devnet keypair (default: ~/.config/solana/id.json)
 *   RPC_URL       — Solana RPC endpoint (default: Helius devnet)
 *
 * Luke 18:31
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createInitializeMint2Instruction,
  createSetAuthorityInstruction,
  AuthorityType,
  TOKEN_2022_PROGRAM_ID,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
} from "@solana/spl-token";
import { AnchorProvider, Program, BN, type Idl } from "@coral-xyz/anchor";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { createHash } from "crypto";

// ─── Config ──────────────────────────────────────────────────────────────────

const RPC_URL =
  process.env.RPC_URL ??
  "https://devnet.helius-rpc.com/?api-key=98ca6456-20a8-4518-8393-1b9ee6c2b7f3";

const PROGRAM_ID = new PublicKey(
  "79nQsecDspUWxvAMyJvK36EUty4yEoP5ssLvHZuNiugF"
);

const JTX_MINT = new PublicKey(
  "9XpJiKEYzq5yDo5pJzRfjSRMPL2yPfDQXgiN7uYtBhUj"
);

const CSTB_MINT_DEVNET = new PublicKey(
  "4waAAfTjqf5LNpj2TC5zoeiAgegVwKWoy4WiJgjdBkVL"
);

// Pre-existing devnet OPTX mint — we'll try to use this first
const EXISTING_OPTX_MINT = new PublicKey(
  "4r9WxVWBNMphYfSyGBuMFYRLsLEnzUNquJPnpFessXRH"
);

// Protocol defaults
const GAZE_THRESHOLD = 4000n;         // minimum gaze entropy for a valid attestation
const COMPUTE_DIFFICULTY_MIN = 2;     // minimum compute difficulty
const ENTROPY_PER_ATTESTATION = 8000n;
const OPTX_PER_ENTROPY = 1n;          // 1 OPTX per entropy unit

// ─── Minimal IDL for the initialize instruction ───────────────────────────────

const INIT_IDL: Idl = {
  version: "0.1.0",
  name: "jett_optical_trust",
  address: PROGRAM_ID.toBase58(),
  metadata: { address: PROGRAM_ID.toBase58() },
  instructions: [
    {
      name: "initialize",
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237],
      accounts: [
        { name: "authority", isMut: true, isSigner: true },
        { name: "protocolConfig", isMut: true, isSigner: false },
        { name: "jtxMint", isMut: false, isSigner: false },
        { name: "cstbMint", isMut: false, isSigner: false },
        { name: "optxMint", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "gazeThreshold", type: "u64" },
        { name: "computeDifficultyMin", type: "u8" },
        { name: "entropyPerAttestation", type: "u64" },
        { name: "optxPerEntropy", type: "u64" },
      ],
    },
  ],
  accounts: [
    { name: "ProtocolConfig", discriminator: [25, 20, 44, 198, 102, 168, 61, 1] },
  ],
  types: [],
  errors: [],
};

// ─── PDA helper ───────────────────────────────────────────────────────────────

function deriveProtocolConfig(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("protocol-config")],
    PROGRAM_ID
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Jett Optical Trust Protocol — Devnet Init ===\n");

  // Load keypair
  const keypairPath =
    process.env.KEYPAIR ??
    process.env.FOUNDER_KEYPAIR ??
    `${homedir()}/.config/solana/id.json`;

  if (!existsSync(keypairPath)) {
    console.error(`Keypair not found at: ${keypairPath}`);
    console.error("Generate one with: solana-keygen new --outfile ~/.config/solana/id.json");
    console.error("Then airdrop: solana airdrop 2 --url devnet");
    process.exit(1);
  }

  let authority: Keypair;
  try {
    const raw = JSON.parse(readFileSync(keypairPath, "utf-8"));
    authority = Keypair.fromSecretKey(new Uint8Array(raw));
  } catch (err) {
    console.error("Failed to load keypair:", err);
    process.exit(1);
  }

  console.log(`Program    : ${PROGRAM_ID.toBase58()}`);
  console.log(`Authority  : ${authority.publicKey.toBase58()}`);
  console.log(`RPC        : ${RPC_URL}\n`);

  const connection = new Connection(RPC_URL, "confirmed");

  // Check balance
  const balance = await connection.getBalance(authority.publicKey);
  console.log(`Balance    : ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  if (balance < 0.05 * LAMPORTS_PER_SOL) {
    console.error("\nInsufficient balance. Airdrop first:");
    console.error(`  solana airdrop 2 ${authority.publicKey.toBase58()} --url devnet`);
    process.exit(1);
  }

  // ── Derive protocol-config PDA ────────────────────────────────────────────
  const [configPDA, configBump] = deriveProtocolConfig();
  console.log(`\nProtocol Config PDA : ${configPDA.toBase58()} (bump: ${configBump})`);

  const existingConfig = await connection.getAccountInfo(configPDA);
  if (existingConfig) {
    console.log("Protocol already initialized.");
    printEnvVars(configPDA, EXISTING_OPTX_MINT, authority.publicKey);
    return;
  }

  // ── Resolve OPTX mint ─────────────────────────────────────────────────────
  let optxMint: PublicKey;
  const existingMintInfo = await connection.getAccountInfo(EXISTING_OPTX_MINT);

  if (existingMintInfo) {
    console.log(`\nReusing existing OPTX mint: ${EXISTING_OPTX_MINT.toBase58()}`);
    optxMint = EXISTING_OPTX_MINT;
    // Note: if this mint's authority is already set to configPDA we can skip SetAuthority.
    // If it's still the authority keypair, we need to transfer it.
    console.log("  (Make sure mint authority is or will be transferred to protocol config PDA)");
  } else {
    console.log("\nCreating new Token-2022 OPTX mint...");
    optxMint = await createToken2022Mint(connection, authority, configPDA);
    console.log(`  OPTX Mint: ${optxMint.toBase58()}`);
  }

  // ── Call program initialize ───────────────────────────────────────────────
  console.log("\nInitializing protocol on-chain...");

  // Build a minimal NodeWallet-compatible wrapper around the Keypair
  const nodeWallet = {
    publicKey: authority.publicKey,
    signTransaction: async (tx: Transaction) => {
      tx.partialSign(authority);
      return tx;
    },
    signAllTransactions: async (txs: Transaction[]) => {
      txs.forEach((tx) => tx.partialSign(authority));
      return txs;
    },
  };

  const provider = new AnchorProvider(connection, nodeWallet as any, {
    commitment: "confirmed",
  });

  const program = new Program(INIT_IDL, provider);

  try {
    const sig = await (program.methods as any)
      .initialize(
        new BN(GAZE_THRESHOLD.toString()),
        COMPUTE_DIFFICULTY_MIN,
        new BN(ENTROPY_PER_ATTESTATION.toString()),
        new BN(OPTX_PER_ENTROPY.toString())
      )
      .accounts({
        authority: authority.publicKey,
        protocolConfig: configPDA,
        jtxMint: JTX_MINT,
        cstbMint: CSTB_MINT_DEVNET,
        optxMint,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc({ commitment: "confirmed" });

    console.log(`\n  Protocol initialized!`);
    console.log(`  Tx: ${sig}`);
    console.log(`  Explorer: https://solscan.io/tx/${sig}?cluster=devnet`);
  } catch (err: any) {
    console.error("\nInitialize failed:", err?.message ?? err);
    console.error("\nThis likely means:");
    console.error("  1. The program is not deployed at this address on devnet, OR");
    console.error("  2. The program's IDL differs from this script's IDL, OR");
    console.error("  3. The OPTX mint authority is not the keypair (for existing mints).");
    console.error("\nDeploy the program first:");
    console.error("  anchor build && anchor deploy --provider.cluster devnet");
    process.exit(1);
  }

  printEnvVars(configPDA, optxMint, authority.publicKey);
}

// ─── Create Token-2022 mint ───────────────────────────────────────────────────

async function createToken2022Mint(
  connection: Connection,
  authority: Keypair,
  mintAuthority: PublicKey
): Promise<PublicKey> {
  // Generate a fresh mint keypair
  const mintKeypair = Keypair.generate();
  const lamports = await getMinimumBalanceForRentExemptMint(connection);

  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: authority.publicKey,
    newAccountPubkey: mintKeypair.publicKey,
    space: MINT_SIZE,
    lamports,
    programId: TOKEN_2022_PROGRAM_ID,
  });

  const initMintIx = createInitializeMint2Instruction(
    mintKeypair.publicKey,
    9,             // 9 decimals (like SOL)
    mintAuthority, // mint authority = protocol config PDA
    null,          // no freeze authority
    TOKEN_2022_PROGRAM_ID
  );

  const tx = new Transaction().add(createAccountIx, initMintIx);
  await sendAndConfirmTransaction(connection, tx, [authority, mintKeypair], {
    commitment: "confirmed",
  });

  return mintKeypair.publicKey;
}

// ─── Print env vars ───────────────────────────────────────────────────────────

function printEnvVars(
  configPDA: PublicKey,
  optxMint: PublicKey,
  authority: PublicKey
) {
  console.log("\n=== Add these to your .env.local ===");
  console.log(`NEXT_PUBLIC_OPTX_PROGRAM_ID=79nQsecDspUWxvAMyJvK36EUty4yEoP5ssLvHZuNiugF`);
  console.log(`NEXT_PUBLIC_OPTX_CONFIG_PDA=${configPDA.toBase58()}`);
  console.log(`NEXT_PUBLIC_OPTX_MINT_DEVNET=${optxMint.toBase58()}`);
  console.log(`NEXT_PUBLIC_PROTOCOL_AUTHORITY=${authority.toBase58()}`);
  console.log(`NEXT_PUBLIC_HELIUS_RPC_URL=https://devnet.helius-rpc.com/?api-key=98ca6456-20a8-4518-8393-1b9ee6c2b7f3`);
  console.log("\n=== Solana Explorer ===");
  console.log(`Config PDA : https://solscan.io/account/${configPDA.toBase58()}?cluster=devnet`);
  console.log(`OPTX Mint  : https://solscan.io/token/${optxMint.toBase58()}?cluster=devnet`);
  console.log(`Program    : https://solscan.io/account/79nQsecDspUWxvAMyJvK36EUty4yEoP5ssLvHZuNiugF?cluster=devnet`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
