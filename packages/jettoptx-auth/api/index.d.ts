import { X as XOAuthConfig, a as XOAuthTokens, J as JettAuthClaims } from '../x-oauth-BLefWUGk.js';

declare function createXAuthHandler(config: XOAuthConfig): () => Promise<Response>;
declare function getPKCEVerifier(state: string): string | null;

interface XCallbackResult {
    tokens: XOAuthTokens;
    claims: JettAuthClaims;
    jwt: string;
    cookie: string;
}
declare function createXCallbackHandler(config: XOAuthConfig, jwtPrivateKey: Uint8Array, opts?: {
    onTokens?: (walletPubkey: string | null, tokens: XOAuthTokens) => Promise<void>;
}): (request: Request) => Promise<Response>;

declare function createWalletChallengeHandler(): (request: Request) => Promise<Response>;
declare function createWalletVerifyHandler(jwtPrivateKey: Uint8Array, jwtPublicKey: Uint8Array): (request: Request) => Promise<Response>;

declare function createRefreshHandler(jwtPrivateKey: Uint8Array, jwtPublicKey: Uint8Array): (request: Request) => Promise<Response>;

export { type XCallbackResult, createRefreshHandler, createWalletChallengeHandler, createWalletVerifyHandler, createXAuthHandler, createXCallbackHandler, getPKCEVerifier };
