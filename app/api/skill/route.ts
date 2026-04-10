/**
 * app/api/skill/route.ts — Hermes skill execution API route
 *
 * Routes POST { skill, args, userId } to the appropriate backend:
 *   "hedgehog" → Jetson HEDGEHOG Service :8811 (Grok 4.20 gateway)
 *   "trading"  → TraderJOE mock (placeholder)
 *   "system"   → handled locally
 *
 * Jetson is reachable at Tailscale IP 100.85.183.16.
 */

import { NextRequest, NextResponse } from "next/server";
import { SKILL_REGISTRY } from "@/lib/skills";

const HEDGEHOG_URL =
  process.env.HEDGEHOG_INTERNAL_URL ?? "http://100.85.183.16:8811";

const HEDGEHOG_TIMEOUT_MS = 15_000;

interface SkillRequestBody {
  skill: string;
  args: string;
  userId: string;
}

interface SkillResponse {
  output: string;
  metadata?: Record<string, unknown>;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: SkillRequestBody;

  try {
    body = (await req.json()) as SkillRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { skill: slug, args = "", userId = "anonymous" } = body;

  if (!slug) {
    return NextResponse.json({ error: "Missing skill slug" }, { status: 400 });
  }

  const skillDef = SKILL_REGISTRY.find((s) => s.slug === slug);
  if (!skillDef) {
    return NextResponse.json(
      { error: `Unknown skill: ${slug}` },
      { status: 404 }
    );
  }

  try {
    const result = await dispatchSkill(skillDef.agentType, slug, args, userId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error(`[skill/route] ${slug} failed:`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

async function dispatchSkill(
  agentType: string,
  slug: string,
  args: string,
  userId: string
): Promise<SkillResponse> {
  switch (agentType) {
    case "hedgehog":
      return handleHedgehog(slug, args, userId);
    case "traderjoe":
      return handleTraderJoe(slug, args);
    case "optx":
      return handleOptx(slug, args, userId);
    case "aaron":
      return handleAaron(slug, args, userId);
    case "joe":
      return handleJoe(slug, args, userId);
    case "local":
    default:
      return handleLocal(slug, args, userId);
  }
}

// ---------------------------------------------------------------------------
// HEDGEHOG — Grok 4.20 via Jetson :8811 OpenAI shim
// ---------------------------------------------------------------------------

async function handleHedgehog(
  slug: string,
  args: string,
  userId: string
): Promise<SkillResponse> {
  const systemPrompts: Record<string, string> = {
    grok: "You are HEDGEHOG, an AI assistant in the JettChat interface. Answer concisely with technical precision. You have access to Grok 4.20 multi-agent reasoning.",
    gaze: "You are the AGT (Agentive Gaze Tensor) analyzer for OPTX. Summarize the current COG/EMO/ENV gaze tensor state concisely.",
  };

  const system =
    systemPrompts[slug] ??
    "You are HEDGEHOG, an AI assistant. Be concise and helpful.";

  const userContent = args || "Provide a status summary.";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEDGEHOG_TIMEOUT_MS);

  try {
    const res = await fetch(`${HEDGEHOG_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: "grok-4.20-multi-agent-beta-0309",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
        stream: false,
        user: userId,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HEDGEHOG ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: Record<string, number>;
    };

    const content =
      data.choices?.[0]?.message?.content ?? "[No response from HEDGEHOG]";

    return {
      output: content,
      metadata: { model: "grok-4.20-multi-agent", usage: data.usage },
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// TraderJOE — mock placeholder
// ---------------------------------------------------------------------------

async function handleTraderJoe(
  slug: string,
  args: string
): Promise<SkillResponse> {
  const pair = args.trim().toUpperCase() || "XRP/USDC";

  // Placeholder response — real integration wires to Jetson :8888 AARON router
  return {
    output: `[TraderJOE] Market data for ${pair} — live trading integration coming via AARON Router :8888. Current bots: traderjoe1 (passive LP), traderjoe2 (lag oracle), traderjoe3 (Xahau rebalance), traderjoe4 (grid 6% range).`,
    metadata: { pair, source: "mock", agentType: "traderjoe" },
  };
}

// ---------------------------------------------------------------------------
// OPTX / Staking
// ---------------------------------------------------------------------------

async function handleOptx(
  slug: string,
  args: string,
  userId: string
): Promise<SkillResponse> {
  const amount = args.trim() || "0";
  return {
    output: `[OPTX Staking] Querying staking status for ${amount} JTX (userId: ${userId}).\n\nDevnet program: 91SqPNGRFrTgwSM3S7grZK8A6TCqn5STFGK4mAfqWMbQ\n$OPTX: 4r9WxVWBNMphYfSyGBuMFYRLsLEnzUNquJPnpFessXRH\n\nLive staking reads coming soon via AARON Router.`,
    metadata: { amount, userId, network: "devnet" },
  };
}

// ---------------------------------------------------------------------------
// AARON — attestation / trust
// ---------------------------------------------------------------------------

async function handleAaron(
  slug: string,
  args: string,
  userId: string
): Promise<SkillResponse> {
  if (slug === "attest") {
    return {
      output: `[AARON] Attestation batch submission triggered for userId: ${userId}.\n\nConnecting to AARON Router at 100.85.183.16:8888...\n\nNote: AGT hash (32-byte) + zkWASM proof will be submitted on next batch window.`,
      metadata: { action: "attest", userId },
    };
  }

  if (slug === "trust") {
    const agent = args.trim() || "unknown";
    return {
      output: `[AARON] Trust score lookup for "${agent}".\n\nAARON Router: 100.85.183.16:8888 — DePIN trust oracle.\nIntegration in progress. Submit AGT attestations to build trust score.`,
      metadata: { agent },
    };
  }

  return { output: "[AARON] Unknown AARON command." };
}

// ---------------------------------------------------------------------------
// JOE — Matrix/X relay
// ---------------------------------------------------------------------------

async function handleJoe(
  slug: string,
  args: string,
  userId: string
): Promise<SkillResponse> {
  const message = args.trim();
  if (!message) {
    return { output: "[JOE] Usage: /bridge <message> — relays to X community via Joe (@joe:jettoptics.ai)." };
  }

  return {
    output: `[JOE] Bridge relay queued: "${message}"\n\nWill post via Matrix homeserver (matrix.jettoptics.ai) → X integration.\nRoom: #optx:jettoptics.ai`,
    metadata: { bridgeMessage: message, userId },
  };
}

// ---------------------------------------------------------------------------
// Local — /wallet, /moa, /help
// ---------------------------------------------------------------------------

async function handleLocal(
  slug: string,
  args: string,
  userId: string
): Promise<SkillResponse> {
  if (slug === "wallet") {
    return {
      output: `[Wallet] Connected identity: ${userId}\n\nSolana: EFvgELE1Hb4PC5tbPTAe8v1uEDGee8nwYBMCU42bZRGk\nXRPL: rq9mNYMKhzy9EgmBmwfWKn6fs5qgPpVmk\n$JTX mainnet: 9XpJiKEYzq5yDo5pJzRfjSRMPL2yPfDQXgiN7uYtBhUj`,
      metadata: { userId },
    };
  }

  if (slug === "moa") {
    return {
      output: "[MOA] Map of Augments overlay toggled. (Client-side state managed by the UI layer.)",
      metadata: { action: "moa-toggle" },
    };
  }

  if (slug === "help") {
    const lines = SKILL_REGISTRY.map(
      (s) =>
        `  ${(s.usage ?? `/${s.slug}`).padEnd(24)} ${s.description}${s.requiresTier ? ` [${s.requiresTier.toUpperCase()}]` : ""}`
    );
    return {
      output: `HERMES Skill Registry — available slash commands:\n\n${lines.join("\n")}\n\nTier gates: MOJO ($8.88/mo) · DOJO ($28.88/6mo)`,
      metadata: { skillCount: SKILL_REGISTRY.length },
    };
  }

  return { output: `[${slug}] No local handler for this skill.` };
}
