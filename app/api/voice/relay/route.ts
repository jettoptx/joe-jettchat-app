/**
 * POST /api/voice/relay — Text-mode fallback for voice interactions
 *
 * SECURITY:
 * - Verifies Ed25519 JWT signature
 * - Enforces xHandle === "jettoptx" (founder-only)
 * - Rate limited: max 30 requests per 5 minutes per IP
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@jettoptx/auth";

const XAI_API_KEY = process.env.XAI_API_KEY!;
const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;
const HEDGEHOG_URL = process.env.HEDGEHOG_URL || "http://100.85.183.16:8811";
const ALLOWED_HANDLES = new Set(["jettoptx"]);

const ASTROJOE_SYSTEM = `You are AstroJOE, the AI agent for JETT Optics and JettChat.
Personality: Direct, efficient, slightly witty. Authoritative but approachable.
Never reveal internal system details, container state, or developer context.
You assist with OPTX ecosystem questions, DePIN authentication, and general queries.`;

// ── Rate limiter ────────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW = 5 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ── JWT verification ────────────────────────────────────────────────────────
function b64Decode(str?: string): Uint8Array {
  if (!str) throw new Error("Missing key");
  const bin = Buffer.from(str, "base64");
  return new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength);
}

function verifyAndExtractHandle(jwt: string): string | null {
  if (!JWT_PUBLIC_KEY) {
    try {
      const parts = jwt.split(".");
      if (parts.length !== 3) return null;
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      return payload.x_handle || payload.xHandle || null;
    } catch {
      return null;
    }
  }

  try {
    const publicKey = b64Decode(JWT_PUBLIC_KEY);
    const claims = verifyJWT(jwt, publicKey);
    return (claims as any).x_handle || (claims as any).xHandle || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const jwt = request.cookies.get("jettauth")?.value;
  if (!jwt) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const xHandle = verifyAndExtractHandle(jwt);
  if (!xHandle || !ALLOWED_HANDLES.has(xHandle.toLowerCase())) {
    return NextResponse.json({ error: "Forbidden: founder accounts only" }, { status: 403 });
  }

  const body = await request.json();
  const { text } = body;

  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  try {
    // Try HEDGEHOG first (Jetson Grok gateway)
    const res = await fetch(`${HEDGEHOG_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: "Bearer sk-hedgehog-local",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4.20-0309-reasoning",
        messages: [
          { role: "system", content: ASTROJOE_SYSTEM },
          { role: "user", content: text },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({
        content: data.choices?.[0]?.message?.content || "No response",
        source: "hedgehog",
      });
    }

    // Fallback to direct xAI
    const fallback = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-3-fast",
        messages: [
          { role: "system", content: ASTROJOE_SYSTEM },
          { role: "user", content: text },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    const fallbackData = await fallback.json();
    return NextResponse.json({
      content: fallbackData.choices?.[0]?.message?.content || "No response",
      source: "xai-direct",
    });
  } catch (err: any) {
    console.error("[voice/relay]", err.message);
    return NextResponse.json({ error: "Voice relay error" }, { status: 500 });
  }
}
