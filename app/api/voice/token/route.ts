/**
 * POST /api/voice/token — Issue xAI ephemeral token for browser realtime WS
 *
 * Protected: requires voicejoe_session cookie (@jettoptx only).
 * The XAI_API_KEY stays server-side; only the short-lived client secret
 * reaches the browser.
 */

import { NextRequest, NextResponse } from "next/server";

const XAI_API_KEY = process.env.XAI_API_KEY!;

export async function POST(request: NextRequest) {
  // Verify VoiceJOE session
  const cookie = request.cookies.get("voicejoe_session")?.value;
  if (!cookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(Buffer.from(cookie, "base64url").toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  // Enforce @jettoptx
  if (payload.x_handle !== "jettoptx") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check expiry
  if (payload.exp && (payload.exp as number) < Math.floor(Date.now() / 1000)) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  try {
    // Request ephemeral token from xAI
    const res = await fetch("https://api.x.ai/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-3-fast",
        voice: "leo",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[voice/token] xAI ephemeral token error:", res.status, err);
      return NextResponse.json(
        { error: "Failed to create voice session" },
        { status: 502 }
      );
    }

    const data = await res.json();

    // Return only the client_secret (ephemeral token)
    return NextResponse.json({
      token: data.client_secret?.value || data.client_secret,
      expires_at: data.client_secret?.expires_at || data.expires_at,
    });
  } catch (err: any) {
    console.error("[voice/token] Error:", err.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
