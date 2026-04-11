// src/jwt.ts
import nacl from "tweetnacl";
import { decodeBase64, encodeBase64 } from "tweetnacl-util";
var HEADER = { alg: "EdDSA", typ: "JWT" };
function base64UrlEncode(data) {
  const str = typeof data === "string" ? data : encodeBase64(data);
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64UrlDecode(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return decodeBase64(padded + "=".repeat((4 - padded.length % 4) % 4));
}
function encodeJSON(obj) {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)));
}
function decodeJSON(encoded) {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(encoded)));
}
function signJWT(claims, privateKey) {
  const header = encodeJSON(HEADER);
  const payload = encodeJSON(claims);
  const message = new TextEncoder().encode(`${header}.${payload}`);
  const signature = nacl.sign.detached(message, privateKey);
  return `${header}.${payload}.${base64UrlEncode(signature)}`;
}
function verifyJWT(token, publicKey) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const [header, payload, sig] = parts;
  const message = new TextEncoder().encode(`${header}.${payload}`);
  const signature = base64UrlDecode(sig);
  if (!nacl.sign.detached.verify(message, signature, publicKey)) {
    throw new Error("Invalid JWT signature");
  }
  const decoded = decodeJSON(header);
  if (decoded.alg !== "EdDSA") throw new Error(`Unsupported alg: ${decoded.alg}`);
  const claims = decodeJSON(payload);
  if (claims.exp && claims.exp < Math.floor(Date.now() / 1e3)) {
    throw new Error("JWT expired");
  }
  return claims;
}
function generateKeyPair() {
  const kp = nacl.sign.keyPair();
  return { publicKey: kp.publicKey, privateKey: kp.secretKey };
}
function createClaims(opts) {
  const now = Math.floor(Date.now() / 1e3);
  return {
    iss: "https://jettoptics.ai",
    sub: `sol:${opts.walletPubkey}`,
    aud: "jettchat",
    iat: now,
    exp: now + (opts.expiresInSeconds ?? 86400),
    // default 24h
    x_id: opts.xId,
    x_handle: opts.xHandle,
    x_verified: opts.xVerified,
    wallets: opts.wallets ?? [opts.walletPubkey],
    auth_methods: opts.authMethods
  };
}

// src/solana-auth.ts
import nacl2 from "tweetnacl";
import { decodeBase64 as decodeBase642 } from "tweetnacl-util";
var NONCE_TTL_SECONDS = 300;
function createNonceChallenge(walletPubkey) {
  const nonce = Array.from(nacl2.randomBytes(32)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const issuedAt = Math.floor(Date.now() / 1e3);
  const expiresAt = issuedAt + NONCE_TTL_SECONDS;
  const message = [
    "JettChat Authentication",
    "",
    `Wallet: ${walletPubkey}`,
    `Nonce: ${nonce}`,
    `Issued: ${new Date(issuedAt * 1e3).toISOString()}`,
    "",
    "Sign this message to verify wallet ownership.",
    "This will not trigger a blockchain transaction."
  ].join("\n");
  return { nonce, message, issuedAt, expiresAt };
}
function verifySignedMessage(message, signatureBase64, walletPubkeyBase58) {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = decodeBase642(signatureBase64);
    const pubkeyBytes = base58Decode(walletPubkeyBase58);
    const valid = nacl2.sign.detached.verify(
      messageBytes,
      signatureBytes,
      pubkeyBytes
    );
    return { valid, walletPubkey: walletPubkeyBase58 };
  } catch {
    return { valid: false, walletPubkey: walletPubkeyBase58 };
  }
}
function isNonceExpired(challenge) {
  return Math.floor(Date.now() / 1e3) > challenge.expiresAt;
}
var BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Decode(str) {
  const bytes = [0];
  for (const char of str) {
    const idx = BASE58_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid Base58 character: ${char}`);
    let carry = idx;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 255;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 255);
      carry >>= 8;
    }
  }
  for (const char of str) {
    if (char !== "1") break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

// src/x-oauth.ts
import { randomBytes, createHash } from "crypto";
var X_AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
var X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
var X_REVOKE_URL = "https://api.x.com/2/oauth2/revoke";
var X_USERS_ME_URL = "https://api.x.com/2/users/me";
var DEFAULT_SCOPES = [
  "tweet.read",
  "users.read",
  "follows.read",
  "dm.read",
  "dm.write",
  "offline.access"
];
function generatePKCE() {
  const codeVerifier = randomBytes(64).toString("base64url").slice(0, 128);
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const state = randomBytes(32).toString("hex");
  return { codeVerifier, codeChallenge, state };
}
function buildAuthorizeUrl(config, pkce) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: (config.scopes ?? DEFAULT_SCOPES).join(" "),
    state: pkce.state,
    code_challenge: pkce.codeChallenge,
    code_challenge_method: "S256"
  });
  return `${X_AUTHORIZE_URL}?${params.toString()}`;
}
async function exchangeCodeForTokens(config, code, codeVerifier) {
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier
  });
  const headers = {
    "Content-Type": "application/x-www-form-urlencoded"
  };
  if (config.clientSecret) {
    const credentials = Buffer.from(
      `${config.clientId}:${config.clientSecret}`
    ).toString("base64");
    headers["Authorization"] = `Basic ${credentials}`;
  }
  const res = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers,
    body: body.toString()
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`X token exchange failed (${res.status}): ${err}`);
  }
  return res.json();
}
async function refreshTokens(config, refreshToken) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId
  });
  const headers = {
    "Content-Type": "application/x-www-form-urlencoded"
  };
  if (config.clientSecret) {
    const credentials = Buffer.from(
      `${config.clientId}:${config.clientSecret}`
    ).toString("base64");
    headers["Authorization"] = `Basic ${credentials}`;
  }
  const res = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers,
    body: body.toString()
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`X token refresh failed (${res.status}): ${err}`);
  }
  return res.json();
}
async function revokeToken(config, token, tokenType = "access_token") {
  const body = new URLSearchParams({
    token,
    token_type_hint: tokenType,
    client_id: config.clientId
  });
  await fetch(X_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
}
async function fetchXProfile(accessToken) {
  const res = await fetch(
    `${X_USERS_ME_URL}?user.fields=id,name,username,profile_image_url,verified`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch X profile (${res.status})`);
  }
  const json = await res.json();
  return json.data;
}

// src/session.ts
var DEFAULT_CONFIG = {
  cookieName: "jettauth",
  maxAge: 86400,
  // 24h
  secure: true,
  sameSite: "lax",
  path: "/",
  domain: ""
};
function buildSessionCookie(token, config) {
  const c = { ...DEFAULT_CONFIG, ...config };
  const parts = [`${c.cookieName}=${token}`, `Path=${c.path}`, `Max-Age=${c.maxAge}`];
  if (c.secure) parts.push("Secure");
  parts.push("HttpOnly");
  parts.push(`SameSite=${c.sameSite}`);
  if (c.domain) parts.push(`Domain=${c.domain}`);
  return parts.join("; ");
}
function buildClearCookie(config) {
  const c = { ...DEFAULT_CONFIG, ...config };
  return `${c.cookieName}=; Path=${c.path}; Max-Age=0; HttpOnly`;
}
function extractToken(cookieHeader, cookieName) {
  if (!cookieHeader) return null;
  const name = cookieName ?? DEFAULT_CONFIG.cookieName;
  const match = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

// src/middleware.ts
var DEFAULT_PUBLIC_ROUTES = [
  "/",
  "/login",
  "/callback/x",
  "/callback/wallet",
  "/api/auth/x",
  "/api/auth/x/callback",
  "/api/auth/wallet/verify",
  "/api/auth/refresh",
  "/pricing"
];
function isPublicRoute(pathname, publicRoutes) {
  const routes = publicRoutes ?? DEFAULT_PUBLIC_ROUTES;
  return routes.some((route) => {
    if (route.endsWith("*")) {
      return pathname.startsWith(route.slice(0, -1));
    }
    return pathname === route;
  });
}
function authenticateRequest(cookieHeader, config) {
  const token = extractToken(cookieHeader, config.cookieName);
  if (!token) return { authenticated: false, claims: null };
  try {
    const claims = verifyJWT(token, config.publicKey);
    return { authenticated: true, claims };
  } catch {
    return { authenticated: false, claims: null };
  }
}
function createNextMiddlewareHandler(config) {
  return (request) => {
    const { pathname } = request.nextUrl;
    if (isPublicRoute(pathname, config.publicRoutes)) {
      return { type: "next" };
    }
    const cookieHeader = request.headers.get("cookie");
    const auth = authenticateRequest(cookieHeader, config);
    if (!auth.authenticated) {
      return {
        type: "redirect",
        url: config.loginRedirect ?? "/login"
      };
    }
    return { type: "next", claims: auth.claims };
  };
}
export {
  authenticateRequest,
  buildAuthorizeUrl,
  buildClearCookie,
  buildSessionCookie,
  createClaims,
  createNextMiddlewareHandler,
  createNonceChallenge,
  exchangeCodeForTokens,
  extractToken,
  fetchXProfile,
  generateKeyPair,
  generatePKCE,
  isNonceExpired,
  isPublicRoute,
  refreshTokens,
  revokeToken,
  signJWT,
  verifyJWT,
  verifySignedMessage
};
//# sourceMappingURL=index.mjs.map