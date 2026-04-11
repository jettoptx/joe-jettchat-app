interface JettAuthClaims {
    iss: string;
    sub: string;
    aud: string;
    exp: number;
    iat: number;
    x_id?: string;
    x_handle?: string;
    x_verified?: boolean;
    wallets: string[];
    auth_methods: ("x_oauth" | "solana_sign")[];
}
declare function signJWT(claims: JettAuthClaims, privateKey: Uint8Array): string;
declare function verifyJWT(token: string, publicKey: Uint8Array): JettAuthClaims;
declare function generateKeyPair(): {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
};
declare function createClaims(opts: {
    walletPubkey: string;
    wallets?: string[];
    xId?: string;
    xHandle?: string;
    xVerified?: boolean;
    authMethods: ("x_oauth" | "solana_sign")[];
    expiresInSeconds?: number;
}): JettAuthClaims;

interface XOAuthConfig {
    clientId: string;
    clientSecret?: string;
    redirectUri: string;
    scopes?: string[];
}
interface XOAuthTokens {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
}
interface XUserProfile {
    id: string;
    name: string;
    username: string;
    profile_image_url?: string;
    verified?: boolean;
}
interface PKCEPair {
    codeVerifier: string;
    codeChallenge: string;
    state: string;
}
declare function generatePKCE(): PKCEPair;
declare function buildAuthorizeUrl(config: XOAuthConfig, pkce: PKCEPair): string;
declare function exchangeCodeForTokens(config: XOAuthConfig, code: string, codeVerifier: string): Promise<XOAuthTokens>;
declare function refreshTokens(config: XOAuthConfig, refreshToken: string): Promise<XOAuthTokens>;
declare function revokeToken(config: XOAuthConfig, token: string, tokenType?: "access_token" | "refresh_token"): Promise<void>;
declare function fetchXProfile(accessToken: string): Promise<XUserProfile>;

export { type JettAuthClaims as J, type XOAuthConfig as X, type XOAuthTokens as a, type XUserProfile as b, buildAuthorizeUrl as c, createClaims as d, exchangeCodeForTokens as e, fetchXProfile as f, generateKeyPair as g, generatePKCE as h, revokeToken as i, refreshTokens as r, signJWT as s, verifyJWT as v };
