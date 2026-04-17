/**
 * POST /api/voice/token — Issue xAI ephemeral token for browser realtime WS
 *
 * SECURITY MODEL (v2 — 2026-04-16):
 * - HARD-REQUIRES JWT_PUBLIC_KEY. No decode-only fallback. If the key is
 *   missing, the endpoint returns 503. Previously a missing key silently
 *   downgraded to unsigned decoding, which was a bypass.
 * - Verifies Ed25519 signature on `jettauth` cookie.
 * - Allows only the founder account: pinned to numeric X user ID(s) from
 *   ALLOWED_X_IDS env, AND handle ∈ ALLOWED_HANDLES, AND xVerified === true
 *   when REQUIRE_VERIFIED=1. Handle is mutable on X; the ID is immutable.
 * - Rate limited: 10 tokens per 5 min per IP.
 * - XAI_API_KEY never reaches the client.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@jettoptx/auth";

const XAI_API_KEY = process.env.XAI_API_KEY;
const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;

// Immutable numeric X user IDs (comma-separated). When set, this is the
// primary gate — the handle check becomes a secondary sanity check.
const ALLOWED_X_IDS = new Set(
  (process.env.ALLOWED_X_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

const ALLOWED_HANDLES = new Set(
  (process.env.ALLOWED_X_HANDLES || "jettoptx")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

const REQUIRE_VERIFIED = process.env.REQUIRE_VERIFIED === "1";

// ── Rate limiter (in-memory, resets on cold start) ──────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
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

function b64Decode(str: string): Uint8Array {
  const bin = Buffer.from(str, "base64");
  return new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength);
}

type Verified = {
  xId: string;
  xHandle: string;
  xVerified: boolean;
  exp?: number;
};

function verifyAndExtract(jwt: string): Verified | null {
  // Fail-closed: no decode-only fallback. A missing key is a server error.
  if (!JWT_PUBLIC_KEY) return null;
  try {
    const publicKey = b64Decode(JWT_PUBLIC_KEY);
    // JettAuthClaims has no index signature; double-cast through unknown.
    const claims = verifyJWT(jwt, publicKey) as unknown as Record<string, unknown>;

    const xId = String(claims.xId ?? claims.x_id ?? "");
    const xHandle = String(claims.xHandle ?? claims.x_handle ?? "").toLowerCase();
    const xVerified = Boolean(claims.xVerified ?? claims.x_verified);
    const exp = typeof claims.exp === "number" ? claims.exp : undefined;

    // Explicit expiry check — belt and suspenders in case lib tolerance drifts.
    if (exp !== undefined && Date.now() / 1000 > exp) return null;
    if (!xId || !xHandle) return null;
    return { xId, xHandle, xVerified, exp };
  } catch (err: any) {
    console.error("[voice/token] JWT verify failed:", err.message);
    return null;
  }
}

export async function POST(request: NextRequest) {
  // Rate limit first — don't let unauth traffic churn the JWT verifier.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (!checkRateLimit(ip)) {
    console.warn(`[voice/token] Rate limited: ${ip}`);
    return NextResponse.json(
      { error: "Rate limited. Max 10 tokens per 5 minutes." },
      { status: 429 }
    );
  }

  // Server-config preconditions — fail fast + loud.
  if (!JWT_PUBLIC_KEY) {
    console.error("[voice/token] JWT_PUBLIC_KEY not configured — refusing to issue tokens");
    return NextResponse.json(
      { error: "Server misconfigured: signing key missing" },
      { status: 503 }
    );
  }
  if (!XAI_API_KEY) {
    console.error("[voice/token] XAI_API_KEY not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
  }

  // Session
  const jwt = request.cookies.get("jettauth")?.value;
  if (!jwt) {
    return NextResponse.json({ error: "Unauthorized — no session" }, { status: 401 });
  }

  const session = verifyAndExtract(jwt);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized — invalid session" }, { status: 401 });
  }

  // Founder check: primary gate is numeric xId (immutable).
  // Handle + verified are secondary sanity checks.
  const idOk = ALLOWED_X_IDS.size === 0 || ALLOWED_X_IDS.has(session.xId);
  const handleOk = ALLOWED_HANDLES.has(session.xHandle);
  const verifiedOk = !REQUIRE_VERIFIED || session.xVerified === true;

  if (!idOk || !handleOk || !verifiedOk) {
    console.warn(
      `[voice/token] Forbidden: xId=${session.xId} handle=@${session.xHandle} verified=${session.xVerified} ip=${ip} idOk=${idOk} handleOk=${handleOk} verifiedOk=${verifiedOk}`
    );
    return NextResponse.json(
      { error: "Forbidden: founder account only" },
      { status: 403 }
    );
  }

  if (ALLOWED_X_IDS.size === 0) {
    console.warn(
      "[voice/token] ALLOWED_X_IDS not set — falling back to handle-only gate. Set ALLOWED_X_IDS env to pin to immutable X user ID."
    );
  }

  try {
    const res = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expires_after: { seconds: 300 } }),
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
    const token =
      data.client_secret?.value || data.value || data.client_secret;
    const expires_at =
      data.client_secret?.expires_at || data.expires_at;

    if (!token) {
      console.error("[voice/token] No token in response:", JSON.stringify(data));
      return NextResponse.json({ error: "No token in xAI response" }, { status: 502 });
    }

    console.log(
      `✅ [voice/token] Issued ephemeral token xId=${session.xId} @${session.xHandle} ip=${ip}`
    );
    return NextResponse.json({ token, expires_at });
  } catch (err: any) {
    console.error("[voice/token] Error:", err.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
