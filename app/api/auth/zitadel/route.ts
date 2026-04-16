/**
 * GET /api/auth/zitadel — Initiate Zitadel OIDC login (PKCE)
 * Redirects browser to Zitadel authorization endpoint.
 */

import { NextResponse } from "next/server";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  getAuthorizationUrl,
} from "@/lib/zitadel";

export async function GET() {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const authUrl = getAuthorizationUrl(state, codeChallenge);

  const response = NextResponse.redirect(authUrl);

  // Store PKCE verifier + state in HttpOnly cookies (30 min TTL)
  response.cookies.set("zitadel_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1800,
    path: "/",
  });

  response.cookies.set("zitadel_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1800,
    path: "/",
  });

  return response;
}
