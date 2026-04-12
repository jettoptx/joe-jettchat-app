"use client";

import React, { useState } from "react";
import { Shield, CreditCard, Wallet, Mic, AlertCircle, X, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StarburstBackground } from "@/components/ui/starburst-bg";
import { HeatmapText } from "@/components/ui/heatmap-text";
import { ConvexUserSync } from "@/components/ConvexUserSync";
import { useSearchParams } from "next/navigation";

// This page must be dynamic because it uses useSearchParams + ConvexUserSync
export const dynamic = 'force-dynamic';

const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/eVq8wQgcq0m7a8x84TgA801";

export default function LoginPage() {
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
        {/* OPTX Logo — animated Framer Heatmap thermal gradient */}
        <div className="w-32 h-32 mb-4 relative">
          <div
            className="absolute inset-0 heatmap-logo"
            style={{
              WebkitMaskImage: "url(/optx-logo-mask.png)",
              maskImage: "url(/optx-logo-mask.png)",
              WebkitMaskSize: "contain",
              maskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center",
              background: "linear-gradient(135deg, #11206a, #1f3ba2, #2f63e7, #6bd7ff, #ffe679, #ff991e, #ff4c00, #ff991e, #6bd7ff, #2f63e7, #1f3ba2, #11206a)",
              backgroundSize: "400% 400%",
            }}
          />
          {/* Glow effect behind logo */}
          <div
            className="absolute inset-[-20%] heatmap-logo blur-xl opacity-40"
            style={{
              WebkitMaskImage: "url(/optx-logo-mask.png)",
              maskImage: "url(/optx-logo-mask.png)",
              WebkitMaskSize: "contain",
              maskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center",
              background: "linear-gradient(135deg, #2f63e7, #6bd7ff, #ffe679, #ff991e, #ff4c00, #ff991e, #6bd7ff, #2f63e7)",
              backgroundSize: "400% 400%",
            }}
          />
        </div>

        {/* Jett Chat — animated gradient text in Orbitron */}
        <HeatmapText text="JETT CHAT" fontSize="2.25rem" />
        <p className="text-muted-foreground text-sm font-mono mt-2">
          End-to-end encrypted messaging powered by OPTX gaze biometrics
        </p>
      </div>

      <Card className="relative z-10 w-full max-w-md bg-zinc-900/90 border-zinc-800 backdrop-blur-xl">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 text-xs font-mono px-3 py-1 rounded-full mb-4">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              VOICE JOE IS PUBLIC
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome</h1>
            <p className="text-zinc-400">Talk to Voice JOE before you login</p>
          </div>

          <div className="space-y-4">
            <Button
              onClick={goToVoice}
              className="w-full h-14 text-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium flex items-center justify-center gap-3 group"
            >
              <Mic className="w-5 h-5 group-hover:scale-110 transition-transform" />
              TALK TO VOICE JOE FIRST (NO LOGIN)
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-700"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-widest text-zinc-500 font-mono">
                or continue with
              </div>
            </div>

            <Button
              onClick={handleXLogin}
              variant="outline"
              className="w-full h-12 border-zinc-700 hover:bg-zinc-800 text-white flex items-center justify-center gap-3"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25l-.01.004-.009.004L12 9.75 5.775 2.258l-.01-.004-.009-.004C5.52 2.107 5.26 2 5 2 3.9 2 3 2.9 3 4v16c0 1.1.9 2 2 2 1.1 0 2-.9 2-2v-.75L12 14.25 19 21.75V22c0 1.1.9 2 2 2 1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
              </svg>
              Sign in with X
            </Button>

            {errorMessage && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>{errorMessage}</div>
              </div>
            )}
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-zinc-500 font-mono">
              Voice JOE uses local astro-joe-0.5-dojo • No account required for voice mode
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Silent Convex sync after X login */}
      <ConvexUserSync />
    </div>
  );
}
