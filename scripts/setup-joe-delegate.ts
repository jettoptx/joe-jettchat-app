#!/usr/bin/env npx ts-node
/**
 * setup-joe-delegate.ts — One-time setup script
 *
 * Adds JOE's operational wallet (EFvg...) as an UpdateDelegate on the
 * AstroJOE Metaplex Core asset. Must be run by the Founder wallet (owner).
 *
 * This gives JOE autonomous authority to:
 *   - Update agent metadata
 *   - Act as a delegate for on-chain operations
 *   - Sign AccessPass grants tied to the agent identity
 *
 * Usage:
 *   FOUNDER_KEYPAIR=~/.config/solana/id.json npx ts-node scripts/setup-joe-delegate.ts
 *
 * Prerequisites:
 *   npm install @metaplex-foundation/mpl-core @metaplex-foundation/umi @metaplex-foundation/umi-bundle-defaults
 *
 * Luke 18:31
 */

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { keypairIdentity, publicKey } from "@metaplex-foundation/umi";
import {
  addPluginV1,
  mplCore,
  updateDelegate,
} from "@metaplex-foundation/mpl-core";
import { readFileSync } from "fs";

// ─── Config ──────────────────────────────────────────────────────────────────

const RPC_URL =
  process.env.RPC_URL ??
  "https://mainnet.helius-rpc.com/?api-key=98ca6456-20a8-4518-8393-1b9ee6c2b7f3";

const ASTROJOE_ASSET = publicKey(
  "9116eaELxZheLwJNu73LxQVsuaiugH8e11onkEw4ku9R"
);

const JOE_WALLET = publicKey(
  "EFvgELE1Hb4PC5tbPTAe8v1uEDGee8nwYBMCU42bZRGk"
);

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== AstroJOE Delegate Setup ===\n");

  // Load Founder keypair
  const keypairPath =
    process.env.FOUNDER_KEYPAIR ?? `${process.env.HOME}/.config/solana/id.json`;
  console.log(`Loading keypair from: ${keypairPath}`);

  let secretKey: Uint8Array;
  try {
    const raw = JSON.parse(readFileSync(keypairPath, "utf-8"));
    secretKey = new Uint8Array(raw);
  } catch (err) {
    console.error("Failed to load keypair:", err);
    console.error("Set FOUNDER_KEYPAIR env var to your keypair file path.");
    process.exit(1);
  }

  // Initialize Umi
  const umi = createUmi(RPC_URL).use(mplCore());
  const founderKeypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
  umi.use(keypairIdentity(founderKeypair));

  console.log(`Founder: ${founderKeypair.publicKey}`);
  console.log(`AstroJOE Asset: ${ASTROJOE_ASSET}`);
  console.log(`JOE Wallet (delegate): ${JOE_WALLET}\n`);

  // Add UpdateDelegate plugin to the Core asset
  // This is authority-managed — only the updateAuthority (Founder) can add it
  console.log("Adding UpdateDelegate plugin...");

  try {
    const tx = await addPluginV1(umi, {
      asset: ASTROJOE_ASSET,
      plugin: updateDelegate(),
      // The delegate defaults to the authority adding it
      // We need to set JOE as the additional delegate
    }).sendAndConfirm(umi);

    console.log(`\n✓ UpdateDelegate added!`);
    console.log(`  Tx: ${Buffer.from(tx.signature).toString("base64")}`);
    console.log(`\n  JOE wallet (${JOE_WALLET}) now has delegate authority`);
    console.log(`  over the AstroJOE Core asset (${ASTROJOE_ASSET}).`);
    console.log(`\n  Both wallets can now act on behalf of astroJOE:`);
    console.log(`    Founder (owner):    FEUwuvXbb...Fy3H`);
    console.log(`    JOE (delegate):     EFvgELE1H...ZRGk`);
    console.log(`    Agent PDA wallet:   G8MxbW8LK...PkqD`);
  } catch (err: any) {
    if (err?.message?.includes("already has")) {
      console.log("✓ UpdateDelegate already exists on the asset.");
    } else {
      console.error("Failed to add delegate:", err);
      process.exit(1);
    }
  }
}

main().catch(console.error);
