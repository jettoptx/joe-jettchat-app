import * as react_jsx_runtime from 'react/jsx-runtime';
import React from 'react';
import { J as JettAuthClaims, b as XUserProfile } from '../x-oauth-BLefWUGk.mjs';

interface AuthState {
    isLoaded: boolean;
    isSignedIn: boolean;
    claims: JettAuthClaims | null;
    xProfile: XUserProfile | null;
    walletPubkey: string | null;
}
interface AuthContextValue extends AuthState {
    signOut: () => Promise<void>;
    refreshSession: () => Promise<void>;
}
declare const AuthContext: React.Context<AuthContextValue>;
interface AuthProviderProps {
    children: React.ReactNode;
    sessionEndpoint?: string;
    signOutEndpoint?: string;
    refreshEndpoint?: string;
}
declare function AuthProvider({ children, sessionEndpoint, signOutEndpoint, refreshEndpoint, }: AuthProviderProps): react_jsx_runtime.JSX.Element;

declare function useAuth(): AuthContextValue;

interface UseXOAuthOptions {
    authEndpoint?: string;
}
interface UseXOAuthReturn {
    initiateXLogin: () => void;
    isRedirecting: boolean;
}
declare function useXOAuth(opts?: UseXOAuthOptions): UseXOAuthReturn;

interface UseSolanaAuthOptions {
    challengeEndpoint?: string;
    verifyEndpoint?: string;
}
interface UseSolanaAuthReturn {
    connectAndSign: (signMessage: (message: Uint8Array) => Promise<Uint8Array>, publicKeyBase58: string) => Promise<boolean>;
    isAuthenticating: boolean;
    error: string | null;
}
declare function useSolanaAuth(opts?: UseSolanaAuthOptions): UseSolanaAuthReturn;

export { AuthContext, type AuthContextValue, AuthProvider, type AuthState, useAuth, useSolanaAuth, useXOAuth };
