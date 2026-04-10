"use client";

import React from "react";
import { ConvexProvider } from "convex/react";
import { AuthProvider } from "@jettoptx/auth/next";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { clusterApiUrl } from "@solana/web3.js";
import { convex } from "@/lib/convex";

import "@solana/wallet-adapter-react-ui/styles.css";

const wallets = [new PhantomWalletAdapter()];

function getRpcEndpoint(): string {
  if (process.env.NEXT_PUBLIC_HELIUS_RPC_URL) {
    return process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
  }
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";
  return clusterApiUrl(network as "devnet" | "mainnet-beta");
}

export function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = getRpcEndpoint();

  return (
    <ConvexProvider client={convex}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <AuthProvider>{children}</AuthProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </ConvexProvider>
  );
}
