import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeCodeForTokens,
  fetchXProfile,
  signJWT,
  createClaims,
} from "@jettoptx/auth";

// Base64 decode for JWT signing key
function b64Decode(str?: string): Uint8Array {
  if (!str) {
    throw new Error("JWT_SIGNING_KEY environment variable is not set");
  }
  const bin = Buffer.from(str, "base64");
  return new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength);
}

const X_CLIENT_ID = process.env.X_CLIENT_ID;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jettoptx.chat";
const JWT_SIGNING_KEY = process.env.JWT_SIGNING_KEY;
const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY; // for future verification

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${APP_URL}/login?error=${error}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${APP_URL}/login?error=missing_params`);
  }

  // Validate critical env vars
  if (!X_CLIENT_ID || !X_CLIENT_SECRET || !JWT_SIGNING_KEY) {
    console.error("Missing required env vars for X OAuth:", {
      hasClientId: !!X_CLIENT_ID,
      hasClientSecret: !!X_CLIENT_SECRET,
      hasJwtKey: !!JWT_SIGNING_KEY,
    });
    return NextResponse.redirect(
      `${APP_URL}/login?error=server_config&detail=missing_env_vars`
    );
  }

  // Retrieve PKCE state from cookie
  const oauthStateCookie = cookies().get("x_oauth_state");
  if (!oauthStateCookie) {
    return NextResponse.redirect(`${APP_URL}/login?error=no_state`);
  }

  let codeVerifier: string;
  let savedState: string;
  try {
    const stateData = JSON.parse(oauthStateCookie.value);
    codeVerifier = stateData.codeVerifier;
    savedState = stateData.state;
  } catch {
    return NextResponse.redirect(`${APP_URL}/login?error=invalid_state`);
  }

  if (state !== savedState) {
    return NextResponse.redirect(`${APP_URL}/login?error=state_mismatch`);
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(
      {
        clientId: X_CLIENT_ID,
        clientSecret: X_CLIENT_SECRET,
        redirectUri: `${APP_URL}/api/auth/x/callback`,
      },
      code,
      codeVerifier
    );

    // Fetch X profile
    const profile = await fetchXProfile(tokens.access_token);

    // Create JettAuth JWT
    const claims = createClaims({
      walletPubkey: `x:${profile.id}`,
      xId: profile.id,
      xHandle: profile.username,
      xVerified: profile.verified,
      authMethods: ["x_oauth"],
    });

    const privateKey = b64Decode(JWT_SIGNING_KEY);
    const jwt = signJWT(claims, privateKey);

    // Set session cookie + redirect to app (with sync flag so frontend can confirm Convex user)
    const response = NextResponse.redirect(`${APP_URL}?sync=true`);

    response.cookies.set("jettauth", jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 86400,
      path: "/",
    });

    response.cookies.set("x_refresh_token", tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 86400,
      path: "/",
    });

    response.cookies.set(
      "x_profile",
      JSON.stringify({
        id: profile.id,
        username: profile.username,
        name: profile.name,
        avatar: profile.profile_image_url,
        verified: profile.verified,
      }),
      {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 86400,
        path: "/",
      }
    );

    response.cookies.delete("x_oauth_state");

    console.log(`✅ X OAuth success for @${profile.username} (x:${profile.id})`);
    return response;
  } catch (err: any) {
    console.error("X OAuth callback error:", err);
    const detail = encodeURIComponent(
      err.message || String(err) || "unknown_error"
    );
    return NextResponse.redirect(
      `${APP_URL}/login?error=auth_failed&detail=${detail}`
    );
  }
}
