import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeCodeForTokens,
  fetchXProfile,
  signJWT,
  createClaims,
} from "@jettoptx/auth";

// Base64 decode helper for Ed25519 key
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    console.error("X OAuth error from provider:", error);
    return NextResponse.redirect(`${APP_URL}/login?error=${error}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${APP_URL}/login?error=missing_params`);
  }

  if (!X_CLIENT_ID || !X_CLIENT_SECRET || !JWT_SIGNING_KEY) {
    console.error("Missing X OAuth env vars:", {
      hasClientId: !!X_CLIENT_ID,
      hasClientSecret: !!X_CLIENT_SECRET,
      hasJwtKey: !!JWT_SIGNING_KEY,
    });
    return NextResponse.redirect(`${APP_URL}/login?error=server_config`);
  }

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
    const tokens = await exchangeCodeForTokens(
      {
        clientId: X_CLIENT_ID,
        clientSecret: X_CLIENT_SECRET,
        redirectUri: `${APP_URL}/api/auth/x/callback`,
      },
      code,
      codeVerifier
    );

    const profile = await fetchXProfile(tokens.access_token);

    const claims = createClaims({
      walletPubkey: `x:${profile.id}`,
      xId: profile.id,
      xHandle: profile.username,
      xVerified: profile.verified,
      authMethods: ["x_oauth"],
    });

    const privateKey = b64Decode(JWT_SIGNING_KEY);
    const jwt = signJWT(claims, privateKey);

    const isProduction = process.env.NODE_ENV === "production";
    const cookieDomain = isProduction ? { domain: ".jettoptx.chat" } : {};

    const response = NextResponse.redirect(`${APP_URL}?sync=true`);

    response.cookies.set("jettauth", jwt, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 86400,
      path: "/",
      ...cookieDomain,
    });

    response.cookies.set("x_refresh_token", tokens.refresh_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 30 * 86400,
      path: "/",
      ...cookieDomain,
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
        secure: isProduction,
        sameSite: "lax",
        maxAge: 86400,
        path: "/",
        ...cookieDomain,
      }
    );

    response.cookies.delete({
      name: "x_oauth_state",
      path: "/",
      ...cookieDomain,
    });

    console.log(`✅ X OAuth success for @${profile.username} (x:${profile.id})`);
    return response;
  } catch (err: any) {
    console.error("X OAuth callback error:", err);
    const detail = encodeURIComponent(err.message || String(err) || "unknown_error");
    return NextResponse.redirect(
      `${APP_URL}/login?error=auth_failed&detail=${detail}`
    );
  }
}
