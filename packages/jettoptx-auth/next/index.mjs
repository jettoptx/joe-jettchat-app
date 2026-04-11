// next/AuthProvider.tsx
import { createContext, useCallback, useEffect, useState } from "react";
import { jsx } from "react/jsx-runtime";
var AuthContext = createContext({
  isLoaded: false,
  isSignedIn: false,
  claims: null,
  xProfile: null,
  walletPubkey: null,
  signOut: async () => {
  },
  refreshSession: async () => {
  }
});
function AuthProvider({
  children,
  sessionEndpoint = "/api/auth/session",
  signOutEndpoint = "/api/auth/signout",
  refreshEndpoint = "/api/auth/refresh"
}) {
  const [state, setState] = useState({
    isLoaded: false,
    isSignedIn: false,
    claims: null,
    xProfile: null,
    walletPubkey: null
  });
  const loadSession = useCallback(async () => {
    try {
      const res = await fetch(sessionEndpoint, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setState({
          isLoaded: true,
          isSignedIn: true,
          claims: data.claims,
          xProfile: data.xProfile ?? null,
          walletPubkey: data.claims?.sub?.replace("sol:", "") ?? null
        });
      } else {
        setState((prev) => ({ ...prev, isLoaded: true, isSignedIn: false }));
      }
    } catch {
      setState((prev) => ({ ...prev, isLoaded: true, isSignedIn: false }));
    }
  }, [sessionEndpoint]);
  useEffect(() => {
    loadSession();
  }, [loadSession]);
  const signOut = useCallback(async () => {
    await fetch(signOutEndpoint, {
      method: "POST",
      credentials: "include"
    });
    setState({
      isLoaded: true,
      isSignedIn: false,
      claims: null,
      xProfile: null,
      walletPubkey: null
    });
  }, [signOutEndpoint]);
  const refreshSession = useCallback(async () => {
    const res = await fetch(refreshEndpoint, {
      method: "POST",
      credentials: "include"
    });
    if (res.ok) {
      await loadSession();
    }
  }, [refreshEndpoint, loadSession]);
  return /* @__PURE__ */ jsx(
    AuthContext.Provider,
    {
      value: { ...state, signOut, refreshSession },
      children
    }
  );
}

// next/useAuth.ts
import { useContext } from "react";
function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

// next/useXOAuth.ts
import { useCallback as useCallback2, useState as useState2 } from "react";
function useXOAuth(opts) {
  const [isRedirecting, setIsRedirecting] = useState2(false);
  const endpoint = opts?.authEndpoint ?? "/api/auth/x";
  const initiateXLogin = useCallback2(() => {
    setIsRedirecting(true);
    window.location.href = endpoint;
  }, [endpoint]);
  return { initiateXLogin, isRedirecting };
}

// next/useSolanaAuth.ts
import { useCallback as useCallback3, useState as useState3 } from "react";
function useSolanaAuth(opts) {
  const [isAuthenticating, setIsAuthenticating] = useState3(false);
  const [error, setError] = useState3(null);
  const challengeEndpoint = opts?.challengeEndpoint ?? "/api/auth/wallet/challenge";
  const verifyEndpoint = opts?.verifyEndpoint ?? "/api/auth/wallet/verify";
  const connectAndSign = useCallback3(
    async (signMessage, publicKeyBase58) => {
      setIsAuthenticating(true);
      setError(null);
      try {
        const challengeRes = await fetch(
          `${challengeEndpoint}?pubkey=${publicKeyBase58}`
        );
        if (!challengeRes.ok) {
          throw new Error("Failed to get challenge");
        }
        const { message, nonce } = await challengeRes.json();
        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = await signMessage(messageBytes);
        const verifyRes = await fetch(verifyEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            message,
            signature: uint8ArrayToBase64(signatureBytes),
            publicKey: publicKeyBase58,
            nonce
          })
        });
        if (!verifyRes.ok) {
          const err = await verifyRes.json();
          throw new Error(err.error ?? "Verification failed");
        }
        setIsAuthenticating(false);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Authentication failed");
        setIsAuthenticating(false);
        return false;
      }
    },
    [challengeEndpoint, verifyEndpoint]
  );
  return { connectAndSign, isAuthenticating, error };
}
function uint8ArrayToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
export {
  AuthContext,
  AuthProvider,
  useAuth,
  useSolanaAuth,
  useXOAuth
};
//# sourceMappingURL=index.mjs.map