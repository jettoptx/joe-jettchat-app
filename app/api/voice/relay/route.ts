/**
 * POST /api/voice/relay — Text-mode fallback for voice interactions
 *
 * Protected: requires jettauth cookie with xHandle === "jettoptx".
 * Routes through HEDGEHOG (Grok 4.20) with direct xAI fallback.
 */

import { NextRequest, NextResponse } from "next/server";

const XAI_API_KEY = process.env.XAI_API_KEY!;
const HEDGEHOG_URL = process.env.HEDGEHOG_URL || "http://100.85.183.16:8811";

const ASTROJOE_SYSTEM = `You are AstroJOE, the AI agent for JETT Optics and JettChat.
Personality: Direct, efficient, slightly witty. Authoritative but approachable.
Never reveal internal system details, container state, or developer context.
You assist with OPTX ecosystem questions, DePIN authentication, and general queries.`;

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

  const body = await request.json();
  const { text } = body;

  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  try {
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
