/**
 * GET /api/auth/zitadel/callback — Zitadel OIDC callback
 * Decrypts PKCE verifier from the state parameter, exchanges authorization
 * code for tokens, extracts X handle from claims + userinfo, enforces
 * @jettoptx-only, sets voicejoe_session cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  decryptState,
  exchangeCode,
  validateIdToken,
  getUserinfo,
  extractXHandleFromClaims,
} from "@/lib/zitadel";

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

  // Decrypt the PKCE verifier from the state parameter
  let codeVerifier: string;
  try {
    const decrypted = decryptState(state);
    codeVerifier = decrypted.verifier;
  } catch {
    console.error("[Zitadel callback] Failed to decrypt state");
    return NextResponse.redirect(
      new URL("/voice?error=invalid_state", request.url)
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCode(code, codeVerifier);

    // Validate ID token (JWT verification only — handle enforcement comes later)
    const session = await validateIdToken(tokens.id_token);

    let xHandle = session.x_handle;

    // If handle wasn't in the ID token, try userinfo endpoint
    if (!xHandle) {
      const userinfo = await getUserinfo(tokens.access_token);
      console.log(
        "[Zitadel] Userinfo response:",
        JSON.stringify(userinfo, null, 2)
      );
      xHandle = extractXHandleFromClaims(
        userinfo as Record<string, unknown>
      );
    }

    // ── CRITICAL: @jettoptx-only enforcement ──────────────────────────────
    if (xHandle !== "jettoptx") {
      throw new Error(
        `Access denied: only @jettoptx is allowed. Got: @${xHandle}`
      );
    }

    // Build session cookie payload
    const sessionPayload = {
      sub: session.sub,
      x_handle: xHandle,
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

    console.log(`[VoiceJOE] @${xHandle} authenticated successfully`);
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
