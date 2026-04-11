"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// next/index.ts
var next_exports = {};
__export(next_exports, {
  AuthContext: () => AuthContext,
  AuthProvider: () => AuthProvider,
  useAuth: () => useAuth,
  useSolanaAuth: () => useSolanaAuth,
  useXOAuth: () => useXOAuth
});
module.exports = __toCommonJS(next_exports);

// next/AuthProvider.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var AuthContext = (0, import_react.createContext)({
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
  const [state, setState] = (0, import_react.useState)({
    isLoaded: false,
    isSignedIn: false,
    claims: null,
    xProfile: null,
    walletPubkey: null
  });
  const loadSession = (0, import_react.useCallback)(async () => {
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
  (0, import_react.useEffect)(() => {
    loadSession();
  }, [loadSession]);
  const signOut = (0, import_react.useCallback)(async () => {
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
  const refreshSession = (0, import_react.useCallback)(async () => {
    const res = await fetch(refreshEndpoint, {
      method: "POST",
      credentials: "include"
    });
    if (res.ok) {
      await loadSession();
    }
  }, [refreshEndpoint, loadSession]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    AuthContext.Provider,
    {
      value: { ...state, signOut, refreshSession },
      children
    }
  );
}

// next/useAuth.ts
var import_react2 = require("react");
function useAuth() {
  const ctx = (0, import_react2.useContext)(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

// next/useXOAuth.ts
var import_react3 = require("react");
function useXOAuth(opts) {
  const [isRedirecting, setIsRedirecting] = (0, import_react3.useState)(false);
  const endpoint = opts?.authEndpoint ?? "/api/auth/x";
  const initiateXLogin = (0, import_react3.useCallback)(() => {
    setIsRedirecting(true);
    window.location.href = endpoint;
  }, [endpoint]);
  return { initiateXLogin, isRedirecting };
}

// next/useSolanaAuth.ts
var import_react4 = require("react");
function useSolanaAuth(opts) {
  const [isAuthenticating, setIsAuthenticating] = (0, import_react4.useState)(false);
  const [error, setError] = (0, import_react4.useState)(null);
  const challengeEndpoint = opts?.challengeEndpoint ?? "/api/auth/wallet/challenge";
  const verifyEndpoint = opts?.verifyEndpoint ?? "/api/auth/wallet/verify";
  const connectAndSign = (0, import_react4.useCallback)(
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AuthContext,
  AuthProvider,
  useAuth,
  useSolanaAuth,
  useXOAuth
});
//# sourceMappingURL=index.js.map