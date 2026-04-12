"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Shield, CreditCard, Wallet, Mic, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StarburstBackground } from "@/components/ui/starburst-bg";
import { HeatmapText } from "@/components/ui/heatmap-text";
import { OPTXFramerMetal } from "@/components/ui/OPTXFramerMetal";
import { useSearchParams } from "next/navigation";

const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/eVq8wQgcq0m7a8x84TgA801";

export function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const detail = searchParams.get("detail");
  const [voiceOpen, setVoiceOpen] = useState(false);

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
        {/* OPTX Logo — LiquidMetal shader with silver dot */}
        <OPTXFramerMetal size="w-44 h-44" className="mb-4" />

        {/* Jett Chat — animated gradient text in Orbitron */}
        <HeatmapText text="JETT CHAT" fontSize="2.25rem" />
        <p className="text-muted-foreground text-sm font-mono mt-2">
          End-to-end encrypted messaging
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

      {/* Voice JOE — Customer Service Widget (bottom-right) */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Expanded chat bubble */}
        {voiceOpen && (
          <div className="bg-card/95 backdrop-blur-md border border-border/50 rounded-2xl shadow-2xl shadow-black/50 w-72 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-sm font-medium">Voice JOE</span>
              </div>
              <button
                onClick={() => setVoiceOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Talk to JOE — no account needed. Ask anything about OPTX, JettChat, or get help.
              </p>
              <Button
                onClick={goToVoice}
                className="w-full h-10 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-medium rounded-xl flex items-center gap-2 text-sm"
              >
                <Mic className="w-4 h-4" />
                Start Talking
              </Button>
            </div>
          </div>
        )}

        {/* FAB button */}
        <button
          onClick={() => setVoiceOpen(!voiceOpen)}
          className="group w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/30 transition-all hover:scale-105 active:scale-95"
          aria-label="Talk to Voice JOE"
        >
          {voiceOpen ? (
            <X className="w-6 h-6 text-black" />
          ) : (
            <Image
              src="/astroknotsLOGO.png"
              alt="Voice JOE"
              width={32}
              height={32}
              className="object-contain drop-shadow-sm"
              priority
            />
          )}
        </button>
      </div>
    </div>
  );
}
