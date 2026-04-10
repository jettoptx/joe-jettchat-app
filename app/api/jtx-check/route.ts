import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// JTX Token mint on Solana mainnet
const JTX_MINT = "9XpJiKEYzq5yDo5pJzRfjSRMPL2yPfDQXgiN7uYtBhUj";
const FOUNDER_WALLET = "FEUwuvXbbSYTCEhhqgAt2viTsEnromNNDsapoFvyfy3H";

// Helius RPC — mainnet for real JTX balance checks
const HELIUS_RPC =
  process.env.HELIUS_MAINNET_RPC ??
  "https://mainnet.helius-rpc.com/?api-key=98ca6456-20a8-4518-8393-1b9ee6c2b7f3";

interface TokenAccount {
  mint: string;
  amount: string;
  decimals: number;
}

/**
 * GET /api/jtx-check?wallet=<pubkey>
 *
 * Returns the caller's JTX balance and derived tier.
 * Used by middleware gate + client-side tier display.
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json(
      { error: "wallet query param required" },
      { status: 400 }
    );
  }

  // Founder wallet — automatic max tier
  if (wallet === FOUNDER_WALLET) {
    return NextResponse.json({
      wallet,
      balance: 999999,
      tier: "spaceCowboy",
      allowed: true,
    });
  }

  try {
    // Use Helius DAS getTokenAccountsByOwner for reliability
    const rpcBody = {
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [
        wallet,
        { mint: JTX_MINT },
        { encoding: "jsonParsed" },
      ],
    };

    const res = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rpcBody),
    });

    if (!res.ok) {
      console.error("[jtx-check] RPC error:", res.status);
      return NextResponse.json(
        { error: "RPC request failed", balance: 0, tier: "none", allowed: false },
        { status: 502 }
      );
    }

    const data = await res.json();
    const accounts = data?.result?.value ?? [];

    let rawBalance = 0;
    let decimals = 6; // JTX uses 6 decimals

    if (accounts.length > 0) {
      const parsed = accounts[0]?.account?.data?.parsed?.info;
      if (parsed) {
        rawBalance = Number(parsed.tokenAmount?.amount ?? 0);
        decimals = parsed.tokenAmount?.decimals ?? 6;
      }
    }

    const balance = rawBalance / Math.pow(10, decimals);

    // Derive tier
    let tier: string = "none";
    if (balance >= 1111) tier = "spaceCowboy";
    else if (balance >= 444) tier = "dojo";
    else if (balance >= 12) tier = "mojo";
    else if (balance >= 1) tier = "basic";

    return NextResponse.json({
      wallet,
      balance,
      tier,
      allowed: balance >= 1,
    });
  } catch (err) {
    console.error("[jtx-check] Error:", err);
    return NextResponse.json(
      { error: "Failed to check JTX balance", balance: 0, tier: "none", allowed: false },
      { status: 500 }
    );
  }
}
