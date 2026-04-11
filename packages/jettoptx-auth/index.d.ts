import { J as JettAuthClaims } from './x-oauth-BLefWUGk.js';
export { X as XOAuthConfig, a as XOAuthTokens, b as XUserProfile, c as buildAuthorizeUrl, d as createClaims, e as exchangeCodeForTokens, f as fetchXProfile, g as generateKeyPair, h as generatePKCE, r as refreshTokens, i as revokeToken, s as signJWT, v as verifyJWT } from './x-oauth-BLefWUGk.js';

interface NonceChallenge {
    nonce: string;
    message: string;
    issuedAt: number;
    expiresAt: number;
}
interface VerifyResult {
    valid: boolean;
    walletPubkey: string;
}
declare function createNonceChallenge(walletPubkey: string): NonceChallenge;
declare function verifySignedMessage(message: string, signatureBase64: string, walletPubkeyBase58: string): VerifyResult;
declare function isNonceExpired(challenge: NonceChallenge): boolean;

interface SessionConfig {
    cookieName?: string;
    maxAge?: number;
    secure?: boolean;
    sameSite?: "strict" | "lax" | "none";
    path?: string;
    domain?: string;
}
declare function buildSessionCookie(token: string, config?: SessionConfig): string;
declare function buildClearCookie(config?: SessionConfig): string;
declare function extractToken(cookieHeader: string | null, cookieName?: string): string | null;

interface MiddlewareConfig {
    publicRoutes?: string[];
    publicKey: Uint8Array;
    cookieName?: string;
    loginRedirect?: string;
}
interface AuthResult {
    authenticated: boolean;
    claims: JettAuthClaims | null;
}
declare function isPublicRoute(pathname: string, publicRoutes?: string[]): boolean;
declare function authenticateRequest(cookieHeader: string | null, config: MiddlewareConfig): AuthResult;
/**
 * Next.js middleware helper. Import and use in your middleware.ts:
 *
 * ```ts
 * import { createAuthMiddleware } from "@jettoptx/auth";
 *
 * export default createAuthMiddleware({
 *   publicKey: decodeBase64(process.env.JWT_PUBLIC_KEY!),
 *   loginRedirect: "/login",
 * });
 * ```
 */
declare function createNextMiddlewareHandler(config: MiddlewareConfig): (request: {
    nextUrl: {
        pathname: string;
    };
    headers: {
        get(name: string): string | null;
    };
}) => {
    type: "next";
    url?: undefined;
    claims?: undefined;
} | {
    type: "redirect";
    url: string;
    claims?: undefined;
} | {
    type: "next";
    claims: JettAuthClaims | null;
    url?: undefined;
};

export { type AuthResult, JettAuthClaims, type MiddlewareConfig, type NonceChallenge, type SessionConfig, type VerifyResult, authenticateRequest, buildClearCookie, buildSessionCookie, createNextMiddlewareHandler, createNonceChallenge, extractToken, isNonceExpired, isPublicRoute, verifySignedMessage };
