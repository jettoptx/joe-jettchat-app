"use client";

import React from "react";
import { Shield, CreditCard, Wallet, Mic, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StarburstBackground } from "@/components/ui/starburst-bg";
import { HeatmapText } from "@/components/ui/heatmap-text";
import { useSearchParams } from "next/navigation";

const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/eVq8wQgcq0m7a8x84TgA801";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const detail = searchParams.get("detail");

  const handleXLogin = () => {
    window.location.href = "/api/auth/x";
  };

  const goToVoice = () => {
    window.location.href = "/voice";
  };

  const errorMessage = error
    ? error === "auth_failed"
      ? "Authentication failed. Please try again."
      : error === "server_config"
      ? "Server configuration error (check env vars)."
      : `Error: ${error}`
    : null;

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center bg-black overflow-hidden">
      <StarburstBackground />

      {/* Logo + Title — floating above the card */}
      <div className="relative z-10 flex flex-col items-center text-center mb-6">
        {/* OPTX Founder Logo — animated thermal glow */}
        <div className="w-28 h-28 mb-4 relative">
          {/* Animated gradient background clipped by logo mask */}
          <div
            className="absolute inset-0 heatmap-text"
            style={{
              WebkitMaskImage: "url(/founder-logo-mask.png)",
              maskImage: "url(/founder-logo-mask.png)",
              WebkitMaskSize: "contain",
              maskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center",
              background: "linear-gradient(135deg, #f97316, #ea580c, #fdba74, #fff7ed, #f97316, #ea580c, #fdba74)",
              backgroundSize: "300% 300%",
            }}
          />
        </div>

        {/* Jett Chat — animated gradient text in Orbitron */}
        <HeatmapText text="JETT CHAT" fontSize="2.25rem" />
        <p className="text-muted-foreground text-sm font-mono mt-2">
          End-to-end encrypted messaging
        </p>
      </div>

      {/* Voice JOE Quick Access — before login */}
      <div className="relative z-10 mb-8">
        <Button
          onClick={goToVoice}
          className="group h-14 px-10 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-semibold rounded-2xl flex items-center gap-3 shadow-xl shadow-orange-500/30 transition-all hover:scale-105"
        >
          <Mic className="w-6 h-6 group-hover:animate-pulse" />
          TALK TO VOICE JOE FIRST
          <span className="text-xs opacity-75 font-mono">(no login needed)</span>
        </Button>
        <p className="text-center text-[10px] text-muted-foreground/60 mt-2 font-mono">
          just talk • no account required
        </p>
      </div>

      {/* Error Display */}
      {errorMessage && (
        <div className="relative z-10 mb-6 max-w-sm w-full">
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-red-400 text-sm font-medium">{errorMessage}</p>
              {detail && (
                <p className="text-red-400/70 text-xs font-mono mt-1 break-all">
                  {detail}
                </p>
              )}
              <p className="text-red-400/60 text-xs mt-2">
                Check console and ensure X_CLIENT_SECRET + JWT_SIGNING_KEY are set in Vercel/env.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Login card */}
      <Card className="relative z-10 w-full max-w-sm border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="pt-6 pb-6 px-8">
          {/* Auth buttons */}
          <div className="space-y-3">
            {/* X OAuth — Primary */}
            <Button
              onClick={handleXLogin}
              className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 font-medium gap-3 rounded-xl"
            >
              Sign in with
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-mono">then</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Solana Wallet — Web3 gate */}
            <Button
              variant="outline"
              className="w-full h-12 border-primary/30 text-primary hover:bg-primary/10 font-medium gap-3 rounded-xl"
              onClick={() => {
                // Wallet connect handled by Solana adapter
              }}
            >
              <Wallet className="w-5 h-5" />
              Connect Wallet · Hold 1 JTX
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-mono">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Stripe — non-web3 fiat gate */}
            <a href={STRIPE_PAYMENT_LINK} target="_blank" rel="noopener noreferrer">
              <Button
                variant="outline"
                className="w-full h-12 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 font-medium gap-3 rounded-xl"
              >
                <CreditCard className="w-5 h-5" />
                Pay $8 — No Wallet Needed
              </Button>
            </a>

            {/* Tier upsell */}
            <div className="flex items-center justify-center gap-2 mt-1">
              <Badge variant="outline" className="text-[9px] border-primary/20 text-primary/60 font-mono">
                MOJO $8.88/mo
              </Badge>
              <Badge variant="outline" className="text-[9px] border-primary/20 text-primary/60 font-mono">
                DOJO $28.88/6mo
              </Badge>
              <Badge variant="outline" className="text-[9px] border-purple-500/20 text-purple-400/60 font-mono">
                SPACE COWBOY $88.88
              </Badge>
            </div>
          </div>

          {/* E2E badge */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <Shield className="w-3.5 h-3.5 text-primary/50" />
            <span className="text-[10px] text-muted-foreground font-mono">
              TKDF hybrid encryption · Post-quantum resistant
            </span>
          </div>

          {/* Footer */}
          <p className="mt-4 text-center text-muted-foreground/60 text-[10px] font-mono">
            Powered by OPTX · jettoptx.chat
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
