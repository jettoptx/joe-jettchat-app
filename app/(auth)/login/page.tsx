"use client";

import React from "react";
import { useXOAuth } from "@jettoptx/auth/next";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useSolanaAuth } from "@jettoptx/auth/next";

export default function LoginPage() {
  const { initiateXLogin, isRedirecting } = useXOAuth();
  const { publicKey, signMessage, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { connectAndSign, isAuthenticating, error } = useSolanaAuth();

  const handleWalletAuth = async () => {
    if (!connected) {
      setVisible(true);
      return;
    }
    if (publicKey && signMessage) {
      await connectAndSign(signMessage, publicKey.toBase58());
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="w-full max-w-sm px-6">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl font-bold text-accent mb-2">
            JettChat
          </h1>
          <p className="text-text-secondary text-sm">
            Sign in to start chatting
          </p>
        </div>

        {/* Auth buttons */}
        <div className="space-y-3">
          <button
            onClick={initiateXLogin}
            disabled={isRedirecting}
            className="w-full flex items-center justify-center gap-3 bg-card border border-border rounded-xl px-4 py-3 text-text-primary hover:bg-card/80 transition-colors disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            {isRedirecting ? "Redirecting..." : "Verify with X"}
          </button>

          <button
            onClick={handleWalletAuth}
            disabled={isAuthenticating}
            className="w-full flex items-center justify-center gap-3 bg-accent text-background rounded-xl px-4 py-3 font-medium hover:bg-accent-muted transition-colors disabled:opacity-50"
          >
            {isAuthenticating
              ? "Signing..."
              : connected
              ? "Sign Message"
              : "Connect Wallet"}
          </button>
        </div>

        {error && (
          <p className="mt-4 text-red-400 text-sm text-center">{error}</p>
        )}

        <p className="mt-8 text-center text-text-muted text-xs">
          No account needed. Verify via X or connect a Solana wallet.
        </p>
      </div>
    </div>
  );
}
