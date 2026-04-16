/**
 * GET /api/auth/zitadel/session — Returns current VoiceJOE session
 * Used by the voice page to check auth status.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get("voicejoe_session")?.value;

  if (!cookie) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  try {
    const payload = JSON.parse(
      Buffer.from(cookie, "base64url").toString("utf8")
    );

    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return NextResponse.json(
        { authenticated: false, error: "Session expired" },
        { status: 401 }
      );
    }

    // Enforce @jettoptx-only even on session reads
    if (payload.x_handle !== "jettoptx") {
      return NextResponse.json(
        { authenticated: false, error: "Unauthorized account" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        sub: payload.sub,
        x_handle: payload.x_handle,
        name: payload.name,
      },
    });
  } catch {
    return NextResponse.json(
      { authenticated: false, error: "Invalid session" },
      { status: 401 }
    );
  }
}

/**
 * DELETE /api/auth/zitadel/session — Logout
 */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("voicejoe_session");
  return response;
}
