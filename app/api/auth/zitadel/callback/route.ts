/**
 * GET /api/auth/zitadel/callback — Zitadel OIDC callback
 * Exchanges authorization code for tokens, validates @jettoptx-only,
 * sets voicejoe_session cookie, redirects to /voice.
 */

import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, validateIdToken, getUserinfo } from "@/lib/zitadel";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle Zitadel errors
  if (error) {
    const desc = searchParams.get("error_description") || error;
    console.error("[Zitadel callback] Error:", desc);
    return NextResponse.redirect(
      new URL(`/voice?error=${encodeURIComponent(desc)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/voice?error=missing_params", request.url)
    );
  }

  // Verify state
  const storedState = request.cookies.get("zitadel_state")?.value;
  if (state !== storedState) {
    return NextResponse.redirect(
      new URL("/voice?error=state_mismatch", request.url)
    );
  }

  // Get PKCE verifier
  const codeVerifier = request.cookies.get("zitadel_verifier")?.value;
  if (!codeVerifier) {
    return NextResponse.redirect(
      new URL("/voice?error=missing_verifier", request.url)
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCode(code, codeVerifier);

    // Validate ID token + enforce @jettoptx-only
    let session = await validateIdToken(tokens.id_token);

    // If X handle wasn't in the ID token, try userinfo endpoint
    if (!session.x_handle) {
      const userinfo = await getUserinfo(tokens.access_token);
      const handle = (
        (userinfo.preferred_username as string) ||
        (userinfo.nickname as string) ||
        ""
      )
        .replace(/^@/, "")
        .toLowerCase();

      if (handle !== "jettoptx") {
        throw new Error(`Access denied: only @jettoptx allowed. Got: @${handle}`);
      }
      session = { ...session, x_handle: handle };
    }

    // Build session cookie payload
    const sessionPayload = {
      sub: session.sub,
      x_handle: session.x_handle,
      name: session.name,
      exp: session.exp,
      access_token: tokens.access_token,
    };

    const response = NextResponse.redirect(new URL("/voice", request.url));

    // Set session cookie (HttpOnly, same expiry as token)
    response.cookies.set(
      "voicejoe_session",
      Buffer.from(JSON.stringify(sessionPayload)).toString("base64url"),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: tokens.expires_in || 3600,
        path: "/",
      }
    );

    // Clean up PKCE cookies
    response.cookies.delete("zitadel_state");
    response.cookies.delete("zitadel_verifier");

    console.log(`[VoiceJOE] @${session.x_handle} authenticated successfully`);
    return response;
  } catch (err: any) {
    console.error("[Zitadel callback] Auth failed:", err.message);
    return NextResponse.redirect(
      new URL(
        `/voice?error=${encodeURIComponent(err.message)}`,
        request.url
      )
    );
  }
}
