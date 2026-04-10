import { NextResponse } from "next/server";
import { generatePKCE, buildAuthorizeUrl } from "@jettoptx/auth";
import { cookies } from "next/headers";

const X_CLIENT_ID = process.env.X_CLIENT_ID!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3333";

export async function GET() {
  const pkce = generatePKCE();

  // Store PKCE verifier + state in httpOnly cookie for callback
  cookies().set("x_oauth_state", JSON.stringify({
    codeVerifier: pkce.codeVerifier,
    state: pkce.state,
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  const authorizeUrl = buildAuthorizeUrl(
    {
      clientId: X_CLIENT_ID,
      redirectUri: `${APP_URL}/api/auth/x/callback`,
    },
    pkce
  );

  return NextResponse.redirect(authorizeUrl);
}
