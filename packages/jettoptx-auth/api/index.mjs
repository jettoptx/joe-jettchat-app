var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/jwt.ts
var jwt_exports = {};
__export(jwt_exports, {
  createClaims: () => createClaims,
  generateKeyPair: () => generateKeyPair,
  signJWT: () => signJWT,
  verifyJWT: () => verifyJWT
});
import nacl from "tweetnacl";
import { decodeBase64, encodeBase64 } from "tweetnacl-util";
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
var HEADER;
var init_jwt = __esm({
  "src/jwt.ts"() {
    "use strict";
    HEADER = { alg: "EdDSA", typ: "JWT" };
  }
});

// src/x-oauth.ts
import { randomBytes, createHash } from "crypto";
var X_AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
var X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
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

// api/x-auth.ts
var pkceStore = /* @__PURE__ */ new Map();
function createXAuthHandler(config) {
  return async () => {
    const pkce = generatePKCE();
    pkceStore.set(pkce.state, {
      codeVerifier: pkce.codeVerifier,
      expiresAt: Date.now() + 3e5
    });
    for (const [key, val] of pkceStore) {
      if (val.expiresAt < Date.now()) pkceStore.delete(key);
    }
    const url = buildAuthorizeUrl(config, pkce);
    return Response.redirect(url);
  };
}
function getPKCEVerifier(state) {
  const entry = pkceStore.get(state);
  if (!entry || entry.expiresAt < Date.now()) {
    pkceStore.delete(state);
    return null;
  }
  pkceStore.delete(state);
  return entry.codeVerifier;
}

// api/x-callback.ts
init_jwt();

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
function extractToken(cookieHeader, cookieName) {
  if (!cookieHeader) return null;
  const name = cookieName ?? DEFAULT_CONFIG.cookieName;
  const match = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

// api/x-callback.ts
function createXCallbackHandler(config, jwtPrivateKey, opts) {
  return async (request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) {
      return Response.json(
        { error: "Missing code or state" },
        { status: 400 }
      );
    }
    const codeVerifier = getPKCEVerifier(state);
    if (!codeVerifier) {
      return Response.json(
        { error: "Invalid or expired state" },
        { status: 400 }
      );
    }
    const tokens = await exchangeCodeForTokens(config, code, codeVerifier);
    const xProfile = await fetchXProfile(tokens.access_token);
    const claims = createClaims({
      walletPubkey: "pending",
      // No wallet yet — X-only auth
      wallets: [],
      xId: xProfile.id,
      xHandle: xProfile.username,
      xVerified: xProfile.verified,
      authMethods: ["x_oauth"]
    });
    const jwt = signJWT(claims, jwtPrivateKey);
    const cookie = buildSessionCookie(jwt);
    if (opts?.onTokens) {
      await opts.onTokens(null, tokens);
    }
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/?x_connected=true",
        "Set-Cookie": cookie
      }
    });
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

// api/wallet-verify.ts
init_jwt();
var nonceStore = /* @__PURE__ */ new Map();
function createWalletChallengeHandler() {
  return async (request) => {
    const url = new URL(request.url);
    const pubkey = url.searchParams.get("pubkey");
    if (!pubkey) {
      return Response.json({ error: "Missing pubkey" }, { status: 400 });
    }
    const challenge = createNonceChallenge(pubkey);
    nonceStore.set(challenge.nonce, challenge);
    for (const [key, val] of nonceStore) {
      if (isNonceExpired(val)) nonceStore.delete(key);
    }
    return Response.json({
      message: challenge.message,
      nonce: challenge.nonce
    });
  };
}
function createWalletVerifyHandler(jwtPrivateKey, jwtPublicKey) {
  return async (request) => {
    const body = await request.json();
    const { message, signature, publicKey, nonce } = body;
    if (!message || !signature || !publicKey || !nonce) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    const challenge = nonceStore.get(nonce);
    if (!challenge) {
      return Response.json(
        { error: "Invalid or expired nonce" },
        { status: 400 }
      );
    }
    if (isNonceExpired(challenge)) {
      nonceStore.delete(nonce);
      return Response.json({ error: "Nonce expired" }, { status: 400 });
    }
    nonceStore.delete(nonce);
    const result = verifySignedMessage(message, signature, publicKey);
    if (!result.valid) {
      return Response.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }
    const cookieHeader = request.headers.get("cookie");
    const existingToken = extractToken(cookieHeader);
    let existingClaims = null;
    if (existingToken) {
      try {
        existingClaims = verifyJWT(existingToken, jwtPublicKey);
      } catch {
      }
    }
    const claims = createClaims({
      walletPubkey: publicKey,
      wallets: [publicKey],
      xId: existingClaims?.x_id,
      xHandle: existingClaims?.x_handle,
      xVerified: existingClaims?.x_verified,
      authMethods: existingClaims?.x_id ? ["x_oauth", "solana_sign"] : ["solana_sign"]
    });
    const jwt = signJWT(claims, jwtPrivateKey);
    const cookie = buildSessionCookie(jwt);
    return new Response(
      JSON.stringify({ success: true, claims }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": cookie
        }
      }
    );
  };
}

// api/refresh.ts
init_jwt();
function createRefreshHandler(jwtPrivateKey, jwtPublicKey) {
  return async (request) => {
    const cookieHeader = request.headers.get("cookie");
    const token = extractToken(cookieHeader);
    if (!token) {
      return Response.json({ error: "No session" }, { status: 401 });
    }
    let claims;
    try {
      claims = verifyJWTIgnoreExpiry(token, jwtPublicKey);
    } catch {
      return Response.json({ error: "Invalid session" }, { status: 401 });
    }
    const now = Math.floor(Date.now() / 1e3);
    const refreshedClaims = {
      ...claims,
      iat: now,
      exp: now + 86400
      // 24h
    };
    const jwt = signJWT(refreshedClaims, jwtPrivateKey);
    const cookie = buildSessionCookie(jwt);
    return new Response(
      JSON.stringify({ success: true, claims: refreshedClaims }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": cookie
        }
      }
    );
  };
}
function verifyJWTIgnoreExpiry(token, publicKey) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT");
  const payloadJson = JSON.parse(
    Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
  );
  const originalExp = payloadJson.exp;
  payloadJson.exp = Math.floor(Date.now() / 1e3) + 3600;
  const { verifyJWT: verify } = (init_jwt(), __toCommonJS(jwt_exports));
  try {
    return verify(token, publicKey);
  } catch (e) {
    if (e.message === "JWT expired") {
      return { ...payloadJson, exp: originalExp };
    }
    throw e;
  }
}
export {
  createRefreshHandler,
  createWalletChallengeHandler,
  createWalletVerifyHandler,
  createXAuthHandler,
  createXCallbackHandler,
  getPKCEVerifier
};
//# sourceMappingURL=index.mjs.map