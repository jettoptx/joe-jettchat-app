import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeCodeForTokens,
  fetchXProfile,
  signJWT,
  createClaims,
} from "@jettoptx/auth";

// Base64 decode for JWT signing key
function b64Decode(str: string): Uint8Array {
  const bin = Buffer.from(str, "base64");
  return new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength);
}

const X_CLIENT_ID = process.env.X_CLIENT_ID!;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3333";
const JWT_SIGNING_KEY = process.env.JWT_SIGNING_KEY!;

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

  // Retrieve PKCE state from cookie
  const oauthStateCookie = cookies().get("x_oauth_state");
  if (!oauthStateCookie) {
    return NextResponse.redirect(`${APP_URL}/login?error=no_state`);
  }

  const { codeVerifier, state: savedState } = JSON.parse(oauthStateCookie.value);

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
      walletPubkey: `x:${profile.id}`, // X-only auth, no wallet yet
      xId: profile.id,
      xHandle: profile.username,
      xVerified: profile.verified,
      authMethods: ["x_oauth"],
    });

    const privateKey = b64Decode(JWT_SIGNING_KEY);
    const jwt = signJWT(claims, privateKey);

    // Set session cookie
    const response = NextResponse.redirect(APP_URL);

    response.cookies.set("jettauth", jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 86400, // 24 hours
      path: "/",
    });

    // Store refresh token for later use
    response.cookies.set("x_refresh_token", tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 86400, // 30 days
      path: "/",
    });

    // Store X profile for client-side access
    response.cookies.set("x_profile", JSON.stringify({
      id: profile.id,
      username: profile.username,
      name: profile.name,
      avatar: profile.profile_image_url,
      verified: profile.verified,
    }), {
      httpOnly: false, // readable by client
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 86400,
      path: "/",
    });

    // Clear PKCE state cookie
    response.cookies.delete("x_oauth_state");

    return response;
  } catch (err) {
    console.error("X OAuth callback error:", err);
    return NextResponse.redirect(
      `${APP_URL}/login?error=auth_failed&detail=${encodeURIComponent(String(err))}`
    );
  }
}
