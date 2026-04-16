/**
 * GET /api/auth/zitadel — Initiate Zitadel OIDC login (PKCE)
 * Redirects browser to Zitadel authorization endpoint.
 * PKCE verifier is encrypted into the state parameter (no cookies needed).
 */

import { NextResponse } from "next/server";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  encryptState,
  getAuthorizationUrl,
} from "@/lib/zitadel";

export async function GET() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Encrypt the verifier into the state parameter — eliminates cookie dependency
  const state = encryptState(codeVerifier);

  const authUrl = getAuthorizationUrl(state, codeChallenge);

  return NextResponse.redirect(authUrl);
}
