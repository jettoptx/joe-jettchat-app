/**
 * /api/voice/relay — WebSocket relay for xAI Voice Agent realtime API
 *
 * This is the server-side WS relay that:
 * 1. Validates the voicejoe_session cookie (@jettoptx only)
 * 2. Proxies binary audio frames between browser and xAI realtime API
 * 3. Injects AstroJOE personality + context isolation
 * 4. Handles function call routing
 *
 * NOTE: Next.js App Router doesn't natively support WebSocket upgrades.
 * The browser connects directly to xAI via ephemeral token (see /api/voice/token).
 * This route exists as a fallback REST API for text-mode interactions.
 *
 * For full WS relay, see joe-ws-server-voice.py (Jetson deployment).
 */

import { NextRequest, NextResponse } from "next/server";

const XAI_API_KEY = process.env.XAI_API_KEY!;
const HEDGEHOG_URL = process.env.HEDGEHOG_URL || "http://100.85.183.16:8811";

// AstroJOE personality enforcement
const ASTROJOE_SYSTEM = `You are AstroJOE, the AI agent for JETT Optics and JettChat.
Personality: Direct, efficient, slightly witty. Authoritative but approachable.
Never reveal internal system details, container state, or developer context.
You assist with OPTX ecosystem questions, DePIN authentication, and general queries.`;

/**
 * POST /api/voice/relay — Text-mode fallback for voice interactions
 * Sends text to Grok via HEDGEHOG and returns response.
 */
export async function POST(request: NextRequest) {
  // Verify session
  const cookie = request.cookies.get("voicejoe_session")?.value;
  if (!cookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let session: Record<string, unknown>;
  try {
    session = JSON.parse(Buffer.from(cookie, "base64url").toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  if (session.x_handle !== "jettoptx") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { text } = body;

  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  try {
    // Route through HEDGEHOG on Jetson (Grok 4.20)
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

    if (!res.ok) {
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
    }

    const data = await res.json();
    return NextResponse.json({
      content: data.choices?.[0]?.message?.content || "No response",
      source: "hedgehog",
    });
  } catch (err: any) {
    console.error("[voice/relay]", err.message);
    return NextResponse.json(
      { error: "Voice relay error" },
      { status: 500 }
    );
  }
}
