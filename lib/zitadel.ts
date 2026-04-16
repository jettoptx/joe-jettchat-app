/**
 * lib/zitadel.ts — Zitadel OIDC utilities for VoiceJOE
 *
 * Handles PKCE code flow, token exchange, JWT validation,
 * and @jettoptx-only enforcement.
 */

import crypto from "crypto";

// ── Zitadel Configuration ───────────────────────────────────────────────────

const ZITADEL_ISSUER = process.env.ZITADEL_ISSUER!; // e.g. https://auth.jettoptics.ai
const ZITADEL_CLIENT_ID = process.env.ZITADEL_CLIENT_ID!;
const ZITADEL_REDIRECT_URI =
  process.env.ZITADEL_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/zitadel/callback`;

// The ONLY X account allowed to use VoiceJOE
const ALLOWED_X_HANDLE = "jettoptx";

// ── PKCE helpers ────────────────────────────────────────────────────────────

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

// ── Authorization URL ───────────────────────────────────────────────────────

export function getAuthorizationUrl(
  state: string,
  codeChallenge: string
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: ZITADEL_CLIENT_ID,
    redirect_uri: ZITADEL_REDIRECT_URI,
    scope: "openid profile email",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    // Hint Zitadel to use the X/Twitter IDP
    prompt: "login",
  });

  return `${ZITADEL_ISSUER}/oauth/v2/authorize?${params.toString()}`;
}

// ── Token Exchange ──────────────────────────────────────────────────────────

export interface ZitadelTokens {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

export async function exchangeCode(
  code: string,
  codeVerifier: string
): Promise<ZitadelTokens> {
  const res = await fetch(`${ZITADEL_ISSUER}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: ZITADEL_CLIENT_ID,
      code,
      redirect_uri: ZITADEL_REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zitadel token exchange failed: ${res.status} ${err}`);
  }

  return res.json();
}

// ── JWKS validation ─────────────────────────────────────────────────────────

let jwksCache: { keys: JsonWebKey[]; fetched: number } | null = null;

async function getJwks(): Promise<JsonWebKey[]> {
  if (jwksCache && Date.now() - jwksCache.fetched < 3600_000) {
    return jwksCache.keys;
  }

  const res = await fetch(`${ZITADEL_ISSUER}/oauth/v2/keys`);
  if (!res.ok) throw new Error("Failed to fetch Zitadel JWKS");
  const data = await res.json();
  jwksCache = { keys: data.keys, fetched: Date.now() };
  return data.keys;
}

// ── JWT decode (header inspection) ──────────────────────────────────────────

function decodeJwtPart(part: string): Record<string, unknown> {
  const json = Buffer.from(part, "base64url").toString("utf8");
  return JSON.parse(json);
}

// ── Validate ID token and enforce @jettoptx-only ────────────────────────────

export interface VoiceJoeSession {
  sub: string; // Zitadel user ID
  preferred_username: string;
  x_handle: string; // extracted from IDP claims
  email?: string;
  name?: string;
  exp: number;
  iat: number;
}

export async function validateIdToken(
  idToken: string
): Promise<VoiceJoeSession> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const header = decodeJwtPart(parts[0]) as { kid?: string; alg?: string };
  const payload = decodeJwtPart(parts[1]) as Record<string, unknown>;

  // Verify issuer
  if (payload.iss !== ZITADEL_ISSUER) {
    throw new Error(`Invalid issuer: ${payload.iss}`);
  }

  // Verify audience
  if (payload.aud !== ZITADEL_CLIENT_ID && !((payload.aud as string[])?.includes?.(ZITADEL_CLIENT_ID))) {
    throw new Error("Invalid audience");
  }

  // Verify expiry
  const now = Math.floor(Date.now() / 1000);
  if ((payload.exp as number) < now) {
    throw new Error("Token expired");
  }

  // JWKS signature verification
  const jwks = await getJwks();
  const signingKey = jwks.find((k: any) => k.kid === header.kid);
  if (!signingKey) {
    throw new Error("Signing key not found in JWKS");
  }

  const key = await crypto.webcrypto.subtle.importKey(
    "jwk",
    signingKey as crypto.webcrypto.JsonWebKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const sigBuf = Buffer.from(parts[2], "base64url");
  const dataBuf = Buffer.from(`${parts[0]}.${parts[1]}`, "utf8");
  const valid = await crypto.webcrypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    sigBuf,
    dataBuf
  );

  if (!valid) throw new Error("JWT signature verification failed");

  // ── Extract X handle from Zitadel IDP claims ──────────────────────────────
  // Zitadel stores the federated IDP username in different claim locations
  // depending on configuration. Check all common paths.
  const xHandle =
    (payload["urn:zitadel:iam:org:domain:primary:x_handle"] as string) ||
    (payload["preferred_username"] as string) ||
    (payload["nickname"] as string) ||
    extractXHandleFromMetadata(payload) ||
    "";

  const normalizedHandle = xHandle.replace(/^@/, "").toLowerCase();

  // ── CRITICAL: @jettoptx-only enforcement ──────────────────────────────────
  if (normalizedHandle !== ALLOWED_X_HANDLE) {
    throw new Error(
      `Access denied: only @${ALLOWED_X_HANDLE} is allowed. Got: @${normalizedHandle}`
    );
  }

  return {
    sub: payload.sub as string,
    preferred_username: (payload.preferred_username as string) || normalizedHandle,
    x_handle: normalizedHandle,
    email: payload.email as string | undefined,
    name: (payload.name as string) || (payload.given_name as string),
    exp: payload.exp as number,
    iat: payload.iat as number,
  };
}

function extractXHandleFromMetadata(
  payload: Record<string, unknown>
): string | null {
  // Zitadel may put IDP-federated username in metadata claims
  const metadata = payload["urn:zitadel:iam:user:metadata"] as
    | Record<string, string>
    | undefined;
  if (metadata?.x_handle) return metadata.x_handle;
  if (metadata?.twitter_handle) return metadata.twitter_handle;

  // Check for linked IDP username
  const idpInfo = payload["urn:zitadel:iam:user:resourceowner:idps"] as
    | Array<{ username?: string }>
    | undefined;
  if (idpInfo?.[0]?.username) return idpInfo[0].username;

  return null;
}

// ── Userinfo endpoint (fallback for handle extraction) ──────────────────────

export async function getUserinfo(
  accessToken: string
): Promise<Record<string, unknown>> {
  const res = await fetch(`${ZITADEL_ISSUER}/oidc/v1/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Userinfo fetch failed");
  return res.json();
}
