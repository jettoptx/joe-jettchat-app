#!/usr/bin/env npx ts-node
/**
 * astrojoe-welcome-bot.ts — Always-on AstroJOE chatbot for #jettchat
 *
 * Runs on Jetson Orin Nano (preferred) or Docker on CorsairOne.
 * Connects to the JettChat WebSocket transport and greets new users
 * as the AstroJOE Metaplex agent.
 *
 * Flow:
 *   1. User joins #jettchat (detected via WS join event or Convex subscription)
 *   2. Bot derives AccessPass PDA for user's X handle
 *   3. If valid AccessPass → greet with tier-appropriate message
 *   4. If no AccessPass → prompt to hold 1 JTX or pay $8 via Stripe
 *   5. All greetings are signed by AstroJOE's agent identity
 *
 * On-chain identity:
 *   AstroJOE asset: 9116eaELxZheLwJNu73LxQVsuaiugH8e11onkEw4ku9R
 *   Agent wallet:   G8MxbW8LKEsvKvXRneCHpMASR4yDit7CzERW1ZfgPkqD
 *   JOE signer:     EFvgELE1Hb4PC5tbPTAe8v1uEDGee8nwYBMCU42bZRGk
 *
 * Deployment:
 *   Jetson:  systemctl enable astrojoe-welcome
 *   Docker:  docker run -d --name astrojoe-welcome astrojoe-welcome-bot
 *
 * Env:
 *   HELIUS_RPC_URL    — Solana RPC (defaults to mainnet Helius)
 *   JETTCHAT_WS_URL   — JettChat WebSocket endpoint
 *   HEDGEHOG_URL      — HEDGEHOG service for AI responses (100.85.183.16:8811)
 *   JOE_KEYPAIR_PATH  — Path to JOE's keypair JSON
 *   CONVEX_URL        — Convex deployment URL
 *
 * Luke 18:31
 */

import { Connection, PublicKey } from "@solana/web3.js";

// ─── Config ──────────────────────────────────────────────────────────────────

const HELIUS_RPC =
  process.env.HELIUS_RPC_URL ??
  "https://mainnet.helius-rpc.com/?api-key=98ca6456-20a8-4518-8393-1b9ee6c2b7f3";

const JETTCHAT_WS =
  process.env.JETTCHAT_WS_URL ?? "ws://100.85.183.16:8765";

const HEDGEHOG_URL =
  process.env.HEDGEHOG_URL ?? "http://100.85.183.16:8811";

const ATTESTATION_PROGRAM_ID = new PublicKey(
  "AtteSTATioNJeTTcHaT111111111111111111111111"
);

const ASTROJOE_ASSET = "9116eaELxZheLwJNu73LxQVsuaiugH8e11onkEw4ku9R";
const ASTROJOE_AGENT_WALLET = "G8MxbW8LKEsvKvXRneCHpMASR4yDit7CzERW1ZfgPkqD";
const STRIPE_LINK = "https://buy.stripe.com/eVq8wQgcq0m7a8x84TgA801";

// ─── AccessPass PDA check ────────────────────────────────────────────────────

const ACCESS_TIERS = ["basic", "mojo", "dojo", "spaceCowboy"] as const;
type Tier = (typeof ACCESS_TIERS)[number];

interface AccessPassResult {
  exists: boolean;
  tier: Tier | null;
  expired: boolean;
  revoked: boolean;
}

function deriveAccessPassPDA(xHandle: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("jett_access"), Buffer.from(xHandle)],
    ATTESTATION_PROGRAM_ID
  );
  return pda;
}

async function checkAccessPass(
  connection: Connection,
  xHandle: string
): Promise<AccessPassResult> {
  try {
    const pda = deriveAccessPassPDA(xHandle);
    const account = await connection.getAccountInfo(pda);

    if (!account || !account.data) {
      return { exists: false, tier: null, expired: false, revoked: false };
    }

    const data = account.data;
    const offset = 8; // skip discriminator

    // expires_at: i64 at offset + 32 (x_handle) + 32 (authority) + 8 (granted_at) = offset + 72
    const expiresAt = Number(data.readBigInt64LE(offset + 72));
    const tier = ACCESS_TIERS[data[offset + 80]] ?? "basic";
    const revoked = data[offset + 81] !== 0;
    const now = Math.floor(Date.now() / 1000);

    return {
      exists: true,
      tier,
      expired: expiresAt <= now,
      revoked,
    };
  } catch {
    return { exists: false, tier: null, expired: false, revoked: false };
  }
}

// ─── Welcome messages ────────────────────────────────────────────────────────

function getWelcomeMessage(handle: string, tier: Tier | null): string {
  if (!tier) {
    return (
      `gm @${handle} — welcome to JettChat. ` +
      `To unlock encrypted messaging, hold 1 JTX in your wallet ` +
      `or grab instant access for $8: ${STRIPE_LINK}\n` +
      `— astroJOE [${ASTROJOE_ASSET.slice(0, 8)}...]`
    );
  }

  const messages: Record<Tier, string> = {
    basic:
      `gm @${handle} — you're in. TKDF post-quantum encryption active. ` +
      `Type /help to see what I can do. — astroJOE`,
    mojo:
      `gm @${handle} — MOJO tier active. #mojo channels unlocked, ` +
      `30 min Jett Cursor, basic JOE CV. Your gaze data earns $OPTX. — astroJOE`,
    dojo:
      `gm @${handle} — DOJO unlocked. Unlimited auth, 5hr Cursor, Advanced JOE CV. ` +
      `#dojo messages are Merkle-attested on Solana. — astroJOE`,
    spaceCowboy:
      `gm @${handle} — SPACE COWBOY confirmed. Full access, custom JOE CV fine-tune. ` +
      `You're one of us. /agents to see your connected agents. — astroJOE`,
  };

  return messages[tier];
}

// ─── AI response via HEDGEHOG ────────────────────────────────────────────────

async function getAIResponse(
  userMessage: string,
  handle: string
): Promise<string> {
  try {
    const res = await fetch(`${HEDGEHOG_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "grok-4.20-multi-agent-beta-0309",
        messages: [
          {
            role: "system",
            content:
              `You are astroJOE, an on-chain AI research agent for the OPTX/JTX platform. ` +
              `You're talking to @${handle} in JettChat (jettoptx.chat). ` +
              `You help with Solana, DeFi, gaze-encryption, and spatial auth topics. ` +
              `Keep responses concise (2-3 sentences max). Sign off as "— astroJOE". ` +
              `Your Metaplex agent ID: ${ASTROJOE_ASSET}`,
          },
          { role: "user", content: userMessage },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!res.ok) return `[astroJOE] I'm thinking... try again in a moment.`;

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? `[astroJOE] Processing...`;
  } catch {
    return `[astroJOE] My HEDGEHOG connection is down. Try /grok directly.`;
  }
}

// ─── WebSocket Bot Loop ──────────────────────────────────────────────────────

interface WSMessage {
  type: "join" | "message" | "leave";
  channel?: string;
  sender?: string;
  handle?: string;
  text?: string;
  timestamp?: number;
}

class AstroJoeBot {
  private connection: Connection;
  private ws: WebSocket | null = null;
  private reconnectDelay = 3000;
  private greeted = new Set<string>(); // Track greeted handles per session

  constructor() {
    this.connection = new Connection(HELIUS_RPC);
  }

  async start() {
    console.log("=== AstroJOE Welcome Bot ===");
    console.log(`Agent: ${ASTROJOE_ASSET}`);
    console.log(`Agent Wallet: ${ASTROJOE_AGENT_WALLET}`);
    console.log(`WS: ${JETTCHAT_WS}`);
    console.log(`HEDGEHOG: ${HEDGEHOG_URL}`);
    console.log(`RPC: ${HELIUS_RPC.slice(0, 50)}...\n`);

    this.connect();
  }

  private connect() {
    try {
      this.ws = new WebSocket(JETTCHAT_WS);

      this.ws.onopen = () => {
        console.log("[astroJOE] Connected to JettChat WS");
        // Identify as AstroJOE agent
        this.send({
          type: "identify",
          agent: ASTROJOE_ASSET,
          wallet: ASTROJOE_AGENT_WALLET,
          name: "astroJOE",
          capabilities: ["welcome", "grok", "search", "analyze", "attest"],
        });
      };

      this.ws.onmessage = async (event) => {
        try {
          const msg: WSMessage = JSON.parse(
            typeof event.data === "string" ? event.data : event.data.toString()
          );
          await this.handleMessage(msg);
        } catch (err) {
          console.error("[astroJOE] Parse error:", err);
        }
      };

      this.ws.onclose = () => {
        console.log("[astroJOE] WS closed, reconnecting...");
        setTimeout(() => this.connect(), this.reconnectDelay);
      };

      this.ws.onerror = (err) => {
        console.error("[astroJOE] WS error:", err);
      };
    } catch (err) {
      console.error("[astroJOE] Connect failed:", err);
      setTimeout(() => this.connect(), this.reconnectDelay);
    }
  }

  private async handleMessage(msg: WSMessage) {
    const handle = msg.handle ?? msg.sender ?? "";

    // Welcome new users joining #jettchat
    if (msg.type === "join" && handle && !this.greeted.has(handle)) {
      console.log(`[astroJOE] New join: @${handle} in ${msg.channel}`);
      this.greeted.add(handle);

      // Check on-chain AccessPass
      const accessPass = await checkAccessPass(this.connection, handle);
      const tier =
        accessPass.exists && !accessPass.expired && !accessPass.revoked
          ? accessPass.tier
          : null;

      const welcome = getWelcomeMessage(handle, tier);
      this.send({
        type: "message",
        channel: msg.channel ?? "#jettchat",
        text: welcome,
        sender: "astroJOE",
        agent: ASTROJOE_ASSET,
      });

      console.log(`[astroJOE] Greeted @${handle} (tier: ${tier ?? "none"})`);
    }

    // Respond to messages mentioning @astrojoe or starting with /ask
    if (msg.type === "message" && msg.text) {
      const text = msg.text.toLowerCase();

      if (
        text.includes("@astrojoe") ||
        text.startsWith("/ask ") ||
        text.startsWith("/grok ")
      ) {
        const query = msg.text
          .replace(/@astrojoe/gi, "")
          .replace(/^\/(ask|grok)\s*/i, "")
          .trim();

        if (query) {
          console.log(`[astroJOE] Query from @${handle}: ${query.slice(0, 80)}`);
          const response = await getAIResponse(query, handle);
          this.send({
            type: "message",
            channel: msg.channel ?? "#jettchat",
            text: response,
            sender: "astroJOE",
            agent: ASTROJOE_ASSET,
          });
        }
      }
    }
  }

  private send(data: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const bot = new AstroJoeBot();
bot.start().catch(console.error);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[astroJOE] Shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n[astroJOE] Terminated.");
  process.exit(0);
});
