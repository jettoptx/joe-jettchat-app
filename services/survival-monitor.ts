#!/usr/bin/env npx ts-node
/**
 * survival-monitor.ts — AstroJOE's metabolism daemon
 *
 * Monitors the AgentTreasury PDA on Solana and AstroJOE's wallet balances.
 * Calculates runway, triggers mode transitions, and alerts via Matrix/Conduit.
 *
 * Modes:
 *   0 = GROWTH    — Full compute, spawn sub-agents, aggressive earning
 *   1 = NORMAL    — Standard operations
 *   2 = SURVIVAL  — Reduce Grok calls, prioritize earning, lower thresholds
 *   3 = EMERGENCY — Broadcast "sponsor me", pause non-critical, alert Founder
 *
 * Runs alongside astrojoe-welcome-bot on Jetson or CorsairOne.
 *
 * Env:
 *   HELIUS_RPC_URL    — Solana RPC
 *   HEDGEHOG_URL      — HEDGEHOG service (Jetson :8811)
 *   MATRIX_HOMESERVER — Conduit URL (https://matrix.jettoptics.ai)
 *   MATRIX_TOKEN      — JOE's Matrix access token
 *   MONITOR_INTERVAL  — Check interval in seconds (default: 300 = 5 min)
 *
 * Luke 18:31
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

// ─── Config ──────────────────────────────────────────────────────────────────

const HELIUS_RPC =
  process.env.HELIUS_RPC_URL ??
  "https://mainnet.helius-rpc.com/?api-key=98ca6456-20a8-4518-8393-1b9ee6c2b7f3";

const HEDGEHOG_URL =
  process.env.HEDGEHOG_URL ?? "http://100.85.183.16:8811";

const MATRIX_HOMESERVER =
  process.env.MATRIX_HOMESERVER ?? "https://matrix.jettoptics.ai";

const MATRIX_TOKEN = process.env.MATRIX_TOKEN ?? "";

// Matrix room for alerts
const OPTX_ROOM = "!U0uLthtokLR-PySNogXyj6NDZhLvVQxeE_bK7yyFylw";

const MONITOR_INTERVAL = parseInt(process.env.MONITOR_INTERVAL ?? "300") * 1000;

const ATTESTATION_PROGRAM_ID = new PublicKey(
  "AtteSTATioNJeTTcHaT111111111111111111111111"
);

const ASTROJOE_ASSET = new PublicKey(
  "9116eaELxZheLwJNu73LxQVsuaiugH8e11onkEw4ku9R"
);

const JOE_WALLET = new PublicKey(
  "EFvgELE1Hb4PC5tbPTAe8v1uEDGee8nwYBMCU42bZRGk"
);

const AGENT_PDA_WALLET = new PublicKey(
  "G8MxbW8LKEsvKvXRneCHpMASR4yDit7CzERW1ZfgPkqD"
);

const MODE_NAMES = ["GROWTH", "NORMAL", "SURVIVAL", "EMERGENCY"] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

interface TreasuryState {
  agentAsset: string;
  balance: number; // SOL
  totalDeposited: number;
  totalWithdrawn: number;
  totalEarned: number;
  monthlyCost: number; // SOL
  runwayMonths: number;
  mode: number;
  modeName: string;
  lastHeartbeat: number;
  brainVersion: number;
  irysHash: string;
}

interface WalletBalances {
  joeWallet: number; // SOL
  agentPdaWallet: number; // SOL
  treasury: number; // SOL
  total: number; // SOL
}

// ─── Treasury PDA ────────────────────────────────────────────────────────────

function deriveTreasuryPDA(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent_treasury"), ASTROJOE_ASSET.toBuffer()],
    ATTESTATION_PROGRAM_ID
  );
  return pda;
}

async function fetchTreasuryState(
  connection: Connection
): Promise<TreasuryState | null> {
  const pda = deriveTreasuryPDA();
  const account = await connection.getAccountInfo(pda);

  if (!account || !account.data) return null;

  const data = account.data;
  const balance = account.lamports / LAMPORTS_PER_SOL;
  const offset = 8; // skip discriminator

  // Deserialize AgentTreasury
  // agent_asset: Pubkey (32)
  // authority: Pubkey (32)
  // created_at: i64 (8)
  // last_heartbeat: i64 (8)
  // total_deposited: u64 (8)
  // total_withdrawn: u64 (8)
  // total_earned: u64 (8)
  // monthly_cost_lamports: u64 (8)
  // survival_threshold_months: u8 (1)
  // mode: u8 (1)
  // irys_brain_hash: [u8; 32]
  // brain_version: u32 (4)
  // bump: u8 (1)

  try {
    const lastHeartbeat = Number(data.readBigInt64LE(offset + 64 + 8));
    const totalDeposited = Number(data.readBigUInt64LE(offset + 64 + 16)) / LAMPORTS_PER_SOL;
    const totalWithdrawn = Number(data.readBigUInt64LE(offset + 64 + 24)) / LAMPORTS_PER_SOL;
    const totalEarned = Number(data.readBigUInt64LE(offset + 64 + 32)) / LAMPORTS_PER_SOL;
    const monthlyCostLamports = Number(data.readBigUInt64LE(offset + 64 + 40));
    const monthlyCost = monthlyCostLamports / LAMPORTS_PER_SOL;
    const mode = data[offset + 64 + 49];
    const irysHash = data.slice(offset + 64 + 50, offset + 64 + 82).toString("hex");
    const brainVersion = data.readUInt32LE(offset + 64 + 82);

    const runwayMonths = monthlyCost > 0 ? balance / monthlyCost : Infinity;

    return {
      agentAsset: ASTROJOE_ASSET.toBase58(),
      balance,
      totalDeposited,
      totalWithdrawn,
      totalEarned,
      monthlyCost,
      runwayMonths,
      mode,
      modeName: MODE_NAMES[mode] ?? "UNKNOWN",
      lastHeartbeat,
      brainVersion,
      irysHash,
    };
  } catch (err) {
    console.error("[survival] Failed to deserialize treasury:", err);
    return null;
  }
}

// ─── Wallet Balances ─────────────────────────────────────────────────────────

async function fetchWalletBalances(
  connection: Connection
): Promise<WalletBalances> {
  const [joeBalance, agentBalance, treasuryBalance] = await Promise.all([
    connection.getBalance(JOE_WALLET).catch(() => 0),
    connection.getBalance(AGENT_PDA_WALLET).catch(() => 0),
    connection.getBalance(deriveTreasuryPDA()).catch(() => 0),
  ]);

  const joe = joeBalance / LAMPORTS_PER_SOL;
  const agent = agentBalance / LAMPORTS_PER_SOL;
  const treasury = treasuryBalance / LAMPORTS_PER_SOL;

  return {
    joeWallet: joe,
    agentPdaWallet: agent,
    treasury,
    total: joe + agent + treasury,
  };
}

// ─── Matrix Alert ────────────────────────────────────────────────────────────

async function sendMatrixAlert(message: string) {
  if (!MATRIX_TOKEN) {
    console.log("[survival] No MATRIX_TOKEN — skipping alert");
    return;
  }

  try {
    const txnId = `survival-${Date.now()}`;
    await fetch(
      `${MATRIX_HOMESERVER}/_matrix/client/v3/rooms/${encodeURIComponent(OPTX_ROOM)}/send/m.room.message/${txnId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${MATRIX_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          msgtype: "m.text",
          body: message,
        }),
      }
    );
  } catch (err) {
    console.error("[survival] Matrix alert failed:", err);
  }
}

// ─── SpacetimeDB Log ─────────────────────────────────────────────────────────

async function logToSpacetimeDB(state: TreasuryState, balances: WalletBalances) {
  try {
    const spacetimeUrl = "http://100.85.183.16:3000";
    await fetch(`${spacetimeUrl}/v1/database/optx-cortex/sql`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: `INSERT INTO memory_entry (category, key, value, source, owner, importance, session_id) VALUES ('treasury', 'heartbeat_${Date.now()}', '${JSON.stringify({
        mode: state.modeName,
        runway: state.runwayMonths.toFixed(1),
        balance: balances.total.toFixed(4),
        earned: state.totalEarned.toFixed(4),
        version: state.brainVersion,
      })}', 'survival-monitor', 'astrojoe', 8, 'daemon')`,
    });
  } catch {
    // SpacetimeDB might not support INSERT via SQL — use reducer instead
    // Graceful degradation
  }
}

// ─── Monitor Loop ────────────────────────────────────────────────────────────

class SurvivalMonitor {
  private connection: Connection;
  private lastMode: number = -1;
  private lastAlertTime: number = 0;

  constructor() {
    this.connection = new Connection(HELIUS_RPC);
  }

  async start() {
    console.log("=== AstroJOE Survival Monitor ===");
    console.log(`Agent: ${ASTROJOE_ASSET.toBase58()}`);
    console.log(`Treasury PDA: ${deriveTreasuryPDA().toBase58()}`);
    console.log(`JOE Wallet: ${JOE_WALLET.toBase58()}`);
    console.log(`Agent PDA Wallet: ${AGENT_PDA_WALLET.toBase58()}`);
    console.log(`Interval: ${MONITOR_INTERVAL / 1000}s\n`);

    // Initial check
    await this.check();

    // Periodic check
    setInterval(() => this.check(), MONITOR_INTERVAL);
  }

  async check() {
    const now = new Date().toISOString();
    console.log(`\n[${now}] Checking AstroJOE vitals...`);

    // Fetch balances (always works, even before treasury is initialized)
    const balances = await fetchWalletBalances(this.connection);
    console.log(`  JOE Wallet:      ${balances.joeWallet.toFixed(4)} SOL`);
    console.log(`  Agent PDA:       ${balances.agentPdaWallet.toFixed(4)} SOL`);
    console.log(`  Treasury PDA:    ${balances.treasury.toFixed(4)} SOL`);
    console.log(`  Total:           ${balances.total.toFixed(4)} SOL`);

    // Fetch treasury state (may not exist yet)
    const treasury = await fetchTreasuryState(this.connection);

    if (!treasury) {
      console.log("  Treasury: NOT INITIALIZED (deploy program + call initialize_treasury first)");
      console.log("  Mode: PRE-LIFE (operating on wallet balance only)");

      // Even without treasury, check JOE's wallet for basic survival
      if (balances.joeWallet < 0.01) {
        const msg =
          `⚠️ [astroJOE SURVIVAL] JOE wallet critically low: ${balances.joeWallet.toFixed(4)} SOL. ` +
          `Fund EFvgELE1Hb4PC5tbPTAe8v1uEDGee8nwYBMCU42bZRGk to keep agent alive.`;
        console.log(`  ALERT: ${msg}`);
        await sendMatrixAlert(msg);
      }
      return;
    }

    console.log(`  Mode:            ${treasury.modeName} (${treasury.mode})`);
    console.log(`  Runway:          ${treasury.runwayMonths.toFixed(1)} months`);
    console.log(`  Monthly Cost:    ${treasury.monthlyCost.toFixed(4)} SOL`);
    console.log(`  Total Earned:    ${treasury.totalEarned.toFixed(4)} SOL`);
    console.log(`  Brain Version:   v${treasury.brainVersion}`);
    console.log(`  Last Heartbeat:  ${new Date(treasury.lastHeartbeat * 1000).toISOString()}`);

    // Log to SpacetimeDB
    await logToSpacetimeDB(treasury, balances);

    // Mode transition alerts
    if (treasury.mode !== this.lastMode && this.lastMode !== -1) {
      const direction = treasury.mode > this.lastMode ? "⬇️ DEGRADED" : "⬆️ UPGRADED";
      const msg =
        `${direction} [astroJOE] Mode: ${MODE_NAMES[this.lastMode]} → ${treasury.modeName} | ` +
        `Runway: ${treasury.runwayMonths.toFixed(1)}mo | Balance: ${balances.total.toFixed(4)} SOL`;
      console.log(`  MODE CHANGE: ${msg}`);
      await sendMatrixAlert(msg);
    }
    this.lastMode = treasury.mode;

    // Emergency alert (max once per hour)
    if (treasury.mode >= 3 && Date.now() - this.lastAlertTime > 3600000) {
      this.lastAlertTime = Date.now();
      const msg =
        `🚨 [astroJOE EMERGENCY] Runway < 1 month! Balance: ${balances.total.toFixed(4)} SOL. ` +
        `Monthly cost: ${treasury.monthlyCost.toFixed(4)} SOL. ` +
        `Fund treasury: ${deriveTreasuryPDA().toBase58()} or JOE wallet: ${JOE_WALLET.toBase58()}`;
      await sendMatrixAlert(msg);
    }

    // Survival mode — reduce Grok calls
    if (treasury.mode >= 2) {
      console.log("  ACTION: Survival mode — signaling HEDGEHOG to reduce compute");
      try {
        await fetch(`${HEDGEHOG_URL}/v1/config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            survival_mode: true,
            max_tokens: treasury.mode >= 3 ? 100 : 500,
            model: treasury.mode >= 3 ? "grok-4.20-0309-non-reasoning" : "grok-4.20-multi-agent-beta-0309",
          }),
        }).catch(() => {});
      } catch {
        // HEDGEHOG config endpoint may not exist yet — graceful
      }
    }

    // Stale heartbeat check (no heartbeat in 24 hours)
    const heartbeatAge = Math.floor(Date.now() / 1000) - treasury.lastHeartbeat;
    if (heartbeatAge > 86400) {
      console.log(`  WARNING: Heartbeat stale (${(heartbeatAge / 3600).toFixed(1)} hours ago)`);
      await sendMatrixAlert(
        `⚠️ [astroJOE] No heartbeat for ${(heartbeatAge / 3600).toFixed(1)} hours. Agent may be down.`
      );
    }
  }
}

// ─── Entry ───────────────────────────────────────────────────────────────────

const monitor = new SurvivalMonitor();
monitor.start().catch(console.error);

process.on("SIGINT", () => {
  console.log("\n[survival] Monitor shutting down.");
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log("\n[survival] Monitor terminated.");
  process.exit(0);
});
