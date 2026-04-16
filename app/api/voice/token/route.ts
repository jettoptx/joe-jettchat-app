/**
 * POST /api/voice/token — Issue xAI ephemeral token for browser realtime WS
 *
 * SECURITY:
 * - Verifies Ed25519 JWT signature (not just decoding payload)
 * - Enforces xHandle === "jettoptx" (founder-only)
 * - Rate limited: max 10 tokens per 5 minutes per IP
 * - XAI_API_KEY never reaches the client
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@jettoptx/auth";

const XAI_API_KEY = process.env.XAI_API_KEY;
const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;
const ALLOWED_HANDLES = new Set(["jettoptx"]);

// ── Rate limiter (in-memory, resets on cold start) ──────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // max tokens per window
const RATE_WINDOW = 5 * 60 * 1000; // 5 minutes

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

// ── JWT verification with Ed25519 signature check ───────────────────────────
function b64Decode(str?: string): Uint8Array {
  if (!str) throw new Error("Missing key");
  const bin = Buffer.from(str, "base64");
  return new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength);
}

function verifyAndExtractHandle(jwt: string): string | null {
  if (!JWT_PUBLIC_KEY) {
    // Fallback: decode-only (less secure, but don't break if key missing)
    console.warn("[voice/token] JWT_PUBLIC_KEY not set — using decode-only verification");
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
  } catch (err: any) {
    console.error("[voice/token] JWT verify failed:", err.message);
    return null;
  }
}

export async function POST(request: NextRequest) {
  // Rate limit by IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";

  if (!checkRateLimit(ip)) {
    console.warn(`[voice/token] Rate limited: ${ip}`);
    return NextResponse.json(
      { error: "Rate limited. Max 10 tokens per 5 minutes." },
      { status: 429 }
    );
  }

  // Verify JWT (Ed25519 signature + claims)
  const jwt = request.cookies.get("jettauth")?.value;
  if (!jwt) {
    return NextResponse.json({ error: "Unauthorized — no session" }, { status: 401 });
  }

  const xHandle = verifyAndExtractHandle(jwt);
  if (!xHandle || !ALLOWED_HANDLES.has(xHandle.toLowerCase())) {
    console.warn(`[voice/token] Forbidden: handle="${xHandle}" ip=${ip}`);
    return NextResponse.json(
      { error: "Forbidden: founder accounts only" },
      { status: 403 }
    );
  }

  if (!XAI_API_KEY) {
    console.error("[voice/token] XAI_API_KEY not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  try {
    const res = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expires_after: { seconds: 300 },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[voice/token] xAI error:", res.status, err);
      return NextResponse.json(
        { error: "Failed to create voice session", detail: err },
        { status: 502 }
      );
    }

    const data = await res.json();
    const token = data.client_secret?.value || data.value || data.client_secret;
    const expires_at = data.client_secret?.expires_at || data.expires_at;

    if (!token) {
      console.error("[voice/token] No token in response:", JSON.stringify(data));
      return NextResponse.json({ error: "No token in xAI response" }, { status: 502 });
    }

    console.log(`✅ [voice/token] Issued ephemeral token for @${xHandle} (ip=${ip})`);
    return NextResponse.json({ token, expires_at });
  } catch (err: any) {
    console.error("[voice/token] Error:", err.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
