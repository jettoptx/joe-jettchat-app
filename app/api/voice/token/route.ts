/**
 * POST /api/voice/token — Issue xAI ephemeral token for browser realtime WS
 *
 * Protected: requires jettauth cookie with xHandle === "jettoptx".
 * The XAI_API_KEY stays server-side; only the short-lived client secret
 * reaches the browser.
 */

import { NextRequest, NextResponse } from "next/server";

const XAI_API_KEY = process.env.XAI_API_KEY!;

function getXHandleFromJWT(cookie: string): string | null {
  try {
    const parts = cookie.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    return payload.xHandle || payload.x_handle || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const jwt = request.cookies.get("jettauth")?.value;
  if (!jwt) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const xHandle = getXHandleFromJWT(jwt);
  if (xHandle !== "jettoptx") {
    return NextResponse.json({ error: "Forbidden: @jettoptx only" }, { status: 403 });
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
      console.error("[voice/token] xAI ephemeral token error:", res.status, err);
      return NextResponse.json(
        { error: "Failed to create voice session", detail: err },
        { status: 502 }
      );
    }

    const data = await res.json();

    // xAI returns { value, expires_at } or { client_secret: { value, expires_at } }
    const token = data.client_secret?.value || data.value || data.client_secret;
    const expires_at = data.client_secret?.expires_at || data.expires_at;

    if (!token) {
      console.error("[voice/token] No token in response:", JSON.stringify(data));
      return NextResponse.json(
        { error: "No token in xAI response" },
        { status: 502 }
      );
    }

    return NextResponse.json({ token, expires_at });
  } catch (err: any) {
    console.error("[voice/token] Error:", err.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
